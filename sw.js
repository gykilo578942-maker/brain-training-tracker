const CACHE_NAME = "bt-tracker-v1";
const APP_SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./manifest.json",
  "./src/app.js",
  "./src/firebase-config.js",
  "./src/auth.js",
  "./src/db.js",
  "./src/date-utils.js",
  "./src/stats.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js",
  "https://www.gstatic.com/firebasejs/10.14.1/firebase-firestore.js",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin && url.hostname !== "www.gstatic.com") {
    // let Firebase/Google API calls (identitytoolkit.googleapis.com, firestore.googleapis.com, etc.)
    // pass through uncached; gstatic-hosted SDK modules are cacheable and handled below
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
