/* Release probe: activated real SW, then actual offline + synthetic storage faults.
   Optional GYM_APP_URL verifies a published copy. Isolated Chrome, no owner data. */
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), http = require('node:http');
const { chromium } = require('playwright-core');
const { LAUNCH } = require('../../env');
const root = path.resolve(__dirname, '../../..');
const cache = fs.readFileSync(path.join(root, 'sw.js'), 'utf8').match(/const CACHE = "([^"]+)"/)[1];
const photo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const server = http.createServer((req, res) => {
  const name = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  const file = path.resolve(root, name);
  if (!file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
  fs.readFile(file, (err, body) => {
    if (err) { res.writeHead(404); res.end(); return; }
    res.setHeader('Content-Type', file.endsWith('.html') ? 'text/html; charset=utf-8'
      : file.endsWith('.js') ? 'text/javascript' : file.endsWith('.css') ? 'text/css' : 'application/octet-stream');
    res.end(body);
  });
});
(async () => {
  const remote = process.env.GYM_APP_URL;
  if (!remote) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, timezoneId: 'Asia/Vladivostok' });
  const page = await context.newPage(), errors = [];
  page.setDefaultNavigationTimeout(30000);
  page.setDefaultTimeout(8000);
  page.on('pageerror', err => errors.push(err.message));
  try {
    await page.goto(remote || 'http://127.0.0.1:' + server.address().port + '/');
    await page.click('#setSkip');
    await page.waitForFunction(async cache => {
      await navigator.serviceWorker.ready;
      return !!navigator.serviceWorker.controller && (await caches.keys()).includes(cache);
    }, cache, { timeout: 30000 });
    const baseline = await page.evaluate(async photo => {
      S.bw = '70'; S.exNote = { fixture: 'offline stage4' }; S.bkAsk = Date.now();
      const day = today();
      S.rec[day] = { wo: 1, sp: {}, log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', w: '60',
        s: 3, r: '8', rs: [8, 8, 8], ws: [60, 60, 60], vol: 1440, xp: 12 } },
        ml: [{ n: 'Завтрак', items: [{ p: 'Овсяные хлопья сухие', g: 100 }] }] };
      invalidateFood(); recomputeStats(1); save(); flush();
      await phPut(day, photo); await phSync(); undoDrop();
      return { day, rec: JSON.stringify(S.rec), xp: S.xp, ton: dayTon(day), kcal: daySum(day).k };
    }, photo);
    assert.equal(baseline.ton, 1440); assert.equal(baseline.kcal, 366);
    await context.setOffline(true); await page.reload();
    await page.waitForFunction(() => PH.includes(today()));
    await page.click('[data-tab="photo"]'); await page.waitForSelector('#phT img');
    await page.evaluate(() => {
      window.oldDelete = IDBObjectStore.prototype.delete;
      IDBObjectStore.prototype.delete = function (...args) {
        if (this.name === 'ph') throw new DOMException('synthetic offline delete failure', 'UnknownError');
        return oldDelete.apply(this, args);
      };
    });
    const remove = async () => {
      await page.click('#phDel'); await page.waitForSelector('#ask.on'); await page.click('#askY');
    };
    await remove(); await page.waitForFunction(() => /Не удалось удалить/.test($('noteT').textContent));
    assert.equal(await page.evaluate(() => phGet(today())), photo);
    await page.evaluate(() => { IDBObjectStore.prototype.delete = oldDelete; });
    await page.waitForTimeout(300); await remove();
    await page.waitForFunction(() => !PH.includes(today()) && !!undoRec);
    await page.evaluate(() => {
      window.oldPut = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        if (this.name === 'ph') throw new DOMException('synthetic offline quota', 'QuotaExceededError');
        return oldPut.apply(this, args);
      };
    });
    await page.click('#undoB');
    await page.waitForFunction(() => /Не удалось отменить/.test($('noteT').textContent) && !undoRec?.busy);
    assert.equal(await page.evaluate(() => phGet(today())), undefined);
    assert.equal(await page.evaluate(() => !!undoRec), true);
    await page.evaluate(() => { IDBObjectStore.prototype.put = oldPut; });
    await page.waitForTimeout(300); await page.click('#undoB');
    await page.waitForFunction(() => !undoRec && $('noteT').textContent === 'Отменено');
    assert.equal(await page.evaluate(() => phGet(today())), photo);
    assert.deepEqual(await page.evaluate(() => ({ rec: JSON.stringify(S.rec), xp: S.xp,
      ton: dayTon(today()), kcal: daySum(today()).k })),
    { rec: baseline.rec, xp: baseline.xp, ton: 1440, kcal: 366 });
    const copy = await page.evaluate(photo => {
      window.oldAdd = IDBObjectStore.prototype.add;
      IDBObjectStore.prototype.add = function (...args) {
        if (this.name === 'ph' && args[1] === '2026-09-30') throw new DOMException('synthetic import quota', 'QuotaExceededError');
        return oldAdd.apply(this, args);
      };
      return { state: JSON.parse(JSON.stringify(S)), photos: { 'broken-day': photo,
        '2026-02-30': photo, '2026-09-30': photo, '2026-09-29': photo } };
    }, photo);
    await page.locator('#impFile').setInputFiles({ name: 'synthetic-offline-copy.json',
      mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(copy)) });
    await page.waitForSelector('#ask.on'); await page.click('#askY');
    await page.waitForFunction(() => /Журнал восстановлен/.test($('noteT').textContent));
    const result = await page.evaluate(async () => ({ keys: await phKeys(), notice: $('noteT').textContent,
      ton: dayTon(today()), kcal: daySum(today()).k }));
    assert.equal(result.keys.includes('broken-day'), false);
    assert.equal(result.keys.includes('2026-02-30'), false);
    assert.equal(result.keys.includes('2026-09-30'), false);
    assert.equal(result.keys.includes('2026-09-29'), true);
    assert.equal(result.ton, 1440); assert.equal(result.kcal, 366);
    assert.match(result.notice, /Не удалось добавить фото: 1/);
    await page.evaluate(() => { IDBObjectStore.prototype.add = oldAdd; });
    await page.reload(); await page.waitForFunction(() => PH.includes('2026-09-29'));
    assert.equal(await page.evaluate(() => phGet(today())), photo);
    assert.deepEqual(errors, []);
    console.log('PASS activated ' + cache + ' offline: delete/Undo failure+retry, partial import, invalid dates, reload; journal1440kg/food366kcal preserved');
  } finally { await context.close(); await browser.close(); server.close(); }
})().catch(err => { console.error(err.stack); server.close(); process.exitCode = 1; });
