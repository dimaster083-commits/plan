/* Календарь, а не посещаемость, двигает фазу тренировочного цикла.
   Этот сторож падает, если planWeek снова начнёт ждать трёх закрытых
   тренировок перед следующим понедельником. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP);
  await p.waitForTimeout(1300);
  await p.evaluate(() => {
    S.setup = 1;
    document.getElementById('setup').classList.remove('on');
    S.sound = 0;
    save();
  });

  const result = await p.evaluate(() => {
    S.start = '2026-09-14';
    S.rec['2026-09-17'] = { log: {}, sp: {}, wo: 1 };
    S.rec['2026-09-19'] = { log: {}, sp: {}, wo: 1 };
    wkCache = null;
    const before = JSON.stringify(S.rec);
    const weeks = [planWeek('2026-09-20'), planWeek('2026-09-21')];
    const index = cycIdx('2026-09-21');
    return { weeks, index, unchanged: JSON.stringify(S.rec) === before };
  });

  chk(result.weeks[0] === 1, '1. до следующего понедельника остаётся первая неделя', result.weeks.join(', '));
  chk(result.weeks[1] === 2, '2. понедельник открывает вторую неделю независимо от посещаемости', result.weeks.join(', '));
  chk(result.index === 1, '3. индекс цикла следует за календарной неделей', String(result.index));
  chk(result.unchanged, '4. расчёт недели не меняет журнал');
  chk(errs.length === 0, '5. без ошибок в консоли', errs.join(' | ') || 'чисто');
  await b.close();
  console.log('\nпроблем: ' + fails);
  process.exit(fails ? 1 : 0);
})();
