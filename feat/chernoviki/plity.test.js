/* РАЗМИНКА И БЛИНЫ.

   Три вещи, на которых такая фишка врёт чаще всего:

   1. Считает лесенку от рабочего веса из программы, а в карточке при этом
      написан другой вес — тот, что предложен на эту неделю. Человек греется
      к цифре, до которой сегодня не дойдёт.
   2. Округляет раскладку молча. Блин 1,25 кг, показанный общим kg() как
      «1,3», в сумму не сходится: на штанге лежит одно, на экране другое.
   3. Показывает раскладку блинов там, где блинов нет — у гантелей и блоков.

   Поэтому тут ничего не спрашивается у приложения: и сетка весов, и сумма
   блинов пересчитываются заново, своими формулами, из того самого текста,
   который человек видит на экране. Экран — 320 px, обе темы. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs = require('fs');
const path = require('path');

let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);

/* ---------- свой счёт ---------- */
// сетка весов приложения: до 20 кг килограмм, выше 2,5 кг
const наСетке = w => {
  if (!isFinite(w) || w <= 0) return false;
  const g = w >= 20 ? 2.5 : 1;
  return Math.abs(w / g - Math.round(w / g)) < 1e-9;
};
// «5 + 2,5 + 1,25 на сторону» → 8.75; не раскладка (честный отказ) → null
const блины = t => {
  if (!/на сторону\s*$/.test(String(t || ''))) return null;
  const ч = String(t).replace(/\s*на сторону\s*$/, '').split('+')
    .map(x => parseFloat(x.trim().replace(',', '.')));
  return ч.some(x => !isFinite(x)) ? null : ч.reduce((a, b) => a + b, 0);
};

/* ---------- чтение экрана (уезжает в страницу как текст) ---------- */
const ЧИТАТЬ = `[...document.querySelectorAll('#exl .plt .pltr')].map(r => ({
  w: parseFloat((r.querySelector('.pltkg').textContent||'').replace('кг','').replace(',','.')),
  x: ((r.querySelector('.pltx')||{}).textContent||'').trim(),
  n: ((r.querySelector('.pltn')||{}).textContent||'').trim(),
  p: ((r.querySelector('.pltp')||{}).textContent||'').trim(),
  раб: r.classList.contains('pltw')
}))`;
const СТРОКИ = p => p.evaluate('(' + ЧИТАТЬ + ')');
const ОТКРЫТЬ = (p, j) => p.evaluate(jj => { exOpen = jj; render(); }, j);

// день с пятью упражнениями разной природы: штанга, гантели, блок, изоляция, свой вес
const SEED = () => {
  S.setup = 1; document.getElementById('setup').classList.remove('on'); S.sound = 0;
  S.anchors = { b: 70, s: 50, d: 60 }; S.start = today(); S.rec = {};
  const d = dayOf(today());
  d.t = 'up1'; d.s = 'Верх тела · силовой';
  d.ex = [
    { n: 'Жим лёжа', s: 4, r: '4-6', w: 80, g: 'Грудь' },
    { n: 'Жим гантелей сидя', s: 3, r: '6-8', w: 30, g: 'Плечи' },
    { n: 'Тяга верхнего блока', s: 3, r: '6-8', w: 45, g: 'Спина' },
    { n: 'Махи в стороны', s: 3, r: '12-15', w: 8, g: 'Плечи' },
    { n: 'Подтягивания', s: 3, r: '6-8', w: 0, g: 'Спина' }
  ];
  save(); recomputeStats(1); tab = 'wo'; sel = today(); exOpen = 0; render();
};
// вписать вес руками, как это делает человек в зале
const ВПИСАТЬ = v => {
  const f = document.querySelector('#exl .exfkg');
  f.value = String(v);
  f.dispatchEvent(new Event('input', { bubbles: true }));
};
const СБРОС = () => { const r = S.rec[today()]; if (r && r.log[0]) delete r.log[0].w; render(); };

const СНИМКИ = {}, ЦВЕТА = {};

