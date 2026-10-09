/* Fixed historical dates: changing today's template must not reinterpret the
   completed cycle. This catches planWeek using today's weekNeed for old weeks. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const chk = (c, n, d) => {
  if (!c) fails++;
  console.log('  ' + (c ? '✓ ' : '✗ ') + n + ' → ' + JSON.stringify(d));
};
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext()).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP);
  await p.waitForSelector('#setup.on');
  const before = await p.evaluate(() => {
    S.setup = 1; S.sound = 0; S.rec = {}; S.map = {}; S.pause = {};
    S.days = build().days; S.start = '2026-08-10';
    document.getElementById('setup').classList.remove('on');
    for (let k = 13; k >= 1; k--) {
      const ds = addDays('2026-10-09', -k);
      if (dayOf(ds).t === 'rest') continue;
      S.rec[ds] = { wo: 1, log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь',
        w: '60', s: '3', r: '8', rs: [8,8,8], vol: 1440, sd: 1 } }, sp: {} };
    }
    entCache = null; save();
    return { week: planWeek('2026-10-08'), intensity: intFactor('2026-10-08'),
      planned: rangeData('2026-09-26', 13).days.filter(x => x.tr).length };
  });
  chk(before.week === 2 && before.intensity === 0.9 && before.planned === 8,
    'historical fixture has one qualifying week', before);
  await p.evaluate(() => { window.historyChange = setDayType(wdOf('2026-10-08'), 'rest'); });
  await p.click('#askY');
  await p.evaluate(() => window.historyChange);
  const after = await p.evaluate(() => ({ week: planWeek('2026-10-08'),
    intensity: intFactor('2026-10-08'),
    planned: rangeData('2026-09-26', 13).days.filter(x => x.tr).length,
    currentNeed: weekNeed(), type: S.days[wdOf('2026-10-08')].t }));
  chk(after.type === 'rest' && after.currentNeed === 2,
    'new template takes effect for current threshold', after);
  chk(after.week === 2 && after.intensity === 0.9 && after.planned === 8,
    'template change preserves historical cycle and intensity', { before, after });
  await p.reload();
  await p.waitForFunction(() => typeof planWeek === 'function');
  const restored = await p.evaluate(() => ({ week: planWeek('2026-10-08'),
    intensity: intFactor('2026-10-08') }));
  chk(restored.week === 2 && restored.intensity === 0.9,
    'historical cycle survives reload', restored);
  const empty = await p.evaluate(() => {
    S.rec = {}; S.map = {}; S.days = build().days; S.start = '2026-09-28';
    S.days[wdOf('2026-10-01')].ex = [];
    S.rec['2026-09-29'] = { wo: 1, log: {}, sp: {} };
    S.rec['2026-10-03'] = { wo: 1, log: {}, sp: {} };
    save();
    const two = planWeek('2026-10-05');
    S.rec['2026-10-03'].wo = 0; save();
    return { need: weekNeed(), two, one: planWeek('2026-10-05') };
  });
  chk(empty.need === 2 && empty.two === 2 && empty.one === 1,
    'empty training slot does not raise qualification threshold', empty);
  chk(errs.length === 0, 'no browser errors', errs);
  await b.close();
  process.exit(fails ? 1 : 0);
})();
