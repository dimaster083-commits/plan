/* Лёгкий объём меняет только будущие назначения, не журнал выполненных подходов. */
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

  const before = await p.evaluate(() => {
    S.setup = 1; document.getElementById('setup').classList.remove('on');
    const future = iso(new Date(Date.now() + 7 * 864e5));
    const day = S.days.find(d => (d.ex || []).some(e => num(e.s) >= 3));
    const j = day.ex.findIndex(e => num(e.s) >= 3);
    const base = num(day.ex[j].s);
    const historical = {
      '2026-09-17': { log: { [j]: { done: 1, n: day.ex[j].n, g: day.ex[j].g, s: '3', r: '8', rs: ['8', '8', '8'], w: '20' } } },
      '2026-09-19': { log: { [j]: { done: 1, n: day.ex[j].n, g: day.ex[j].g, s: '4', r: '8', rs: ['8', '8', '8', '8'], w: '20' } } }
    };
    S.rec = historical;
    flush();
    return { future, base, j, standard: setsOf(future, base, j),
      expectedStandard: Math.max(2, base + cycOf(future).ds),
      logs: JSON.stringify(Object.values(S.rec).map(r => r.log)) };
  });
  chk(before.standard === before.expectedStandard, '1. стандартный режим сохраняет число рабочих подходов',
      before.standard + ' по текущему циклу');

  const light = await p.evaluate(({ future, base, j }) => {
    openSettings();
    const btn = document.querySelector('#shB [data-volume-mode="light"]');
    if (btn) btn.click();
    return { mode: S.volumeMode, prescribed: setsOf(future, base, j), settings: !!btn,
      logs: JSON.stringify(Object.values(S.rec).map(r => r.log)) };
  }, before);
  chk(light.settings && light.mode === 'light', '2. в настройках можно выбрать лёгкий объём',
      JSON.stringify({ control: light.settings, mode: light.mode }));
  chk(light.prescribed === Math.max(2, before.standard - 1), '3. лёгкий режим уменьшает будущее назначение на один подход, но не ниже двух',
      before.standard + ' → ' + light.prescribed);
  chk(light.logs === before.logs, '4. переключение не меняет логи за 17 и 19 сентября',
      light.logs === before.logs ? 'снимок журнала совпал' : 'журнал изменён');

  await p.reload(); await p.waitForTimeout(1300);
  const after = await p.evaluate(({ future, base, j, logs }) => ({
    mode: S.volumeMode, prescribed: setsOf(future, base, j),
    logs: JSON.stringify(Object.values(S.rec).map(r => r.log))
  }), before);
  chk(after.mode === 'light' && after.prescribed === Math.max(2, before.standard - 1),
      '5. выбор лёгкого объёма переживает перезагрузку', JSON.stringify(after));
  chk(after.logs === before.logs, '6. перезагрузка не меняет завершённые логи',
      after.logs === before.logs ? 'снимок журнала совпал' : 'журнал изменён');
  chk(errs.length === 0, '7. без ошибок JavaScript', errs.join(' | ') || 'чисто');

  await b.close();
  console.log('\nпровалено: ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(async e => { console.log('FATAL ' + e.message); process.exit(1); });
