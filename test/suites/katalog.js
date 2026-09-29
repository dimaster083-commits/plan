/* Каталог упражнений — экран «Упражнения», как библиотека Lyfta.
   До этой правки выбрать можно было только из 67 упражнений программы
   списком без фото; своей вкладки, поиска по мышцам, избранного и страницы
   упражнения с мышцами и лесенкой по книге «Фитнес для умных» не было. */
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
  await p.evaluate(() => {
    S.setup = 1; S.sound = 0; document.getElementById('setup').classList.remove('on');
    S.rec = {}; delete S.fav; delete S.libEx; delete S.myEx;
    const d = dayOf(today()); d.t = 'up1'; d.ex = [{ n: 'Жим лёжа', s: 3, r: '8-10', w: 60, g: 'Грудь' }];
    save(); sel = today(); tab = 'wo'; render();
  });

  // 1. своя вкладка, пять вкладок поровну и не уже пальца, подписи не обрезаны
  const t1 = await p.evaluate(() => {
    const tabs = [...document.querySelectorAll('.tab')];
    const vis = [...document.querySelectorAll('.tab i')].filter(i => i.offsetParent);
    return { has: tabs.some(t => t.dataset.tab === 'ex'), w: tabs.map(t => Math.round(t.getBoundingClientRect().width)),
      cut: vis.filter(i => i.scrollWidth > i.clientWidth + 1).map(i => i.textContent) };
  });
  chk(t1.has && Math.min(...t1.w) >= 44 && t1.cut.length === 0, '1. вкладка «Упражнения», вкладки не уже 44 px, подписи целиком', JSON.stringify(t1));

  // 2. база грузится и показывается карточками
  await p.evaluate(() => { tab = 'ex'; render(); });
  await p.waitForFunction(() => document.querySelectorAll('#exgrid .lcard').length > 0, null, { timeout: 8000 }).catch(() => {});
  const t2 = await p.evaluate(() => ({ n: LIB ? LIB.list.length : 0, cards: document.querySelectorAll('#exgrid .lcard').length,
    first: (document.querySelector('#exgrid .lcard b') || {}).textContent, cnt: document.getElementById('exact').textContent }));
  chk(t2.n === 876 && t2.cards === 40 && t2.first === 'Жим лёжа' && /876/.test(t2.cnt), '2. 876 упражнений, первыми — упражнения программы', JSON.stringify(t2));

  // 3. поиск по-русски без «ё» и по-английски
  const t3 = await p.evaluate(() => {
    const q = v => { const i = document.getElementById('exs'); i.value = v; i.dispatchEvent(new Event('input')); return [...document.querySelectorAll('#exgrid .lcard b')].map(x => x.textContent); };
    const a = q('жим лежа'), z = q('зерхер'), en = q('zercher'); q(''); return { a: a.slice(0, 3), z, en };
  });
  chk(t3.a[0] === 'Жим лёжа' && t3.z.indexOf('Присед Зерхера') >= 0 && t3.en.indexOf('Присед Зерхера') >= 0, '3. поиск: «жим лежа» находит «Жим лёжа», зерхер/zercher', JSON.stringify(t3));

  // 4. лента мышц: «Грудь» — ровно те, у кого грудь основная, посчитано по самой базе
  const t4 = await p.evaluate(() => {
    document.querySelector('[data-lmu="ch"]').click();
    const want = window.EXLIB.filter(r => r[7].split(' ').indexOf('ch') >= 0).length;
    const got = parseInt(document.getElementById('exact').textContent, 10);
    const on = document.querySelector('[data-lmu="ch"]').getAttribute('aria-pressed');
    document.querySelector('[data-lmu="ch"]').click();
    return { want, got, on, off: document.querySelector('[data-lmu="ch"]').getAttribute('aria-pressed') };
  });
  chk(t4.want > 0 && t4.got === t4.want && t4.on === 'true' && t4.off === 'false', '4. лента мышц фильтрует по основной мышце, повторное касание снимает', JSON.stringify(t4));

  // 5. фильтр книги: тип движения и «без вредных»
  const t5 = await p.evaluate(() => {
    LF.pl = 'hpull'; paintLib();
    const n1 = parseInt(document.getElementById('exact').textContent, 10);
    const want = window.EXLIB.filter(r => r[9] === 'hpull').length;
    LF.pl = ''; LF.safe = true; paintLib();
    const n2 = parseInt(document.getElementById('exact').textContent, 10);
    const safe = window.EXLIB.filter(r => !r[11]).length;
    const pill = !!document.querySelector('[data-lclr="safe"]');
    document.querySelector('[data-lclr="safe"]').click();
    return { n1, want, n2, safe, pill, after: LF.safe };
  });
  chk(t5.n1 === t5.want && t5.n2 === t5.safe && t5.pill && t5.after === false, '5. фильтры по книге: тип движения, «без вредных», снимаются крестиком', JSON.stringify(t5));

  // 6. страница упражнения: мышцы основные/вспомогательные, лесенка книги
  const t6 = await p.evaluate(async () => {
    openLib('Barbell_Bench_Press_-_Medium_Grip'); await new Promise(r => setTimeout(r, 300));
    const sh = document.getElementById('shB');
    const cls = m => [...new Set([...sh.querySelectorAll('.lmap [data-mus="' + m + '"]')].map(x => x.getAttribute('class')))];
    return { t: document.getElementById('shT').textContent, name: (sh.querySelector('.lname') || {}).textContent,
      chest: cls('Грудь'), tri: cls('Трицепс'), legs: cls('Квадрицепс'),
      plane: (sh.querySelector('.lbook b') || {}).textContent,
      steps: [...sh.querySelectorAll('.lstep button')].map(x => x.textContent.trim()),
      on: (sh.querySelector('.lstep button.on') || {}).textContent };
  });
  chk(t6.t === 'УПРАЖНЕНИЕ' && t6.name === 'Жим лёжа' && t6.chest[0] === 'mm3' && t6.tri[0] === 'mm1' && t6.legs[0] === 'mm0',
    '6. страница: грудь — основная, трицепс — вспомогательная, ноги не горят', JSON.stringify({ c: t6.chest, t: t6.tri, l: t6.legs }));
  chk(t6.plane === 'Горизонтальный жим' && t6.steps.length === 6 && /^5/.test(t6.on || ''), '7. тип движения и лесенка книги: жим лёжа — 5-я ступень из 6', JSON.stringify({ p: t6.plane, on: t6.on }));

  // 8. вредное по книге — предупреждение с заменой
  const t8 = await p.evaluate(async () => {
    openLib('Upright_Barbell_Row'); await new Promise(r => setTimeout(r, 300));
    return (document.querySelector('#shB .lharm') || {}).textContent || '';
  });
  chk(/подъём на грудь/.test(t8), '8. тяга к подбородку — «книга против» и замена', t8.replace(/\s+/g, ' ').slice(0, 80));

  // 9. избранное: переключается, живёт в журнале и переживает перезагрузку
  const t9 = await p.evaluate(async () => {
    sheetClose(); document.querySelector('#exgrid .lcard [data-lfav]').click();
    const id = document.querySelector('#exgrid .lcard').dataset.lib;
    document.querySelector('[data-lmu="fav"]').click();
    const cards = [...document.querySelectorAll('#exgrid .lcard')].map(x => x.dataset.lib);
    flush(); return { id, fav: S.fav.slice(), cards };
  });
  await p.reload(); await p.waitForTimeout(1300);
  const t9b = await p.evaluate(() => S.fav);
  chk(t9.fav.length === 1 && t9.cards.length === 1 && t9.cards[0] === t9.id && JSON.stringify(t9b) === JSON.stringify(t9.fav),
    '9. избранное: касание, своя лента, переживает перезагрузку', JSON.stringify({ t9, t9b }));

  // 10. выбор из «Зала»: упражнение базы встаёт в день и живёт как своё
  const t10 = await p.evaluate(async () => {
    sel = today(); tab = 'wo'; render(); openExPicker();
    document.querySelector('#shB [data-libpick]').click();
    await new Promise(r => setTimeout(r, 400));
    const pick = !document.getElementById('lpick').hidden && tab === 'ex';
    const i = document.getElementById('exs'); i.value = 'зерхер'; i.dispatchEvent(new Event('input'));
    const add = document.querySelector('#exgrid .lcard [data-libadd]');
    const h = add ? Math.round(add.getBoundingClientRect().height) : 0;
    add.click();
    const d = dayOf(today()), last = d.ex[d.ex.length - 1];
    return { pick, h, tab, last: last.n, g: last.g, lib: S.libEx[last.n], my: S.myEx[last.n], m: muscleOf(last.n, last.g),
      img: exPic(last.n, 1) };
  });
  chk(t10.pick && t10.tab === 'wo' && t10.last === 'Присед Зерхера' && t10.g === 'Ноги' && t10.lib[0] === 'Zercher_Squats' &&
    t10.m === 'Квадрицепс' && /Zercher_Squats\/1\.jpg$/.test(t10.img) && t10.h >= 44,
    '10. «Вся база» из «+ Упражнение»: Зерхер в дне, мышца — квадрицепс, фото из базы', JSON.stringify(t10));

  // 11. журнал считает его как любое другое: баланс мышц и «в прошлый раз»
  const t11 = await p.evaluate(async () => {
    const d = dayOf(today()), j = d.ex.length - 1;
    exOpen = j; render(); const c = document.querySelector('.ex[data-j="' + j + '"]');
    c.querySelector('[data-f="w"]').value = '40'; [...c.querySelectorAll('[data-rs]')].forEach(x => { x.value = '8'; });
    toggleSet(j); flush();
    const q = vol7m()['Квадрицепс'];
    openHow('Присед Зерхера'); await new Promise(r => setTimeout(r, 300));
    return { q, t: document.getElementById('shT').textContent, last: (document.querySelector('#shB .llast') || {}).textContent || '' };
  });
  chk(t11.q === 3 && t11.t === 'УПРАЖНЕНИЕ' && /8\/8\/8|3×8/.test(t11.last), '11. подходы идут в баланс мышц, «Техника» ведёт на страницу с прошлым разом', JSON.stringify(t11));

  // 12. битая копия чинится: избранное и связки
  const t12 = await p.evaluate(() => {
    S.fav = 'мусор'; S.libEx = { 'Присед Зерхера': ['Zercher_Squats', 'Квадрицепс'], 'Битое': ['x', 'Космос'], 'Пустое': 5 };
    scrubKeys(); return { fav: S.fav, lib: Object.keys(S.libEx) };
  });
  chk(Array.isArray(t12.fav) && t12.fav.length === 0 && JSON.stringify(t12.lib) === '["Присед Зерхера"]', '12. битая копия: избранное и связки чинятся', JSON.stringify(t12));

  // 13. всё влезает в 320, кнопки не меньше 44
  const t13 = await p.evaluate(async () => {
    sheetClose(); tab = 'ex'; render(); await new Promise(r => setTimeout(r, 200));
    const sz = sel => [...document.querySelectorAll(sel)].filter(x => x.offsetParent).map(x => Math.round(Math.min(x.getBoundingClientRect().width, x.getBoundingClientRect().height)));
    const mins = { fav: Math.min(...sz('#exgrid .lfav')), mu: Math.min(...sz('.lmu')), f: Math.min(...sz('#exf')) };
    openLib('Barbell_Bench_Press_-_Medium_Grip'); await new Promise(r => setTimeout(r, 300));
    mins.step = Math.min(...sz('#shB .lstep button')); mins.go = Math.min(...sz('#shB .lgo'));
    return { w: document.documentElement.scrollWidth, sh: document.getElementById('shB').scrollWidth <= document.getElementById('shB').clientWidth + 1, mins };
  });
  chk(t13.w <= 320 && t13.sh && Object.values(t13.mins).every(v => v >= 44), '13. влезает в 320, кнопки не меньше 44 px', JSON.stringify(t13));

  chk(errs.length === 0, '14. без ошибок страницы', errs.join(' | ') || 'чисто');
  await b.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
