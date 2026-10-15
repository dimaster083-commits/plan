/* BUG-0034/0035: a clipboard refusal belongs to the original Analysis and
   its latest copy request. Breaks caught: stale append/select after close,
   replacement or reopen; duplicate manual-copy blocks; stale text winning
   an out-of-order refusal. Real app/UI/state, only writeText is deferred.
   --red-only selects the essential regressions at both phone widths.
   --case=name runs just one named scenario at both widths. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
const redOnly = process.argv.includes('--red-only');
const onlyCase = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
let checks = 0, failures = 0;

function check(name, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); console.log('  ✓ ' + name); }
  catch (e) {
    failures++;
    console.log('  ✗ ' + name + ' ' + e.message.split('\n').slice(0, 7).join(' '));
  }
}
async function tap(p, selector) {
  await p.locator(selector).first().click();
  // Exercise the real trusted-click guard, including repeated Copy taps.
  await p.waitForTimeout(290);
}
async function fresh(browser, width, clipboard = 'deferred', hints = false) {
  const context = await browser.newContext({
    viewport: {width, height: width === 320 ? 568 : 844},
    timezoneId: 'Asia/Vladivostok', reducedMotion: 'reduce',
    serviceWorkers: 'block', isMobile: true, hasTouch: true
  });
  await context.route('https://**/*', route => route.abort());
  const p = await context.newPage(), errors = [];
  p.on('pageerror', e => errors.push(e.message));
  try {
    await p.goto(APP);
    await tap(p, '#setSkip');
    await p.evaluate(({mode, hints}) => {
      // Synthetic fixture only. Builders, migrations and all rendering remain real.
      S = build(); migrate(); S.setup = 1; S.bw = '80'; S.height = '180';
      S.goal = '90'; S.sound = 0; S.hints = hints ? 1 : 0; S.bkAsk = Date.now();
      S.rec = {}; S.map = {}; S.pause = {}; S.meas = {};
      S.exNote = {fixture: 'summary copy must not change this journal'};
      sel = today(); tab = 'wo'; exOpen = null;
      entCache = null; wkCache = null;
      scrubKeys(); recomputeStats(1); undoDrop(); save(); flush(); render();
      window.summaryClipboard = [];
      // Never read or write the user's clipboard. This is the sole API double.
      Object.defineProperty(navigator, 'clipboard', {configurable: true, value:
        mode === 'missing' ? undefined : {
          writeText(text) {
            return new Promise((resolve, reject) => {
              summaryClipboard.push({text, resolve, reject});
            });
          }
        }
      });
    }, {mode: clipboard, hints});
    await tap(p, '[data-tab="prog"]');
    await tap(p, '#anBtn');
    return {context, p, errors};
  } catch (e) { await context.close(); throw e; }
}
async function request(p, count) {
  await tap(p, '#anCopy');
  await p.waitForFunction(n => summaryClipboard.length === n, count, {timeout: 2000});
  return p.evaluate(i => summaryClipboard[i].text, count - 1);
}
async function settle(p, index, success = false) {
  await p.evaluate(async ({index, success}) => {
    const pending = summaryClipboard[index];
    if (success) pending.resolve();
    else pending.reject(new DOMException('Synthetic permission denied', 'NotAllowedError'));
    // Drain the real async handler without replacing it or its app dependencies.
    await new Promise(resolve => setTimeout(resolve, 0));
  }, {index, success});
}
async function persisted(p) {
  return p.evaluate(() => ({memory: JSON.stringify(S), disk: localStorage.getItem('sys-gym-v3')}));
}
async function view(p) {
  return p.evaluate(() => ({
    on: $('sh').classList.contains('on'), title: $('shT').textContent,
    html: $('shB').innerHTML, lock: document.body.style.overflow,
    focus: document.activeElement.id || document.activeElement.getAttribute('data-mk') || document.activeElement.tagName,
    scroll: $('sh').scrollTop,
    raw: document.querySelector('[data-mk="waist"]')?.value ?? null,
    instruction: $('noteT').textContent
  }));
}
async function fallback(p) {
  return p.evaluate(() => {
    const all = [...$('shB').querySelectorAll('textarea')], ta = all[0];
    return {
      count: all.length, value: ta?.value, readOnly: ta?.readOnly,
      selected: !!ta && document.activeElement === ta && ta.selectionStart === 0 && ta.selectionEnd === ta.value.length,
      visible: !!ta && $('sh').classList.contains('on') && !!ta.getClientRects().length
    };
  });
}
function literalSummary(name, text, weight) {
  check(name + ' has the hand-checked body-weight line', text.includes('Рост 180 см, вес ' + weight + ' кг, цель 90 кг.'), true);
  for (const marker of ['СВОДКА ИЗ ДНЕВНИКА ТРЕНИРОВОК, ', 'РАБОЧИЕ ВЕСА И РЕКОРДЫ:', 'ОБЪЁМ ЗА 7 ДНЕЙ (подходов / норма):', 'ПИТАНИЕ (последние 14 дней журнала):', 'ЧТО ВИДИТ ПРИЛОЖЕНИЕ:']) {
    check(name + ' retains ' + marker, text.includes(marker), true);
  }
}
async function checkFallback(p, label, text) {
  const manual = await fallback(p);
  check(label + ' has one manual-copy textarea', manual.count, 1);
  check(label + ' contains exactly the text captured by that copy request', manual.value, text);
  check(label + ' is read-only', manual.readOnly, true);
  check(label + ' selects all text for manual copy', manual.selected, true);
  check(label + ' is in the visible original sheet', manual.visible, true);
}

