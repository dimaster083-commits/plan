/* Ручной рабочий вес не перетирается расчётом; облегчение не прогрессирует,
   а закреплённый полный вес растёт один раз и два провала снижают его на шаг. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const saved = await p.evaluate(() => {
    S.setup = 1; S.sound = 0; document.getElementById('setup').classList.remove('on');
    const di = S.days.findIndex(x => (x.ex || []).length), e = S.days[di].ex[0], ds = '2026-09-17';
    e.w = 57.5; e.fixed = 1;
    S.rec = { [ds]: { wo: 1, log: { 0: { done: 1, n: e.n, g: e.g, s: '3', r: '6-8',
      w: 52.5, rs: [8, 8, 8], vol: 1260, xp: 12 } }, sp: {} } };
    save(); flush();
    return { di, ds, manual: e.w, logged: S.rec[ds].log[0].w };
  });
  await p.reload(); await p.waitForTimeout(1300);
  const reloaded = await p.evaluate(({ di, ds }) => ({
    manual: S.days[di].ex[0].w, fixed: S.days[di].ex[0].fixed,
    logged: S.rec[ds].log[0].w, done: S.rec[ds].log[0].done
  }), saved);
  chk(reloaded.manual === saved.manual && reloaded.fixed === 1 && reloaded.logged === saved.logged && reloaded.done === 1,
    '1. ручной рабочий и записанный выполненный вес переживают save/reload', JSON.stringify(reloaded));
  const r = await p.evaluate(() => {
    S.setup = 1; S.sound = 0; document.getElementById('setup').classList.remove('on');
    S.anchors = { b: 100, s: 80, d: 120 }; S.returning = 1; S.start = '2026-09-14'; S.rec = {};
    const d = S.days.find(x => (x.ex || []).length), e = d.ex[0];
    e.w = 50; e.fixed = 1; const manual = e.w; deriveWeights(); const fixed = e.w;
    delete e.fixed; e.r = '6-8'; e.s = 3; e.w = 50;
    const lightDs = '2026-09-21', fullDs = '2026-10-05';
    const light = weightFor(e, [1], lightDs), full = weightFor(e, [1], fullDs);
    const top = topRep(e.r), lLight = { s: 3, r: e.r, w: light, rs: [top, top, top] };
    maybeProgress(lLight, e, light); const afterLight = e.w;
    const lFull = { s: 3, r: e.r, w: full, rs: [top, top, top] };
    maybeProgress(lFull, e, full); const afterFull = e.w;
    maybeProgress(lFull, e, full); const afterTwice = e.w;
    return { manual, fixed, light, full, afterLight, afterFull, afterTwice, step: stepFor({ g: e.g, w: 50 }), ramp: rampOf(lightDs) };
  });
  chk(r.fixed === r.manual, '2. deriveWeights не перетирает e.fixed', r.manual + ' → ' + r.fixed);
  chk(r.ramp === .9 && r.light < r.full && r.afterLight === 50, '3. 90% цикла не поднимают рабочий вес', JSON.stringify(r));
  chk(r.afterFull === 50 + r.step && r.afterTwice === r.afterFull,
    '4. верх всех подходов на полном весе поднимает ровно один раз', JSON.stringify(r));

  const lower = await p.evaluate(() => {
    const d = S.days.find(x => (x.ex || []).length), e = d.ex[0]; e.w = 50; e.r = '6-8'; e.s = 3;
    const dates = ['2026-10-12', '2026-10-19']; const j = 0;
    dates.forEach(ds => { S.map[ds] = S.days.indexOf(d); S.rec[ds] = { wo: 1, log: { [j]: { done: 1, n: e.n, g: e.g, s: '3', r: '6-8', w: 50, rs: [5, 4, 4], vol: 650, xp: 12 } }, sp: {} }; });
    sel = dates[1]; const l = S.rec[sel].log[j]; maybeRegress(l, e, 50);
    return { before: 50, after: e.w, down: !!l.down, step: stepFor({ g: e.g, w: 50 }) };
  });
  chk(lower.down && lower.after === lower.before - lower.step, '5. второй подряд недобор снижает рабочий вес на шаг', JSON.stringify(lower));
  chk(errs.length === 0, '6. без ошибок JavaScript', errs.join(' | ') || 'чисто');
  await b.close(); console.log('\nпроблем: ' + fails); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
