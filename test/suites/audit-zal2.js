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
    try { clearInterval(tInt); tInt = null; } catch (e) { }   // таймер отдыха — если он ещё есть в сборке
    if ($('tmr')) $('tmr').classList.remove('on');
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
  // тип — касанием номера подхода; одна кнопка чаще 260 мс — дребезг, поэтому с паузой
  const тип = async (i, n) => { for (let k = 0; k < n; k++) { await p.locator(C + `[data-kindcyc="${i}"]`).click(); await p.waitForTimeout(300); } };
  await тип(0, 1); await тип(2, 2); await тип(3, 3);                           // Р, О, Д
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
  await p.locator(C + '[data-kindcyc="0"]').click();                          // первая строка — разминка
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
  await p.evaluate(() => toggleSet(0)); await p.waitForTimeout(300);
  const l2 = await лог(), т2 = await p.evaluate(() => dayTon(today()));
  chk(до2 === '12/9/9/9' && переход === до2 && перезагр === до2 && галка && /12\/9\/9\/9/.test(строка)
      && JSON.stringify(l2.wu) === '[12]' && JSON.stringify(l2.rs) === '[9,9,9]' && т2 === 9 * 60 * 3,
    '2. вписанные повторы переживают переход и перезагрузку, ○ в списке закрывает черновик с разминкой', JSON.stringify({ до2, переход, перезагр, галка, строка, l2, т2 }));

  // 3. «Завершить» без единого закрытого подхода тренировку не закрывает: ни опыта, ни недели в серию
  await день();
  const xp3 = await p.evaluate(() => S.xp);
  await p.evaluate(() => $('fin').click()); await p.waitForTimeout(250);
  await p.evaluate(() => $('fin').click()); await p.waitForTimeout(300);
  const пусто = await p.evaluate(xp0 => ({ wo: recOf(today()).wo, dxp: S.xp - xp0, нед: doneThisWeek(today()), отмена: !$('woCx').hidden }), xp3);
  await p.evaluate(() => sheetClose());
  chk(!пусто.wo && пусто.dxp === 0 && пусто.нед === 0 && пусто.отмена,
    '3. пустая тренировка не закрывается: без опыта и без недели в серию, «Отменить начало» на месте', JSON.stringify(пусто));

  // 4. итоги тренировки: «упражнений» — сделанные по журналу, а не стоящие в плане дня
  await день();
  await p.evaluate(() => { recRW(today()).t0 = Date.now() - 6e5; exOpen = null; render(); });
  await p.evaluate(() => toggleSet(0)); await p.waitForTimeout(300);
  await p.evaluate(() => $('fin').click()); await p.waitForTimeout(300);
  const итог = await p.evaluate(() => ({ wo: recOf(today()).wo, упр: document.querySelector('#shB .sum .win b').textContent, журнал: dayEntries(today()).length }));
  await p.evaluate(() => sheetClose());
  chk(итог.wo && итог.упр === '1' && итог.журнал === 1,
    '4. итоги тренировки считают сделанные упражнения (1 из 2), а не план дня', JSON.stringify(итог));

  // 5. «Каждую неделю» отдых → тренировка: прошлые дни отдыха без записей не становятся пропусками
  const был5 = await p.evaluate(() => {
    S.rec = {}; S.map = {}; delete S.pause; S.days = build().days;
    S.start = addDays(mondayOf(today()), -28);
    // все прошлые тренировки сделаны — слабого звена нет
    for (let ds = S.start; ds < today(); ds = addDays(ds, 1)) if (dayOf(ds).t !== 'rest') S.rec[ds] = { wo: 1, log: {}, sp: {} };
    entCache = null; recomputeStats(1); save(); edit = false; sel = today(); render();
    const i = S.days.findIndex((d, k) => d.t === 'rest' && k !== wdOf(today()));
    const mon = addDays(mondayOf(today()), -28);
    return { i, att: attendance(28), мес: rangeData(mon, 28).days.filter(x => x.tr).length, звено: regularity(28).worst || null };
  });
  await p.evaluate(i => { wkMode = 'all'; openWeekPlan(today()); wkPick = i; openWeekPlan();
    document.querySelector('#shB [data-wpt="up1"]').click(); }, был5.i);
  await p.waitForTimeout(300); await p.click('#askY'); await p.waitForTimeout(300);
  const стал5 = await p.evaluate(i => {
    sheetClose();
    const mon = addDays(mondayOf(today()), -28), next = addDays(today(), ((i - wdOf(today())) + 7) % 7 || 7);
    return { шаблон: S.days[i].t, att: attendance(28), мес: rangeData(mon, 28).days.filter(x => x.tr).length,
      впереди: dayOf(next).t, звено: regularity(28).worst || null };
  }, был5.i);
  chk(стал5.шаблон === 'up1' && стал5.впереди === 'up1' && стал5.att.planned === был5.att.planned && стал5.мес === был5.мес && !был5.звено && !стал5.звено,
    '5. отдых → тренировка во всех неделях: прошлые дни отдыха не числятся пропусками, будущие — тренировки', JSON.stringify({ был5, стал5 }));

  // 6. черновик сегодняшнего дня (вписанный вес до закрытия) после обмена дней шаблона не встаёт на чужое упражнение
  await день();
  const k6 = await p.evaluate(() => {
    const t = today(), wd = wdOf(t);
    const k = S.days.findIndex((d, i) => i !== wd && d.t !== 'rest');
    S.days[k].ex = [{ n: 'Присед', s: 3, r: '5', w: 100, g: 'Ноги' }];
    save(); exOpen = 0; render(); return k;
  });
  await p.locator(C + '[data-f="w"]').fill('62.5');
  await p.locator(C + '[data-ws="0"]').fill('65');
  const обмен = () => p.evaluate(k => { wkMode = 'all'; openWeekPlan(today()); wkPick = null;
    document.querySelector('#shB [data-wpd="' + wdOf(today()) + '"]').click();
    document.querySelector('#shB [data-wpd="' + k + '"]').click(); sheetClose(); exOpen = 0; render();
    const c = document.querySelector('.ex[data-j="0"]');
    return { n: dayOf(today()).ex[0].n, w: c.querySelector('[data-f="w"]').value, ws0: c.querySelector('[data-ws="0"]').value }; }, k6);
  const туда = await обмен(), обратно = await обмен();
  chk(туда.n === 'Присед' && туда.w === '100' && туда.ws0 === '' && обратно.n === 'Жим лёжа' && обратно.w === '62,5' && обратно.ws0 === '65',
    '6. обмен дней шаблона: вписанный вес жима не встаёт на присед и возвращается с жимом', JSON.stringify({ туда, обратно }));

  chk(errs.length === 0, 'без ошибок в консоли', errs.join(' | ') || 'чисто');
  await b.close();
  process.exit(fails ? 1 : 0);
})();
