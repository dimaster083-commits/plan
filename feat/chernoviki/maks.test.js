/* МАКСИМУМ И РЕКОРДЫ. Фишка меряет силу: расчётный 1ПМ по Эпли, рекорды
   по повторам и проценты от максимума.

   Что здесь сторожится:
   · формула считает то, что должна, а один повтор не «дорастает» до 103 %;
   · максимум берётся из ФАКТИЧЕСКИХ повторов (rs), а не из плана — это
     ровно то место, где фишка легче всего начинает врать в плюс;
   · рекорд на N повторов — это «не меньше N», а не «ровно N» и не «любой
     подход вообще»;
   · пустой журнал молчит, а не показывает 0 кг;
   · выше 12 повторов — честная оговорка, а не выдуманная точность;
   · проценты строго убывают и лежат на сетке приложения;
   · всё влезает в 320 px в обеих темах, и в стилях нет своих цветов. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);

/* Сеет журнал: кладёт подходы в первое упражнение ближайшего дня с
   программой и открывает его карточку. sets — [{назад, вес, план, rs}]. */
const SEED = `(function(seed){
  S.setup = 1; document.getElementById('setup').classList.remove('on');
  S.rec = {}; S.pr = {};
  // ближайший назад день, в котором вообще есть программа
  let ds = null;
  for (let k = 0; k < 21 && !ds; k++) {
    const t = new Date(); t.setDate(t.getDate() - k);
    const d = dayOf(iso(t));
    if (d && (d.ex || []).length) ds = iso(t);
  }
  if (!ds) return { err: 'нет дня с программой' };
  const name = dayOf(ds).ex[0].n;
  // недели назад от него: тот же день недели — та же программа
  seed.forEach(s => {
    const t = new Date(ds + 'T12:00:00'); t.setDate(t.getDate() - s.back * 7);
    const day = dayOf(iso(t));
    if (!day || !(day.ex || []).length) return;
    const r = recRW(iso(t)); r.wo = 1;
    r.log[0] = { done: 1, n: name, g: day.ex[0].g, w: String(s.w),
                 s: String(s.s), r: String(s.r), rs: s.rs ? s.rs.map(String) : undefined };
  });
  entCache = null; save(); recomputeStats(1);
  // прошедший день иначе рисуется журналом без карточек
  tab = 'wo'; sel = ds; editPast = true; exOpen = 0; render();
  return { name: name, ds: ds };
})`;