(async () => {
  const b = await chromium.launch(LAUNCH);

  for (const skin of ['sl', 'ber']) {
    console.log('\n===== ' + skin + ' =====');
    const p = await (await b.newContext({ viewport: { width: 320, height: 800 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1400);
    await p.evaluate(s => applyTheme(s), skin);
    await p.evaluate(SEED); await p.waitForTimeout(350);

    /* 1. лесенка идёт к весу из карточки, а не к рабочему -------------------- */
    const к = await p.evaluate(() => ({
      поле: parseFloat(document.querySelector('#exl .exfkg').value.replace(',', '.')),
      рабочий: num(dayOf(sel).ex[0].w),
      предложен: weightFor(dayOf(sel).ex[0], intOf(sel, dayOf(sel).t), sel)
    }));
    const стр = await СТРОКИ(p);
    chk(к.поле !== к.рабочий && к.поле === к.предложен,
      '1. неделя не тяжёлая: в карточке стоит не рабочий вес',
      'рабочий ' + к.рабочий + ', в карточке ' + к.поле);
    const посл = стр[стр.length - 1] || {};
    chk(стр.length >= 3 && посл.w === к.поле,
      '2. последняя ступень — ровно вес из карточки', стр.map(x => x.w).join(' → '));
    chk(посл.раб && /рабоч/i.test(посл.n), '3. и она названа рабочей', посл.n || '—');
    // половина от 72,5 по сетке — 37,5; от рабочих 80 вышло бы 40
    chk(стр.some(x => x.w === 37.5) && !стр.some(x => x.w === 40),
      '4. середина лесенки посчитана от 72,5, а не от 80',
      стр.map(x => x.w).join(', '));

    /* 2. сетка, порядок, повторы -------------------------------------------- */
    chk(стр.every(x => наСетке(x.w)), '5. все веса лесенки лежат на сетке приложения',
      стр.map(x => x.w).join(', '));
    chk(стр.every((x, i) => i === 0 || x.w > стр[i - 1].w),
      '6. лесенка идёт строго вверх, без повторов', стр.map(x => x.w).join(' < '));
    chk(стр[0].w === 20 && /гриф/i.test(стр[0].n),
      '7. начинается с пустого грифа', стр[0].w + ' · ' + стр[0].n);
    chk(стр.slice(0, -1).every(x => /^×\s*\d+$/.test(x.x)),
      '8. у каждой разминочной ступени написаны повторы', стр.map(x => x.x).join(' | '));
    chk(/^4\s*×\s*4-6$/.test(посл.x),
      '9. у рабочей — подходы и повторы из карточки', посл.x || '—');

    /* 3. раскладка блинов сходится в вес ------------------------------------ */
    const раскл = стр.filter(x => блины(x.p) !== null);
    chk(раскл.length >= 3, '10. раскладка блинов показана у штангового движения',
      раскл.length + ' строк из ' + стр.length);
    const кривые = раскл.filter(x => Math.abs(20 + 2 * блины(x.p) - x.w) > 1e-9);
    chk(кривые.length === 0, '11. гриф 20 + два раза блины на сторону = ровно этот вес',
      раскл.map(x => x.w + '=20+2×' + блины(x.p)).join(' · '));
    chk(раскл.every(x => x.p.split('+').every(z =>
        [25, 20, 15, 10, 5, 2.5, 1.25].indexOf(parseFloat(z.replace(/[^\d,.]/g, '').replace(',', '.'))) >= 0)),
      '12. в раскладке только настоящие блины', раскл.map(x => x.p).join(' | '));
    chk(раскл.some(x => /(^|\s)1,25(\s|$)/.test(x.p)),
      '13. блин 1,25 назван как есть, а не округлён до «1,3»',
      (раскл.find(x => /1,2|1,3/.test(x.p)) || {}).p || 'такого блина не нашлось');

    /* 4. нераскладываемый вес назван честно ---------------------------------- */
    await p.evaluate(ВПИСАТЬ, 33); await p.waitForTimeout(200);
    const с33 = await СТРОКИ(p);
    const р33 = с33[с33.length - 1] || {};
    chk(р33.w === 33, '14. вписанный руками вес подхватился лесенкой',
      с33.map(x => x.w).join(' → '));
    chk(блины(р33.p) === null && /не набрать/i.test(р33.p),
      '15. 33 кг блинами не набрать — так и написано', р33.p || '—');
    chk(/32,5/.test(р33.p) && /35/.test(р33.p),
      '16. названы оба соседних веса, а не подставлен молча один', р33.p || '—');
    const прочие = с33.slice(0, -1).filter(x => блины(x.p) !== null);
    chk(прочие.length >= 1 && прочие.every(x => Math.abs(20 + 2 * блины(x.p) - x.w) < 1e-9),
      '17. остальные ступени при этом разложены как обычно',
      прочие.map(x => x.w + ':' + x.p).join(' · '));

    /* 5. ровно гриф ---------------------------------------------------------- */
    await p.evaluate(ВПИСАТЬ, 20); await p.waitForTimeout(200);
    const с20 = await СТРОКИ(p);
    chk(с20.length === 1 && с20[0].w === 20,
      '18. вес ровно в гриф: одна строка, без пустого грифа сверху',
      с20.map(x => x.w).join(','));
    chk(с20.length === 1 && /ровно гриф/i.test(с20[0].p),
      '19. и сказано, что это ровно гриф', (с20[0] || {}).p || '—');

    /* 6. меньше грифа и без веса — фишка молчит ------------------------------ */
    await p.evaluate(ВПИСАТЬ, 15); await p.waitForTimeout(200);
    const мало = await p.evaluate(() => {
      const el = document.querySelector('#exl .plt');
      return { текст: (el.innerText || '').trim(), выс: Math.round(el.getBoundingClientRect().height) };
    });
    chk(мало.текст === '' && мало.выс === 0,
      '20. вес меньше грифа — ни строчки и ни пикселя', JSON.stringify(мало));
    await p.evaluate(СБРОС); await p.waitForTimeout(200);

    const молча = await p.evaluate(() => {
      const из = {};
      [3, 4].forEach(j => {
        exOpen = j; render();
        const el = document.querySelector('#exl .plt');
        из[dayOf(sel).ex[j].n] = {
          текст: (el.innerText || '').trim(),
          выс: Math.round(el.getBoundingClientRect().height)
        };
      });
      return из;
    });
    chk(Object.values(молча).every(x => x.текст === '' && x.выс === 0),
      '21. лёгкая изоляция и свой вес — фишка молчит, а не показывает мусор',
      JSON.stringify(молча));

    /* 7. гантели и блок: лесенка есть, раскладки нет ------------------------- */
    for (const [j, имя, бк] of [[1, 'гантели', 'а'], [2, 'блок', 'б']]) {
      await ОТКРЫТЬ(p, j);
      const ст = await СТРОКИ(p);
      chk(ст.length >= 2, '22' + бк + '. ' + имя + ': лесенка показана',
        ст.map(x => x.w).join(' → '));
      chk(ст.every(x => !x.p), '23' + бк + '. ' + имя + ': раскладки блинов нет',
        ст.map(x => x.p).filter(Boolean).join(' | ') || 'ни одной');
      chk(ст.every(x => наСетке(x.w)) && ст.every((x, i) => i === 0 || x.w > ст[i - 1].w),
        '24' + бк + '. ' + имя + ': веса на сетке и по возрастанию', ст.map(x => x.w).join(', '));
    }

    /* 8. живой пересчёт и сворачивание --------------------------------------- */
    await ОТКРЫТЬ(p, 0);
    await p.evaluate(ВПИСАТЬ, 100); await p.waitForTimeout(200);
    const сто = await СТРОКИ(p);
    chk(сто.length && сто[сто.length - 1].w === 100 && сто.some(x => x.w === 50),
      '25. вес поменяли в поле — лесенка пересчиталась сразу',
      сто.map(x => x.w).join(' → '));
    const сверн = await p.evaluate(() => {
      const вид = () => [...document.querySelectorAll('#exl .pltr')]
        .filter(r => r.getBoundingClientRect().height > 0).length;
      const было = вид();
      document.querySelector('#exl .plth').click(); const свёрнуто = вид();
      document.querySelector('#exl .plth').click(); const назад = вид();
      return { было: было, свёрнуто: свёрнуто, назад: назад };
    });
    chk(сверн.было > 0 && сверн.свёрнуто === 0 && сверн.назад === сверн.было,
      '26. шапка сворачивает лесенку и возвращает её обратно', JSON.stringify(сверн));
    const отм = await p.evaluate(() => {
      const r = document.querySelector('#exl .pltr');
      r.click();
      const п = r.classList.contains('pltdn');
      r.click();
      return { после: п, снято: !r.classList.contains('pltdn'), журнал: Object.keys(S.rec[today()].log).length };
    });
    chk(отм.после && отм.снято, '27. ступень отмечается и снимается нажатием',
      JSON.stringify(отм));
    await p.evaluate(СБРОС); await p.waitForTimeout(200);

    /* 9. телефон 320 px ------------------------------------------------------ */
    await ОТКРЫТЬ(p, 0);
    const узко = await p.evaluate(() => {
      const вылез = [...document.querySelectorAll('#exl .plt, #exl .plt *')]
        .filter(el => { const r = el.getBoundingClientRect();
          return r.width > 0 && (r.right > 320.5 || r.left < -0.5); })
        .map(el => el.className + ':' + Math.round(el.getBoundingClientRect().right));
      const мелкие = [...document.querySelectorAll('#exl .plth, #exl .pltr')]
        .filter(el => el.getBoundingClientRect().height < 44)
        .map(el => el.className + ':' + Math.round(el.getBoundingClientRect().height));
      return { вылез: вылез, мелкие: мелкие, шир: document.documentElement.scrollWidth };
    });
    chk(узко.вылез.length === 0, '28. ничего не вылезает за 320 px',
      узко.вылез.join(', ') || 'чисто');
    chk(узко.шир <= 320, '29. страница не поехала вбок', узко.шир + ' px');
    chk(узко.мелкие.length === 0, '30. нажимать есть куда: не меньше 44 px',
      узко.мелкие.join(', ') || 'все ≥ 44');

    chk(errs.length === 0, '31. без ошибок на странице', errs.join(' | ') || 'чисто');

    СНИМКИ[skin] = await p.evaluate(() =>
      [...document.querySelectorAll('#exl .plt .pltr')].map(r => r.innerText.replace(/\s+/g, ' ').trim()));
    ЦВЕТА[skin] = await p.evaluate(() =>
      getComputedStyle(document.querySelector('#exl .pltkg')).color);

    await p.context().close();
  }

  /* ---------- темы равны ---------- */
  console.log('\n===== темы =====');
  chk(СНИМКИ.sl && СНИМКИ.sl.length > 0 &&
      JSON.stringify(СНИМКИ.sl) === JSON.stringify(СНИМКИ.ber),
    '32. обе темы показывают одну и ту же лесенку слово в слово',
    (СНИМКИ.sl || [])[0] || '—');
  chk(ЦВЕТА.sl && ЦВЕТА.ber && ЦВЕТА.sl !== ЦВЕТА.ber,
    '33. а цвет у них свой, из темы', ЦВЕТА.sl + ' / ' + ЦВЕТА.ber);

  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'feat', 'plity.css'), 'utf8');
  const хексы = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  chk(хексы.length === 0, '34. в стилях фишки нет ни одного своего цвета',
    хексы.join(', ') || 'ни одного');
  const чужие = [...new Set(css.match(/\.[a-zA-Z_-][\w-]*/g) || [])].filter(c => !/^\.plt/.test(c));
  chk(чужие.length === 0, '35. и ни одного чужого класса', чужие.join(', ') || 'только свои');

  /* ---------- сторож меряет ----------
     Проверка, зелёная на любых данных, ничего не стоит. Те же формулы,
     что и выше, скармливаются нарочно испорченным строкам: если они
     этого не ловят, то и на экране не поймают. */
  console.log('\n===== сторож =====');
  const л1 = Math.abs(20 + 2 * блины('25 + 1,3 на сторону') - 72.5) > 1e-9;   // старое округление
  const л2 = Math.abs(20 + 2 * блины('25 + 1,25 на сторону') - 72.5) > 1e-9;  // как надо
  chk(л1 && !л2, '36. блин, округлённый до 1,3, проверка ловит, а правильный пропускает',
    '1,3 → ' + (л1 ? 'красное' : 'зелёное') + ', 1,25 → ' + (л2 ? 'красное' : 'зелёное'));
  chk(!наСетке(13.7) && !наСетке(21) && !наСетке(0) && наСетке(22.5) && наСетке(13),
    '37. проверка сетки ловит вес мимо сетки',
    '13,7/21/0 мимо, 22,5/13 на сетке');
  chk(блины('блинами не набрать: 32,5 или 35') === null && блины('') === null,
    '38. честный отказ в сумму не подставляется', 'null');
  // лесенка от рабочего веса дала бы другие цифры — значит проверке 4 есть что ловить
  const отРабочего = [20, 40, 56, 68, 80], сЭкрана = (СНИМКИ.sl || []).length;
  chk(сЭкрана > 0 && отРабочего.indexOf(37.5) < 0,
    '39. лесенка от рабочих 80 кг не содержит 37,5 — проверка 4 различает',
    отРабочего.join(', '));

  await b.close();
  console.log('\nпроблем: ' + fails);
  process.exit(fails ? 1 : 0);
})();