const cases = [
  {name: 'denied-current', run: async (p, label) => {
    const captured = await request(p, 1); literalSummary(label, captured, '80');
    // A real model change while the external request waits must not change
    // the text already handed to that request or its fallback.
    await p.evaluate(() => { setBw('81'); flush(); });
    const before = await persisted(p);
    await settle(p, 0);
    await checkFallback(p, label, captured);
    check(label + ' fallback still describes captured80kg, not current81kg', (await fallback(p)).value.includes('вес 80 кг'), true);
    check(label + ' leaves memory and disk unchanged', await persisted(p), before);
  }},
  {name: 'missing-api', clipboard: 'missing', run: async (p, label) => {
    const before = await persisted(p);
    await tap(p, '#anCopy');
    const manual = await fallback(p);
    check(label + ' synchronously missing API offers one fallback', manual.count, 1);
    literalSummary(label, manual.value || '', '80');
    check(label + ' manual fallback is read-only and fully selected', [manual.readOnly, manual.selected, manual.visible], [true, true, true]);
    check(label + ' leaves memory and disk unchanged', await persisted(p), before);
  }},
  {name: 'sequential-refusals', red: true, run: async (p, label) => {
    const first = await request(p, 1);
    await settle(p, 0);
    check(label + ' first refusal exposes captured80kg', (await fallback(p)).value, first);
    await p.evaluate(() => { setBw('81'); flush(); });
    const latest = await request(p, 2); literalSummary(label, latest, '81');
    check(label + ' fixture really changes the export', first === latest, false);
    const before = await persisted(p);
    await settle(p, 1);
    await checkFallback(p, label, latest);
    check(label + ' leaves memory and disk unchanged', await persisted(p), before);
  }},
  {name: 'closed-sheet', red: true, run: async (p, label) => {
    await request(p, 1); await tap(p, '#shX');
    const before = await view(p), data = await persisted(p);
    check(label + ' fixture has closed original sheet', [before.on, before.lock], [false, '']);
    await settle(p, 0);
    check(label + ' never appends even a hidden textarea', (await fallback(p)).count, 0);
    check(label + ' leaves closed sheet, focus and notification untouched', await view(p), before);
    check(label + ' leaves memory and disk unchanged', await persisted(p), data);
  }},
  {name: 'new-measurement', red: true, run: async (p, label) => {
    await request(p, 1); await tap(p, '#shX'); await tap(p, '[data-meas="1"]');
    await p.fill('[data-mk="waist"]', '87,5');
    const before = await view(p), data = await persisted(p);
    check(label + ' fixture has live raw input and focus', [before.title, before.raw, before.focus, before.lock], ['ЗАМЕРЫ', '87,5', 'waist', 'hidden']);
    await settle(p, 0);
    check(label + ' late refusal adds no textarea to another form', (await fallback(p)).count, 0);
    check(label + ' preserves new form raw, focus, scroll lock and content', await view(p), before);
    check(label + ' preserves exact memory and disk', await persisted(p), data);
  }},
  {name: 'same-title-reopened', red: true, run: async (p, label) => {
    await request(p, 1); await tap(p, '#shX'); await tap(p, '#anBtn');
    const before = await view(p), data = await persisted(p);
    check(label + ' fixture reopened an Analysis sheet', [before.on, before.title, before.focus], [true, 'РАЗБОР', 'shX']);
    await settle(p, 0);
    check(label + ' old refusal never inserts into reopened same-title sheet', (await fallback(p)).count, 0);
    check(label + ' leaves reopened sheet and focus untouched', await view(p), before);
    check(label + ' preserves exact memory and disk', await persisted(p), data);
  }},
  {name: 'hint-over-analysis', red: true, hints: true, run: async (p, label) => {
    await request(p, 1); await tap(p, '#shI');
    const before = await view(p), data = await persisted(p);
    const hint = await p.evaluate(() => ({hidden: $('hsh').hidden, html: $('hsh').innerHTML, focus: document.activeElement.id}));
    check(label + ' fixture opens a newer hint over original Analysis', [hint.hidden, hint.focus], [false, 'hshX']);
    await settle(p, 0);
    check(label + ' refusal adds no fallback under newer hint', (await fallback(p)).count, 0);
    check(label + ' leaves underlying Analysis and notification untouched', await view(p), before);
    check(label + ' preserves hint content and focus', await p.evaluate(() => ({hidden: $('hsh').hidden, html: $('hsh').innerHTML, focus: document.activeElement.id})), hint);
    check(label + ' preserves exact memory and disk', await persisted(p), data);
  }},
  {name: 'out-of-order-refusals', red: true, run: async (p, label) => {
    const older = await request(p, 1); literalSummary(label + ' older', older, '80');
    await p.evaluate(() => { setBw('81'); flush(); });
    const latest = await request(p, 2); literalSummary(label + ' latest', latest, '81');
    await settle(p, 1); await checkFallback(p, label + ' latest refusal', latest);
    // Move focus through real keyboard navigation after the latest fallback.
    await p.keyboard.press('Shift+Tab');
    check(label + ' user moved focus back to Copy', await p.evaluate(() => document.activeElement.id), 'anCopy');
    const before = await view(p), data = await persisted(p);
    await settle(p, 0);
    check(label + ' older refusal cannot append a second fallback', (await fallback(p)).count, 1);
    check(label + ' older refusal cannot replace latest81kg text', (await fallback(p)).value, latest);
    check(label + ' older refusal cannot steal focus or alter current sheet', await view(p), before);
    check(label + ' preserves exact memory and disk', await persisted(p), data);
  }},
  {name: 'success', run: async (p, label) => {
    const before = await persisted(p), captured = await request(p, 1);
    literalSummary(label, captured, '80');
    await settle(p, 0, true);
    check(label + ' normal success never creates a manual fallback', (await fallback(p)).count, 0);
    check(label + ' normal success confirms export', await p.locator('#noteT').textContent(), 'Данные выгружены');
    check(label + ' normal success preserves exact source memory and disk', await persisted(p), before);
  }},
  {name: 'success-updates-existing-fallback', red: true, run: async (p, label) => {
    const first = await request(p, 1); literalSummary(label + ' first', first, '80');
    await settle(p, 0);
    await p.evaluate(() => { setBw('81'); flush(); });
    const latest = await request(p, 2); literalSummary(label + ' next', latest, '81');
    const before = await view(p), data = await persisted(p);
    check(label + ' second Copy tap owns focus before success', before.focus, 'anCopy');
    await settle(p, 1, true);
    const manual = await fallback(p), after = await view(p);
    check(label + ' successful newer copy retains one current manual block', manual.count, 1);
    check(label + ' existing block updates from80kg to exact newly copied81kg', manual.value, latest);
    check(label + ' existing block stays read-only', manual.readOnly, true);
    check(label + ' successful copy never selects or steals focus for fallback', [manual.selected, after.focus, after.lock], [false, 'anCopy', before.lock]);
    check(label + ' successful copy confirms export', after.instruction, 'Данные выгружены');
    check(label + ' successful copy preserves exact memory and disk', await persisted(p), data);
  }},
  {name: 'late-success-new-form', run: async (p, label) => {
    const captured = await request(p, 1); literalSummary(label, captured, '80');
    await tap(p, '#shX'); await tap(p, '[data-meas="1"]');
    await p.fill('[data-mk="waist"]', '87,5');
    const before = await view(p), data = await persisted(p);
    await settle(p, 0, true);
    const after = await view(p);
    // The success notification is allowed; the later independent form is intact.
    delete before.instruction; delete after.instruction;
    check(label + ' successful older copy preserves new raw form and focus', after, before);
    check(label + ' successful older copy creates no fallback', (await fallback(p)).count, 0);
    check(label + ' successful older copy preserves exact memory and disk', await persisted(p), data);
  }}
];

(async () => {
  const selected = cases.filter(c => (!redOnly || c.red) && (!onlyCase || c.name === onlyCase));
  if (!selected.length) throw new Error('No Summary copy scenarios match the requested filters');
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) for (const item of selected) {
      const label = width + ' ' + item.name;
      const {context, p, errors} = await fresh(browser, width, item.clipboard, item.hints);
      try {
        await item.run(p, label);
        check(label + ' no uncaught errors', errors, []);
      } catch (e) {
        failures++;
        console.log('  ✗ ' + label + ' HARNESS/UNEXPECTED ' + e.stack);
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  console.log('Summary copy: ' + checks + ' checks, ' + failures + ' failures' + (redOnly ? ' (RED-only)' : ''));
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('FATAL', e); process.exitCode = 1; });
