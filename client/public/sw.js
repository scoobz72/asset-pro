/* myCMMS service worker: makes the app installable and quick to open.
   Never caches /api (live data). Built assets are cached; pages fall back to the cached app shell offline. */
const CACHE = "mycmms-v1";
const SHELL = ["/", "/m", "/manifest.webmanifest", "/icon-192.png", "/favicon.svg"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))));
  self.clients.claim();
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/")) return;

  // Pages: network first, so a deploy shows straight away; cached shell when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(url.pathname.startsWith("/m") ? "/m" : "/", copy));
        return res;
      }).catch(() => caches.match(url.pathname.startsWith("/m") ? "/m" : "/").then((r) => r || caches.match("/")))
    );
    return;
  }

  // Hashed build files never change: cache first.
  if (url.pathname.startsWith("/assets/") || /\.(png|svg|woff2?|webmanifest)$/.test(url.pathname)) {
    e.respondWith(
      caches.match(req).then((hit) => hit || fetch(req).then((res) => {
        if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
        return res;
      }))
    );
  }
});
