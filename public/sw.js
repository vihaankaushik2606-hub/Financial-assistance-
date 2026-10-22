const CACHE = "finance-lab-offline-v1";
self.addEventListener("install", event => {
 event.waitUntil(caches.open(CACHE).then(cache => cache.add("/offline.html")));
 self.skipWaiting();
});
self.addEventListener("activate", event => {
 event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("finance-lab-offline-") && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
 const url = new URL(event.request.url);
 // Never cache API responses, authentication, third-party data or private pages.
 if (event.request.method !== "GET" || url.origin !== self.location.origin || url.pathname.startsWith("/api/") || event.request.mode !== "navigate") return;
 event.respondWith(fetch(event.request).catch(() => caches.open(CACHE).then(cache => cache.match("/offline.html"))));
});