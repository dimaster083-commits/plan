/* Actual served v8: reuse canonical bytes/activated worker/offline and v7
   interactions, then test memory ownership with fresh synthetic profiles. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { LAUNCH } = require('../../env');
const url = process.env.GYM_APP_URL || 'https://dimaster083-commits.github.io/plan/';
const G = '#mll [data-ml="0"] input[data-g="0"]';
async function tap(p, s) { await p.locator(s).first().click(); await p.clock.runFor(280); }
(async () => {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, '../1.4.8.8.7/delivery.cjs')],
      { stdio: 'inherit', env: process.env });
    child.on('error', reject);
    child.on('close', code => code === 0 ? resolve() : reject(new Error('base delivery exit ' + code)));
  });
  const browser = await chromium.launch(LAUNCH);
  try { for (const width of [320, 390]) {
    const context = await browser.newContext({ viewport: { width, height: 844 },
      timezoneId: 'Asia/Vladivostok', reducedMotion: 'reduce' });
    try {
      const p = await context.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
      // Start before the pause target; the clock runs between API calls.
      await p.clock.install({ time: new Date('2026-10-12T12:00:00+10:00') });
      await p.clock.pauseAt(new Date('2026-10-13T12:00:00+10:00'));
      assert.equal(await p.evaluate(() => Date.now()), Date.parse('2026-10-13T12:00:00+10:00'));
      await p.goto(url); await p.clock.runFor(800); await tap(p, '#setSkip');
      await p.evaluate(() => {
        S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0; S.bw = '80';
        S.bkAsk = Date.now(); S.rec = {}; S.pause = {};
        S.myFood = [{ n: 'Served cleanup fixture', k: 100, p: 10, f: 2, c: 15 }];
        recRW('2026-10-13').ml = [{ n: 'Fixture', items: [{ p: 'Served cleanup fixture', g: '125' }] }];
        invalidateFood(); sel = today(); tab = 'food'; undoDrop(); save(); flush(); render();
      });
      await p.fill(G, '1e309'); await tap(p, '#mll [data-rm="0"]');
      assert.equal(await p.evaluate(() => foodUiRaw.size), 1);
      await tap(p, '#undoB');
      assert.equal(await p.locator(G).inputValue(), '1e309');
      assert.equal(await p.locator(G).getAttribute('aria-invalid'), 'true');
      assert.equal(await p.evaluate(() => daySum(sel).k), 125);
      await tap(p, '#mll [data-rm="0"]');
      await p.clock.runFor(7500); // no paint after expiry
      assert.deepEqual(await p.evaluate(() => {
        flush(); return [!!undoRec, foodUiRaw.size, daySum(sel).k,
          JSON.parse(localStorage.getItem(KEY)).rec[sel].ml[0].items.length];
      }), [false, 0, 0, 0]);
      assert.deepEqual(errors, []);
      console.log('✓ served ' + width + ' removed raw restored by Undo, then released on expiry without paint; journal/disk intact');
    } finally { await context.close(); }
  } } finally { await browser.close(); }
})().catch(e => { console.error('FATAL', e.stack); process.exitCode = 1; });
