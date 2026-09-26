/*
 * عامل الخدمة: يخزّن هيكل التطبيق وبيانات المصحف وخطوط الصفحات
 * ليعمل المصحف كاملاً دون إنترنت بعد أول زيارة.
 * ملفات التلاوة لا تُخزَّن — حجمها كبير وتُبثّ من الشبكة.
 */
const VERSION = 'mushaf-v9'
const SHELL = `${VERSION}-shell`
const DATA = `${VERSION}-data`
const FONTS = `${VERSION}-fonts`

/** الأصول الثابتة المعروفة مسبقاً */
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './logo-mark.png',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/favicon-64.png',
]

/** أدنى ما يلزم لفتح المصحف دون شبكة */
const CORE_DATA = [
  './data/index.json',
  './data/surahs.json',
  './data/pages/chunk-00.json',
  './data/tafsir/index.json',
  './data/tafsir/juz-01.json',
  './data/timings/ayah-shape.json',
  './data/adhkar.json',
  './data/hadith.json',
  './data/cities.json',
]

async function addAllSafely(cacheName, urls) {
  const cache = await caches.open(cacheName)
  await Promise.all(
    urls.map(async (url) => {
      try {
        const response = await fetch(url, { cache: 'reload' })
        if (response.ok) await cache.put(url, response)
      } catch {
        /* أصل غير متاح الآن — يُخزَّن عند أول استعمال */
      }
    }),
  )
}

/** ملفات البناء أسماؤها مبصومة، فتُستخرج من index.html */
async function cacheHashedAssets() {
  try {
    const response = await fetch('./index.html', { cache: 'reload' })
    if (!response.ok) return
    const html = await response.clone().text()
    const cache = await caches.open(SHELL)
    await cache.put('./index.html', response)
    const urls = [...html.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((m) => m[1])
    await addAllSafely(SHELL, urls)
  } catch {
    /* لا شبكة الآن */
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    Promise.all([addAllSafely(SHELL, SHELL_ASSETS), addAllSafely(DATA, CORE_DATA)]).then(() =>
      self.skipWaiting(),
    ),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key))),
      )
      .then(() => cacheHashedAssets())
      .then(() => self.clients.claim()),
  )
})

/** المخزون أولاً: مناسب للبيانات والخطوط التي لا تتغيّر */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  const hit = await cache.match(request, { ignoreVary: true })
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') void cache.put(request, response.clone())
  return response
}

/** الشبكة أولاً مع رجوع إلى المخزون: مناسب لهيكل التطبيق */
async function networkFirst(request, cacheName) {
  const cache = await caches.open(cacheName)
  try {
    const response = await fetch(request)
    if (response.ok) void cache.put(request, response.clone())
    return response
  } catch (err) {
    const hit = await cache.match(request, { ignoreVary: true })
    if (hit) return hit
    if (request.mode === 'navigate') {
      const shell =
        (await cache.match('./index.html', { ignoreVary: true })) ??
        (await cache.match('./', { ignoreVary: true }))
      if (shell) return shell
    }
    throw err
  }
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)

  // خطوط الصفحات المحزومة مع الموقع. أمّا المجلوبة من شبكة التوزيع فلا
  // نخزّنها هنا: التطبيق يحفظها بنفسه في IndexedDB، فتخزينها مرّتين
  // يضاعف ٤٦ ميجابايت بلا فائدة.
  if (url.origin === location.origin && url.pathname.includes('/fonts/')) {
    event.respondWith(cacheFirst(request, FONTS).catch(() => fetch(request)))
    return
  }

  // بيانات المصحف المحلية
  if (url.origin === location.origin && url.pathname.includes('/data/')) {
    event.respondWith(cacheFirst(request, DATA))
    return
  }

  // هيكل التطبيق وأصوله
  if (url.origin === location.origin) {
    event.respondWith(networkFirst(request, SHELL))
    return
  }

  // خطوط جوجل
  if (url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com')) {
    event.respondWith(cacheFirst(request, FONTS).catch(() => fetch(request)))
  }
})

/** يطلب التطبيق تخزين صفحات بعينها لقراءتها دون شبكة */
self.addEventListener('message', (event) => {
  const data = event.data
  if (data?.type !== 'cache-urls' || !Array.isArray(data.urls)) return
  event.waitUntil(addAllSafely(DATA, data.urls))
})
