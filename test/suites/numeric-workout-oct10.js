/* Numeric workout boundary: synthetic journals in isolated mobile contexts.
   Invalid drafts remain editable text; only validated completion adds work. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let failures = 0, checks = 0;
function check(name, actual, verify) {
  checks++;
  try { verify(actual); console.log('✓ ' + name); }
  catch (e) { failures++; console.log('✗ ' + name + ': ' + e.message + '; actual=' + JSON.stringify(actual)); }
}
const pause = p => p.waitForTimeout(280);
async function click(p, selector) { await p.locator(selector).click(); await pause(p); }
async function open(p) { await click(p, '.exrow[data-open="0"]'); }
async function fixture(p) {
  await p.evaluate(() => {
    S = build(); migrate(); S.setup = 1; S.sound = 0; S.bw = 80; S.start = '2026-12-10';
    const d = S.days[wdOf('2026-10-10')];
    d.t = 'up1'; d.ex = [{ n: 'Жим лёжа', s: 3, r: '6-8', w: 60, g: 'Грудь' }];
    S.rec = { '2026-10-03': { wo: 1, log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь',
      w: '60', s: '3', r: '6-8', rs: [8, 8, 8], ws: [60, 60, 60], vol: 1440, sd: 1 } }, sp: {} },
      '2026-10-10': { log: {}, sp: {} } };
    entCache = null; recomputeStats(1); S.pr['Жим лёжа'] = 60;
    save(); flush(); $('setup').classList.remove('on'); sheetClose(); undoDrop();
    tab = 'wo'; sel = '2026-10-10'; exOpen = null; edit = false; editPast = false; render();
  });
  await pause(p); await open(p);
}
async function snapshot(p) {
  return p.evaluate(() => ({ done: !!recOf(sel).log[0]?.done, ton: dayTon(sel), sets: daySets(sel),
    xp: S.xp, working: dayOf(sel).ex[0].w, pr: JSON.stringify(S.pr),
    vol: JSON.stringify(S.vol), sessions: exSessions('Жим лёжа').length,
    draft: recOf(sel).log[0]?.ws?.[0], field: document.querySelector('[data-ws="0"]')?.value,
    note: $('noteT').textContent }));
}
function noWork(actual, before) {
  assert.equal(actual.done, false); assert.equal(actual.ton, 0); assert.equal(actual.sets, 0);
  for (const key of ['xp', 'working', 'pr', 'vol', 'sessions']) assert.equal(actual[key], before[key], key);
}
async function reload(p) {
  await p.evaluate(() => flush()); await p.reload();
  await p.waitForFunction(() => typeof S !== 'undefined' && !!S && S.setup);
  await open(p);
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const viewport of [{ width: 320, height: 568 }, { width: 390, height: 844 }]) {
      const context = await browser.newContext({ viewport, timezoneId: 'Asia/Vladivostok', locale: 'ru-RU' });
      try {
        await context.route('https://**/*', route => route.abort());
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
        await p.waitForTimeout(1200);
        const label = viewport.width + 'px ';
        for (const [raw, route] of [['abc', 'button'], ['-1', 'button'], ['55kg', 'button'], ['abc', 'ticks'], ['abc', 'closed'], ['9'.repeat(309), 'button'], ['9'.repeat(308), 'button']]) {
          await fixture(p); const before = await snapshot(p);
          await p.locator('[data-ws="0"]').fill(raw);
          check(label + raw + ' saved as raw draft', await snapshot(p), x => assert.equal(x.draft, raw));
          await click(p, '[data-close]'); await open(p);
          check(label + raw + ' survives reopen', await snapshot(p), x => assert.equal(x.field, raw));
          await reload(p);
          check(label + raw + ' survives reload', await snapshot(p), x => assert.equal(x.field, raw));
          if (route === 'closed') await p.evaluate(() => { exOpen = null; render(); toggleSet(0); });
          else if (route === 'button') await click(p, '[data-complete="0"]');
          else for (const i of [1, 2, 0]) await click(p, '[data-tick="' + i + '"]');
          check(label + raw + ' blocked via ' + route, await snapshot(p), x => {
            noWork(x, before); assert.match(x.note, /вес/i);
          });
          // Correct the same persisted draft, then use the same completion route.
          // Reset partial ticks through the UI before repeating a corrected tick route.
          if (route === 'ticks') {
            for (const i of [0, 1, 2]) {
              if (await p.locator('[data-tick="' + i + '"]').getAttribute('aria-pressed') === 'true')
                await click(p, '[data-tick="' + i + '"]');
            }
          }
          if (route === 'closed') await open(p);
          if ((await snapshot(p)).done) await click(p, '[data-complete="0"]');
          await p.locator('[data-ws="0"]').fill('60');
          for (let i = 0; i < 3; i++) await p.locator('[data-rs="' + i + '"]').fill('8');
          if (route === 'closed') await p.evaluate(() => { exOpen = null; render(); toggleSet(0); });
          else if (route === 'button') await click(p, '[data-complete="0"]');
          else for (let i = 0; i < 3; i++) await click(p, '[data-tick="' + i + '"]');
          check(label + raw + ' correction completes', await snapshot(p), x => {
            assert.equal(x.done, true); assert.equal(x.ton, 1440); assert.equal(x.sets, 3);
            assert.equal(x.xp, before.xp + 12); assert.equal(x.working, 62.5); assert.equal(x.sessions, 2);
          });
        }
        await fixture(p); const beforeTick = await snapshot(p);
        await click(p, '[data-tick="0"]');
        await p.locator('[data-ws="0"]').fill('abc');
        await click(p, '[data-tick="1"]'); await click(p, '[data-tick="2"]');
        check(label + 'editing a checked row invalid blocks final valid tick', await snapshot(p), x => {
          noWork(x, beforeTick); assert.match(x.note, /вес/i);
        });
        for (const [name, raw, allRows] of [['product', '1'+'0'.repeat(308), false], ['sum', '1'+'0'.repeat(307), true]]) {
          await fixture(p); const before = await snapshot(p);
          for (const i of (allRows ? [0,1,2] : [0])) await p.locator('[data-ws="'+i+'"]').fill(raw);
          await click(p, '[data-complete="0"]');
          check(label + 'finite decimal with overflowing '+name+' cannot commit', await snapshot(p), x => {
            noWork(x, before); assert.match(x.note, /вес|объём|объем/i);
          });
        }
        // Three sets of eight: first row2.5 + two rows60 =980 kg;
        // blank and explicit0 both use common60 =1440 kg (LIMIT-002).
        for (const [raw, expected] of [['2,5', 980], ['2.5', 980], ['', 1440], ['0', 1440]]) {
          await fixture(p); const before = await snapshot(p);
          await p.locator('[data-ws="0"]').fill(raw); await reload(p);
          await click(p, '[data-complete="0"]');
          check(label + JSON.stringify(raw) + ' valid arithmetic after reload', await snapshot(p), x => {
            assert.equal(x.done, true); assert.equal(x.ton, expected); assert.equal(x.sets, 3);
            assert.equal(x.xp, before.xp + 12);
            assert.equal(x.working, expected === 1440 ? 62.5 : 60);
          });
          await click(p, '#undoB');
          check(label + JSON.stringify(raw) + ' undo restores draft and all stats', await snapshot(p), x => {
            noWork(x, before);
            assert.equal(x.field === '' ? '' : Number(x.field.replace(',', '.')), raw === '' ? '' : Number(raw.replace(',', '.')));
          });
          await reload(p);
          check(label + JSON.stringify(raw) + ' undo survives reload', await snapshot(p), x => noWork(x, before));
        }
        check(label + 'no runtime errors', errors, x => assert.deepEqual(x, []));
      } finally { await context.close(); }
    }
    console.log('numeric-workout-oct10: ' + checks + ' checks, ' + failures + ' failures');
    if (failures) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 2; });
