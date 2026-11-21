/* HafM.list service worker — offline app shell (cache-first for local files, network-first for pages). */
const CACHE = 'hafm-list-v7';
const SHELL = ['./', 'index.html', 'home.html', 'list.html', 'entry.html', 'reports.html', 'branches.html', 'review.html', 'account.html', 'admin.html',
  'assets/css/app.css', 'assets/css/auth.css', 'assets/js/config.js', 'assets/js/data.js', 'assets/js/branch-geo.js', 'assets/js/core.js', 'assets/js/learn.js', 'assets/js/export.js',
  'assets/js/pages/login.js', 'assets/js/pages/home.js', 'assets/js/pages/list.js', 'assets/js/pages/entry.js', 'assets/js/pages/reports.js',
  'assets/js/pages/branches.js', 'assets/js/pages/review.js', 'assets/js/pages/account.js', 'assets/js/pages/admin.js',
  'assets/img/logo.svg', 'assets/img/logo-light.svg', 'assets/img/halfm-logo.svg', 'assets/img/halfm-logo-light.svg', 'assets/icons/icon-192.png', 'manifest.webmanifest'];
self.addEventListener('install', e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('hafm-list-') && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request; if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const cacheable = url.origin === location.origin || /fonts\.(googleapis|gstatic)\.com|cdn\.jsdelivr\.net/.test(url.host);
  if (!cacheable) return;
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).then(r => { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return r; })
      .catch(() => caches.match(req, {ignoreSearch: true}).then(r => r || caches.match('index.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req).then(r => { if (r.ok || r.type === 'opaque') { const copy = r.clone(); caches.open(CACHE).then(c => c.put(req, copy)); } return r; }).catch(() => hit);
    return hit || net;
  }));
});
