/* Actual delivery: canonical release/offline checks plus approved clipboard
   fallback. Clipboard API is controlled only inside synthetic browser profiles;
   the user's system clipboard and stored data are never accessed. */
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright-core');
const { LAUNCH } = require('../../env');
const url = process.env.GYM_APP_URL || 'https://dimaster083-commits.github.io/plan/';
async function tap(p, s) { await p.locator(s).first().click(); await p.clock.runFor(280); }
async function deny(p, at) {
  await p.evaluate(at => servedCopies[at].reject(new DOMException('Denied', 'NotAllowedError')), at);
  await p.clock.runFor(1);
}
(async () => {
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.resolve(__dirname, '../1.4.8.8.8/delivery.cjs')],
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
        S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0;
        S.bw = '80'; S.goal = '80'; S.bkAsk = Date.now(); save(); flush(); render();
        window.servedCopies = [];
        Object.defineProperty(navigator, 'clipboard', { configurable: true, value: {
          writeText: text => new Promise((resolve, reject) => servedCopies.push({ text, resolve, reject }))
        } });
      });
      await tap(p, '[data-tab="prog"]'); await tap(p, '#anBtn'); await tap(p, '#anCopy'); await deny(p, 0);
      assert.equal(await p.locator('#shB textarea').count(), 1);
      assert.match(await p.locator('#shB textarea').inputValue(), /вес 80 кг/);
      assert.equal(await p.locator('#shB textarea').evaluate(i => i.readOnly && i === document.activeElement
        && i.selectionStart === 0 && i.selectionEnd === i.value.length), true);
      await p.evaluate(() => { window.servedManual = $('shB').querySelector('textarea'); setBw('81'); });
      await tap(p, '#anCopy'); await deny(p, 1);
      assert.equal(await p.locator('#shB textarea').count(), 1);
      assert.equal(await p.locator('#shB textarea').evaluate(i => i === servedManual), true);
      assert.match(await p.locator('#shB textarea').inputValue(), /вес 81 кг/);
      console.log('✓ served ' + width + ' denied clipboard has one selected readonly fallback; repeat updates same block');
      await tap(p, '#anCopy'); await tap(p, '#shX'); await tap(p, '[data-meas="1"]');
      await p.fill('[data-mk="waist"]', '87,5');
      const before = await p.evaluate(() => ({ sheet: sheetSeq, title: $('shT').textContent,
        raw: document.querySelector('[data-mk="waist"]').value, focus: document.activeElement?.dataset.mk,
        lock: document.body.style.overflow, state: snapS() }));
      await deny(p, 2);
      assert.deepEqual(await p.evaluate(() => ({ sheet: sheetSeq, title: $('shT').textContent,
        raw: document.querySelector('[data-mk="waist"]').value, focus: document.activeElement?.dataset.mk,
        lock: document.body.style.overflow, state: snapS() })), before);
      assert.equal(await p.locator('#shB textarea').count(), 0);
      assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.deepEqual(errors, []);
      console.log('✓ served ' + width + ' late clipboard denial leaves newer measurement/raw/focus/lock/journal intact');
    } finally { await context.close(); }
  } } finally { await browser.close(); }
})().catch(e => { console.error('FATAL', e.stack); process.exitCode = 1; });
