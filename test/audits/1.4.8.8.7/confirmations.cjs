/* Read-only release audit. Every context is an ephemeral synthetic profile.
 * RED means a violated user invariant was actually observed, not a suite crash.
 * No owner profile, remote writes, photos, or food editor is used. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');
const TIME = new Date('2026-10-13T12:00:00+10:00');
let red = 0, green = 0;
function check(name, ok, evidence) {
  if (ok) { green++; console.log('PASS ' + name); }
  else { red++; console.log('RED ' + name + ' ' + JSON.stringify(evidence, (key, value) => {
    if (key !== 'rec') return value;
    return Object.fromEntries(Object.entries(JSON.parse(value)).map(([ds, r]) =>
      [ds, { wo: r.wo, logCount: Object.keys(r.log || {}).length }]));
  })); }
}
function seed({ remind, foodFixture }) {
  S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0;
  S.bw = '80'; S.goal = '80'; S.start = '2026-09-28';
  S.bkAt = remind ? 0 : Date.now(); S.bkAsk = remind ? 0 : Date.now();
  S.rec = {}; S.tpl = []; S.quest = {}; S.map = {}; S.pause = {};
  S.days.forEach(d => { if (d.t !== 'rest') d.ex = d.ex.slice(0, 1); });
  for (const ds of ['2026-10-06', '2026-10-08', '2026-10-13']) {
    const d = dayOf(ds), e = d.ex[0];
    S.rec[ds] = { wo: 1, log: { 0: { done: 1, n: e.n, g: e.g,
      w: 40, s: 3, r: '8-10', rs: [8, 8, 8], ws: [40, 40, 40], vol: 960 } },
      sp: {}, dt: d.t, note: 'Synthetic confirmation fixture ' + ds, bw: '80' };
  }
  // A captured ration fixture reaches the existing askText path. No food draft
  // editor is exercised and no nutrition behavior is asserted by this audit.
  if (foodFixture) {
    S.myFood = [{ n: 'Confirmation fixture', k: 100, p: 10, f: 2, c: 15 }];
    S.rec['2026-10-13'].ml = [{ n: 'Fixture', items: [{ p: 'Confirmation fixture', g: '100' }] }];
    invalidateFood();
  }
  sel = today(); lastDay = today(); tab = 'wo'; exOpen = null; editPast = false;
  entCache = null; wkCache = null; closeSetup(); undoDrop();
  pendingActions.clear(); lastTap = { k: '', t: 0 };
  applyNutri(); save(); flush(); render();
}
function observeAsks() {
  window.confirmationCalls = [];
  for (const name of ['ask', 'askText']) {
    const original = name === 'ask' ? ask : askText;
    const wrap = (...args) => {
      const call = { kind: name, text: args[0], status: 'pending', openedAt: Date.now() };
      window.confirmationCalls.push(call);
      const p = original(...args);
      p.then(value => { call.status = 'resolved'; call.value = value; call.closedAt = Date.now(); });
      return p;
    };
    if (name === 'ask') ask = wrap; else askText = wrap;
  }
}
function view() {
  const active = document.activeElement;
  return { now: Date.now(), title: $('askT').textContent, on: $('ask').classList.contains('on'),
    inputHidden: $('askI').hidden, input: $('askI').value,
    active: active.id || active.tagName, activeVisible: !!active.getClientRects().length,
    calls: window.confirmationCalls, rec: JSON.stringify(S.rec),
    undo: !!undoRec, undoVisible: !$('undo').hidden, bkAsk: S.bkAsk, tpl: S.tpl.length };
}
async function tap(p, selector) {
  await p.locator(selector).first().click(); await p.clock.runFor(280);
}
async function setup(browser, width, remind, foodFixture = false, gateReader = false) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 },
    timezoneId: 'Asia/Vladivostok', reducedMotion: 'reduce', hasTouch: true });
  if (gateReader) await context.addInitScript(() => {
    const NativeReader = FileReader;
    window.readerReady = new Promise(res => { window.readerReadyResolve = res; });
    window.FileReader = class extends NativeReader {
      set onload(handler) {
        super.onload = event => {
          window.releaseReader = () => handler.call(this, event);
          window.readerReadyResolve();
        };
      }
    };
  });
  const p = await context.newPage(); p.setDefaultTimeout(10000);
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.clock.install({ time: TIME }); await p.clock.pauseAt(TIME);
  await p.goto(APP); await p.evaluate(seed, { remind, foodFixture });
  await p.reload(); await p.waitForFunction(() => S.setup === 1);
  const loadedAt = await p.evaluate(() => Date.now());
  await p.evaluate(observeAsks);
  return { context, p, loadedAt, errors };
}
async function reminder(p, loadedAt) {
  const elapsed = await p.evaluate(() => Date.now());
  await p.clock.runFor(Math.max(0, loadedAt + 2501 - elapsed));
}
async function importFixture(p, marker) {
  const state = await p.evaluate(() => JSON.parse(snapS()));
  state.rec = {}; state.goal = marker;
  const chooser = p.waitForEvent('filechooser');
  await p.locator('#imp').click();
  await (await chooser).setFiles({ name: 'synthetic-confirmation.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ v: 3, state, photos: {} })) });
}
async function run(browser, width, name, work, options = {}) {
  const test = await setup(browser, width, !!options.remind, !!options.food, !!options.gateReader);
  try { await work(test); assert.deepEqual(test.errors, [], name + ' page errors'); }
  finally { await test.context.close(); }
}
(async () => {
  const browser = await chromium.launch({ ...LAUNCH, headless: true });
  try {
    for (const width of [320, 390]) {
      await run(browser, width, 'reminder-reset', async ({ p, loadedAt }) => {
        const before = await p.evaluate(() => JSON.stringify(S.rec));
        await tap(p, '#rd'); const first = await p.evaluate(view);
        assert.match(first.title, /^Очистить тренировку/); assert.equal(first.active, 'askN');
        await reminder(p, loadedAt); const replaced = await p.evaluate(view);
        check('C01 ' + width + ' reminder preserves active reset confirmation', replaced.title === first.title,
          { before: first, after: replaced });
        await tap(p, '#askN'); const dismissed = await p.evaluate(view);
        check('C02 ' + width + ' cancellation settles every opened confirmation',
          dismissed.calls.every(c => c.status === 'resolved'), dismissed);
        check('C03 ' + width + ' cancellation restores initiating reset focus', dismissed.active === 'rd', dismissed);
        assert.equal(dismissed.rec, before, 'cancel leaves exact journal intact');
        check('C04 ' + width + ' reminder interruption never clears journal', dismissed.rec === before);
        await tap(p, '#rd'); await tap(p, '#askY'); assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 0);
        assert.equal(await p.evaluate(() => !!undoRec), true);
        await tap(p, '#undoB'); assert.equal(await p.evaluate(() => JSON.stringify(S.rec)), before);
        check('C05 ' + width + ' reset works again after interruption and Undo restores exact journal', true);
      }, { remind: true });
      await run(browser, width, 'reminder-text', async ({ p, loadedAt }) => {
        await tap(p, '[data-tab="food"]'); await tap(p, '#cpBtn'); await tap(p, '[data-save]');
        await p.locator('#askI').fill('Draft confirmation name');
        const first = await p.evaluate(view); assert.equal(first.inputHidden, false);
        await reminder(p, loadedAt); const after = await p.evaluate(view);
        check('C06 ' + width + ' reminder preserves visible name draft',
          after.title === first.title && !after.inputHidden && after.input === first.input, { first, after });
        await tap(p, '#askN'); const dismissed = await p.evaluate(view);
        assert.equal(dismissed.tpl, 0); assert.equal(dismissed.calls[0].status, 'pending');
        await tap(p, '[data-save]'); const reopened = await p.evaluate(view);
        check('C07 ' + width + ' interrupted text can be resumed with typed value',
          reopened.input === first.input, { typed: first.input, reopened: reopened.input });
        await p.keyboard.press('Escape'); await p.clock.runFor(280);
        check('C08 ' + width + ' text cancel leaves fixture and templates intact',
          await p.evaluate(() => S.tpl.length === 0 && daySum('2026-10-13').k === 100));
      }, { remind: true, food: true });
      await run(browser, width, 'reminder-undo', async ({ p, loadedAt }) => {
        await tap(p, '#rd'); await tap(p, '#askY');
        const before = await p.evaluate(view); assert.equal(before.undoVisible, true); assert.equal(before.undo, true);
        await reminder(p, loadedAt); const after = await p.evaluate(view);
        check('C09 ' + width + ' background reminder preserves recent reset Undo',
          after.undo && after.undoVisible, { before, after });
        assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 0);
        await tap(p, '#askN');
      }, { remind: true });
      await run(browser, width, 'wipe-gates', async ({ p }) => {
        await tap(p, '[data-tab="prog"]'); const before = await p.evaluate(() => snapS());
        await tap(p, '#wipe'); await tap(p, '#askN'); assert.equal(await p.evaluate(() => snapS()), before);
        check('C10 ' + width + ' first wipe cancel preserves exact state/focus',
          await p.evaluate(() => document.activeElement.id === 'wipe'));
        await tap(p, '#wipe'); await p.locator('#askY').click();
        assert.match(await p.locator('#askT').innerText(), /^Точно/);
        await p.locator('#askY').click(); // same trusted button at identical synthetic time
        assert.match(await p.locator('#askT').innerText(), /^Точно/);
        assert.equal(await p.evaluate(() => snapS()), before);
        check('C11 ' + width + ' rapid second yes does not pass both wipe gates', true);
        await tap(p, '#askN'); assert.equal(await p.evaluate(() => snapS()), before);
        check('C12 ' + width + ' second wipe cancel preserves exact state/focus',
          await p.evaluate(() => document.activeElement.id === 'wipe'));
      });
      await run(browser, width, 'midnight-reset', async ({ p }) => {
        await p.clock.setFixedTime(new Date('2026-10-13T23:59:00+10:00'));
        await p.evaluate(() => { sel = today(); lastDay = today(); render(); });
        const before = await p.evaluate(() => snapS()); await tap(p, '#rd');
        await p.clock.setFixedTime(new Date('2026-10-14T00:01:00+10:00'));
        await p.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
        assert.equal(await p.evaluate(() => sel), '2026-10-14');
        await tap(p, '#askY'); assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 0);
        assert.equal(await p.evaluate(() => recOf('2026-10-13').note), 'Synthetic confirmation fixture 2026-10-13');
        await tap(p, '#undoB'); assert.equal(await p.evaluate(() => snapS()), before);
        check('C13 ' + width + ' midnight reset targets original date; Undo restores exact state', true);
      });
      await run(browser, width, 'import-cancel', async ({ p }) => {
        await tap(p, '[data-tab="prog"]'); const before = await p.evaluate(() => snapS());
        await importFixture(p, '81'); await p.waitForSelector('#ask.on'); await tap(p, '#askN');
        assert.equal(await p.evaluate(() => snapS()), before);
        check('C14 ' + width + ' native FileReader import cancel preserves exact state/visible focus',
          await p.evaluate(() => !!document.activeElement.getClientRects().length));
      });
      await run(browser, width, 'reader-ask-race', async ({ p }) => {
        await tap(p, '[data-tab="prog"]'); const before = await p.evaluate(() => snapS());
        await importFixture(p, '81'); await p.evaluate(() => window.readerReady);
        await tap(p, '#wipe'); const first = await p.evaluate(view);
        await p.evaluate(() => { window.releaseReader(); }); const after = await p.evaluate(view);
        check('C15 ' + width + ' delayed native FileReader prompt preserves active wipe confirmation',
          after.title === first.title, { first, after });
        await tap(p, '#askN'); const dismissed = await p.evaluate(view);
        check('C16 ' + width + ' delayed-reader race settles earlier wipe Promise',
          dismissed.calls.every(c => c.status === 'resolved'), dismissed);
        assert.equal(await p.evaluate(() => snapS()), before);
        check('C17 ' + width + ' delayed-reader collision cancellation preserves exact state', true);
      }, { gateReader: true });
      await run(browser, width, 'import-confirm', async ({ p }) => {
        await tap(p, '[data-tab="prog"]'); await importFixture(p, '81');
        await p.waitForSelector('#ask.on'); await tap(p, '#askY');
        await p.waitForFunction(() => S.goal === '81' && Object.keys(S.rec).length === 0);
        await p.evaluate(() => flush()); await p.reload();
        assert.equal(await p.evaluate(() => S.goal), '81');
        assert.equal(await p.evaluate(() => Object.keys(S.rec).length), 0);
        check('C18 ' + width + ' explicit import confirmation replaces only isolated fixture and survives reload', true);
      });
      await run(browser, width, 'wipe-confirm', async ({ p }) => {
        await tap(p, '[data-tab="prog"]'); await tap(p, '#wipe'); await tap(p, '#askY');
        assert.match(await p.locator('#askT').innerText(), /^Точно/);
        await p.evaluate(() => { window.wipeBeforeReload = true; });
        const reload = p.waitForEvent('load'); await p.locator('#askY').click(); await reload;
        assert.equal(await p.evaluate(() => window.wipeBeforeReload), undefined);
        assert.equal(await p.evaluate(() => Object.keys(S.rec).length), 0);
        assert.equal(await p.evaluate(() => !!S.setup), false);
        check('C19 ' + width + ' both explicit wipe confirmations clear only isolated fixture and reload', true);
      });
    }
  } finally { await browser.close(); }
  console.log('CONFIRMATION AUDIT: ' + green + ' PASS; ' + red + ' RED. All synthetic contexts closed.');
  process.exitCode = red ? 1 : 0;
})().catch(e => { console.error('FATAL', e.stack); process.exitCode = 2; });
