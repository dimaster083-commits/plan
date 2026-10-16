/* BUG-0037/0038/0039. Breaks caught: monthly best uses common weight instead
   of working rows; a paused/current template rewrites dated attendance;
   a late native photo read replaces a newer screen, form or report request.
   All reports, model calculations, UI handlers and IndexedDB are real.
   Only the return timing of the original phLoad is controlled.
   --red-only selects the essential regressions; --case=name isolates one. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const env = require('../env');
const APP = process.env.GYM_APP_URL || env.APP;
const APP_ORIGIN = new URL(APP).origin;
const { LAUNCH } = env;
const redOnly = process.argv.includes('--red-only');
const onlyCase = process.argv.find(arg => arg.startsWith('--case='))?.slice(7);
let checks = 0, failures = 0, harnessErrors = 0;
const TARGET = new Date('2026-10-16T12:00:00+10:00');

function check(name, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); console.log('  ✓ ' + name); }
  catch { failures++; console.log('  ✗ ' + name + ' expected=' + JSON.stringify(expected).slice(0, 700) + ' actual=' + JSON.stringify(actual).slice(0, 700)); }
}
async function tap(p, selector) {
  await p.locator(selector).first().click();
  // Advance the installed clock too: a frozen performance.now would make
  // genuine repeated taps look faster than the app's 260 ms finger guard.
  await p.clock.runFor(290);
}
function fixture(kind) {
  sheetClose();
  S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 1; S.bw = '80';
  S.start = '2026-09-01'; S.bkAsk = Date.now(); S.rec = {}; S.pr = {};
  S.map = {}; S.once = {}; S.pause = {}; S.meas = {}; S.quest = {};
  S.volBase = {}; S.xpBase = 0; S.exNote = {fixture: 'monthly report must preserve this journal'};
  S.days.forEach(d => { d.t = 'rest'; d.s = 'Отдых'; d.ex = []; });
  for (const i of [2, 3]) {
    S.days[i].t = 'up1'; S.days[i].s = 'Контроль жима';
    S.days[i].ex = [{n: 'Жим лёжа', g: 'Грудь', w: 50, s: 3, r: '6-10'}];
  }
  const mixed = {done: 1, n: 'Жим лёжа', g: 'Грудь', w: 50, s: 2,
    r: '6-10', rs: [9, 7], ws: [55, 70], wu: [12], dr: [10], fl: [1], vol: 985};
  if (kind === 'historical') {
    S.rec['2026-09-10'] = {wo: 1, sp: {}, log: {0: {done: 1, n: 'Жим лёжа', g: 'Грудь',
      w: 50, s: 2, r: '6-10', rs: [8, 7], ws: [50, 55], vol: 785}}};
  } else {
    S.rec['2026-10-15'] = {wo: 1, sp: {}, log: {0: mixed}};
  }
  if (kind === 'semantics') {
    Object.assign(S.rec['2026-10-15'].log, {
      1: {done: 1, n: 'Только разминка', g: 'Грудь', w: 100, s: 0, r: '8', rs: [], ws: [], wu: [12], vol: 0},
      2: {done: 1, n: 'Только дроп', g: 'Грудь', w: 100, s: 0, r: '8', rs: [], ws: [], dr: [10], vol: 0},
      3: {done: 1, n: 'Старый журнал', g: 'Грудь', w: 25, s: 2, r: '8'},
      4: {done: 1, n: 'Нулевой вес строки', g: 'Грудь', w: 40, s: 2, r: '8', rs: [8, 6], ws: [0, 35], vol: 530},
      5: {done: 1, n: 'Старые веса строк', g: 'Грудь', w: 20, s: 2, r: '8', rs: [8, 6], ws: [30, 35], vol: 450}
    });
  }
  if (kind === 'horizon') {
    S.start = '2026-10-13';
    S.days.forEach(d => { d.t = 'up1'; d.s = 'Контроль жима'; d.ex = [{n: 'Жим лёжа', g: 'Грудь', w: 50, s: 2, r: '6-10'}]; });
    S.rec['2026-10-12'] = {bw: '80', sp: {}, log: {}};
    S.rec['2026-10-14'] = {skip: 1, sp: {}, log: {0: {n: 'Жим лёжа', g: 'Грудь', w: 900, s: 2, r: '8', rs: [8, 8]}}};
    S.rec['2026-10-16'] = {wo: 0, sp: {}, log: {}};
  }
  sel = kind === 'historical' ? '2026-09-10' : today();
  mo = kind === 'historical' ? '2026-09' : '2026-10';
  tab = 'prog'; pSec = 'log'; exOpen = null; editPast = false; calView = 'month';
  $('setup').classList.remove('on'); entCache = wkCache = null; justDone = -1;
  pendingActions.clear(); lastTap = {k: '', t: 0}; undoDrop(); recomputeStats(1); save(); flush(); render();
}
async function fresh(browser, width, kind = 'mixed', photos = false) {
  const context = await browser.newContext({
    viewport: {width, height: width === 320 ? 568 : 844},
    timezoneId: 'Asia/Vladivostok', reducedMotion: 'reduce',
    serviceWorkers: 'block', isMobile: true, hasTouch: true
  });
  await context.route('https://**/*', route =>
    new URL(route.request().url()).origin === APP_ORIGIN ? route.continue() : route.abort());
  const p = await context.newPage(), errors = [];
  p.setDefaultTimeout(4000);
  p.on('pageerror', e => errors.push(e.message));
  try {
    // pauseAt is intentionally later than install; installing and pausing at
    // the same instant races the wall clock on slow Chrome startup.
    await p.clock.install({time: new Date('2026-10-15T12:00:00+10:00')});
    await p.clock.pauseAt(TARGET);
    assert.equal(await p.evaluate(() => Date.now()), TARGET.getTime(), 'clock must be fixed before loading the app');
    await p.goto(APP); await p.clock.runFor(800); await p.waitForSelector('#setup.on');
    await p.evaluate(fixture, kind);
    if (photos) await p.evaluate(async () => {
      const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
      await phPut('2026-09-10', png); await phPut('2026-10-10', png); await phPut('2026-11-10', png);
      PHCACHE.clear(); await phSync();
      const original = phLoad;
      window.monthPhotoReads = [];
      phLoad = function (ds) {
        const job = {ds, ready: false, value: null, release: null};
        // Start the original function immediately, including native IndexedDB
        // and its real cache side effects. Delay only its returned value.
        const realRead = original(ds);
        const held = new Promise(resolve => { job.release = () => resolve(job.value); });
        monthPhotoReads.push(job);
        Promise.resolve(realRead).then(value => { job.value = value; job.ready = true; });
        return held;
      };
    });
    await p.clock.runFor(300); await p.evaluate(() => flush());
    return {context, p, errors};
  } catch (e) { await context.close(); throw e; }
}
async function persisted(p) {
  return p.evaluate(async () => ({memory: JSON.stringify(S), disk: localStorage.getItem('sys-gym-v3'), photos: await phSnapshot()}));
}
async function view(p) {
  return p.evaluate(() => ({
    on: $('sh').classList.contains('on'), title: $('shT').textContent,
    html: $('shB').innerHTML, lock: document.body.style.overflow,
    focus: document.activeElement.id || document.activeElement.getAttribute('data-mk') || document.activeElement.tagName,
    raw: document.querySelector('[data-mk="waist"]')?.value ?? null,
    scroll: $('sh').scrollTop, tab, mo,
    hint: !$('hsh').hidden, hintHtml: $('hsh').innerHTML
  }));
}
async function report(p) {
  return p.evaluate(() => ({
    on: $('sh').classList.contains('on'), title: $('shT').textContent,
    month: document.querySelector('#shB .monav b')?.textContent,
    tiles: [...$('shB').querySelectorAll('.sum .win > b')].map(e => e.textContent),
    best: [...$('shB').querySelectorAll('.wtab tr')].map(r => [...r.cells].map(c => c.textContent)),
    planned: Number(($('shB').textContent.match(/из\s*(\d+)\s*запланированных/) || [])[1]),
    images: $('shB').querySelectorAll('.mopair img').length
  }));
}
async function openDirect(p) { await tap(p, '#moBtn'); await p.waitForSelector('#moP'); return report(p); }
async function reload(p) {
  const target = await p.evaluate(() => { flush(); return mo; });
  await p.reload(); await p.clock.runFor(800);
  await p.waitForFunction(() => typeof S === 'object' && S.setup === 1);
  await tap(p, '[data-tab="prog"]');
  await tap(p, '#cyear [data-mo="' + Number(target.slice(5, 7)) + '"]');
}
async function newerSeptember(p) {
  await tap(p, '#shX'); await tap(p, '#wkBtn');
  for (let i = 0; i < 5; i++) await tap(p, '#shB .wknav [data-wk]:first-child');
  await tap(p, '#shB > [data-mon]');
  return p.locator('#shB .sum .win > b').first().textContent();
}
async function pending(p, count) {
  await p.waitForFunction(n => monthPhotoReads.length >= n && monthPhotoReads[n - 1].ready, count);
}
async function release(p, index) {
  await p.evaluate(async i => { monthPhotoReads[i].release(); await Promise.resolve(); await Promise.resolve(); }, index);
  await p.clock.runFor(1);
}
async function checkUntouched(p, label, before, data) {
  check(label + ' preserves visible window, raw, focus and scroll lock', await view(p), before);
  check(label + ' preserves exact journal, disk and native photos', await persisted(p), data);
}

