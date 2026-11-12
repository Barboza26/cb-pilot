/* CB Pilot — service worker: permite instalar la app y abrirla aunque falle el internet.
   Estrategia «red primero»: siempre pide la versión más nueva; la copia guardada solo se usa sin conexión.
   La API (/api/) nunca se guarda. */
const CACHE = "cbpilot-v2";
const SHELL = ["/", "/assets/css/base.css", "/assets/css/pilot.css", "/assets/js/theme.js", "/assets/js/core.js", "/assets/js/pilot.js", "/assets/js/worlds.js", "/assets/img/pilo-emblema.svg", "/manifest.webmanifest"];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).catch(() => {}).then(() => self.skipWaiting()));
});
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith("cbpilot-") && k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/admin")) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok && res.type === "basic") { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {}); }
      return res;
    } catch {
      const hit = await caches.match(req, { ignoreSearch: req.mode === "navigate" });
      if (hit) return hit;
      if (req.mode === "navigate") { const home = await caches.match("/"); if (home) return home; }
      return new Response("", { status: 504, statusText: "Sin conexión" });
    }
  })());
});
