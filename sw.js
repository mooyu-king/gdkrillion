const CACHE = 'gdkrillion-aef4225e19aef04b';
const ASSETS = new Set(["/assets/site.css?v=b83ef47ced6d","/assets/site.js?v=7d11100deab9","/images/gd-krillion-app-192.png","/images/gd-krillion-app-512.png","/images/gd-krillion-cover.webp","/images/gd-krillion-crowd.webp","/images/gd-krillion-favicon.png","/images/gd-krillion-logo.webp","/images/gd-krillion-rare.webp","/images/gd-krillion-topics.webp","/images/medical-krillion-cover.webp","/images/medical-krillion-scoring.webp","/images/medical-krillion-timing.webp","/images/medical-krillion-vocabulary.webp","/site.webmanifest"]);
const PAGES = new Set(["/","/guides/rare-vs-crowd/","/guides/daily-strategy/","/about/","/privacy-policy/","/contact/","/terms/","/medical-krillion/"]);

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([...PAGES, ...ASSETS, '/offline.html'])));
});
self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) {
      if (key.startsWith('gdkrillion-') && key !== CACHE) await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        return await fetch(request);
      } catch {
        const cache = await caches.open(CACHE);
        const route = url.pathname.endsWith('/') ? url.pathname : url.pathname + '/';
        return (PAGES.has(route) && await cache.match(route)) || await cache.match('/offline.html');
      }
    })());
    return;
  }
  if (ASSETS.has(url.pathname + url.search)) {
    event.respondWith(caches.open(CACHE).then(async (cache) => await cache.match(request) || fetch(request)));
  }
});
