/* BUG-0040 audit only: manual norms must survive when the historical day type
   has no matching slot in the current week. Real UI, isolated synthetic data.
   Correct product expectations fail with exit 1; a broken harness uses exit 2.
   No application patches, personal profile, clipboard, or external network. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');

const DATES = ['2026-10-13', '2026-10-14', '2026-10-15'];
const NAME = 'MANUAL NORM Food';
const FOOD = [{ n: NAME, k: 100, p: 10, f: 2, c: 15 }];
const ITEMS = [125, 250, 50].map(g => [{ p: NAME, g: String(g) }]);
const TEMPLATE = [{ n: '400g template', ml: [{ n: 'Template', note: '', items: [{ p: NAME, g: '400' }] }] }];
const SUMS = [
  { k: 125, p: 12.5, f: 2.5, c: 18.75 },
  { k: 250, p: 25, f: 5, c: 37.5 },
  { k: 50, p: 5, f: 1, c: 7.5 }
];
const MANUAL = ['2100', '160'];
let cases = 0, checks = 0, failedExpectations = 0;

async function tap(p, selector) {
  await p.locator(selector).first().click();
  await p.waitForTimeout(280); // the product's independent-tap guard is 260ms
}
async function fill(p, selector, value) {
  await p.locator(selector).fill(value);
  await p.locator(selector).blur();
  await p.waitForTimeout(175);
}
async function selectDate(p, date) {
  await tap(p, '#chips [data-d="' + date + '"]');
}
async function seed(p) {
  await p.goto(APP);
  await p.waitForFunction(() => typeof render === 'function');
  await p.waitForSelector('#setup.on');
  await tap(p, '#setSkip');
  await p.evaluate(({ dates, name }) => {
    S = build(); migrate(); S.setup = 1; S.hints = 0; S.sound = 0; S.bkAsk = Date.now();
    S.bw = '80'; S.goal = '80'; S.height = 180; S.age = 30; S.sex = 'm'; S.act = 'sit';
    S.rec = {}; S.pause = {}; S.map = {}; S.kcManual = 0;
    applyNutri();
    S.myFood = [{ n: name, k: 100, p: 10, f: 2, c: 15 }]; invalidateFood();
    dates.forEach((date, i) => {
      recRW(date).ml = [{ n: 'Meal ' + date, note: '', items: [{ p: name, g: ['125', '250', '50'][i] }] }];
    });
    S.tpl = [{ n: '400g template', ml: [{ n: 'Template', note: '', items: [{ p: name, g: '400' }] }] }];
    sel = dates[0]; mo = '2026-10'; tab = 'food'; lastDay = today(); exOpen = null;
    closeSetup(); undoDrop(); save(); flush(); render();
  }, { dates: DATES, name: NAME });
}
async function state(p, date) {
  return p.evaluate(({ date, dates }) => {
    flush();
    const disk = JSON.parse(localStorage.getItem(KEY));
    const food = state => ({ items: dates.map(ds => state.rec[ds].ml[0].items), myFood: state.myFood, tpl: state.tpl });
    // Use the application's own read model for each saved snapshot. This is a
    // synchronous read: restore S in finally, with no save/render while swapped.
    const resolvedNorms = state => {
      const current = S;
      try { S = state; const n = normDay(date); return [String(n.kc), String(n.pr)]; }
      finally { S = current; }
    };
    return {
      sel, inputs: [$('kc').value, $('pr').value],
      resolved: resolvedNorms(S), diskResolved: resolvedNorms(disk),
      summary: [$('tKc').textContent, $('tPr').textContent],
      manual: [S.kcManual, disk.kcManual],
      historicalType: S.rec[date].dt,
      types: S.days.map(d => d.t),
      templateNorms: S.days.map(d => ({ t: d.t, kc: d.kc, pr: d.pr })),
      diskTemplateNorms: disk.days.map(d => ({ t: d.t, kc: d.kc, pr: d.pr })),
      resolvedIsTemplate: S.days.includes(normDay(date)),
      food: food(S), diskFood: food(disk), sums: dates.map(daySum)
    };
  }, { date, dates: DATES });
}
function check(errors, actual, expected, label) {
  checks++;
  try { assert.deepEqual(actual, expected, label); }
  catch (error) {
    if (error.code !== 'ERR_ASSERTION') throw error;
    failedExpectations++;
    errors.push({ label, actual, expected, error: error.message });
  }
}
function foodCheck(errors, snapshot, stage) {
  const food = { items: ITEMS, myFood: FOOD, tpl: TEMPLATE };
  check(errors, { live: snapshot.food, disk: snapshot.diskFood, sums: snapshot.sums },
    { live: food, disk: food, sums: SUMS }, stage + ': dated food, grams, database and template remain unchanged');
}
function manualChecks(errors, snapshot, stage, date) {
  const summary = date === DATES[0] ? ['125 / 2100 ккал', '13 / 160 г'] : ['250 / 2100 ккал', '25 / 160 г'];
  check(errors, snapshot.inputs, MANUAL, stage + ': fields retain manual 2100/160');
  check(errors, snapshot.resolved, MANUAL, stage + ': S resolves manual 2100/160');
  check(errors, snapshot.diskResolved, MANUAL, stage + ': persisted S resolves manual 2100/160');
  check(errors, snapshot.summary, summary, stage + ': totals use the same manual norms');
  check(errors, snapshot.manual, [1, 1], stage + ': manual flag is persisted');
}
async function run(browser, width, mode) {
  cases++;
  const ctx = await browser.newContext({
    viewport: { width, height: width === 320 ? 568 : 844 },
    timezoneId: 'Asia/Vladivostok', locale: 'ru-RU', reducedMotion: 'reduce', serviceWorkers: 'block'
  });
  await ctx.route('**/*', route => /^(file|data|blob):/.test(route.request().url()) ? route.continue() : route.abort());
  const failures = [], evidence = {}, runtimeErrors = [];
  try {
    const p = await ctx.newPage(); p.setDefaultTimeout(7000);
    p.on('pageerror', error => runtimeErrors.push(error.message));
    await p.clock.install({ time: new Date('2026-10-15T12:00:00+10:00') });
    await p.clock.resume(); await p.clock.setFixedTime(new Date('2026-10-15T12:00:00+10:00'));
    await seed(p);

    const allRest = mode === 'all-rest', date = allRest ? DATES[0] : DATES[1];
    const changes = await p.evaluate(allRest => S.days.map((d, i) => ({ i, t: d.t }))
      .filter(d => allRest ? d.t !== 'rest' : d.t === 'rest').map(d => d.i), allRest);
    await tap(p, '[data-tab="wo"]'); await tap(p, '#wkPlan'); await tap(p, '[data-wpm="all"]');
    for (const i of changes) {
      await tap(p, '[data-wpd="' + i + '"]');
      await tap(p, '[data-wpt="' + (allRest ? 'rest' : 'up1') + '"]');
      await tap(p, '#askY');
      // Let each real Undo expire before the next row: on 320px it can cover
      // that button. Advance only this synthetic context's timer, not real time.
      await p.clock.runFor(7100); await p.waitForFunction(() => !undoRec);
    }
    await tap(p, '#shX'); await tap(p, '[data-tab="food"]'); await selectDate(p, date);
    evidence.before = await state(p, date);
    check(failures, evidence.before.types.every(t => allRest ? t === 'rest' : t !== 'rest'), true,
      'fixture: all current slots have the opposite rest/training class');
    check(failures, evidence.before.historicalType, allRest ? 'up1' : 'rest',
      'fixture: UI schedule edits retain the historical day type');

    await fill(p, '#kc', MANUAL[0]); await fill(p, '#pr', MANUAL[1]);
    evidence.typed = await state(p, date);
    await selectDate(p, date === DATES[0] ? DATES[1] : DATES[0]); await selectDate(p, date);
    evidence.navigated = await state(p, date);
    await p.reload(); await p.waitForFunction(() => typeof render === 'function');
    await tap(p, '[data-tab="food"]'); await selectDate(p, date);
    evidence.reloaded = await state(p, date);

    // Gather the whole sequence before reporting RED, so a first failed total
    // never hides the navigation/reload evidence for this same product bug.
    for (const [stage, snapshot] of Object.entries(evidence)) foodCheck(failures, snapshot, stage);
    for (const stage of ['typed', 'navigated', 'reloaded']) manualChecks(failures, evidence[stage], stage, date);
    check(failures, runtimeErrors, [], 'no uncaught application errors');
    check(failures, await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, 'no horizontal overflow');
    console.log(JSON.stringify({ bug: 'BUG-0040', width, mode, date, uiChangedSlots: changes,
      expected: 'manual 2100kcal/160g persists in S, disk, totals, date navigation and reload',
      status: failures.length ? 'EXPECTATION_FAILED' : 'PASS', evidence, runtimeErrors, failures }));
  } finally { await ctx.close(); }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) for (const mode of ['all-rest', 'all-training']) await run(browser, width, mode);
  } finally { await browser.close(); }
  console.log('MANUAL_NORMS_AUDIT ' + JSON.stringify({ cases, checks, failedExpectations, harnessErrors: 0 }));
  process.exitCode = failedExpectations ? 1 : 0;
})().catch(error => {
  console.error('MANUAL_NORMS_AUDIT ' + JSON.stringify({ cases, checks, failedExpectations, harnessErrors: 1, error: error.stack }));
  process.exitCode = 2;
});
