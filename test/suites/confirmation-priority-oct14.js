/* BUG-0027/0028: real UI and native FileReader in isolated synthetic Chrome.
 * Breaks caught: callback/draft overwrite, import between wipe gates, early
 * Undo invalidation, missed eventual backup, and stale reminder eligibility.
 * The reader gate delays native onload delivery only; it does not fake data. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
const TIME = new Date('2026-10-13T12:00:00+10:00');
const BACKUP = 'Копии прогресса не было больше трёх недель. Данные живут только в этом телефоне — сохранить копию сейчас?';
const RETRY = 'Сейчас открыт другой вопрос. После ответа выбери файл копии снова.';
const WIPE1 = 'Стереть всё: журнал, веса, рацион, фотографии и настройку? Отменить будет нельзя.';
const WIPE2 = 'Точно? Если копия не сохранена, прогресс восстановить не выйдет.';
let checks = 0, failures = 0;
async function tap(p, selector) { await p.locator(selector).first().click(); await p.clock.runFor(280); }
async function until(p, start, ms) { await p.clock.runFor(Math.max(0, start + ms - await p.evaluate(() => Date.now()))); }
function seed({ remind, meals, three }) {
  S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0;
  S.bw = '80'; S.goal = '80'; S.start = '2026-09-28';
  S.bkAt = remind ? 0 : Date.now(); S.bkAsk = remind ? 0 : Date.now();
  S.rec = {}; S.tpl = []; S.quest = {}; S.map = {}; S.pause = {};
  S.days.forEach(d => { if (d.t !== 'rest') d.ex = d.ex.slice(0, 1); });
  const dates = three ? ['2026-10-06', '2026-10-08', '2026-10-13']
    : ['2026-10-03', '2026-10-06', '2026-10-08', '2026-10-13'];
  for (const ds of dates) {
    const d = dayOf(ds), e = d.ex[0];
    S.rec[ds] = { wo: 1, log: { 0: { done: 1, n: e.n, g: e.g, w: 40,
      s: 3, r: '8-10', rs: [8, 8, 8], ws: [40, 40, 40], vol: 960 } },
      sp: {}, dt: d.t, note: 'Confirmation fixture ' + ds, bw: '80' };
  }
  if (meals) {
    S.myFood = [{ n: 'Confirmation fixture', k: 100, p: 10, f: 2, c: 15 }];
    S.rec['2026-10-13'].ml = [{ n: 'Fixture', items: [{ p: 'Confirmation fixture', g: '100' }] }];
    invalidateFood();
  }
  sel = today(); lastDay = today(); tab = 'wo'; exOpen = null; editPast = false;
  entCache = null; wkCache = null; closeSetup(); undoDrop();
  lastTap = { k: '', t: 0 }; applyNutri(); save(); flush(); render();
}
function observe() {
  window.askResults = [];
  for (const name of ['ask', 'askText']) {
    const original = name === 'ask' ? ask : askText;
    const wrapped = (...args) => {
      const result = { kind: name, text: args[0], pending: true };
      window.askResults.push(result);
      const promise = original(...args);
      promise.then(value => { result.pending = false; result.value = value; });
      return promise;
    };
    if (name === 'ask') ask = wrapped; else askText = wrapped;
  }
}
async function fresh(browser, width, options) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 },
    timezoneId: 'Asia/Vladivostok', reducedMotion: 'reduce', hasTouch: true, serviceWorkers: 'block' });
  if (options.reader) await context.addInitScript(() => {
    const NativeReader = FileReader;
    window.readerReleases = []; window.readerDone = 0;
    window.FileReader = class extends NativeReader {
      readAsText(file) {
        window.readerReady = new Promise(resolve => { window.readerReadyResolve = resolve; });
        super.readAsText(file);
      }
      set onload(handler) {
        super.onload = event => {
          window.readerReleases.push(() => {
            Promise.resolve(handler.call(this, event)).then(() => { window.readerDone++; });
          });
          window.readerReadyResolve();
        };
      }
    };
  });
  const p = await context.newPage(), errors = [];
  p.setDefaultTimeout(5000); p.on('pageerror', e => errors.push(e.message));
  // Install before the target on the blank page: the clock runs between API
  // calls, so pausing at the install instant can otherwise be in the past.
  await p.clock.install({ time: new Date(TIME.getTime() - 86400000) });
  await p.clock.pauseAt(TIME);
  assert.equal(await p.evaluate(() => Date.now()), TIME.getTime(), 'exact fixture clock before app load');
  await p.goto(APP); await p.evaluate(seed, options); await p.reload();
  await p.waitForFunction(() => S.setup === 1); await p.evaluate(observe);
  return { context, p, start: await p.evaluate(() => Date.now()), errors };
}
async function check(browser, width, name, options, work) {
  checks++; let test;
  try {
    test = await fresh(browser, width, options); await work(test);
    assert.deepEqual(test.errors, []); console.log('  ✓ ' + width + ' ' + name);
  } catch (e) {
    failures++; console.log('  ✗ ' + width + ' ' + name + ' — ' + e.message);
  } finally { if (test) await test.context.close(); }
}
async function chooseImport(p) {
  const state = await p.evaluate(() => JSON.parse(snapS())); state.goal = '81'; state.rec = {};
  const chooser = p.waitForEvent('filechooser'); await p.locator('#imp').click();
  await (await chooser).setFiles({ name: 'confirmation-fixture.json', mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ v: 3, state, photos: {} })) });
}
async function releaseReader(p) { await p.evaluate(() => { window.readerReleases.shift()(); }); }
async function notice(p) {
  assert.equal(await p.locator('#askStatus').count(), 1, 'retry notice exists in active dialog');
  assert.equal(await p.locator('#askStatus').innerText(), RETRY);
  assert.equal(await p.locator('#askStatus').isVisible(), true);
  assert.equal(await p.locator('#askStatus').getAttribute('role'), 'status');
  assert.equal(await p.locator('#askStatus').getAttribute('aria-live'), 'polite');
}
async function readCopy(download) {
  assert.equal(download.suggestedFilename(), 'sistema-2026-10-13.json');
  const stream = await download.createReadStream(), chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}
async function allSettled(p, values) {
  assert.deepEqual(await p.evaluate(() => window.askResults.map(r => ({ pending: r.pending, value: r.value }))),
    values.map(value => ({ pending: false, value })));
}
(async () => {
  const browser = await chromium.launch({ ...LAUNCH, headless: true });
  try { for (const width of [320, 390]) {
    await check(browser, width, 'reminder preserves reset, original Promise and focus; appears after cancel', { remind: true }, async ({ p, start }) => {
      const rec = await p.evaluate(() => JSON.stringify(S.rec)); await tap(p, '#rd');
      await until(p, start, 2501);
      assert.match(await p.locator('#askT').innerText(), /^Очистить тренировку за 13 окт 2026/);
      assert.equal(await p.evaluate(() => S.bkAsk), 0);
      assert.deepEqual(await p.evaluate(() => window.askResults.map(r => r.pending)), [true]);
      await tap(p, '#askN'); await allSettled(p, [false]);
      assert.equal(await p.evaluate(() => document.activeElement.id), 'rd');
      assert.equal(await p.evaluate(() => JSON.stringify(S.rec)), rec);
      await until(p, start, 3501); assert.equal(await p.locator('#askT').innerText(), BACKUP);
      assert.equal(await p.evaluate(() => S.bkAsk > 0), true); await tap(p, '#askN');
      await allSettled(p, [false, false]); await p.evaluate(() => flush()); await p.reload();
      await p.clock.runFor(3500); assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
      assert.equal(await p.evaluate(() => JSON.stringify(S.rec)), rec);
    });
    await check(browser, width, 'reminder preserves actual text draft and successful save', { remind: true, meals: true }, async ({ p, start }) => {
      const rec = await p.evaluate(() => JSON.stringify(S.rec));
      await tap(p, '[data-tab="food"]'); await tap(p, '#cpBtn'); await tap(p, '[data-save]');
      await p.locator('#askI').fill('Мой черновик'); await until(p, start, 2501);
      assert.equal(await p.locator('#askT').innerText(), 'Название шаблона');
      assert.equal(await p.locator('#askI').isVisible(), true);
      assert.equal(await p.locator('#askI').inputValue(), 'Мой черновик');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'askI');
      assert.equal(await p.evaluate(() => S.bkAsk), 0); await tap(p, '#askY');
      await allSettled(p, ['Мой черновик']);
      assert.deepEqual(await p.evaluate(() => S.tpl.map(t => t.n)), ['Мой черновик']);
      assert.equal(await p.evaluate(() => JSON.stringify(S.rec)), rec);
      await tap(p, '#shX'); await p.clock.runFor(8000);
      assert.equal(await p.locator('#askT').innerText(), BACKUP); await tap(p, '#askN');
      await allSettled(p, ['Мой черновик', false]); await p.evaluate(() => flush()); await p.reload();
      assert.deepEqual(await p.evaluate(() => S.tpl.map(t => t.n)), ['Мой черновик']);
      assert.equal(await p.evaluate(() => daySum('2026-10-13').k), 100);
    });
    await check(browser, width, 'settings modal defers backup until closed', { remind: true }, async ({ p, start }) => {
      await tap(p, '#gear'); await until(p, start, 2501);
      assert.equal(await p.locator('#shT').innerText(), 'НАСТРОЙКИ');
      assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
      assert.equal(await p.evaluate(() => S.bkAsk), 0);
      await p.keyboard.press('Escape'); await until(p, start, 3501);
      assert.equal(await p.locator('#askT').innerText(), BACKUP); await tap(p, '#askN');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'gear'); await allSettled(p, [false]);
    });
    await check(browser, width, 'reset Undo lasts seven seconds before backup appears', { remind: true }, async ({ p, start }) => {
      await tap(p, '#rd'); await tap(p, '#askY'); await until(p, start, 2501);
      assert.equal(await p.evaluate(() => !!undoRec), true); assert.equal(await p.locator('#undo').isVisible(), true);
      assert.equal(await p.evaluate(() => S.bkAsk), 0);
      assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
      assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 0);
      await until(p, start, 7279); assert.equal(await p.evaluate(() => !!undoRec), true);
      await until(p, start, 7281); assert.equal(await p.evaluate(() => !!undoRec), false);
      await until(p, start, 8001); assert.equal(await p.locator('#askT').innerText(), BACKUP);
      assert.equal(await p.evaluate(() => S.bkAsk >= 1791856807280), true); await tap(p, '#askN');
      await allSettled(p, [true, false]); await p.evaluate(() => flush()); await p.reload();
      assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 0);
      assert.equal(await p.evaluate(() => S.rec['2026-10-13'].note), 'Confirmation fixture 2026-10-13');
    });
    await check(browser, width, 'Undo during deferral restores exact record and eligible backup later', { remind: true }, async ({ p, start }) => {
      const rec = await p.evaluate(() => JSON.stringify(S.rec)); await tap(p, '#rd'); await tap(p, '#askY');
      await until(p, start, 2501); assert.equal(await p.evaluate(() => !!undoRec), true);
      await tap(p, '#undoB'); assert.equal(await p.evaluate(() => JSON.stringify(S.rec)), rec);
      assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 960);
      await until(p, start, 3501); assert.equal(await p.locator('#askT').innerText(), BACKUP); await tap(p, '#askN');
      await allSettled(p, [true, false]);
    });
    await check(browser, width, 'deferred backup rechecks remaining training count', { remind: true, three: true }, async ({ p, start }) => {
      await tap(p, '#rd'); await tap(p, '#askY'); await until(p, start, 2501);
      assert.equal(await p.evaluate(() => S.bkAsk), 0);
      assert.equal(await p.evaluate(() => !!undoRec), true); await until(p, start, 10001);
      assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
      assert.equal(await p.evaluate(() => S.bkAsk), 0);
      assert.equal(await p.evaluate(() => Object.values(S.rec).filter(r => r.wo).length), 2);
      await allSettled(p, [true]);
    });
    await check(browser, width, 'new actual export suppresses already deferred reminder', { remind: true }, async ({ p, start }) => {
      await tap(p, '#gear'); await until(p, start, 2501); assert.equal(await p.evaluate(() => S.bkAsk), 0);
      const download = p.waitForEvent('download'); await p.locator('[data-bk="exp"]').click();
      const copy = await readCopy(await download);
      assert.equal(copy.v, 3); assert.equal(copy.state.goal, '80'); assert.deepEqual(copy.photos, {});
      assert.equal(copy.state.rec['2026-10-13'].log[0].vol, 960);
      await p.waitForFunction(() => S.bkAt > 0); await p.clock.runFor(10000);
      assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
      assert.equal(await p.evaluate(() => S.bkAsk), 0); await allSettled(p, []);
      await p.evaluate(() => flush()); await p.reload(); await p.clock.runFor(3500);
      assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
    });
    await check(browser, width, 'ordinary reminder appears and affirmative answer downloads real copy', { remind: true }, async ({ p, start }) => {
      await until(p, start, 2501); assert.equal(await p.locator('#askT').innerText(), BACKUP);
      assert.equal(await p.evaluate(() => S.bkAsk), 1791856802500);
      const download = p.waitForEvent('download'); await p.locator('#askY').click();
      const copy = await readCopy(await download);
      assert.equal(copy.v, 3); assert.equal(copy.state.rec['2026-10-13'].log[0].vol, 960);
      assert.equal(Object.keys(copy.state.rec).length, 4); assert.deepEqual(copy.photos, {});
      await allSettled(p, [true]); await p.waitForFunction(() => S.bkAt > 0);
      await p.clock.runFor(300); await p.evaluate(() => flush()); await p.reload(); await p.clock.runFor(3500);
      assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
      assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 960);
    });
    for (const step of [1, 2]) await check(browser, width, 'late native import rejected during wipe step ' + step + '; retry succeeds', { reader: true }, async ({ p }) => {
      await tap(p, '[data-tab="prog"]'); const before = await p.evaluate(() => snapS());
      await chooseImport(p); await p.evaluate(() => window.readerReady); await tap(p, '#wipe');
      if (step === 2) {
        await p.locator('#askY').click(); assert.equal(await p.locator('#askT').innerText(), WIPE2);
        await p.locator('#askY').click(); assert.equal(await p.locator('#askT').innerText(), WIPE2);
        await p.clock.runFor(280);
      }
      assert.equal(await p.evaluate(() => document.activeElement.id), step === 1 ? 'askN' : 'askY');
      await releaseReader(p); assert.equal(await p.locator('#askT').innerText(), step === 1 ? WIPE1 : WIPE2);
      await notice(p); assert.equal(await p.evaluate(() => document.activeElement.id), step === 1 ? 'askN' : 'askY');
      assert.equal(await p.evaluate(() => window.readerDone), 1);
      assert.equal(await p.evaluate(() => snapS()), before); await tap(p, '#askN');
      await allSettled(p, step === 1 ? [false] : [true, false]);
      assert.equal(await p.evaluate(() => document.activeElement.id), 'wipe');
      await chooseImport(p); await p.evaluate(() => window.readerReady); await releaseReader(p);
      assert.match(await p.locator('#askT').innerText(), /^Журнал, веса и рацион будут заменены/);
      await tap(p, '#askY'); await p.waitForFunction(() => window.readerDone === 2);
      assert.equal(await p.evaluate(() => S.goal), '81'); assert.equal(await p.evaluate(() => Object.keys(S.rec).length), 0);
      await allSettled(p, step === 1 ? [false, true] : [true, false, true]);
      await p.evaluate(() => flush()); await p.reload(); assert.equal(await p.evaluate(() => S.goal), '81');
    });
    await check(browser, width, 'late native import preserves active text and accessible retry', { reader: true, meals: true }, async ({ p }) => {
      await tap(p, '[data-tab="prog"]'); await chooseImport(p); await p.evaluate(() => window.readerReady);
      await tap(p, '[data-tab="food"]'); await tap(p, '#cpBtn'); await tap(p, '[data-save]');
      const rec = await p.evaluate(() => JSON.stringify(S.rec)); await p.locator('#askI').fill('Не потерять имя');
      await releaseReader(p); assert.equal(await p.locator('#askT').innerText(), 'Название шаблона');
      assert.equal(await p.locator('#askI').inputValue(), 'Не потерять имя');
      assert.equal(await p.evaluate(() => document.activeElement.id), 'askI'); await notice(p);
      assert.equal(await p.evaluate(() => window.readerDone), 1); await tap(p, '#askY');
      await allSettled(p, ['Не потерять имя']); assert.equal(await p.evaluate(() => S.goal), '80');
      assert.deepEqual(await p.evaluate(() => S.tpl.map(t => t.n)), ['Не потерять имя']);
      assert.equal(await p.evaluate(() => JSON.stringify(S.rec)), rec);
      await p.evaluate(() => flush()); await p.reload(); assert.equal(await p.evaluate(() => daySum('2026-10-13').k), 100);
      assert.deepEqual(await p.evaluate(() => S.tpl.map(t => t.n)), ['Не потерять имя']);
    });
    await check(browser, width, 'overlapping shared requests settle refusal without replacing original callback', {}, async ({ p }) => {
      await tap(p, '#rd'); const title = await p.locator('#askT').innerText();
      await p.evaluate(() => { ask('Другой вопрос', 'ДА'); askText('Другое имя', 'Другое'); });
      assert.equal(await p.locator('#askT').innerText(), title);
      assert.equal(await p.locator('#askI').isVisible(), false);
      assert.equal(await p.evaluate(() => document.activeElement.id), 'askN');
      assert.deepEqual(await p.evaluate(() => window.askResults.map(r => ({ pending: r.pending, value: r.value }))),
        [{ pending: true, value: undefined }, { pending: false, value: false }, { pending: false, value: null }]);
      await tap(p, '#askN'); await allSettled(p, [false, false, null]);
      assert.equal(await p.evaluate(() => document.activeElement.id), 'rd');
      assert.equal(await p.evaluate(() => dayTon('2026-10-13')), 960);
    });
    await check(browser, width, 'deferred backup cannot interleave wipe gates; full wipe reloads empty profile', { remind: true }, async ({ p, start }) => {
      await tap(p, '[data-tab="prog"]'); await tap(p, '#wipe'); await until(p, start, 2501);
      assert.equal(await p.locator('#askT').innerText(), WIPE1); assert.equal(await p.evaluate(() => S.bkAsk), 0);
      await p.locator('#askY').click(); assert.equal(await p.locator('#askT').innerText(), WIPE2);
      await p.locator('#askY').click(); assert.equal(await p.locator('#askT').innerText(), WIPE2);
      await p.clock.runFor(280); assert.equal(await p.locator('#askT').innerText(), WIPE2);
      assert.equal(await p.evaluate(() => S.bkAsk), 0); await p.evaluate(() => { window.wipeToken = true; });
      const reload = p.waitForEvent('load'); await p.locator('#askY').click(); await reload;
      assert.equal(await p.evaluate(() => window.wipeToken), undefined);
      assert.equal(await p.evaluate(() => Object.keys(S.rec).length), 0); assert.equal(await p.evaluate(() => !!S.setup), false);
      await p.clock.runFor(3500); assert.equal(await p.locator('#ask').evaluate(e => e.classList.contains('on')), false);
    });
  }} finally { await browser.close(); }
  console.log('confirmation-priority-oct14: ' + checks + ' checks, ' + failures + ' failures; all synthetic contexts closed');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('FATAL', e.stack); process.exitCode = 2; });
