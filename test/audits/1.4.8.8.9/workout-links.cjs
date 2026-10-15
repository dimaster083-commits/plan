/* New adversarial workout -> history -> week/month audit, not a full suite.
   Synthetic local Chrome contexts; all user actions use trusted taps/inputs.
   Nonzero exit means a recorded expectation failed, not a harness failure. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');
let checks = 0, failed = 0;
const observations = [];
function check(name, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); console.log('PASS ' + name); }
  catch { failed++; console.log('RED ' + name + ' expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual)); }
  observations.push({ name, actual, expected });
}
async function tap(p, selector) { await p.locator(selector).tap(); await p.waitForTimeout(290); }
function seed(ds) {
  sheetClose();
  S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0; S.bw = '80';
  S.start = '2026-09-01'; S.bkAsk = Date.now(); S.rec = {}; S.pr = {}; S.map = {}; S.once = {}; S.pause = {};
  S.volBase = {}; S.xpBase = 0; S.quest = {};
  S.days.forEach(d => { d.t = 'rest'; d.s = 'Отдых'; d.ex = []; });
  S.days[2].t = S.days[3].t = 'up1'; S.days[2].s = S.days[3].s = 'Контроль жима';
  S.days[2].ex = [{ n: 'Жим лёжа', g: 'Грудь', w: 50, s: 3, r: '6-10' }];
  S.days[3].ex = [{ n: 'Жим лёжа', g: 'Грудь', w: 50, s: 3, r: '6-10' }];
  sel = ds; mo = ds.slice(0, 7); tab = 'wo'; exOpen = 0; editPast = false;
  $('setup').classList.remove('on'); entCache = wkCache = null; justDone = -1;
  pendingActions.clear(); lastTap = { k: '', t: 0 }; undoDrop(); recomputeStats(1); save(); flush(); render();
}
async function select(p, ds) {
  await p.evaluate(ds => { sheetClose(); sel = ds; mo = ds.slice(0, 7); tab = 'wo'; exOpen = 0; editPast = false; render(); }, ds);
  if (await p.locator('#editPast').isVisible()) await tap(p, '#editPast');
  if (!await p.locator('.ex[data-j="0"]').isVisible()) await tap(p, '[data-open="0"]');
}
async function fill(p, weights, reps, kinds = weights.map(() => '')) {
  await p.locator('[data-f="s"]').fill(String(weights.length));
  await p.locator('[data-f="s"]').blur();
  await p.locator('[data-f="w"]').fill('50'); await p.locator('[data-f="w"]').blur();
  for (let i = 0; i < kinds.length; i++) {
    const now = await p.locator('[data-rs="' + i + '"]').getAttribute('data-kind');
    const order = ['', 'w', 'f', 'd'];
    for (let n = 0; n < (order.indexOf(kinds[i]) - order.indexOf(now) + 4) % 4; n++) await tap(p, '[data-kindcyc="' + i + '"]');
  }
  for (let i = 0; i < weights.length; i++) {
    await p.locator('[data-ws="' + i + '"]').fill(String(weights[i]));
    await p.locator('[data-rs="' + i + '"]').fill(String(reps[i]));
  }
}
async function complete(p) { await tap(p, '[data-complete="0"]'); }
async function finish(p) {
  if (await p.locator('#editPast').isVisible()) await tap(p, '#editPast');
  await tap(p, '#fin'); await p.waitForSelector('#sh.on');
}
async function oldMonth(p, ym) {
  await p.evaluate(ym => { sheetClose(); tab = 'prog'; pSec = 'log'; mo = ym; render(); window.scrollTo(0, 0); }, ym);
  await tap(p, '#moBtn'); await p.waitForSelector('#moP');
  return p.evaluate(() => ({ text: $('shB').textContent.replace(/\s+/g, ' ').trim(),
    best: [...$('shB').querySelectorAll('.wtab tr')].map(r => r.textContent.replace(/\s+/g, ' ').trim()),
    planned: Number(($('shB').textContent.match(/из\s*(\d+)\s*запланированных/) || [])[1]) }));
}
async function newMonth(p, mon) {
  await p.evaluate(mon => { sheetClose(); tab = 'prog'; render(); window.auditMon = mon; }, mon);
  await tap(p, '#wkBtn');
  // Real UI navigation from current week to the required week.
  for (let i = 0; i < 10 && await p.locator('#shB .wknav b').evaluate(el => el.textContent) !== await p.evaluate(() => wkLabel(auditMon)); i++) {
    await tap(p, '#shB .wknav [data-wk]:first-child');
  }
  await tap(p, '#shB > [data-mon]');
  return p.evaluate(() => ({ title: $('shT').textContent, text: $('shB').textContent.replace(/\s+/g, ' ').trim(),
    firstTile: document.querySelector('#shB .sum .win b')?.textContent || null }));
}
function values(ds) {
  const d = rangeData(ds, 1), w = weekData(mondayOf(ds)), ym = ds.slice(0, 7);
  const m = rangeData(ym + '-01', new Date(+ym.slice(0, 4), +ym.slice(5, 7), 0).getDate());
  return { ton: dayTon(ds), sets: daySets(ds), wo: !!recOf(ds).wo, all: S.vol['Грудь'],
    weekTon: w.ton, weekSets: w.sets, monthTon: m.ton, monthSets: m.sets,
    muscle: d.m['Грудь'], histories: exHistory('Жим лёжа'), lines: dayEntries(ds).map(entryLine) };
}
async function reload(p) { await p.evaluate(() => flush()); await p.reload(); await p.waitForFunction(() => typeof S === 'object' && S.setup === 1); }

(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 },
        hasTouch: true, timezoneId: 'Asia/Vladivostok', serviceWorkers: 'block', reducedMotion: 'reduce' });
      try {
        const p = await context.newPage(), errors = [];
        p.on('pageerror', e => errors.push(e.message));
        await p.clock.install({ time: new Date('2026-10-15T12:00:00+10:00') }); await p.clock.resume();
        await p.goto(APP); await p.waitForSelector('#setup.on');

        // WL-01. Mixed rows -> finish -> visible direct monthly report -> reload.
        await p.evaluate(seed, '2026-10-15');
        await fill(p, [20, 55, 70, 25], [12, 9, 7, 10], ['w', '', 'f', 'd']);
        await complete(p); await finish(p);
        let v = await p.evaluate(values, '2026-10-15');
        check(width + ' WL-01 exact work 55*9+70*7=985 across all derived totals',
          [v.ton, v.sets, v.all, v.weekTon, v.weekSets, v.monthTon, v.monthSets, v.muscle], [985, 2, 985, 985, 2, 985, 2, 2]);
        check(width + ' WL-01 graph actual heaviest work row', v.histories.map(x => x.slice(0, 3)), [['2026-10-15', 70, 2]]);
        let report = await oldMonth(p, '2026-10');
        check(width + ' WL-01 visible best month weight equals actual heaviest row', report.best, ['Жим лёжа70 кг']);
        console.log('EVIDENCE WL-01 ' + width + ' ' + JSON.stringify(report));
        await reload(p); report = await oldMonth(p, '2026-10');
        check(width + ' WL-01 best month weight after reload', report.best, ['Жим лёжа70 кг']);

        // WL-02. Completed earlier month -> pause one historical week -> both entry points.
        await p.evaluate(seed, '2026-09-10');
        await fill(p, [50, 55], [8, 7]); await complete(p); await finish(p);
        await p.evaluate(() => { sheetClose(); sel = '2026-09-10'; tab = 'wo'; exOpen = null; wkMode = 'this'; render(); });
        await tap(p, '#wkPlan'); await tap(p, '[data-wppause="2026-09-07"]'); await tap(p, '#shX');
        report = await oldMonth(p, '2026-09');
        const newer = await newMonth(p, '2026-09-07');
        // Wednesdays 2/9/16/23/30 and Thursdays 3/10/17/24 = 9;
        // the paused week removes Wednesday 9 and Thursday 10 => 7 planned.
        check(width + ' WL-02 new month excludes two paused dates', newer.firstTile, '1/7');
        check(width + ' WL-02 direct month excludes same two paused dates', report.planned, 7);
        console.log('EVIDENCE WL-02 ' + width + ' ' + JSON.stringify({ old: report, newer }));
        await reload(p); report = await oldMonth(p, '2026-09');
        check(width + ' WL-02 direct month pause count after reload', report.planned, 7);

        // WL-03. Change all Thursdays to rest after a closed September workout.
        await p.evaluate(seed, '2026-09-10');
        await fill(p, [50, 55], [8, 7]); await complete(p); await finish(p);
        await p.evaluate(() => { sheetClose(); sel = today(); tab = 'wo'; exOpen = null; wkMode = 'this'; render(); });
        await tap(p, '#wkPlan'); await tap(p, '[data-wpm="all"]'); await tap(p, '[data-wpd="3"]');
        await tap(p, '[data-wpt="rest"]'); await tap(p, '#askY'); await tap(p, '#shX');
        report = await oldMonth(p, '2026-09'); const changed = await newMonth(p, '2026-09-07');
        check(width + ' WL-03 dated month keeps nine past planned dates', changed.firstTile, '1/9');
        check(width + ' WL-03 direct month uses same historical types', report.planned, 9);
        console.log('EVIDENCE WL-03 ' + width + ' ' + JSON.stringify({ old: report, newer: changed }));
        await reload(p); report = await oldMonth(p, '2026-09');
        check(width + ' WL-03 direct month historical count after reload', report.planned, 9);

        // WL-04. Cross-month mixed closure -> later closure -> reopen old -> edit -> Undo/reload.
        await p.evaluate(seed, '2026-09-30');
        await fill(p, [20, 55, 70, 25], [12, 9, 7, 10], ['w', '', 'f', 'd']); await complete(p); await finish(p);
        await select(p, '2026-10-01'); await fill(p, [40, 45, 50], [8, 9, 7]); await complete(p); await finish(p);
        await select(p, '2026-09-30'); await complete(p);
        v = await p.evaluate(values, '2026-09-30');
        check(width + ' WL-04 reopening old removes September only', [v.ton, v.sets, v.monthTon, v.weekTon, v.all, v.wo], [0, 0, 0, 1075, 1075, false]);
        await p.locator('[data-ws="2"]').fill('65'); await complete(p);
        v = await p.evaluate(values, '2026-09-30');
        check(width + ' WL-04 old edit 55*9+65*7=950 plus October1075', [v.ton, v.sets, v.monthTon, v.weekTon, v.all], [950, 2, 950, 2025, 2025]);
        await tap(p, '#undoB');
        check(width + ' WL-04 Undo returns open old draft without changing October',
          await p.evaluate(() => [dayTon('2026-09-30'), dayTon('2026-10-01'), S.vol['Грудь'], !!recOf('2026-09-30').log[0].done]), [0, 1075, 1075, false]);
        await complete(p); await reload(p);
        v = await p.evaluate(values, '2026-09-30');
        check(width + ' WL-04 reload preserves independently recomputed totals', [v.ton, v.sets, v.monthTon, v.weekTon, v.all], [950, 2, 950, 2025, 2025]);

        // WL-05. Partial ticks -> shrink -> grow -> failure/drop -> close, finish, reload.
        await p.evaluate(seed, '2026-10-15');
        await fill(p, [40, 50, 60, 70], [8, 7, 6, 5]);
        await tap(p, '[data-tick="0"]'); await tap(p, '[data-tick="1"]');
        await p.locator('[data-f="s"]').fill('2'); await p.locator('[data-f="s"]').blur();
        check(width + ' WL-05 shrink is still draft with zero credited work', await p.evaluate(() => [dayTon(sel), daySets(sel), !!recOf(sel).log[0].done]), [0, 0, false]);
        await fill(p, [40, 50, 60], [8, 7, 6], ['', 'f', 'd']); await complete(p); await finish(p);
        v = await p.evaluate(values, '2026-10-15');
        check(width + ' WL-05 changed row structure counts 40*8+50*7=670', [v.ton, v.sets, v.all, v.weekTon, v.monthTon], [670, 2, 670, 670, 670]);
        await reload(p); v = await p.evaluate(values, '2026-10-15');
        check(width + ' WL-05 row structure and totals persist', [v.ton, v.sets, v.all, v.lines[0]], [670, 2, 670, '8/7О + дроп 6 · 40/50 кг']);

        // WL-06. Complete with changed target/weight -> move global weekday -> uncomplete.
        await p.evaluate(seed, '2026-10-15');
        await fill(p, [60, 65], [9, 9]);
        await p.locator('[data-f="r"]').fill('9'); await p.locator('[data-f="r"]').blur(); await complete(p); await finish(p);
        await p.evaluate(() => { sheetClose(); exOpen = null; wkMode = 'this'; render(); });
        await tap(p, '#wkPlan'); await tap(p, '[data-wpm="all"]');
        await tap(p, '[data-wpd="3"]'); await tap(p, '[data-wpd="4"]'); await tap(p, '#shX');
        v = await p.evaluate(values, '2026-10-15');
        check(width + ' WL-06 weekday swap keeps locked workout exact', [v.ton, v.sets, v.monthTon, v.wo], [1125, 2, 1125, true]);
        await select(p, '2026-10-15'); await complete(p);
        check(width + ' WL-06 uncomplete follows remapped rollback indices', await p.evaluate(() => ({
          ton: dayTon(sel), total: S.vol['Грудь'], wo: !!recOf(sel).wo,
          program: S.days.flatMap(d => d.ex).map(e => [e.w, e.r]) })),
          { ton: 0, total: 0, wo: false, program: [[50, '6-10'], [50, '6-10']] });
        await reload(p); check(width + ' WL-06 rollback survives reload', await p.evaluate(() => [dayTon('2026-10-15'), S.vol['Грудь'], !!recOf('2026-10-15').wo]), [0, 0, false]);
        check(width + ' no application page errors', errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  console.log('Workout links audit: ' + checks + ' checks, ' + failed + ' failed expectations.');
  process.exitCode = failed ? 1 : 0;
})().catch(e => { console.error('HARNESS ERROR', e.stack); process.exitCode = 2; });
