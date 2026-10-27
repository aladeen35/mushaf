/* offline cache: app shell + data; network-first for data so updates arrive */
const V = "khulood-v1";
const SHELL = ["./", "img/khulood-logo.webp", "img/bushra-tech.webp", "img/khulood-mark.png", "index.html", "css/app.css", "firebase-config.js", "js/core.js", "js/audio.js", "js/reader.js", "js/book3d.js", "js/explore.js", "js/app.js",
  "data/book.js", "data/quran.js", "data/hadith.js", "data/extra.js", "vendor/d3.min.js", "vendor/topojson-client.min.js", "vendor/countries-50m.json", "manifest.webmanifest"];
self.addEventListener("install", (e) => e.waitUntil(caches.open(V).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())));
self.addEventListener("activate", (e) => e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== V).map((k) => caches.delete(k)))).then(() => self.clients.claim())));
self.addEventListener("fetch", (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin) return;
  e.respondWith(fetch(e.request).then((r) => { const cp = r.clone(); caches.open(V).then((c) => c.put(e.request, cp)); return r; }).catch(() => caches.match(e.request)));
});
