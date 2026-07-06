// Musifinity — service worker : mode hors-ligne
const SHELL = "mf-shell-v1";
const AUDIO = "mf-audio-v1";
const CDN = "mf-cdn-v1";

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(SHELL)
      .then((c) => c.addAll(["./", "./index.html"]).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // 1) navigation (ouverture de l'app) : réseau d'abord, cache seulement si vraiment hors-ligne.
  //    On ne sert JAMAIS une page cassée : en cas de doute, on laisse passer le réseau.
  if (e.request.mode === "navigate" || (url.origin === location.origin && url.pathname.endsWith(".html"))) {
    e.respondWith(
      fetch(e.request)
        .then((r) => {
          const copy = r.clone();
          caches.open(SHELL).then((c) => c.put(e.request, copy)).catch(() => {});
          return r;
        })
        .catch(() =>
          caches.match(e.request, { ignoreSearch: true })
            .then((hit) => hit || caches.match("./index.html"))
            .then((hit) => hit || fetch(e.request))
        )
    );
    return;
  }

  // autres fichiers same-origin
  if (url.origin === location.origin) {
    e.respondWith(
      fetch(e.request).catch(() =>
        caches.match(e.request, { ignoreSearch: true })
      )
    );
    return;
  }

  // 2) audio Supabase : cache d'abord (morceaux gardés hors-ligne), sinon réseau
  if (url.pathname.includes("/storage/v1/object/public/audio/")) {
    e.respondWith(
      caches.match(e.request).then((hit) => hit || fetch(e.request))
    );
    return;
  }

  // 3) pochettes + librairies CDN (react, tailwind, babel) : cache d'abord avec remplissage
  const isCover = url.pathname.includes("/storage/v1/object/public/covers/");
  const isCdn = ["cdn.tailwindcss.com", "unpkg.com"].includes(url.hostname);
  if (isCover || isCdn) {
    e.respondWith(
      caches.match(e.request).then(
        (hit) =>
          hit ||
          fetch(e.request).then((r) => {
            if (r.ok || r.type === "opaque") {
              const copy = r.clone();
              caches.open(CDN).then((c) => c.put(e.request, copy)).catch(() => {});
            }
            return r;
          })
      )
    );
  }
});
