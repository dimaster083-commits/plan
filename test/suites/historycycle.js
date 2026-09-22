/* История — это журнал, а не текущий план: записи по датам переживают
   календарный переход и перезагрузку без пересборки или потери снимка. */
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

  const seeded = await p.evaluate(() => {
    S.setup = 1; S.sound = 0; document.getElementById('setup').classList.remove('on');
    S.rec = {
      '2026-09-17': { wo: 1, log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: '3', r: '8-10', w: '55', rs: ['10', '10', '10'], vol: 1650, xp: 12 } }, sp: {} },
      '2026-09-19': { wo: 1, log: { 1: { done: 1, n: 'Тяга блока', g: 'Спина', s: '3', r: '10-12', w: '45', rs: ['12', '12', '12'], vol: 1620, xp: 12 } }, sp: {} }
    };
    const original = JSON.stringify(S.rec);
    tab = 'hist'; histLimit = 12; save(); render();
    return original;
  });
  await p.reload(); await p.waitForTimeout(1300);
  const after = await p.evaluate(() => {
    tab = 'hist'; paintHistory();
    return { days: [...document.querySelectorAll('#hist [data-day]')].map(x => x.dataset.day), rec: JSON.stringify(S.rec) };
  });
  chk(after.days.includes('2026-09-17') && after.days.includes('2026-09-19'),
    '1. обе завершённые даты видны в истории после перезагрузки', after.days.join(', '));
  chk(after.rec === seeded, '2. log, wo и ключи дат сохранены байт-в-байт после границы календаря');

  const incomplete = await p.evaluate(() => {
    S.rec = {}; const ds = today(); const d = dayOf(ds);
    if (d.t === 'rest') { const src = S.days.find(x => (x.ex || []).length); d.t = src.t; d.s = src.s; d.ex = src.ex.map(x => ({ ...x })); }
    sel = ds; tab = 'wo'; exOpen = null; render();
    const fin = document.getElementById('fin'); fin.click();
    return { disabled: fin.disabled, wo: !!recOf(ds).wo };
  });
  chk(incomplete.disabled && !incomplete.wo, '3. незаполненная тренировка не закрывается кликом #fin', JSON.stringify(incomplete));
  chk(errs.length === 0, '4. без ошибок JavaScript', errs.join(' | ') || 'чисто');
  await b.close(); console.log('\nпроблем: ' + fails); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
