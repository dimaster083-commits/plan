/* BUG-0033: unreachable raw strings must expire without another Food paint.
   Breaks caught: missing cleanup; pruning a live dated/duplicate row or an
   Undo sidecar; a detached focused field retaining abandoned raw forever.
   Only retention assertions inspect Map size. Actual UI/journal/disk values
   use literal expectations from 100kcal/100g synthetic food. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
const A = '2026-10-13', B = '2026-10-14', SOURCE = '2026-10-12';
const RAW = '1e309', G = '#mll [data-ml="0"] input[data-g="0"]';
const redOnly = process.argv.includes('--red-only');
const handoffOnly = process.argv.includes('--handoff-only');
let checks = 0, failures = 0;
async function tap(p, selector) {
  await p.locator(selector).first().click();
  await p.waitForTimeout(280); // application's real260ms duplicate-tap guard
}
async function draft(p, selector = G) {
  await p.locator(selector).fill(RAW);
  assert.equal(await p.locator(selector).getAttribute('aria-invalid'), 'true');
}
async function raw(p, selector = G) {
  assert.equal(await p.locator(selector).inputValue(), RAW, 'exact raw belongs to original row');
  assert.equal(await p.locator(selector).getAttribute('aria-invalid'), 'true');
}
async function recorded(p, want) {
  const state = await p.evaluate(() => {
    flush();
    return { grams: S.rec['2026-10-13'].ml[0].items.map(i => i.g),
      disk: JSON.parse(localStorage.getItem(KEY)).rec['2026-10-13'].ml[0].items.map(i => i.g),
      k: daySum('2026-10-13').k, ui: $('tKc').firstChild.textContent.trim(),
      leaked: JSON.stringify(S).includes('1e309') || localStorage.getItem(KEY).includes('1e309') };
  });
  assert.deepEqual(state.grams, want);
  assert.deepEqual(state.disk, want);
  const kcal = want.reduce((n, g) => n + Number(g), 0); // fixture100kcal/100g, not app helper
  assert.equal(state.k, kcal);
  assert.equal(state.ui, String(kcal));
  assert.equal(state.leaked, false, 'raw must never enter saved journal');
}
async function expire(p) {
  await p.waitForFunction(() => undoRec === null, null, { timeout: 9500 });
  await p.waitForTimeout(80); // allow the deferred prune, deliberately NO repaint
}
async function seed(p, equalSource = false) {
  await p.evaluate(equal => {
    S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0;
    S.bw = '80'; S.goal = '80'; S.height = 180; S.age = 30; S.sex = 'm';
    S.bkAsk = Date.now(); S.rec = {}; S.pause = {}; applyNutri();
    S.myFood = [{ n: 'CLEAN Food', k: 100, p: 10, f: 2, c: 15 }]; invalidateFood();
    recRW('2026-10-13').ml = [{ n: 'A', note: '', items: [
      { p: 'CLEAN Food', g: '125' }, { p: 'CLEAN Food', g: '50' }] }];
    recRW('2026-10-14').ml = [{ n: 'B', note: '', items: [{ p: 'CLEAN Food', g: '250' }] }];
    recRW('2026-10-12').ml = equal ? JSON.parse(JSON.stringify(S.rec['2026-10-13'].ml))
      : [{ n: 'Source', note: '', items: [{ p: 'CLEAN Food', g: '400' }] }];
    closeSetup(); undoDrop(); save(); flush();
  }, equalSource);
  await p.reload();
  await p.waitForFunction(() => typeof render === 'function' && !$('setup').classList.contains('on'));
  await tap(p, '[data-tab="food"]');
  await tap(p, '#chips [data-d="' + A + '"]');
}
async function copy(p) {
  await tap(p, '#cpBtn'); await tap(p, '[data-from="' + SOURCE + '"]'); await tap(p, '#askY');
}
async function check(p, width, name, fn, equal = false) {
  if (handoffOnly && !name.includes('queued prune')) return;
  checks++; await seed(p, equal);
  try { await fn(); console.log('✓ ' + width + ' ' + name); }
  catch (e) {
    failures++; console.log('✗ ' + width + ' ' + name + ' → ' + e.message);
    if (e.code !== 'ERR_ASSERTION') throw e;
  }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try { for (const width of [320, 390]) {
    const ctx = await browser.newContext({ viewport: { width, height: 844 },
      timezoneId: 'Asia/Vladivostok', locale: 'ru-RU', reducedMotion: 'reduce', serviceWorkers: 'block' });
    try {
      await ctx.route('https://**/*', r => r.abort());
      const p = await ctx.newPage(), errors = []; p.setDefaultTimeout(7000);
      p.on('pageerror', e => errors.push(e.message));
      await p.clock.install({ time: new Date('2026-10-14T12:00:00+10:00') });
      await p.clock.resume(); await p.clock.setFixedTime(new Date('2026-10-14T12:00:00+10:00'));
      await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p, '#setSkip');
      await check(p, width, 'deleted raw released after real Undo expiry without repaint', async () => {
        await draft(p); await tap(p, '#mll [data-ml="0"] [data-rm="0"]');
        await recorded(p, ['50']);
        assert.equal(await p.evaluate(() => !!undoRec), true);
        assert.equal(await p.evaluate(() => foodUiRaw.size), 1, 'Undo still owns deleted raw');
        await expire(p);
        assert.equal(await p.evaluate(() => foodUiRaw.size), 0, 'expired deleted raw must be released');
        await recorded(p, ['50']);
      });
      if (!redOnly) {
        await check(p, width, 'Undo retains deleted original raw then restored row remains live', async () => {
          await draft(p); await tap(p, '#mll [data-ml="0"] [data-rm="0"]'); await tap(p, '#undoB');
          await raw(p); await recorded(p, ['125', '50']);
          await p.waitForTimeout(80);
          assert.equal(await p.evaluate(() => foodUiRaw.size), 1);
        });
        await check(p, width, 'removed focused DOM field cannot retain dead raw after expiry', async () => {
          await draft(p);
          // Native click without focus transfer also occurs during programmatic redraw.
          // Preserve the real detached field baseline to catch an unconditional fieldFood root.
          await p.evaluate(() => document.querySelector('#mll [data-rm="0"]').click());
          assert.equal(await p.evaluate(() => fieldEl?.isConnected), false);
          await expire(p);
          assert.equal(await p.evaluate(() => foodUiRaw.size), 0, 'detached baseline is not a live owner');
          await recorded(p, ['50']);
        });
        await check(p, width, 'other dated and shifted duplicate drafts survive expiry', async () => {
          await draft(p, '#mll [data-ml="0"] input[data-g="1"]');
          await tap(p, '#chips [data-d="' + B + '"]'); await draft(p);
          await tap(p, '#chips [data-d="' + A + '"]');
          await tap(p, '#mll [data-ml="0"] [data-rm="0"]'); await expire(p);
          await raw(p); await recorded(p, ['50']);
          await tap(p, '#chips [data-d="' + B + '"]'); await raw(p);
          assert.equal(await p.evaluate(() => daySum('2026-10-14').k), 250);
          assert.equal(await p.evaluate(() => foodUiRaw.size), 2);
        });
        await check(p, width, 'non-equal ration replacement keeps raw for Undo', async () => {
          await draft(p); await copy(p); await recorded(p, ['400']);
          assert.equal(await p.locator(G).inputValue(), '400', 'replacement cannot inherit abandoned raw');
          assert.equal(await p.evaluate(() => foodUiRaw.size), 1);
          await tap(p, '#undoB'); await raw(p); await recorded(p, ['125', '50']);
        });
        await check(p, width, 'non-equal ration replacement releases old raw when Undo expires', async () => {
          await draft(p); await copy(p); await expire(p);
          assert.equal(await p.evaluate(() => foodUiRaw.size), 0);
          await recorded(p, ['400']);
        });
        await check(p, width, 'literal-equal replacement has no journal Undo and no abandoned raw', async () => {
          await draft(p); await copy(p);
          assert.equal(await p.evaluate(() => !!undoRec), false, 'same JSON is not a changed journal');
          assert.equal(await p.locator(G).inputValue(), '125');
          assert.equal(await p.evaluate(() => foodUiRaw.size), 0);
          await recorded(p, ['125', '50']);
        }, true);
        await check(p, width, 'queued prune before confirmation click releases transient owner after handoff', async () => {
          await draft(p); await tap(p, '#cpBtn'); await tap(p, '[data-from="' + SOURCE + '"]');
          // Real timers and handlers: redraw queues prune before click capture's
          // fallback. That temporary tapFood owner must also release its raw.
          await p.evaluate(() => { paintFood(); $('askY').click(); });
          await p.waitForTimeout(300);
          assert.equal(await p.evaluate(() => !!undoRec), false);
          assert.equal(await p.locator(G).inputValue(), '125');
          assert.equal(await p.evaluate(() => foodUiRaw.size), 0, 'released click sidecar cannot strand raw');
          await recorded(p, ['125', '50']);
        }, true);
      }
      assert.deepEqual(errors, [], 'no page errors');
    } finally { await ctx.close(); }
  } } finally { await browser.close(); }
  console.log('food-draft-cleanup-oct15: ' + checks + ' checks, ' + failures + ' failures');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
