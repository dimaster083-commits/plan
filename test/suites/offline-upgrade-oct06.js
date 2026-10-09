/* Real local HTTP + Service Worker update, isolated synthetic storage only.
   Previous worker differs only by its cache key (as in the actual 174→175
   release). Previous shell/styles carry fixture markers, not personal data. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const { LAUNCH } = require('../env');
const root = path.resolve(__dirname, '../..');
const currentWorker = fs.readFileSync(path.join(root, 'sw.js'), 'utf8');
const cache = currentWorker.match(/const CACHE = "([^"]+)"/)[1];
const previousCache = cache.replace(/\d+$/, n => String(+n - 1));
const currentCss = fs.readFileSync(path.join(root, 'system.css'), 'utf8');
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json' };
let upgraded = false, failures = 0;
function check(name, actual, verify) {
  try { verify(actual); console.log('✓ ' + name); }
  catch (e) { failures++; console.log('✗ ' + name + ' → ' + e.message + '; actual=' + JSON.stringify(actual)); }
}
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404); res.end(); return; }
  let body = fs.readFileSync(file);
  if (!upgraded && name === 'sw.js') body = Buffer.from(currentWorker.replace('"' + cache + '"', '"' + previousCache + '"'));
  if (!upgraded && name === 'system.css') body = Buffer.from(currentCss + '\n/* previous-shell-fixture */');
  if (!upgraded && name === 'index.html') body = Buffer.from(body.toString().replace('</head>', '<meta name="release-fixture" content="previous"></head>'));
  res.writeHead(200, { 'Content-Type': types[path.extname(name)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(body);
});

(async () => {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto('http://127.0.0.1:' + server.address().port + '/');
    await page.waitForSelector('#setup.on');
    await page.waitForFunction(async old => {
      const reg = await navigator.serviceWorker.getRegistration();
      return reg?.active?.state === 'activated' && !!navigator.serviceWorker.controller && (await caches.keys()).includes(old);
    }, previousCache);
    const before = await page.evaluate(async photo => {
      S.setup = 1; S.sound = 0; $('setup').classList.remove('on');
      S.mapBrightness = 43; S.bw = '72'; S.exNote = { 'Жим лёжа': 'Сохраняется при обновлении' };
      S.fav = ['Inchworm']; S.libEx = { 'Моя мобилизация': ['Inchworm', 'Пресс'] }; S.myEx = { 'Моя мобилизация': 'Пресс' };
      const ds = today(); S.rec = {}; S.rec[ds] = { wo: 1, sp: {}, log: { 0: {
        done: 1, n: 'Жим лёжа', g: 'Грудь', w: '100', s: '2', r: '6', rs: [6, 6], ws: [60, 70], vol: 780, xp: 12, sd: 1
      } }, ml: [{ n: 'Завтрак', note: '', items: [{ p: 'Банан', g: 123 }] }] };
      entCache = null; recomputeStats(1); save(); flush();
      await phPut(ds, photo); PHCACHE.set(ds, photo); await phSync();
      return { rec: S.rec, libEx: S.libEx, fav: S.fav, exNote: S.exNote, bw: S.bw };
    }, photo);
    check('Установлена предыдущая версия кэша', await page.evaluate(() => caches.keys()), ks => assert.ok(ks.includes(previousCache)));
    upgraded = true;
    const activated = await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.getRegistration();
      // Observe the NEW worker, not the already activated previous worker.
      const ready = new Promise(resolve => reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        worker.addEventListener('statechange', () => { if (worker.state === 'activated') resolve(worker.state); });
      }, { once: true }));
      await reg.update(); return ready;
    });
    check('Именно новый worker завершил активацию', activated, state => assert.equal(state, 'activated'));
    // A late fetch from the previous worker can recreate its obsolete cache.
    // The release contract is current cached content, verified byte-for-byte
    // below, not a momentary global cache-key absence.
    check('Активированная сборка имеет свой кэш', await page.evaluate(() => caches.keys()), ks => assert.ok(ks.includes(cache)));
    await page.reload(); await page.waitForFunction(() => typeof S === 'object' && S.setup === 1);
    check('После обновления загружен новый HTML', await page.locator('meta[name="release-fixture"]').count(), n => assert.equal(n, 0));
    check('Загружен точный CSS новой сборки', await page.evaluate(async () => (await fetch('system.css')).text()), css => assert.equal(css, currentCss));
    await context.setOffline(true);
    await page.reload(); await page.waitForFunction(() => typeof S === 'object' && S.setup === 1);
    const after = await page.evaluate(async () => {
      await loadLib(); LF.scope = 'all'; LF.mu = ''; LF.q = ''; LF.eq = ''; LF.lv = 0; LF.pl = ''; LF.cat = ''; LF.safe = false; LF.ru = false;
      return { saved: { rec: S.rec, libEx: S.libEx, fav: S.fav, exNote: S.exNote, bw: S.bw },
        brightness: S.mapBrightness, ton: dayTon(today()), photo: await phGet(today()), all: libList().length,
        css: await (await fetch('system.css')).text(), width: document.documentElement.scrollWidth };
    });
    check('Офлайн остались журнал, еда, заметки и личные привязки', after.saved, s => assert.deepEqual(s, before));
    check('Офлайн сохранились яркость, тоннаж и фото', after, a => {
      assert.equal(a.brightness, 43); assert.equal(a.ton, 780); assert.equal(a.photo, photo);
    });
    check('Полная база и актуальный дизайн доступны без сети на 320 px', after, a => {
      assert.equal(a.all, 876); assert.equal(a.css, currentCss); assert.ok(a.width <= 320);
    });
    check('Обновление и офлайн не вызывают ошибок приложения', errors, e => assert.deepEqual(e, []));
  } finally { await context.close(); await browser.close(); }
})().then(() => { server.close(); process.exitCode = failures ? 1 : 0; }).catch(e => {
  console.log('✗ FATAL ' + e.stack); server.close(); process.exitCode = 1;
});
