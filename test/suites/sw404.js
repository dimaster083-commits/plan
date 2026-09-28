/* Сервис-воркер во время выкладки. GitHub Pages несколько секунд отдаёт
   404/502. Годный ответ сервис-воркер кладёт в кэш, а негодный раньше всё
   равно отдавал в браузер: рабочая копия лежала в кэше, а человек видел
   пустую страницу, пока выкладка не закончится. Теперь при негодном ответе
   отдаётся сохранённая копия — и страницы, и картинок со шрифтами. */
const fs = require('fs'), path = require('path'), vm = require('vm');
let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);
const src = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');

function worker(netStatus) {
  const handlers = {};
  const store = new Map([['./index.html', { tag: 'копия-страницы' }], ['https://x/plan/img/bench-0.jpg', { tag: 'копия-картинки' }]]);
  const cache = { put: async () => {}, addAll: async () => {} };
  const ctx = {
    self: { addEventListener: (t, f) => { handlers[t] = f; }, location: { origin: 'https://x' }, skipWaiting() {}, clients: { claim() {} } },
    caches: {
      open: async () => cache, keys: async () => [], delete: async () => true,
      match: async k => store.get(typeof k === 'string' ? k : k.url) || null
    },
    fetch: async () => (netStatus === 'offline' ? Promise.reject(new Error('нет сети'))
      : { ok: netStatus === 200, status: netStatus, type: 'basic', tag: 'сеть-' + netStatus, clone() { return this; } }),
    URL, console, Promise, setTimeout
  };
  vm.createContext(ctx);
  vm.runInContext(src, ctx);
  const go = async (url, mode) => { let p; handlers.fetch({ request: { method: 'GET', mode, url }, respondWith: x => { p = x; } }); return p; };
  return go;
}
(async () => {
  for (const st of [404, 502]) {
    const go = worker(st);
    const page = await go('https://x/plan/', 'navigate');
    chk(page && page.tag === 'копия-страницы', 'страница при ответе ' + st + ' — сохранённая копия', page && page.tag);
    const img = await go('https://x/plan/img/bench-0.jpg', 'no-cors');
    chk(img && img.tag === 'копия-картинки', 'картинка при ответе ' + st + ' — сохранённая копия', img && img.tag);
  }
  const good = await worker(200)('https://x/plan/', 'navigate');
  chk(good && good.tag === 'сеть-200', 'удачный ответ сети идёт как есть', good && good.tag);
  const off = await worker('offline')('https://x/plan/', 'navigate');
  chk(off && off.tag === 'копия-страницы', 'без сети — сохранённая копия', off && off.tag);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
