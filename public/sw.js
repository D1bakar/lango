const CACHE = "lango-v4-1";
const CORE = [
  "./index.html", "./languages.html", "./lesson.html", "./course.html",
  "./review.html", "./words.html", "./stats.html", "./settings.html",
  "./welcome.html", "./offline.html", "./404.html",
  "./css/fonts.css", "./css/tokens.css", "./css/base.css", "./css/components.css", "./css/app.css",
  "./js/shell.js", "./js/store.js", "./js/loader.js", "./js/srs.js", "./js/tts.js",
  "./data/languages.json", "./manifest.webmanifest", "./icons/favicon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  e.respondWith(
    caches.match(request, { ignoreSearch: false }).then((hit) => {
      const net = fetch(request).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => caches.match("./offline.html"));
      return hit || net;
    })
  );
});
