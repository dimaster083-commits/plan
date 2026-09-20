const CACHE = "sys-gym-114";   // меняется при каждом обновлении приложения
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './icon-180.png',
  './icon-192.png',
  './icon-512.png',
  './img/bg-nebula.jpg',
  './img/bg-ink.jpg',
  './font/exo2-400-cyrillic.woff2',
  './font/exo2-400-latin.woff2',
  './font/exo2-500-cyrillic.woff2',
  './font/exo2-500-latin.woff2',
  './font/exo2-600-cyrillic.woff2',
  './font/exo2-600-latin.woff2',
  './font/exo2-700-cyrillic.woff2',
  './font/exo2-700-latin.woff2',
  './font/forum-400-cyrillic.woff2',
  './font/forum-400-latin.woff2',
  './font/jbmono-400-cyrillic.woff2',
  './font/jbmono-400-latin.woff2',
  './font/jbmono-600-cyrillic.woff2',
  './font/jbmono-600-latin.woff2',
  './font/oswald-200-cyrillic.woff2',
  './font/oswald-200-latin.woff2',
  './font/oswald-300-cyrillic.woff2',
  './font/oswald-300-latin.woff2',
  './font/oswald-400-cyrillic.woff2',
  './font/oswald-400-latin.woff2',
  './font/oswald-600-cyrillic.woff2',
  './font/oswald-600-latin.woff2',
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

  // Саму страницу запрашиваем мимо обычного кэша браузера. Иначе после
  // выкладки приложение ещё минут десять показывает прошлую сборку:
  // сам хостинг разрешает держать index.html в кэше без переспроса.
  const url = new URL(e.request.url);
  const shell = e.request.mode === 'navigate' ||
    (url.origin === self.location.origin && /(^|\/)(index\.html)?$/.test(url.pathname));
  if (shell) {
    e.respondWith(
      fetch(url.pathname + '?v=' + CACHE, { cache: 'no-store' })
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put('./index.html', copy)).catch(() => {});
          return res;
        })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy)).catch(() => {});
        return res;
      })
      // Для картинок и шрифтов подсовывать страницу вместо файла нельзя:
      // браузер получит html там, где ждёт jpg. Пусть лучше не будет ничего.
      .catch(() => caches.match(e.request))
  );
});
