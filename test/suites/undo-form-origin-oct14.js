/* BUG-0020: Undo must not close a later independent form already open at tap.
   Breaks caught: treating the current sheet as the original action's sheet,
   losing a raw measurement, dropping modal focus/scroll, or breaking the
   original workout-summary close and week-plan reopen paths. Native IDB. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const DAY = '2026-10-13';
let checks = 0, failures = 0;
function check(name, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); console.log('  ✓ ' + name); }
  catch (e) { failures++; console.log('  ✗ ' + name + ' ' + e.message.split('\n').slice(0, 7).join(' ')); }
}
async function tap(p, selector) { await p.locator(selector).first().click(); await p.waitForTimeout(290); }
async function fresh(browser, width, recorded) {
  const context = await browser.newContext({viewport: {width, height: width === 320 ? 568 : 844}, timezoneId: 'Asia/Vladivostok', serviceWorkers: 'block', reducedMotion: 'reduce', isMobile: true, hasTouch: true});
  await context.route('https://**/*', route => route.abort());
  const p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  await p.clock.install({time: new Date('2026-10-13T12:00:00+10:00')}); await p.clock.resume();
  await p.goto(APP); await tap(p, '#setSkip');
  await p.evaluate(recorded => {
    S = build(); migrate(); S.setup = 1; S.bw = '75'; S.sound = 0; S.hints = 0; S.start = '2026-10-05'; S.bkAsk = Date.now();
    S.rec = {}; S.map = {}; S.pause = {}; S.meas = {}; S.exNote = {fixture: 'independent journal'};
    sel = today(); tab = 'wo'; exOpen = null; wkMode = 'this'; wkOf = null; wkPick = null;
    entCache = null; wkCache = null;
    if (recorded) {
      const d = dayOf(sel), e = d.ex[0];
      S.rec[sel] = {wo: 0, t0: Date.now() - 3600000, sp: {}, log: {0: {n: e.n, g: e.g, done: 1, w: 40, s: 1, r: '8', rs: [8], ws: [40], vol: 320, xp: 12}}};
    }
    scrubKeys(); recomputeStats(1); undoDrop(); save(); flush(); render();
  }, recorded);
  return {context, p, errors};
}
async function state(p) { return p.evaluate(() => JSON.parse(snapS())); }
async function undoDone(p, before) { await p.waitForFunction(() => !undoRec?.busy, null, {timeout: 3000}).catch(async e => {
  console.log('UNDO diagnostic '+JSON.stringify(await p.evaluate(()=>({undo:!!undoRec,busy:!!undoRec?.busy,note:$('noteT').textContent,ask:$('ask').className,sh:$('sh').className,lastTap,elapsed:Date.now()-fixtureOriginUndo.started,originStillActive:undoRec===fixtureOriginUndo.rec,t0:S.rec[today()]?.t0,raw:document.querySelector('[data-mk="waist"]')?.value}))));throw e;
}); }
async function measurements(p) {
  await tap(p, '[data-tab="prog"]'); await tap(p, '[data-meas="1"]');
  await p.fill('[data-mk="waist"]', '87,5');
  // Use a real wheel event on the visible form, then record its actual offset.
  await p.mouse.move(150, 250); await p.mouse.wheel(0, 60); await p.waitForTimeout(150);
  await p.locator('[data-mk="waist"]').focus();
  return p.evaluate(() => ({scroll: $('sh').scrollTop, raw: document.querySelector('[data-mk="waist"]').value}));
}
async function assertIndependentForm(p, label, before, view) {
  const timing=await p.evaluate(()=>({elapsed:Date.now()-fixtureOriginUndo.started,active:undoRec===fixtureOriginUndo.rec}));
  check(label + ' original Undo still offered before tap', timing.active, true);
  check(label + ' actual button action remains within7s', timing.elapsed < 7000, true);
  await tap(p, '#undoB'); await undoDone(p, before);
  check(label + ' raw form change creates no replacement Undo', await p.evaluate(()=>!!undoRec), false);
  check(label + ' exact pre-action state restored', await state(p), before);
  const ui = await p.evaluate(() => ({on: $('sh').classList.contains('on'), raw: document.querySelector('[data-mk="waist"]').value,
    lock: document.body.style.overflow, focusInside: $('sh').contains(document.activeElement), scroll: $('sh').scrollTop, ask: $('ask').classList.contains('on')}));
  check(label + ' new measurement stays open', ui.on, true);
  check(label + ' raw comma value retained', ui.raw, '87,5');
  check(label + ' modal scroll lock retained', ui.lock, 'hidden');
  check(label + ' focus remains inside form', ui.focusInside, true);
  check(label + ' existing form scroll retained', ui.scroll, view.scroll);
  check(label + ' no destructive-close confirmation required', ui.ask, false);
  // Expose the old hidden-DOM illusion: reopening used to erase the raw value.
  if (!ui.on) await tap(p, '[data-meas="1"]');
  check(label + ' value is usable in open form', await p.locator('[data-mk="waist"]').inputValue(), '87,5');
  if (!ui.on) await p.fill('[data-mk="waist"]', '87,5');
  await tap(p, '[data-measave="1"]');
  check(label + ' retained value can be saved', await p.evaluate(() => S.meas[today()].waist), 87.5);
  const saved = await state(p); await p.reload();
  check(label + ' exact resulting state survives reload', await state(p), saved);
  await tap(p, '[data-tab="prog"]'); await tap(p, '[data-meas="1"]');
  check(label + ' saved measurement survives reload', await p.locator('[data-mk="waist"]').inputValue(), '87,5');
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) {
      for (const action of ['start', 'workout', 'photo']) {
        const {context, p, errors} = await fresh(browser, width, action === 'workout');
        try {
          if (action === 'photo') {
            await p.evaluate(async photo => { await phPut(today(), photo); PHCACHE.clear(); await phSync(); }, PHOTO);
            await tap(p, '[data-tab="photo"]'); await p.waitForSelector('#phT img');
          }
          const before = await state(p);
          if (action === 'photo') {
            await tap(p, '#phDel'); await tap(p, '#askY'); await p.waitForFunction(() => !!undoRec && !PH.includes(today()));
          } else {
            await tap(p, '#fin');
            if (action === 'workout') {
              check(width + ' workout opens acted summary', await p.locator('#sh').evaluate(e => e.classList.contains('on')), true);
              await tap(p, '#shX');
            }
          }
          await p.evaluate(()=>{window.fixtureOriginUndo={started:Date.now(),rec:undoRec};});
          const view = await measurements(p);
          await assertIndependentForm(p, width + ' ' + action + ' Undo', before, view);
          if (action === 'photo') check(width + ' photo Undo restores exact native image after reload', await p.evaluate(day => phGet(day), DAY), PHOTO);
          check(width + ' ' + action + ' no uncaught errors', errors, []);
        } finally { await context.close(); }
      }
      // A sheet actually opened by the undone action still closes.
      {
        const {context, p, errors} = await fresh(browser, width, true);
        try {
          const before = await state(p); await tap(p, '#fin'); await tap(p, '#undoB'); await undoDone(p, before);
          check(width + ' acted workout summary closes on Undo', await p.evaluate(() => [$('sh').classList.contains('on'), document.body.style.overflow]), [false, '']);
          check(width + ' acted summary exact state restored', await state(p), before);
          await p.reload(); check(width + ' acted summary state survives reload', await state(p), before);
          check(width + ' acted summary no uncaught errors', errors, []);
        } finally { await context.close(); }
      }
      // Undo of an action made within Week rebuilds that same Week window.
      {
        const {context, p, errors} = await fresh(browser, width, false);
        try {
          const before = await state(p); await tap(p, '#wkPlan'); await tap(p, '[data-wppause]');
          check(width + ' week pause writes primary state', await p.evaluate(() => S.pause['2026-10-12']), 1);
          await tap(p, '#undoB'); await undoDone(p, before);
          check(width + ' acted Week stays open after Undo', await p.evaluate(() => [$('sh').classList.contains('on'), $('shT').textContent, document.body.style.overflow]), [true, 'НЕДЕЛЯ', 'hidden']);
          check(width + ' acted Week focus inside modal', await p.evaluate(() => $('sh').contains(document.activeElement)), true);
          check(width + ' acted Week exact state restored', await state(p), before);
          await p.reload(); check(width + ' acted Week state survives reload', await state(p), before);
          check(width + ' acted Week no uncaught errors', errors, []);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  console.log('Undo form origin: ' + checks + ' checks, ' + failures + ' failures'); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('FATAL', e); process.exitCode = 1; });
