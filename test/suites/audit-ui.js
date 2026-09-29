/* Аудит вёрстки и подписей на 320, 360, 375 и 414 px. Каждый пункт — найденная
   ошибка, проверка падает на коде до правки:
   · таймер отдыха на 320 уводил «СТОП» за край, пресеты сжимались до 33 px;
   · кнопки RPE на 320 — 42 px;
   · мышца в списке баланса резалась многоточием («Бицепс бе…») на 360;
   · поля подходов на 320, поиск каталога и поля добавок мельче 16 px — iPhone
     увеличивал страницу при касании;
   · правка дня жила в двух местах: скрытая панель #dedit «ТОЛЬКО ЭТА ДАТА…»
     из настроек и шторка «Неделя». Теперь одна дорога — «Неделя»: там и
     разовая замена, и тип дня во всех неделях;
   · «Отстаёт … там и доберёшь» на неделе, поставленной на паузу «болею». */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);
const wait = ms => new Promise(r => setTimeout(r, ms));

// журнал: тренировочный сегодня, прошлые тренировки, добавки
const SEED = () => {
  S.setup = 1; S.sound = 0; document.getElementById('setup').classList.remove('on');
  S.rec = {}; S.map = {}; delete S.pause; S.days = build().days;
  S.bw = '72'; S.bw0 = '70'; S.goal = '80'; S.height = 177; S.age = 30;
  const d0 = dayOf(today());
  if (d0.t === 'rest') { const s2 = S.days.find(x => (x.ex || []).length); d0.t = s2.t; d0.s = s2.s; d0.ex = s2.ex.map(e => ({ ...e })); }
  for (let k = 1; k <= 20; k++) {
    const ds = addDays(today(), -k), d = dayOf(ds);
    if (!(d.ex || []).length) continue;
    const r = recRW(ds); r.wo = 1; r.t0 = Date.now() - 4e6; r.t1 = Date.now() - 3.6e6;
    d.ex.forEach((e, j) => { r.log[j] = { done: 1, n: e.n, g: e.g, s: e.s, r: String(e.r), w: String(+e.w || 20), rs: [8, 8, 8], vol: 24 * (+e.w || 20), sd: 1 }; });
  }
  d0.sp = [{ n: 'Креатин', h: '5 г утром' }];
  entCache = null; save(); recomputeStats(1); sel = today(); tab = 'wo'; exOpen = null; render();
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const open = async w => {
    const p = await (await b.newContext({ viewport: { width: w, height: 740 } })).newPage();
    p.errs = []; p.on('pageerror', e => p.errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(SEED);
    return p;
  };
  const errs = [];

  // 1. таймера отдыха нет (решение владельца, 30.09.2026): ни окна, ни кнопки ⏱ в карточке
  for (const w of [320]) {
    const p = await open(w);
    const t = await p.evaluate(() => {
      tab = 'wo'; sel = today(); exOpen = 0; render();
      return { окно: !!document.getElementById('tmr'), кнопка: !!document.querySelector('[data-rest]'), функция: typeof tStart };
    });
    chk(!t.окно && !t.кнопка && t.функция === 'undefined', '1. таймера отдыха нет: ни окна, ни кнопки', JSON.stringify(t));
    errs.push(...p.errs); await p.close();
  }

  const p = await open(320);

  // 2. RPE на 320: пять кнопок не уже 44 px
  const rpe = await p.evaluate(() => {
    tab = 'wo'; sel = today(); exOpen = 0; render();
    return [...document.querySelectorAll('.rpe button')].map(x => Math.round(x.getBoundingClientRect().width));
  });
  chk(rpe.length === 5 && Math.min(...rpe) >= 44, '2. RPE на 320: кнопки ≥ 44 px', JSON.stringify(rpe));

  // 3. поля подходов на 320 — 16 px и число «142,5» влезает целиком
  const sw = await p.evaluate(() => {
    const ins = [...document.querySelectorAll('.srow .swkg:not([readonly]), .setr .rb .rbx input')].filter(i => i.getClientRects().length);
    const w0 = document.querySelector('.srow .swkg:not([readonly])');
    const was = w0 ? w0.value : ''; if (w0) w0.value = '142,5';
    const fit = w0 ? w0.scrollWidth <= w0.clientWidth + 1 : false;
    if (w0) w0.value = was;
    return { n: ins.length, fs: [...new Set(ins.map(i => parseFloat(getComputedStyle(i).fontSize)))], fit };
  });
  chk(sw.n > 0 && Math.min(...sw.fs) >= 16 && sw.fit, '3. поля веса и повторов на 320 — 16 px, «142,5» влезает', JSON.stringify(sw));

  // 4. как на iPhone: правило @supports (-webkit-touch-callout) действует — нет полей мельче 16 px
  const ios = await p.evaluate(async () => {
    document.querySelectorAll('style').forEach(s => { s.textContent = s.textContent.split('@supports (-webkit-touch-callout:none)').join('@supports (display:block)'); });
    const small = sc => [...sc.querySelectorAll('input:not([type=checkbox]):not([type=file]):not([type=date]),textarea,select')]
      .filter(i => i.getClientRects().length && !i.readOnly && parseFloat(getComputedStyle(i).fontSize) < 16)
      .map(i => (i.id || i.className || i.getAttribute('aria-label')) + ':' + parseFloat(getComputedStyle(i).fontSize));
    const out = {};
    tab = 'wo'; sel = today(); exOpen = 0; render(); out.зал = small(document.getElementById('scr-wo'));
    tab = 'food'; render(); out.еда = small(document.getElementById('scr-food'));
    tab = 'ex'; render(); await new Promise(r => setTimeout(r, 300)); out.каталог = small(document.getElementById('scr-ex'));
    return out;
  });
  const iosBad = Object.values(ios).flat();
  chk(!iosBad.length, '4. на iPhone ни одно поле не мельче 16 px (иначе страница увеличивается при касании)', JSON.stringify(ios));
  await p.reload(); await p.waitForTimeout(1300); await p.evaluate(SEED);

  // 5. одна дорога к расписанию: старой панели нет, настройки ведут в «Неделю»
  const one = await p.evaluate(async () => {
    openSettings(); await new Promise(r => setTimeout(r, 150));
    const bt = document.querySelector('#shB [data-dayset]');
    if (!bt) return { err: 'кнопки в настройках нет' };
    const lbl = bt.textContent.trim();
    bt.click(); await new Promise(r => setTimeout(r, 200));
    return { dedit: !!document.getElementById('dedit'), lbl, sheet: $('sh').classList.contains('on'), title: $('shT').textContent,
      rows: document.querySelectorAll('#shB [data-wpd]').length, gear: $('gear').getAttribute('aria-label'),
      text: /ТОЛЬКО ЭТА ДАТА|Только эта дата|ЭТОТ ДЕНЬ/.test(document.body.innerText) };
  });
  chk(!one.err && !one.dedit && one.sheet && one.title === 'НЕДЕЛЯ' && one.rows === 7 && !one.text && one.gear === 'Настройки',
    '5. правка дня — одна: настройки открывают шторку «Неделя», скрытой панели #dedit нет', one.err || JSON.stringify(one));

  // 6. «Каждую неделю»: выбрал день — тип дня во всех неделях, с вопросом; прошлое не трогается
  const past = await p.evaluate(() => {
    const k = S.days.findIndex(d => d.t === 'lo1');
    const ds = Object.keys(S.rec).filter(x => x < today() && wdOf(x) === k && S.rec[x].wo).sort()[0];
    return { k, ds, was: ds ? dayLook(ds).t : null };
  });
  const typ = await p.evaluate(async k => {
    wkMode = 'all'; openWeekPlan(sel);
    document.querySelector(`#shB [data-wpd="${k}"]`).click();
    const bs = [...document.querySelectorAll('#shB [data-wpt]')];
    if (!bs.length) return { err: 'под выбранным днём нет типов' };
    const on = bs.filter(x => x.classList.contains('on')).map(x => x.dataset.wpt);
    const small = bs.filter(x => x.getBoundingClientRect().height < 44).length;
    document.querySelector('#shB [data-wpt="up2"]').click();
    await new Promise(r => setTimeout(r, 100));
    const q = $('askT').textContent;
    $('askY').click(); await new Promise(r => setTimeout(r, 150));
    return { on, small, q, t: S.days[k].t, s: S.days[k].s, sheet: $('sh').classList.contains('on'),
      ovf: $('shB').scrollWidth - $('shB').clientWidth };
  }, past.k);
  const now = await p.evaluate(ds => ds ? dayLook(ds).t : null, past.ds);
  chk(!typ.err && typ.on.join() === 'lo1' && typ.small === 0 && typ.t === 'up2' && /во всех неделях/.test(typ.q) &&
      !/Только эта дата/.test(typ.q) && typ.sheet && typ.ovf <= 0 && (!past.ds || now === past.was),
    '6. «Каждую неделю»: тип дня меняется во всех неделях с вопросом, прошедшие остаются как были',
    typ.err || JSON.stringify({ ...typ, past: past.was + '→' + now }));

  // 7. «Эта неделя»: разовая замена одной даты без обмена; записанный день не предлагается
  const mv = await p.evaluate(async () => {
    S.days = build().days; S.map = {}; save(); render();
    const mon = addDays(mondayOf(today()), 7), days = weekDates(mon);
    wkMode = 'this'; openWeekPlan(mon);
    const rest = days.find(x => dayOf(x).t === 'rest');
    const k = S.days.findIndex(d => d.t === 'up1');
    document.querySelector(`#shB [data-wpd="${rest}"]`).click();
    const btn = document.querySelector(`#shB [data-wpset="${k}"]`);
    if (!btn) return { err: 'под выбранной датой нет замены' };
    const before = days.filter(x => x !== rest).map(x => dayOf(x).t).join();
    btn.click();
    const after = days.filter(x => x !== rest).map(x => dayOf(x).t).join();
    // вчерашняя записанная тренировка: строка закрыта, панели замены нет
    const past = Object.keys(S.rec).filter(x => x < today() && S.rec[x].wo).sort().pop();
    wkMode = 'this'; openWeekPlan(past); wkPick = past; openWeekPlan();
    return { t: dayOf(rest).t, map: S.map[rest], k, same: before === after, locked: !!document.querySelector('#shB .wkt') };
  });
  chk(!mv.err && mv.t === 'up1' && mv.map === mv.k && mv.same && !mv.locked,
    '7. «Эта неделя»: одна дата получает другую тренировку, остальные на месте; записанный день не трогается', mv.err || JSON.stringify(mv));

  // 8. шторка «Неделя» с выбранным днём влезает в 320–414, кнопки не мельче пальца
  for (const w of [320, 360, 375, 414]) {
    await p.setViewportSize({ width: w, height: 740 });
    const r = await p.evaluate(() => {
      wkMode = 'this'; openWeekPlan(addDays(mondayOf(today()), 7));
      document.querySelectorAll('#shB [data-wpd]')[2].click();
      const bs = [...document.querySelectorAll('#shB button')].filter(x => !x.disabled)
        .map(x => x.getBoundingClientRect()).filter(r => r.width < 44 || r.height < 44).length;
      return { ovf: $('shB').scrollWidth - $('shB').clientWidth, doc: document.documentElement.scrollWidth - innerWidth, bs };
    });
    chk(r.ovf <= 0 && r.doc <= 0 && r.bs === 0, `8. «Неделя» с выбором на ${w}: без прокрутки вбок, кнопки ≥ 44`, JSON.stringify(r));
  }
  // 9. список мышц: названия целиком, без многоточия («Бицепс бе…» на 360)
  await p.evaluate(() => sheetClose());
  for (const w of [320, 360, 375, 414]) {
    await p.setViewportSize({ width: w, height: 740 });
    const mus = await p.evaluate(async () => {
      tab = 'prog'; pSec = 'log'; render(); await new Promise(r => setTimeout(r, 200));
      const sp = [...document.querySelectorAll('#mlist .mrow span')];
      return { n: sp.length, cut: sp.filter(s => s.scrollWidth > s.clientWidth + 1 || s.scrollHeight > s.clientHeight + 1).map(s => s.textContent),
        low: Math.min(...[...document.querySelectorAll('#mlist .mrow')].map(x => Math.round(x.getBoundingClientRect().height))) };
    });
    chk(mus.n >= 9 && !mus.cut.length && mus.low >= 44, `9. список мышц на ${w}: названия не режутся, строки ≥ 44`, JSON.stringify(mus));
  }

  // 10. неделя на паузе: итоги не требуют «добрать»
  const lag = await p.evaluate(() => {
    S.rec = {}; entCache = null; save(); recomputeStats(1);
    const mon = mondayOf(today());
    const before = !!(openWeek(mon), document.querySelector('#shB .wklag'));
    S.pause = { [mon]: 1 }; save();
    openWeek(mon);
    const after = !!document.querySelector('#shB .wklag');
    delete S.pause; save(); sheetClose();
    return { before, after };
  });
  chk(lag.before && !lag.after, '10. неделя на паузе: «Отстаёт … там и доберёшь» не показывается', JSON.stringify(lag));

  errs.push(...p.errs);
  chk(!errs.length, 'без ошибок JS', [...new Set(errs)].join(' | ') || 'чисто');
  await b.close();
  console.log('\nпровалено: ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
