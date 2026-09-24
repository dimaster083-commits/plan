/* Каждая кнопка приложения: нажимаем всё подряд и следим, чтобы ни
   одна не молчала и не роняла страницу. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const out = [];
const ok = (n, c, d) => out.push((c ? '  ✓ ' : '  ✗ ') + n + (c ? '' : '   → ' + d));

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('CONSOLE: ' + m.text()); });
  await page.goto(APP);
  await page.waitForTimeout(1200);
  const closeSetup = () => page.evaluate(() => { S.setup = 1; save(); document.getElementById('setup').classList.remove('on'); });
  await closeSetup();

  // ---- 1. рабочий вес растёт сам и во всех днях ----
  let r = await page.evaluate(() => {
    // найти день с упражнением, которое встречается больше одного раза
    const counts = {};
    S.days.forEach(d => (d.ex||[]).forEach(e => counts[e.n] = (counts[e.n]||0)+1));
    const name = Object.keys(counts).find(n => counts[n] > 1);
    const di = S.days.findIndex(d => (d.ex||[]).some(e => e.n === name));
    const j = S.days[di].ex.findIndex(e => e.n === name);
    const before = S.days.map(d => (d.ex||[]).filter(e => e.n === name).map(e => +e.w)).flat();
    // встать на этот день недели
    const iso = x => { const z = new Date(x); z.setMinutes(z.getMinutes()-z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
    // идём НАЗАД к ближайшему такому дню недели: в будущем дне подход
    // теперь не закрывается — тренировки, которой не было, и нет
    let d0 = new Date();
    while (dayIdx(iso(d0)) !== di) d0.setDate(d0.getDate()-1);
    sel = iso(d0); editPast = false; tab='wo'; render();
    return { name, di, j, before, sel };
  });
  await page.waitForTimeout(200);
  // упражнение надо раскрыть: в списке полей ввода нет
  await page.evaluate(({ j }) => { exOpen = j; render(); }, r);
  await page.waitForTimeout(200);
  await page.evaluate(({ j }) => {
    const card = document.querySelector(`#exl .ex[data-j="${j}"]`);
    const w = card.querySelector('[data-f="w"]');
    w.value = '99'; w.dispatchEvent(new Event('input', { bubbles: true }));
  }, r);
  await page.waitForTimeout(150);
  await page.evaluate(({ j }) => toggleSet(j), r);
  await page.waitForTimeout(300);
  let after = await page.evaluate(n => S.days.map(d => (d.ex||[]).filter(e => e.n === n).map(e => +e.w)).flat(), r.name);
  ok('поднятый вес переносится во все дни программы',
     after.length > 1 && after.every(w => w === 99), `было ${r.before} стало ${after}`);

  // ---- 2. снятая отметка возвращает вес ----
  await page.evaluate(({ j }) => toggleSet(j), r);
  await page.waitForTimeout(300);
  let back = await page.evaluate(n => S.days.map(d => (d.ex||[]).filter(e => e.n === n).map(e => +e.w)).flat(), r.name);
  ok('снятая отметка возвращает рабочий вес',
     JSON.stringify(back) === JSON.stringify(r.before), `было ${r.before} стало ${back}`);

  // ---- 3. тоннаж не накручивается при повторных нажатиях ----
  const volA = await page.evaluate(() => { recomputeStats(); return JSON.stringify(S.vol); });
  await page.evaluate(({ j }) => { toggleSet(j); }, r);
  await page.waitForTimeout(200);
  await page.evaluate(({ j }) => { toggleSet(j); }, r);
  await page.waitForTimeout(200);
  const volB = await page.evaluate(() => { recomputeStats(); return JSON.stringify(S.vol); });
  ok('тоннаж не накручивается от повторных нажатий', volA === volB, `${volA} → ${volB}`);

  // ---- 4. еда принадлежит дате, а не дню недели ----
  const food = await page.evaluate(() => {
    const iso = x => { const z = new Date(x); z.setMinutes(z.getMinutes()-z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
    const a = iso(new Date());
    const d7 = new Date(); d7.setDate(d7.getDate()-7);
    const b = iso(d7);                       // тот же день недели неделю назад
    sel = a; const m = mealsRW(a); m[0].items = [{ p: 'Овсянка на воде готовая', g: '100' }]; save();
    const kA = sumMeals(mealsOf(a)).k, kB = sumMeals(mealsOf(b)).k;
    return { sameWeekday: dayIdx(a) === dayIdx(b), kA, kB };
  });
  ok('еда одного дня не появляется в том же дне недели неделей раньше',
     food.sameWeekday && food.kA > 0 && food.kB === 0, JSON.stringify(food));

  // ---- 5. история прошедшего дня ----
  await page.evaluate(() => { exOpen = null; render(); });
  const hist = await page.evaluate(() => {
    const iso = x => { const z = new Date(x); z.setMinutes(z.getMinutes()-z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
    // берём ближайший прошедший день, в котором есть упражнения
    let ds = null;
    for (let k = 1; k <= 10 && !ds; k++) {
      const d = new Date(); d.setDate(d.getDate()-k);
      const c = iso(d); if ((dayOf(c).ex||[]).length) ds = c;
    }
    const day = dayOf(ds), rr = recRW(ds);
    rr.wo = 1;
    (day.ex||[]).forEach((e,j) => { rr.log[j] = { done:1, n:e.n, g:e.g, s:e.s, r:String(e.r), w:e.w, rs:[8,8,8], vol: 24*(+e.w||0) }; });
    save();
    sel = ds; editPast = false; tab = 'wo'; render();
    return { entries: dayEntries(ds).length, ton: dayTon(ds),
             cards: document.querySelectorAll('#exl .jrow').length,
             inputs: document.querySelectorAll('#exl input').length,
             editBtn: !document.getElementById('editPast').hidden };
  });
  ok('прошедший день показан как история, без полей ввода',
     hist.cards > 0 && hist.inputs === 0 && hist.editBtn, JSON.stringify(hist));

  // ---- 6. «Править» возвращает карточки ----
  await closeSetup();
  await page.click('#editPast');
  await page.waitForTimeout(250);
  const edited = await page.evaluate(() => ({
    rows: document.querySelectorAll('#exl .exrow').length,
    jrows: document.querySelectorAll('#exl .jrow').length }));
  ok('кнопка «Править» возвращает рабочий список', edited.rows > 0 && edited.jrows === 0, JSON.stringify(edited));

  // ---- 7. список истории в «Прогрессе» ----
  const hl = await page.evaluate(() => { tab='prog'; render(); return {
    rows: document.querySelectorAll('#hist [data-day]').length,
    load: document.querySelectorAll('#loadList .ld').length }; });
  ok('в «Прогрессе» есть список истории', hl.rows > 0, JSON.stringify(hl));
  const nGroups = await page.evaluate(() => GROUPS.length);
  ok('объём и тоннаж сведены в один список по группам', hl.load === nGroups, `строк: ${hl.load}, групп: ${nGroups}`);

  // ---- 8. разбор дня открывается ----
  await closeSetup();
  await page.click('#hist [data-day]');
  await page.waitForTimeout(400);
  const rep = await page.evaluate(() => ({
    open: document.getElementById('sh').classList.contains('on'),
    title: document.getElementById('shT').textContent,
    rows: document.querySelectorAll('#shB .jrow').length }));
  ok('разбор дня открывается и показывает подходы', rep.open && rep.rows > 0, JSON.stringify(rep));
  await page.evaluate(() => sheetClose());

  // ---- 9. плечи считаются отдельно ----
  const delts = await page.evaluate(() => ({
    inGroups: GROUPS.some(g => g[0] === 'Плечи'),
    mahi: (EXDB['Махи в стороны']||[])[1],
    zhim: (EXDB['Жим гантелей сидя']||[])[1],
    inVol: S.vol['Плечи'] !== undefined }));
  ok('плечи — отдельная группа, махи и жим сидя не «Грудь»',
     delts.inGroups && delts.mahi === 'Плечи' && delts.zhim === 'Плечи' && delts.inVol, JSON.stringify(delts));

  // ---- 10. тема одна — «Система», выбора оформления нет ----
  const gear = await page.evaluate(() => { openSettings();
    return { open: document.getElementById('sh').classList.contains('on'),
             picks: document.querySelectorAll('[data-skin-set]').length,
             skin: document.documentElement.dataset.skin, q: T('quest') }; });
  ok('настройки открываются, выбора темы в них нет, тема — Система',
     gear.open && gear.picks === 0 && gear.skin === 'sl' && gear.q === 'Квест дня', JSON.stringify(gear));
  await page.evaluate(() => sheetClose());

  // ---- 11. закрытие тренировки ----
  await page.evaluate(() => { S.setup=1; save(); document.getElementById('setup').classList.remove('on');
    sel = today(); editPast=false; tab='wo';
    const d = dayOf(sel); if (d.t === 'rest') { d.t='up2'; d.s='Верх тела'; d.ex = S.days.find(x=>(x.ex||[]).length).ex.map(e=>({...e})); }
    render(); });
  await page.waitForTimeout(250);
  const finished = await page.evaluate(() => {
    exOpen = null; render();
    const d = dayOf(sel); d.ex.forEach((_, j) => toggleSet(j));
    const f = document.getElementById('fin');
    const canFinish = !f.disabled;
    f.click();
    return { canFinish, wo: !!recOf(sel).wo, sheet: document.getElementById('sh').classList.contains('on') };
  });
  await page.waitForTimeout(300);
  ok('тренировка закрывается и показывает итоги', finished.canFinish && finished.wo && finished.sheet, JSON.stringify(finished));
  await page.evaluate(() => sheetClose());

  // ---- 12. резервная копия: состояние переживает круг ----
  const round = await page.evaluate(() => {
    const before = JSON.stringify(S);
    const copy = JSON.parse(before);
    S = copy; migrate(); recomputeStats();
    return { same: JSON.stringify(S.rec) === JSON.stringify(JSON.parse(before).rec),
             vol: Object.keys(S.vol).length };
  });
  ok('журнал не меняется при повторной миграции', round.same, JSON.stringify(round));

  console.log(out.join('\n'));
  console.log('\nОшибки JS за весь прогон:', errs.length ? [...new Set(errs)].join('\n') : 'нет');
  await browser.close();
})().catch(e => { console.log(out.join('\n')); console.log('FATAL', e.message); process.exit(1); });