const cases = [
  {name: 'actual-rows', red: true, run: async (p, label) => {
    const data = await persisted(p);
    check(label + ' source is two working rows 55×9 + failure70×7 =985', await p.evaluate(() => [dayTon('2026-10-15'), daySets('2026-10-15')]), [985, 2]);
    let r = await openDirect(p);
    check(label + ' visible best weight is actual70kg, not common50kg', r.best, [['Жим лёжа', '70 кг']]);
    check(label + ' report keeps one workout, two sets and rounded1,0tonnes', r.tiles.slice(0, 3), ['1', '2', '1,0']);
    check(label + ' opening report preserves exact source', await persisted(p), data);
    await reload(p); r = await openDirect(p);
    check(label + ' actual70kg survives reload', r.best, [['Жим лёжа', '70 кг']]);
  }},
  {name: 'pause', kind: 'historical', red: true, run: async (p, label) => {
    await tap(p, '[data-tab="wo"]'); await tap(p, '#wkPlan');
    await tap(p, '[data-wppause="2026-09-07"]'); await tap(p, '#shX');
    await tap(p, '[data-tab="prog"]');
    const data = await persisted(p); let r = await openDirect(p);
    // Five Wednesdays + four Thursdays minus paused9/10 September = seven.
    check(label + ' direct month excludes paused9/10 September', r.planned, 7);
    check(label + ' pause retains completed785kg and two working sets', r.tiles.slice(0, 3), ['1', '2', '0,8']);
    check(label + ' newer monthly entry also shows1/7', await newerSeptember(p), '1/7');
    check(label + ' report navigation preserves exact source', await persisted(p), data);
    await reload(p); r = await openDirect(p);
    check(label + ' paused plan remains7 after reload', r.planned, 7);
  }},
  {name: 'historical-type', kind: 'historical', red: true, run: async (p, label) => {
    await p.evaluate(() => { sel = today(); render(); });
    await tap(p, '[data-tab="wo"]'); await tap(p, '#wkPlan'); await tap(p, '[data-wpm="all"]');
    await tap(p, '[data-wpd="3"]'); await tap(p, '[data-wpt="rest"]'); await tap(p, '#askY'); await tap(p, '#shX');
    await tap(p, '[data-tab="prog"]');
    const data = await persisted(p); let r = await openDirect(p);
    check(label + ' direct month keeps all nine historical Wednesday/Thursday dates', r.planned, 9);
    check(label + ' newer month retains historical1/9', await newerSeptember(p), '1/9');
    check(label + ' report navigation preserves edited journal exactly', await persisted(p), data);
    await reload(p); r = await openDirect(p);
    check(label + ' dated plan remains9 after reload', r.planned, 9);
  }},
  {name: 'row-semantics', kind: 'semantics', run: async (p, label) => {
    const data = await persisted(p), r = await openDirect(p);
    check(label + ' purewarm/drop100kg never become best working weights', r.best, [
      ['Жим лёжа', '70 кг'], ['Нулевой вес строки', '40 кг'], ['Старые веса строк', '35 кг'], ['Старый журнал', '25 кг']
    ]);
    check(label + ' legacy, zero fallback and failure preserve2365kg/eight sets', await p.evaluate(() => [dayTon('2026-10-15'), daySets('2026-10-15')]), [2365, 8]);
    check(label + ' visible monthly totals use the same real journal', r.tiles.slice(0, 3), ['1', '8', '2,4']);
    check(label + ' viewing never rewrites legacy or zero-weight records', await persisted(p), data);
  }},
  {name: 'current-horizon', kind: 'horizon', run: async (p, label) => {
    let data = await persisted(p), r = await openDirect(p);
    // Start13 October: 13/14/15 count; skipped14 remains a planned date.
    // Before-start12, unfinished today16 and every future date stay excluded.
    check(label + ' current plan counts only13/14/15, including skipped14', r.planned, 3);
    check(label + ' skipped draft900kg never enters completed totals/best', [r.tiles.slice(0, 3), r.best], [['1', '2', '1,0'], [['Жим лёжа', '70 кг']]]);
    check(label + ' unfinished-today report preserves exact source', await persisted(p), data);
    await tap(p, '#shX');
    await p.evaluate(() => { S.rec['2026-10-16'].wo = 1; save(); flush(); render(); });
    data = await persisted(p); r = await openDirect(p);
    check(label + ' closed today adds only16 October, never future dates', [r.planned, r.tiles[0]], [4, '2']);
    check(label + ' closed-today report preserves exact source', await persisted(p), data);
  }},
  {name: 'normal-repeat', photos: true, run: async (p, label) => {
    const data = await persisted(p);
    for (let i = 0; i < 2; i++) {
      await tap(p, '#moBtn'); await pending(p, i + 1); await release(p, i);
      const r = await report(p);
      check(label + ' normal request' + (i + 1) + ' opens October with its real native photo', [r.on, r.title, r.month, r.images], [true, 'ИТОГИ', 'Октябрь 2026', 1]);
      check(label + ' normal request' + (i + 1) + ' focuses report close button', await p.evaluate(() => document.activeElement.id), 'shX');
      await tap(p, '#shX');
    }
    check(label + ' repeated photo reports preserve exact source', await persisted(p), data);
  }},
  {name: 'new-measurement', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1);
    await tap(p, '[data-meas="1"]'); await p.locator('[data-mk="waist"]').fill('87,5');
    const before = await view(p), data = await persisted(p);
    check(label + ' fixture has newer unsaved87,5 with focused waist field', [before.title, before.raw, before.focus, before.lock], ['ЗАМЕРЫ', '87,5', 'waist', 'hidden']);
    await release(p, 0);
    const after = await view(p);
    check(label + ' late photo return cannot replace raw87,5 or steal its focus', [after.title, after.raw, after.focus], ['ЗАМЕРЫ', '87,5', 'waist']);
    await checkUntouched(p, label, before, data);
  }},
  {name: 'second-photo-new-measurement', photos: true, red: true, run: async (p, label) => {
    await p.evaluate(async () => {
      // The second October image is a real native record too; no replacement
      // of phGet, model builders, report handlers or rendering is involved.
      const pixel = await phGet('2026-10-10');
      await phPut('2026-10-14', pixel); PHCACHE.clear(); await phSync();
    });
    await tap(p, '#moBtn'); await pending(p, 1); await release(p, 0); await pending(p, 2);
    check(label + ' first native photo returned and distinct14October photo is pending',
      await p.evaluate(() => [monthPhotoReads[0].ds, monthPhotoReads[1].ds, $('sh').classList.contains('on')]),
      ['2026-10-10', '2026-10-14', false]);
    await tap(p, '[data-meas="1"]'); await p.locator('[data-mk="waist"]').fill('87,5');
    const before = await view(p), data = await persisted(p);
    check(label + ' newer unsaved form owns raw87,5 and focus',
      [before.title, before.raw, before.focus, before.lock], ['ЗАМЕРЫ', '87,5', 'waist', 'hidden']);
    await release(p, 1);
    const after = await view(p);
    check(label + ' second late native photo cannot replace raw87,5 or steal focus',
      [after.title, after.raw, after.focus], ['ЗАМЕРЫ', '87,5', 'waist']);
    await checkUntouched(p, label, before, data);
  }},
  {name: 'latest-month', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1); await release(p, 0);
    await tap(p, '#moP'); await pending(p, 2); // September waits under October.
    await tap(p, '#moN'); await pending(p, 3); await release(p, 2);
    check(label + ' newer November request really opened before older September returns', (await report(p)).month, 'Ноябрь 2026');
    const before = await view(p), data = await persisted(p);
    await release(p, 1); await checkUntouched(p, label, before, data);
  }},
  {name: 'closed-sheet', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1); await release(p, 0);
    await tap(p, '#moP'); await pending(p, 2); await tap(p, '#shX');
    const before = await view(p), data = await persisted(p);
    check(label + ' fixture closed the underlying report', [before.on, before.lock], [false, '']);
    await release(p, 1); await checkUntouched(p, label, before, data);
  }},
  {name: 'same-title-reopened', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1); await release(p, 0);
    await tap(p, '#moP'); await pending(p, 2); await tap(p, '#shX');
    await tap(p, '#moBtn'); await pending(p, 3); await release(p, 2);
    await p.locator('#moP').focus();
    const before = await view(p), data = await persisted(p);
    check(label + ' newer same-title report really reopened October', (await report(p)).month, 'Октябрь 2026');
    await release(p, 1); await checkUntouched(p, label, before, data);
  }},
  {name: 'changed-tab', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1); await tap(p, '[data-tab="food"]');
    const before = await view(p), data = await persisted(p);
    check(label + ' real tab action selected food', before.tab, 'food');
    await release(p, 0); await checkUntouched(p, label, before, data);
  }},
  {name: 'tab-roundtrip', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1);
    await tap(p, '[data-tab="food"]'); await tap(p, '[data-tab="prog"]');
    const before = await view(p), data = await persisted(p);
    check(label + ' real roundtrip returns to original Progress with report still closed', [before.tab, before.on], ['prog', false]);
    await release(p, 0); await checkUntouched(p, label, before, data);
  }},
  {name: 'changed-calendar-month', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1); await tap(p, '#pm');
    const before = await view(p), data = await persisted(p);
    check(label + ' real calendar action selected September', before.mo, '2026-09');
    await release(p, 0); await checkUntouched(p, label, before, data);
  }},
  {name: 'calendar-month-roundtrip', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1); await tap(p, '#pm'); await tap(p, '#nm');
    const before = await view(p), data = await persisted(p);
    check(label + ' real calendar roundtrip returns to October with focus on Next',
      [before.mo, before.on, before.focus], ['2026-10', false, 'nm']);
    await release(p, 0); await checkUntouched(p, label, before, data);
  }},
  {name: 'newer-overlay', photos: true, red: true, run: async (p, label) => {
    await tap(p, '#moBtn'); await pending(p, 1); await tap(p, '#anBtn'); await tap(p, '#shI');
    const before = await view(p), data = await persisted(p);
    check(label + ' newer hint owns focus above Analysis', [before.title, before.hint, before.focus], ['РАЗБОР', true, 'hshX']);
    await release(p, 0); await checkUntouched(p, label, before, data);
  }}
];

(async () => {
  const selected = cases.filter(c => (!redOnly || c.red) && (!onlyCase || c.name === onlyCase));
  if (!selected.length) throw new Error('No monthly report cases match the requested filters');
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) for (const item of selected) {
      const label = width + ' ' + item.name;
      let context;
      try {
        const f = await fresh(browser, width, item.kind, item.photos); context = f.context;
        await item.run(f.p, label);
        check(label + ' no uncaught application errors', f.errors, []);
      } catch (e) {
        failures++; harnessErrors++;
        console.log('  ✗ ' + label + ' HARNESS/UNEXPECTED ' + e.stack);
      } finally { if (context) await context.close(); }
    }
  } finally { await browser.close(); }
  console.log('Monthly report: ' + checks + ' checks, ' + failures + ' failures, ' + harnessErrors + ' harness errors' + (redOnly ? ' (RED-only)' : ''));
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('FATAL', e); process.exitCode = 2; });
