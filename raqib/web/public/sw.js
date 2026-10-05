/* Raqib service worker: makes the app itself open without a connection.
 *
 * It caches the APPLICATION (the page shell, hashed build files, icons, the web fonts) and nothing else. API calls are never
 * cached here: private data lives only in the app's own per-user store (IndexedDB), which is cleared on sign-out. Offline
 * data and queued changes are the app's job (src/offline); this file only keeps the shell available.
 *
 * Bump VERSION to drop the old caches on the next visit.
 */
const VERSION = "raqib-v1";
const SHELL = `${VERSION}-shell`;
const ASSETS = `${VERSION}-assets`;
const FONTS = `${VERSION}-fonts`;
const KEEP = new Set([SHELL, ASSETS, FONTS]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(["/", "/manifest.webmanifest", "/icon.svg", "/icon-192.png"]))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith("raqib-") && !KEEP.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirstShell(request) {
  const cache = await caches.open(SHELL);
  try {
    const fresh = await fetch(request);
    if (fresh.ok) cache.put("/", fresh.clone());
    return fresh;
  } catch {
    return (await cache.match("/")) || Response.error();
  }
}

async function cacheFirst(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  if (hit) return hit;
  const fresh = await fetch(request);
  if (fresh.ok) cache.put(request, fresh.clone());
  return fresh;
}

async function staleWhileRevalidate(request, name) {
  const cache = await caches.open(name);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then((res) => {
      if (res.ok) cache.put(request, res.clone());
      return res;
    })
    .catch(() => undefined);
  return hit || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);

  if (url.origin !== self.location.origin) {
    // only the font files are kept; every other cross-origin request (the API on its own origin) goes straight to the network
    if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") event.respondWith(staleWhileRevalidate(request, FONTS));
    return;
  }
  if (url.pathname.startsWith("/api/")) return; // never cached here
  if (request.mode === "navigate") return void event.respondWith(networkFirstShell(request));
  if (url.pathname.startsWith("/assets/")) return void event.respondWith(cacheFirst(request, ASSETS)); // hashed: immutable
  event.respondWith(staleWhileRevalidate(request, SHELL));
});
