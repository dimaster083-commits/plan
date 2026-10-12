/* BUG0003: trusted repeated start taps must not hit newly revealed cancellation.
   Fresh synthetic browser contexts only; no owner profile or external network. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let checks = 0, failures = 0;
function check(name, actual, verify) {
  checks++;
  try { verify(actual); console.log('✓ ' + name); }
  catch (e) { failures++; console.log('✗ ' + name + ': ' + e.message + '; actual=' + JSON.stringify(actual)); }
}
async function fixture(p) {
  await p.evaluate(() => {
    S = build(); migrate(); S.setup = 1; S.sound = 0; S.bw = 80; S.start = '2026-12-10';
    const d = S.days[wdOf('2026-10-10')];
    d.t = 'up1'; d.ex = [{ n: 'Жим лёжа', s: 3, r: '6-8', w: 60, g: 'Грудь' }];
    S.rec = { '2026-10-10': { log: {}, sp: {}, ml: [{ n: 'Синтетическая еда', items: [{ n: 'Тест', g: 123 }] }] } };
    entCache = null; recomputeStats(1); save(); flush();
    $('setup').classList.remove('on'); sheetClose(); undoDrop();
    tab = 'wo'; sel = '2026-10-10'; exOpen = null; edit = false; editPast = false;
    render(); window.scrollTo(0, 0); window.tapTrace = { down: [], click: [] };
  });
  await p.waitForTimeout(310);
}
async function state(p) {
  return p.evaluate(() => ({ rec: JSON.parse(JSON.stringify(recOf('2026-10-10'))),
    start: S.start, sel, xp: S.xp, vol: JSON.stringify(S.vol), ton: dayTon('2026-10-10'),
    sets: daySets('2026-10-10'), open: exOpen, sheet: $('sh').classList.contains('on'), trace: window.tapTrace }));
}
function noWork(x, before) {
  assert.equal(x.rec.wo || 0, 0); assert.equal(x.ton, 0); assert.equal(x.sets, 0);
  assert.equal(x.xp, before.xp); assert.equal(x.vol, before.vol);
  assert.deepEqual(x.rec.ml, before.rec.ml); assert.equal(x.start, before.start); assert.equal(x.sel, before.sel);
}
function exactDay(x, expected) {
  noWork(x, expected); assert.deepEqual(x.rec, expected.rec);
}
async function reload(p) {
  await p.evaluate(() => flush()); await p.reload();
  await p.waitForFunction(() => typeof S !== 'undefined' && !!S && !!S.setup);
}
async function fastClick(p, selector) {
  // Locator click waits for entrance animations, which would evade the <260ms case.
  // Mouse uses the rendered button's current center and still emits trusted input.
  const box = await p.locator(selector).boundingBox();
  assert.ok(box, 'visible target: ' + selector);
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
async function trace(p) {
  await p.evaluate(() => {
    window.tapTrace = { down: [], click: [] };
    document.addEventListener('pointerdown', e => {
      const el = e.target.closest('button,[data-open]');
      tapTrace.down.push({ id: el?.id || '', trusted: e.isTrusted, x: e.clientX, y: e.clientY, t: performance.now() });
    }, true);
    // Bubble observes state after the actual handler; suppressed clicks never arrive here.
    document.addEventListener('click', e => {
      const el = e.target.closest('button,[data-open]');
      tapTrace.click.push({ id: el?.id || '', trusted: e.isTrusted, t: performance.now(), t0: recOf('2026-10-10').t0 || null });
    });
  });
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, timezoneId: 'Asia/Vladivostok', locale: 'ru-RU', reducedMotion: 'reduce' });
      try {
        await context.route('https://**/*', r => r.abort());
        await context.addInitScript(() => {
          const D = Date, base = new D('2026-10-10T02:00:00Z').getTime(), mark = performance.now();
          window.Date = class extends D {
            constructor(...args) { super(...(args.length ? args : [base + performance.now() - mark])); }
            static now() { return base + performance.now() - mark; }
          };
        });
        const p = await context.newPage(), errors = [];
        p.setDefaultTimeout(8000); p.on('pageerror', e => errors.push(e.message));
        await p.goto(APP); await p.waitForFunction(() => typeof S !== 'undefined' && !!S);
        await p.waitForTimeout(1200); await trace(p);
        const label = viewport.width + 'px ';

        await fixture(p); const baseline = await state(p);
        await p.locator('#fin').dblclick({ delay: 40 });
        await p.waitForTimeout(310); const doubled = await state(p);
        const firstT0 = doubled.trace.click[0]?.t0;
        check(label + 'same-coordinate trusted double start stays started once', doubled, x => {
          noWork(x, baseline); assert.ok(firstT0); assert.equal(x.rec.t0, firstT0);
          assert.equal(x.trace.down.length, 2); assert.deepEqual(x.trace.down.map(e => e.id), ['fin', 'woCx']);
          assert.ok(x.trace.down.every(e => e.trusted));
          assert.equal(x.trace.down[0].x, x.trace.down[1].x); assert.equal(x.trace.down[0].y, x.trace.down[1].y);
          assert.ok(x.trace.down[1].t - x.trace.down[0].t < 260);
          assert.equal(x.trace.click.length, 1); assert.equal(x.trace.click[0].trusted, true);
        });
        await reload(p); await trace(p);
        check(label + 'double-start survives reload with original timestamp', await state(p), x => {
          noWork(x, baseline); assert.ok(firstT0); assert.equal(x.rec.t0, firstT0);
        });

        await fixture(p); const empty = await state(p);
        await p.locator('#fin').click(); const started = await state(p);
        await p.waitForTimeout(310); await p.locator('#woCx').click();
        const cancelled = await state(p);
        check(label + 'intentional cancellation after 310ms preserves date and food', cancelled, x => {
          assert.ok(started.rec.t0); exactDay(x, empty);
          assert.ok(x.trace.click[1].t - x.trace.click[0].t >= 310);
        });
        await p.locator('#undoB').click();
        check(label + 'undo cancellation restores exact start and food', await state(p), x => exactDay(x, started));
        await reload(p); await trace(p);
        check(label + 'restored start persists through reload', await state(p), x => exactDay(x, started));

        await fixture(p); const beforeUndo = await state(p);
        await p.locator('#fin').click(); await fastClick(p, '#undoB');
        check(label + 'immediate undo is available inside finger window', await state(p), x => {
          exactDay(x, beforeUndo); assert.equal(x.trace.click[1]?.id, 'undoB');
          assert.ok(x.trace.click[1].t - x.trace.click[0].t < 260);
        });

        await fixture(p); const beforeOpen = await state(p);
        await p.locator('#fin').click(); await fastClick(p, '#wkPlan');
        check(label + 'unrelated fast week button is allowed', await state(p), x => {
          noWork(x, beforeOpen); assert.ok(x.rec.t0); assert.equal(x.sheet, true);
          assert.equal(x.trace.click[1].id, 'wkPlan');
          assert.ok(x.trace.click[1].t - x.trace.click[0].t < 260);
        });
        await p.locator('#shX').click();
        await p.locator('.exrow[data-open="0"]').click();
        await p.waitForTimeout(310); await p.locator('[data-tick="0"]').dblclick({ delay: 40 });
        check(label + 'same-button double tap still marks one partial set', await state(p), x => {
          noWork(x, beforeOpen); assert.deepEqual(x.rec.log[0].ck, [0]); assert.ok(!x.rec.log[0].done);
        });
        check(label + 'runtime and horizontal fit', { errors, fit: await p.evaluate(() => document.documentElement.scrollWidth <= innerWidth) }, x => {
          assert.deepEqual(x.errors, []); assert.equal(x.fit, true);
        });
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  console.log('tap-start-oct12: ' + checks + ' checks, ' + failures + ' failures');
  if (failures) process.exitCode = 1;
})().catch(e => { console.error(e); process.exitCode = 2; });
