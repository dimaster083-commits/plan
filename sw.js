const CACHE = "sys-gym-61";   // меняется при каждом обновлении приложения
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './img/bench-0.jpg',
  './img/bench-1.jpg',
  './img/cablerow-0.jpg',
  './img/cablerow-1.jpg',
  './img/calfseat-0.jpg',
  './img/calfseat-1.jpg',
  './img/calfstand-0.jpg',
  './img/calfstand-1.jpg',
  './img/crunch-0.jpg',
  './img/crunch-1.jpg',
  './img/curl-0.jpg',
  './img/curl-1.jpg',
  './img/dbrow-0.jpg',
  './img/dbrow-1.jpg',
  './img/dead-0.jpg',
  './img/dead-1.jpg',
  './img/flyes-0.jpg',
  './img/flyes-1.jpg',
  './img/frontsquat-0.jpg',
  './img/frontsquat-1.jpg',
  './img/incline-0.jpg',
  './img/incline-1.jpg',
  './img/lateral-0.jpg',
  './img/lateral-1.jpg',
  './img/legcurl-0.jpg',
  './img/legcurl-1.jpg',
  './img/legpress-0.jpg',
  './img/legpress-1.jpg',
  './img/ohp-0.jpg',
  './img/ohp-1.jpg',
  './img/preacher-0.jpg',
  './img/preacher-1.jpg',
  './img/pulldown-0.jpg',
  './img/pulldown-1.jpg',
  './img/pushdown-0.jpg',
  './img/pushdown-1.jpg',
  './img/rdl-0.jpg',
  './img/rdl-1.jpg',
  './img/row-0.jpg',
  './img/row-1.jpg',
  './img/skull-0.jpg',
  './img/skull-1.jpg',
  './img/split-0.jpg',
  './img/split-1.jpg',
  './img/squat-0.jpg',
  './img/squat-1.jpg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(FILES))
      .then(() => self.skipWaiting())
      .catch(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Сеть в приоритете, кэш как запасной вариант.
// Так обновления подхватываются сразу, а без интернета всё равно работает.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./index.html')))
  );
});
