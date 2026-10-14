/* BUG-0030: real meal gram editor must remain >=44px and usable on 320/390.
   Removing its min-height must fail even if Chromium touch adjustment helps.
   Trusted center tap, keyboard numeric input, real journal totals and reload. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let checks = 0, failures = 0;
function check(name, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); console.log('  ✓ ' + name); }
  catch (e) { failures++; console.log('  ✗ ' + name + ' expected=' + JSON.stringify(expected) + ' actual=' + JSON.stringify(actual)); }
}
async function tap(p, selector) { await p.locator(selector).first().click(); await p.waitForTimeout(290); }
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({viewport: {width, height: width === 320 ? 568 : 844}, timezoneId: 'Asia/Vladivostok', serviceWorkers: 'block', reducedMotion: 'reduce', isMobile: true, hasTouch: true});
      await context.route('https://**/*', route => route.abort());
      try {
        const p = await context.newPage(), errors = []; p.on('pageerror', e => errors.push(e.message));
        await p.clock.install({time: new Date('2026-10-13T12:00:00+10:00')}); await p.clock.resume(); await p.goto(APP); await tap(p, '#setSkip');
        await p.evaluate(() => {
          S = build(); migrate(); S.setup = 1; S.bw = '75'; S.hints = 0; S.sound = 0; S.bkAsk = Date.now();
          S.myFood = [{n: 'Gram fixture', k: 100, p: 10, f: 2, c: 15}];
          S.rec = {[today()]: {log: {}, sp: {}, wo: 0, ml: [{n: 'Synthetic meal', items: [{p: 'Gram fixture', g: '125'}]}]}};
          sel = today(); tab = 'food'; invalidateFood(); undoDrop(); save(); flush(); render();
        });
        const input = p.locator('#mll input[data-g]').first(); await input.scrollIntoViewIfNeeded();
        const initial = await input.boundingBox(); await p.mouse.move(150, 250); await p.mouse.wheel(0, initial.y - (width === 320 ? 284 : 422));
        await p.waitForFunction(() => {const r=document.querySelector('#mll input[data-g]').getBoundingClientRect();return r.top>=innerHeight*.3&&r.bottom<=innerHeight*.7;});
        const rect = await input.boundingBox();
        check(width + ' gram editor has >=44px width', rect.width >= 43.9, true);
        check(width + ' gram editor has >=44px height', rect.height >= 43.9, true);
        check(width + ' gram editor fits viewport', rect.x >= 0 && rect.x + rect.width <= width + .5, true);
        check(width + ' gram font stays >=16px', await input.evaluate(e => parseFloat(getComputedStyle(e).fontSize) >= 16), true);
        await p.touchscreen.tap(rect.x + rect.width / 2, rect.y + rect.height / 2);
        await p.waitForFunction(() => document.activeElement.matches('#mll input[data-g]'), null, {timeout: 3000});
        check(width + ' trusted center tap focuses real gram input', await input.evaluate(e => document.activeElement === e), true);
        await p.keyboard.press('Control+A'); await p.keyboard.type('250'); await p.keyboard.press('Tab'); await p.waitForTimeout(290);
        check(width + ' actual entered grams saved to own date', await p.evaluate(() => S.rec[today()].ml[0].items[0].g), '250');
        check(width + ' changed grams update real day totals', await p.evaluate(() => [daySum(sel).k, daySum(sel).p]), [250, 25]);
        const geom = await p.evaluate(() => ({width: innerWidth, doc: document.documentElement.scrollWidth, items: [...document.querySelectorAll('#mll .it')].map(e => {const r=e.getBoundingClientRect();return {x:r.x,right:r.right};})}));
        check(width + ' no document or meal-row horizontal overflow', geom.doc <= geom.width && geom.items.every(r => r.x >= 0 && r.right <= geom.width + .5), true);
        await p.reload(); await tap(p, '[data-tab="food"]');
        check(width + ' entered grams survive reload', await p.locator('#mll input[data-g]').first().inputValue(), '250');
        check(width + ' no uncaught errors', errors, []);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  console.log('Mobile grams: ' + checks + ' checks, ' + failures + ' failures'); process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('FATAL', e); process.exitCode = 1; });