(async () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'feat', 'maks.css'), 'utf8');
  const b = await chromium.launch(LAUNCH);

  for (const skin of ['sl', 'ber']) {
    console.log('\n===== ' + skin + ' =====');
    const p = await (await b.newContext({ viewport: { width: 320, height: 720 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1400);
    await p.evaluate(s => { applyTheme(s); S.sound = 0; }, skin);

    /* --- 1. формула на известных числах --- */
    const f = await p.evaluate(() => ({
      есть: typeof MAKS === 'object',
      a: MAKS.pm(100, 1), b: MAKS.pm(100, 5), c: MAKS.pm(80, 10),
      ноль: MAKS.pm(0, 5), безПовторов: MAKS.pm(100, 0)
    }));
    chk(f.есть, '1. фишка встала на место');
    chk(f.a === 100, '2. 100 кг × 1 → 100 кг: один повтор это и есть максимум', f.a + '');
    chk(f.b === 117, '3. 100 кг × 5 → 117 кг по Эпли', f.b + '');
    chk(f.c === 107, '4. 80 кг × 10 → 107 кг по Эпли', f.c + '');
    chk(f.ноль === 0 && f.безПовторов === 0, '5. без веса и без повторов максимума нет',
        f.ноль + ' / ' + f.безПовторов);

    /* --- 6. пустой журнал: фишка молчит --- */
    const пусто = await p.evaluate(s => {
      const r = eval(s)([]);
      if (r.err) return r;
      const txt = document.getElementById('exl').innerText;
      return { есть: !!document.querySelector('[data-mk]'), нули: /(^|[^\d,])0\s*кг/.test(txt),
               строк: MAKS.sets(r.name).length };
    }, SEED);
    if (пусто.err) bad('6. пустой журнал', пусто.err);
    else {
      chk(!пусто.есть, '6. на пустом журнале строки максимума нет');
      chk(!пусто.нули, '7. и нигде не написано «0 кг»');
      chk(пусто.строк === 0, '8. подходов в разборе тоже нет');
    }

    /* --- 9. ФАКТИЧЕСКИЕ повторы, а не план ---
       Подход 100 кг, в плане 8 повторов, а сделано 5/5/4. Максимум обязан
       считаться от 5 (117 кг), а не от 8 (127 кг). Разница в 10 кг — ровно
       то враньё, ради которого этот сторож и написан. */
    const факт = await p.evaluate(s => {
      const r = eval(s)([{ back: 0, w: 100, s: 3, r: 8, rs: [5, 5, 4] }]);
      const el = document.querySelector('[data-mk]');
      const best = MAKS.best(MAKS.sets(r.name));
      return { имя: r.name, pm: best.pm, r: best.r, w: best.w,
               строка: el ? el.innerText.replace(/\s+/g, ' ') : '',
               поПлану: MAKS.pm(100, 8) };
    }, SEED);
    chk(факт.r === 5, '9. максимум выведен из сделанных 5 повторов, а не из плановых 8',
        'повторов: ' + факт.r);
    chk(факт.pm === 117, '10. и равен 117 кг', факт.pm + '');
    chk(факт.поПлану === 127 && !/127/.test(факт.строка),
        '11. плановая цифра 127 кг в строке не появляется', факт.строка);
    chk(/100/.test(факт.строка) && /117/.test(факт.строка) && /× ?5/.test(факт.строка),
        '12. строка показывает, из какого подхода выведен максимум', факт.строка);

    /* --- 13. один-единственный подход тоже даёт максимум --- */
    const один = await p.evaluate(s => {
      const r = eval(s)([{ back: 0, w: 100, s: 1, r: 5, rs: [5] }]);
      const best = MAKS.best(MAKS.sets(r.name));
      return { есть: !!document.querySelector('[data-mk]'), pm: best ? best.pm : 0,
               подходов: MAKS.sets(r.name).length };
    }, SEED);
    chk(один.есть && один.pm === 117, '13. один подход — уже максимум',
        один.pm + ' кг, подходов ' + один.подходов);

    /* --- 14. рекорды по повторам: «не меньше N» --- */
    const рек = await p.evaluate(s => {
      const r = eval(s)([
        { back: 3, w: 80, s: 3, r: 10, rs: [10, 10, 8] },
        { back: 2, w: 90, s: 3, r: 8, rs: [8, 8, 8] },
        { back: 1, w: 100, s: 3, r: 8, rs: [5, 5, 4] },
        { back: 0, w: 120, s: 1, r: 1, rs: [1] }
      ]);
      const t = {}; MAKS.records(MAKS.sets(r.name)).forEach(x => t[x.n] = x.w);
      return { t: t, имя: r.name };
    }, SEED);
    const t = рек.t;
    chk(t[1] === 120, '14. рекорд на 1 повтор — разовые 120 кг', t[1] + '');
    chk(t[3] === 100, '15. на 3 повтора — 100 кг: подход на 5 засчитан, разовый нет', t[3] + '');
    chk(t[5] === 100, '16. на 5 повторов — 100 кг', t[5] + '');
    chk(t[8] === 90, '17. на 8 повторов — 90 кг, а не 100', t[8] + '');
    chk(t[10] === 80, '18. на 10 повторов — 80 кг', t[10] + '');
    chk(t[12] === 0, '19. на 12 повторов рекорда нет: столько ни разу не сделано', t[12] + '');

    /* --- 20. таблица рекордов на экране совпадает с разбором --- */
    const шт = await p.evaluate(() => {
      document.querySelector('[data-mk]').click();
      const sh = document.getElementById('sh');
      return { открыта: sh.classList.contains('on'),
               текст: sh.innerText.replace(/\s+/g, ' '),
               строк: sh.querySelectorAll('.mkt tr').length };
    });
    chk(шт.открыта, '20. строка открывает шторку');
    chk(/120/.test(шт.текст) && /90/.test(шт.текст) && /—/.test(шт.текст),
        '21. в шторке стоят те же рекорды и прочерк на пустой ступени');
    chk(!/NaN|undefined|Infinity/.test(шт.текст), '22. в шторке нет мусора');

    /* --- 23. проценты: строго вниз и по сетке --- */
    const пр = await p.evaluate(() => {
      const ряды = MAKS.percents(117);
      return {
        веса: ряды.map(x => x.w),
        сетка: ряды.every(x => x.w === roundW(x.w)),
        вниз: ряды.every((x, i) => i === 0 || x.w < ряды[i - 1].w),
        доли: ряды.map(x => x.from),
        мелкий: MAKS.percents(40).map(x => x.w),
        мелкийВниз: MAKS.percents(40).every((x, i, a) => i === 0 || x.w < a[i - 1].w),
        мелкийСетка: MAKS.percents(40).every(x => x.w === roundW(x.w)),
        сверху: ряды[0].from === 95, снизу: ряды[ряды.length - 1].to === 60
      };
    });
    chk(пр.сетка, '23. проценты лежат на сетке приложения', пр.веса.join(' / '));
    chk(пр.вниз, '24. и идут строго по убыванию', пр.веса.join(' / '));
    chk(пр.сверху && пр.снизу, '25. от 95 % до 60 %', пр.доли.join('/'));
    chk(пр.мелкийСетка && пр.мелкийВниз,
        '26. на лёгком максимуме тоже строго вниз и по сетке', пр.мелкий.join(' / '));

    /* --- 27. выше 12 повторов — честная оговорка --- */
    const врёт = await p.evaluate(s => {
      const r = eval(s)([{ back: 0, w: 60, s: 3, r: 15, rs: [15, 15, 15] }]);
      document.querySelector('[data-mk]').click();
      const sh = document.getElementById('sh').innerText;
      return { текст: sh, оговорка: !!document.querySelector('.mkx-warn'),
               знак: /≈/.test(document.getElementById('exl').innerText),
               честно: /завышает|прикидк/i.test(sh) };
    }, SEED);
    chk(врёт.оговорка && врёт.честно,
        '27. на 15 повторах приложение честно говорит, что формула завышает');
    chk(врёт.знак, '28. и ставит «≈» рядом с числом в карточке');

    const неврёт = await p.evaluate(s => {
      const r = eval(s)([{ back: 0, w: 100, s: 3, r: 5, rs: [5, 5, 5] }]);
      document.querySelector('[data-mk]').click();
      return { оговорка: !!document.querySelector('.mkx-warn'),
               знак: /≈/.test(document.getElementById('exl').innerText) };
    }, SEED);
    chk(!неврёт.оговорка && !неврёт.знак,
        '29. на 5 повторах оговорки нет — значит проверка 27 что-то меряет');

    /* --- 30. 320 px: ничего не вылезает --- */
    const края = await p.evaluate(() => {
      const out = [];
      const тест = el => {
        const r = el.getBoundingClientRect();
        if (r.width > 0 && (r.left < -0.5 || r.right > 320.5)) out.push(el.className + ' ' + Math.round(r.right));
        if (el.scrollWidth > el.clientWidth + 1) out.push(el.className + ' скролл');
      };
      document.querySelectorAll('.mkx, .mkx-top, .mkt, .mkx-warn, .mkx-note').forEach(тест);
      const телоШ = document.documentElement.scrollWidth;
      document.getElementById('shX').click();
      document.querySelectorAll('.mk, .mk-b, .mk-t').forEach(тест);
      const кнопка = document.querySelector('.mk-b').getBoundingClientRect();
      return { out: out, ширина: телоШ, док: document.documentElement.scrollWidth,
               высота: Math.round(кнопка.height) };
    });
    chk(края.out.length === 0, '30. таблицы и строка не вылезают за 320 px', края.out.join(' | ') || 'чисто');
    chk(края.ширина <= 320 && края.док <= 320, '31. страница не едет вбок',
        края.ширина + ' / ' + края.док);
    chk(края.высота >= 44, '32. строка максимума не меньше 44 px под палец', края.высота + ' px');

    /* --- 33. смена темы не сбивает разметку фишки --- */
    const тема = await p.evaluate(s => {
      const до = document.querySelector('[data-mk]').innerText;
      applyTheme(s === 'sl' ? 'ber' : 'sl');
      const после = document.querySelector('[data-mk]') ? document.querySelector('[data-mk]').innerText : null;
      applyTheme(s);
      return { до: до, после: после };
    }, skin);
    chk(тема.после === тема.до, '33. переключение темы не перерисовывает и не теряет строку');

    chk(errs.length === 0, '34. без ошибок в консоли', errs.join(' | ') || 'чисто');
    await p.context().close();
  }

  /* --- стили: ни одного своего цвета --- */
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  const rgb = css.match(/\brgba?\(\s*\d/g) || [];
  chk(hex.length === 0 && rgb.length === 0,
      '35. в стилях фишки нет своих цветов — только токены темы',
      hex.concat(rgb).join(' ') || 'чисто');
  const токены = (css.match(/var\(--[a-z0-9-]+/g) || []).map(s => s.slice(6));
  const чужие = токены.filter(t => !['ink', 'ink2', 'ink3', 'ln', 's2', 'acc',
    'r-m', 'r-s'].includes(t));
  chk(чужие.length === 0, '36. и берутся только разрешённые токены',
      [...new Set(чужие)].join(' ') || 'чисто');

  await b.close();
  console.log('\nпроблем: ' + fails);
  process.exit(fails ? 1 : 0);
})();
