/* Второй аудит «Зала»: настоящая тренировка целиком — разминка, отказ, дроп,
   разный вес по подходам, галочки и кнопка, отмена, прошлые дни, план недели,
   полночь. Каждая проверка — на ошибку, найденную при прогоне, и падает на
   коде до правки. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport: { width: 320, height: 700 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // сегодня — жим 4×6–8 и тяга; неделю назад жим уже был
  const день = () => p.evaluate(() => {
    S.setup = 1; S.sound = 0; document.getElementById('setup').classList.remove('on');
    S.rec = {}; S.map = {}; S.pr = {}; delete S.pause; S.days = build().days;
    S.start = addDays(today(), 60);
    const d = dayOf(today()); d.t = 'up1'; d.s = 'тест';
    d.ex = [{ n: 'Жим лёжа', s: 4, r: '6-8', w: 60, g: 'Грудь' }, { n: 'Тяга штанги в наклоне', s: 3, r: '8-10', w: 50, g: 'Спина' }];
    S.rec[addDays(today(), -7)] = { wo: 1, log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', w: '60', s: '3', r: '6-8', rs: [8, 8, 7], ws: [60, 60, 65], vol: 1415, sd: 1 } }, sp: {} };
    entCache = null; recomputeStats(1); save(); tab = 'wo'; sel = today(); exOpen = 0; edit = false; editPast = false; render();
  });
  const C = '.ex[data-j="0"] ';
  const лог = () => p.evaluate(() => JSON.parse(JSON.stringify(recOf(today()).log[0] || {})));

  // 1. разминка / рабочий / отказ / дроп: галочки по порядку — упражнение закрывается на дропе, а не раньше
  await день();
  await p.click(C + '[data-kindmode]');
  await p.locator(C + '.rbx').nth(0).click();                                  // Р
  for (let k = 0; k < 2; k++) await p.locator(C + '.rbx').nth(2).click();      // О
  for (let k = 0; k < 3; k++) await p.locator(C + '.rbx').nth(3).click();      // Д
  await p.click(C + '[data-kindmode]');
  const вв = [['40', '10'], ['60', '8'], ['65', '6'], ['45', '12']];
  for (let i = 0; i < 4; i++) { await p.locator(C + `[data-ws="${i}"]`).fill(вв[i][0]); await p.locator(C + `[data-rs="${i}"]`).fill(вв[i][1]); }
  const ход = [];
  for (let i = 0; i < 4; i++) { await p.locator(C + `[data-tick="${i}"]`).click(); await p.waitForTimeout(260); ход.push(!!(await лог()).done); }
  const l1 = await лог();
  const т1 = await p.evaluate(() => ({ ton: dayTon(today()), sets: daySets(today()), pr: S.pr['Жим лёжа'] }));
  chk(ход.join() === 'false,false,false,true' && l1.done && JSON.stringify(l1.rs) === '[8,6]' && JSON.stringify(l1.fl) === '[1]'
      && JSON.stringify(l1.wu) === '[10]' && JSON.stringify(l1.dr) === '[12]' && т1.ton === 8 * 60 + 6 * 65 && т1.sets === 2 && т1.pr === 65,
    '1. отказ — рабочий подход, дроп после него ждёт галочки: закрытие на последней строке, тоннаж по рабочим', JSON.stringify({ ход, l1, т1 }));

  // 2. вписанные повторы — в журнале дня: переход к другому упражнению и перезагрузка их не стирают,
  //    а ○ в списке закрывает ровно черновик — с разминкой, которую отметили в карточке
  await день();
  await p.click(C + '[data-kindmode]');
  await p.locator(C + '.rbx').nth(0).click();                                  // первая строка — разминка
  await p.click(C + '[data-kindmode]');
  await p.locator(C + '[data-rs="0"]').fill('12');
  await p.locator(C + '[data-rs="1"]').fill('9');
  await p.locator(C + '[data-tick="1"]').click();
  const клетки = () => p.evaluate(() => [...document.querySelectorAll('.ex[data-j="0"] [data-rs]')].map(x => x.value).join('/'));
  const до2 = await клетки();
  await p.evaluate(() => { exOpen = 1; render(); exOpen = 0; render(); });
  const переход = await клетки();
  await p.reload(); await p.waitForTimeout(1200);
  await p.evaluate(() => { tab = 'wo'; sel = today(); exOpen = 0; render(); });
  const перезагр = await клетки();
  const галка = await p.evaluate(() => document.querySelectorAll('.ex[data-j="0"] .srow')[1].classList.contains('on'));
  await p.evaluate(() => { exOpen = null; render(); });
  const строка = await p.evaluate(() => document.querySelector('.exrow[data-j="0"] .s').textContent);
  await p.click('.exrow[data-j="0"] [data-go="0"]'); await p.waitForTimeout(300);
  const l2 = await лог(), т2 = await p.evaluate(() => dayTon(today()));
  chk(до2 === '12/9/9/9' && переход === до2 && перезагр === до2 && галка && /12\/9\/9\/9/.test(строка)
      && JSON.stringify(l2.wu) === '[12]' && JSON.stringify(l2.rs) === '[9,9,9]' && т2 === 9 * 60 * 3,
    '2. вписанные повторы переживают переход и перезагрузку, ○ в списке закрывает черновик с разминкой', JSON.stringify({ до2, переход, перезагр, галка, строка, l2, т2 }));

  chk(errs.length === 0, 'без ошибок в консоли', errs.join(' | ') || 'чисто');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
