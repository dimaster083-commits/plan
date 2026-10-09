/* Cross-feature contracts, synthetic data only. The same recorded sets must
   drive history, tonnage, muscle colors and recaps. Viewing a smaller catalog
   or changing display brightness must not rewrite the training/food journal. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let failures = 0;
function check(name, value, verify) {
  try { verify(value); console.log('✓ ' + name); }
  catch (error) { failures++; console.log('✗ ' + name + ' → ' + error.message + '; actual=' + JSON.stringify(value)); }
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, acceptDownloads: true });
  await context.addInitScript(() => {
    window.personalSnapshot = () => JSON.parse(JSON.stringify({ days: S.days, rec: S.rec,
      fav: S.fav, myEx: S.myEx, libEx: S.libEx, exNote: S.exNote, bw: S.bw }));
  });
  const page = await context.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(APP); await page.waitForSelector('#setup.on');
    const ready = await page.evaluate(() => typeof setMapBrightness === 'function' && typeof mmColor === 'function');
    check('Согласованный интерфейс карты существует', ready, x => assert.equal(x, true));
    if (!ready) return;
    await page.evaluate(() => {
      S.setup = 1; S.sound = 0; S.hints = 1;
      $('setup').classList.remove('on');
      S.days = build().days; S.days.forEach(d => { d.ex = []; });
      S.start = addDays(today(), 7); S.pause = {}; S.map = {}; S.rec = {}; S.pr = {}; S.once = {};
      S.bw = '72'; S.fav = ['Inchworm'];
      S.myEx = { 'Моя мобилизация': 'Пресс', 'Моя тяга': 'Спина' };
      S.libEx = { 'Моя мобилизация': ['Inchworm', 'Пресс'] };
      S.exNote = { 'Жим лёжа': 'Личная техника не должна исчезнуть' };
      const ds = today(), past = addDays(ds, -15), d = dayOf(ds);
      d.t = 'up1'; d.ex = [{ n: 'Жим лёжа', s: 3, r: '6-8', w: 60, g: 'Грудь' }];
      S.rec[past] = { wo: 1, sp: {}, log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: '2', r: '8', w: '40', rs: [8, 8], ws: [40, 40], vol: 640, xp: 12, sd: 1 } } };
      mealsRW(ds)[0].items = [{ p: 'Банан', g: 123 }];
      entCache = null; wkCache = null; justDone = -1; sel = ds; tab = 'wo'; exOpen = null;
      render(); recomputeStats(1); save(); flush();
      // Compare against the validated fixture, not pre-normalization XP fields.
      window.historicalSnapshot = JSON.stringify(S.rec[past]);
    });
    await page.locator('.exrow[data-open="0"]').click();
    for (let i = 0; i < 3; i++) {
      await page.locator('[data-ws="' + i + '"]').fill('60');
      await page.locator('[data-rs="' + i + '"]').fill('8');
    }
    for (let i = 0; i < 3; i++) await page.locator('[data-tick="' + i + '"]').click();
    await page.waitForFunction(() => recOf(today()).log?.[0]?.done === 1);
    const chain = await page.evaluate(() => {
      paintMusMap(); const recap = rangeData(today(), 1);
      return { sets: daySets(today()), ton: dayTon(today()), map: vol7m()['Грудь'],
        recapSets: recap.sets, recapTon: recap.ton, recapMap: recap.m['Грудь'],
        target: volTargetM('Грудь'), color: mmColor('Грудь', vol7m()['Грудь'], 1),
        row: $('mlist').querySelector('[data-mus="Грудь"]').textContent,
        past: JSON.stringify(S.rec[addDays(today(), -15)]) === historicalSnapshot,
        pastBefore: historicalSnapshot, pastAfter: JSON.stringify(S.rec[addDays(today(), -15)]) };
    });
    check('Три галочки: журнал, тоннаж, карта и итоги считают одну работу', chain, x => {
      assert.equal(x.sets, 3); assert.equal(x.ton, 1440); assert.equal(x.map, 3);
      assert.equal(x.recapSets, 3); assert.equal(x.recapTon, 1440); assert.equal(x.recapMap, 3);
      assert.equal(x.target, 3); assert.ok(x.row.includes('3'));
    });
    check('Новая тренировка не переписывает старую', chain, x => assert.equal(x.past, true));

    const before = await page.evaluate(() => personalSnapshot());
    const view = await page.evaluate(async () => {
      await loadLib(); tab = 'ex'; LF.mu = ''; LF.q = ''; LF.eq = ''; LF.pl = ''; LF.safe = false; LF.ru = false;
      const counts = {};
      for (const scope of ['core', 'mine', 'all']) { LF.scope = scope; paintLib(); counts[scope] = libList().length; }
      setMapBrightness(42); flush();
      return { state: personalSnapshot(), counts, brightness: S.mapBrightness, color: mmColor('Грудь', 3, 1) };
    });
    check('Каталог и яркость не меняют тренировку, рацион и личные привязки', view.state, x => assert.deepEqual(x, before));
    check('Короткий каталог не уничтожает полную базу и мои упражнения', view.counts, x => {
      assert.equal(x.all, 876); assert.ok(x.core > 0 && x.core < 100); assert.ok(x.mine >= 3);
    });
    check('Яркость меняет цвет, но не число рабочих подходов', view, x => {
      assert.equal(x.brightness, 42); assert.notEqual(x.color, chain.color);
    });
    await page.reload(); await page.waitForFunction(() => typeof S === 'object');
    const reloaded = await page.evaluate(() => ({ state: personalSnapshot(), brightness: S.mapBrightness }));
    check('После перезапуска остаются тот же журнал и яркость', reloaded, x => {
      assert.deepEqual(x.state, before); assert.equal(x.brightness, 42);
    });

    await page.evaluate(() => { tab = 'prog'; pSec = 'prog'; render(); });
    const [download] = await Promise.all([page.waitForEvent('download'), page.locator('#exp').click()]);
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    check('Обычная кнопка копии включает яркость и личные данные', backup, x => {
      assert.equal(x.state.mapBrightness, 42); assert.deepEqual(x.state.rec, before.rec);
      assert.deepEqual(x.state.libEx, before.libEx); assert.deepEqual(x.state.fav, before.fav);
    });
    await page.evaluate(() => { S.exNote = { changed: 'Временная синтетическая заметка' }; setMapBrightness(100); flush(); });
    await page.setInputFiles('#impFile', { name: 'synthetic-backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(backup)) });
    await page.waitForSelector('#ask.on'); await page.locator('#askY').click();
    await page.waitForFunction(() => $('noteT').textContent === 'Прогресс восстановлен');
    const restored = await page.evaluate(async () => {
      await loadLib(); LF.scope = 'mine'; LF.mu = ''; LF.q = ''; LF.eq = ''; LF.pl = ''; LF.safe = false; LF.ru = false;
      return { state: personalSnapshot(), brightness: S.mapBrightness, sets: daySets(today()),
        map: vol7m()['Грудь'], used: libList().some(o => o.id === 'Inchworm') };
    });
    check('Восстановление сразу согласует журнал, карту, яркость и каталог', restored, x => {
      assert.deepEqual(x.state, before); assert.equal(x.brightness, 42);
      assert.equal(x.sets, 3); assert.equal(x.map, 3); assert.equal(x.used, true);
    });
    check('Связанный сценарий проходит без ошибок приложения', errors, x => assert.deepEqual(x, []));
  } finally { await context.close(); await browser.close(); }
})().then(() => process.exit(failures ? 1 : 0)).catch(e => { console.log('✗ FATAL ' + e.stack); process.exit(1); });
