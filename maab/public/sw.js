// عامل الخدمة: المصحف والخطوط والواجهة الأساسية تعمل دون اتصال بعد الزيارة الأولى (القسم 16).
// - ملفات البناء والخطوط والصور: من الذاكرة أولاً (أسماؤها تتغيّر مع كل إصدار).
// - صفحات المصحف: من الشبكة أولاً، ومن الذاكرة عند انقطاع الاتصال.
// بيانات الحساب والجداول لا تُخزَّن هنا حتى لا تظهر بيانات قديمة أو لمستخدم آخر.
const VERSION = 'maab-v2';
const STATIC = `${VERSION}-static`;
const PAGES = `${VERSION}-mushaf`;

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// المسار الأساسي من نطاق التسجيل: «/» في النسخة الحية و«/maab/» على GitHub Pages
const BASE = new URL(self.registration.scope).pathname.replace(/\/$/, '');
const local = (url) => (url.pathname.startsWith(BASE) ? url.pathname.slice(BASE.length) || '/' : null);

const isStatic = (url) => {
  const p = local(url);
  return Boolean(p && (p.startsWith('/_next/static/') || p.startsWith('/brand/') || p.startsWith('/icons/') || p === '/data/ayahs.json'));
};

// الصفحات بشرطة ختامية في النسخة الثابتة (trailingSlash)
const isMushaf = (url) => /^\/(guardian|teacher)\/mushaf(\/\d+)?\/?$/.test(local(url) ?? '');

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (isStatic(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ||
          fetch(request).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(STATIC).then((c) => c.put(request, copy));
            }
            return res;
          }),
      ),
    );
    return;
  }

  if (isMushaf(url)) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(PAGES).then((c) => c.put(request, copy));
          }
          return res;
        })
        .catch(() => caches.match(request, { ignoreVary: true }).then((hit) => hit || Response.error())),
    );
  }
});
