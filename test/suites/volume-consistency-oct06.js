/* Regression: aggregate progress used the common exercise load when an old
   recorded session had per-row loads but no stored volume. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let failures = 0;
function check(name, actual, verify) {
  try { verify(actual); console.log('✓ ' + name); }
  catch (error) { failures++; console.log('✗ ' + name + ' → ' + error.message + '; actual=' + JSON.stringify(actual)); }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await (await browser.newContext()).newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(APP);
    await page.waitForFunction(() => typeof recomputeStats === 'function' && typeof S === 'object' && S !== null);
    // Literal totals are hand calculated from recorded work rows, never from helpers.
    const fixtures = [
      { name: '60/70/80 кг при общей графе 100 дают 1680 кг во всех итогах',
        log: { w: 100, s: 3, rs: [8, 8, 8], ws: [60, 70, 80] }, ton: 1680, sets: 3 },
      { name: 'пустой вес средней строки берёт общие 100 кг: 1920 кг',
        log: { w: 100, s: 3, rs: [8, 8, 8], ws: [60, '', 80] }, ton: 1920, sets: 3 },
      { name: 'нулевой вес строки и отсутствующий последний вес берут общий: 1680 кг',
        log: { w: 100, s: 3, rs: [8, 6, 6], ws: [60, 0] }, ton: 1680, sets: 3 },
      { name: 'пустая общая графа берёт плановые 90 кг только для пустого веса строки',
        log: { w: '', s: 3, rs: [8, 8, 8], ws: [60, null, 80] }, ton: 1840, sets: 3 },
      { name: 'старая запись без vol считает пустой повтор низом диапазона при своих весах: 1680 кг',
        log: { w: 100, s: 3, r: '8-10', rs: [8, 0, 8], ws: [60, 70, 80] }, ton: 1680, sets: 3 },
      { name: 'без весов строк сохраняется старый расчёт: 3 × 8 × 100',
        log: { w: 100, s: 3, rs: [8, 8, 8] }, ton: 2400, sets: 3 },
      { name: 'без записанных повторов сохраняется расчёт по общему полю',
        log: { w: 80, s: 3, r: '6-8', ws: [40, 50, 60] }, ton: 1440, sets: 3 },
      { name: 'только нули повторов старой копии сохраняют прежний общий расчёт: 1440 кг',
        log: { w: 80, s: 3, r: '6-8', rs: [0, 0, 0], ws: [40, 50, 60] }, ton: 1440, sets: 3 },
      { name: 'полностью пустые повторы старой копии сохраняют прежний общий расчёт: 1440 кг',
        log: { w: 80, s: 3, r: '6-8', rs: ['', null, ''], ws: [40, 50, 60] }, ton: 1440, sets: 3 },
      { name: 'разминка и дроп не добавляют тоннаж или рабочие подходы',
        log: { w: 100, s: 2, rs: [8, 6], ws: [60, 70], wu: [10, 10], dr: [12, 12] }, ton: 900, sets: 2 },
      { name: 'отказ остаётся рабочим подходом с фактическим весом',
        log: { w: 100, s: 2, rs: [8, 6], ws: [60, 70], fl: [1] }, ton: 900, sets: 2 },
      { name: 'только разминка и дроп сохраняют нулевую рабочую нагрузку',
        log: { w: 100, s: 0, rs: [], ws: [], wu: [8], dr: [8] }, ton: 0, sets: 0 },
      { name: 'сохранённый тоннаж имеет прежний приоритет над пересчётом',
        log: { w: 100, s: 3, rs: [8, 8, 8], ws: [60, 70, 80], vol: 1234 }, ton: 1234, sets: 3 },
      { name: 'явно сохранённый ноль не заменяется вычисленным тоннажем',
        log: { w: 100, s: 3, rs: [8, 8, 8], ws: [60, 70, 80], vol: 0 }, ton: 0, sets: 3 },
      { name: 'строковые веса и повторы старой копии считаются по строкам',
        log: { w: '100', s: '3', rs: ['8', '8', '8'], ws: ['60', '70', '80'] }, ton: 1680, sets: 3 }
    ];
    for (const fixture of fixtures) {
      const actual = await page.evaluate(f => {
        S = build(); S.setup = 1; S.sound = 0; S.rec = {}; S.volBase = {}; S.xpBase = 0;
        const ds = today();
        S.days.forEach(d => { d.ex = []; });
        dayOf(ds).ex = [{ n: 'Жим лёжа', g: 'Грудь', s: 4, r: '8-10', w: 90 }];
        S.rec[ds] = { log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', r: '8', sd: 1, ...f.log } }, sp: {}, wo: 0 };
        entCache = null;
        const before = JSON.stringify(S.rec);
        recomputeStats(1);
        const week = weekData(mondayOf(ds));
        return { total: S.vol['Грудь'], day: dayTon(ds), range: week.ton,
          sets: daySets(ds), weekSets: week.sets, muscleSets: vol7m()['Грудь'],
          historyUnchanged: JSON.stringify(S.rec) === before };
      }, fixture);
      check(fixture.name, actual, a => {
        assert.equal(a.total, fixture.ton, 'общий тоннаж'); assert.equal(a.day, fixture.ton, 'журнал дня');
        assert.equal(a.range, fixture.ton, 'итоги недели'); assert.equal(a.sets, fixture.sets, 'рабочие подходы дня');
        assert.equal(a.weekSets, fixture.sets, 'рабочие подходы недели'); assert.equal(a.muscleSets, fixture.sets, 'карта мышц');
        assert.equal(a.historyUnchanged, true, 'пересчёт не переписывает журнал');
      });
    }
    // The same real load()/import normalization path must retain the per-row count.
    const restored = await page.evaluate(() => {
      const state = JSON.parse(JSON.stringify(S));
      state.rec = { [today()]: { log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', w: 100,
        s: 3, r: '8', rs: [8, 8, 8], ws: [60, 70, 80], sd: 1 } } } };
      for (let n = 1; n <= 16; n++) state['mig' + n] = 1;
      S = importStateOf({ v: 3, state, photos: {} }); scrubKeys(); migrate(); entCache = null; recomputeStats(1);
      flush(); load(); entCache = null;
      return { total: S.vol['Грудь'], day: dayTon(today()), sets: daySets(today()),
        rows: S.rec[today()].log[0].ws, storedVol: S.rec[today()].log[0].vol ?? null };
    });
    check('ремонт копии и загрузка сохраняют расчёт 1680 кг и исходные веса', restored, a => {
      assert.equal(a.total, 1680); assert.equal(a.day, 1680); assert.equal(a.sets, 3);
      assert.deepEqual(a.rows, [60, 70, 80]); assert.equal(a.storedVol, null);
    });
    check('пересчёт и загрузка не вызывают ошибок страницы', errors, a => assert.deepEqual(a, []));
  } finally { await browser.close(); }
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.log('FATAL ' + error.stack); process.exitCode = 1; });
