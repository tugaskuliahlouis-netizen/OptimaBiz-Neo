const CACHE_NAME = "optimabiz-v3";
const BASE_URL = self.registration.scope;

const PRECACHE_URLS = [
  `${BASE_URL}`,
  `${BASE_URL}index.html`,
  `${BASE_URL}offline.html`,
  `${BASE_URL}manifest.json`,
  `${BASE_URL}icons/icon-192x192-A.png`,
  `${BASE_URL}icons/icon-512x512-B.png`,
];

// ── Install: cache semua aset penting ──────────────────────────
self.addEventListener("install", event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .catch(err => console.warn("[SW] Pre-cache partial failure:", err))
  );
});

// ── Activate: hapus cache lama ──────────────────────────────────
self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      );
      await self.clients.claim();
    })()
  );
});

// ── Fetch: cache-first untuk aset lokal, network-first untuk eksternal ──
self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip: non-GET, chrome-extension, API calls
  if (request.method !== "GET") return;
  if (url.protocol.startsWith("chrome-extension")) return;
  if (url.hostname === "api.anthropic.com") return;

  // Lokal: cache-first, fallback ke offline.html jika gagal
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request)
          .then(response => {
            // Hanya cache jika respon valid (status 200)
            if (response && response.status === 200 && response.type === "basic") {
              const clone = response.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
            }
            return response;
          })
          .catch(() => caches.match(`${BASE_URL}offline.html`));
      })
    );
    return;
  }

  // Eksternal (CDN fonts dll): network-first, fallback ke cache
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        }
        return response;
      })
      .catch(() => caches.match(request))
  );
});
