/* =========================================================================
   РАЗМИНКА И БЛИНЫ
   То, что человек считает в уме под штангой: с чего начать и что навесить.

   Лесенка разминки идёт к ТОМУ ЖЕ весу, который написан в карточке —
   к предложенному на эту неделю (weightFor) или к вписанному руками,
   а не к рабочему весу из программы. На лёгкой неделе они разные, и
   разминка к чужой цифре никому не нужна.

   Веса лесенки лежат на общей сетке приложения (granOf): до 20 кг —
   килограмм, выше — 2,5 кг. Своего округления до 2,5 тут нет.

   Раскладка честная: если вес не набирается блинами, так и написано.
   Молча округлить до соседнего — значит соврать про то, что лежит на
   штанге, а по этой цифре потом считается тоннаж.
   ========================================================================= */
(function () {
  const BAR = 20;                                   // олимпийский гриф
  const PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];    // что бывает в зале, на сторону

  /* Штанговые движения — по ключу фото из каталога EXDB. Раскладка блинов
     имеет смысл только там: у гантелей и блоков свой шаг, у тренажёров
     стопка плиток, и «20 + 15 на сторону» там просто враньё.
     Смит, гакк и Т-гриф тоже не в списке: у их грифов свой вес. */
  const BARB = {
    bench: 1, benchclose: 1, benchinc: 1, militarypress: 1, upright: 1, row: 1,
    shrug: 1, curl: 1, skull: 1, revcurl: 1, squat: 1, frontsquat: 1,
    dead: 1, rdl: 1, stiff: 1, goodmorning: 1, glute: 1
  };
  /* Упражнение, добавленное руками, в каталоге не лежит — тогда смотрим
     на название. Сначала отсекаем заведомо не-штанговое. */
  function isBar(name) {
    const r = (typeof EXDB === 'object' && EXDB) ? EXDB[name] : null;
    if (r) return !!BARB[r[0]];
    const s = String(name || '').toLowerCase();
    if (/гантел|блок|канат|тренаж|смит|гакк|т-гриф|брусь|турник|платформ/.test(s)) return false;
    return /штанг|гриф|присед|станов|жим лёжа|жим лежа/.test(s);
  }

  // одна сетка на всё: та же, что у прибавки, показа и стартового веса
  const grid = w => { const g = granOf(w); return Math.max(g, Math.round(num(w) / g) * g); };
  const round2 = w => Math.round(num(w) * 100) / 100;
  /* Блин пишется как он написан на блине. Общий kg() округляет до одного
     знака и превращает 1,25 в «1,3» — для веса на штанге это правильно,
     а для раскладки это враньё: суммы такой раскладки не существует. */
  const plw = v => String(Math.round(v * 100) / 100).replace('.', ',');

  /* Как набрать вес блинами. Возвращает либо список блинов на сторону,
     либо честное объяснение, почему списка нет. */
  function split(w) {
    w = round2(w);
    if (w < BAR) return { no: 'меньше грифа' };
    if (w === BAR) return { no: 'ровно гриф' };
    const cents = Math.round((w - BAR) / 2 * 100);   // на сторону, в копейках килограмма
    if (cents % 125 !== 0) {
      const lo = BAR + Math.floor((w - BAR) / 2.5) * 2.5;
      return { no: 'блинами не набрать: ' + plw(lo) + ' или ' + plw(lo + 2.5) };
    }
    let left = cents; const out = [];
    for (let i = 0; i < PLATES.length; i++) {
      const c = Math.round(PLATES[i] * 100);
      while (left >= c) { out.push(PLATES[i]); left -= c; }
    }
    if (left !== 0) return { no: 'блинами не набрать' };
    return { list: out };
  }

  /* Лесенка к весу W. Пустой гриф — только там, где гриф вообще есть.
     Ступени ниже грифа выбрасываются: на 20-килограммовом грифе
     тринадцати килограммов не бывает. Последней строкой всегда рабочая. */
  function ladder(W, bar) {
    const out = [];
    const push = (w, r, k) => {
      w = round2(w);
      if (!(w > 0)) return;
      if (out.length && w <= out[out.length - 1].w) return;  // строго вверх, без повторов
      out.push({ w: w, r: r, k: k });
    };
    if (bar && BAR < W) push(BAR, '5', 'bar');   // гриф ровно в рабочий вес — это уже работа
    [[0.5, '5'], [0.7, '3'], [0.85, '2']].forEach(s => {
      const w = grid(W * s[0]);
      if (bar && w <= BAR) return;
      if (w >= W) return;
      push(w, s[1], 'up');
    });
    return out;
  }

  /* Отмеченные строки. Живут в памяти вкладки и ключуются датой,
     номером упражнения и весом: в журнал разминка не пишется и на
     тоннаж не влияет — это счёт, а не работа. */
  const done = {};
  let open = true;   // свёрнуто или развёрнуто — на всю вкладку, как человек оставил
  const keyOf = (j, i, w) => sel + '|' + j + '|' + i + '|' + w;

  const plateLine = w => {
    const s = split(w);
    return s.list
      ? s.list.map(plw).join(' + ') + ' на сторону'
      : s.no;
  };

  /* Разметка одного упражнения. Пусто — значит фишке тут сказать нечего:
     свой вес, лёгкая изоляция или веса нет вовсе. */
  function build(e, g, j, d) {
    const IN = (typeof intOf === 'function') ? intOf(sel, d.t) : null;
    // ровно та цифра, которая стоит в поле веса карточки
    const W = num(pick(g.w, weightFor(e, IN, sel)));
    if (!(W >= BAR)) return '';

    const bar = isBar(e.n);
    const rows = ladder(W, bar);
    const sets = pick(g.s, (typeof setsOf === 'function') ? setsOf(sel, num(e.s), j) : num(e.s));
    const reps = pick(g.r, e.r);
    rows.push({ w: round2(W), r: String(reps), k: 'work', s: String(sets) });

    const warm = rows.length - 1;
    const sub = warm
      ? warm + ' ' + plural(warm, 'подход', 'подхода', 'подходов') + ' до ' + kg(W) + ' кг'
      : 'сразу рабочий вес';

    const body = rows.map((x, i) => {
      const on = done[keyOf(j, i, x.w)] ? ' pltdn' : '';
      const nm = x.k === 'work' ? 'рабочий' : (x.k === 'bar' ? 'пустой гриф' : 'разминка');
      const cnt = x.k === 'work' ? (x.s + ' × ' + x.r) : ('× ' + x.r);
      // у пустого грифа раскладка уже названа самой строкой
      const pl = (bar && x.k !== 'bar') ? plateLine(x.w) : '';
      return '<button type="button" class="pltr' + (x.k === 'work' ? ' pltw' : '') + on + '"' +
        ' data-pltr="' + esc(keyOf(j, i, x.w)) + '"' +
        ' aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span class="pltkg">' + esc(kg(x.w)) + '<i>кг</i></span>' +
        '<span class="pltx">' + esc(cnt) + '</span>' +
        '<span class="pltn">' + esc(nm) + '</span>' +
        (pl ? '<span class="pltp">' + esc(pl) + '</span>' : '') +
        '</button>';
    }).join('');

    return '<div class="pltbox' + (open ? '' : ' pltoff') + '">' +
      '<button type="button" class="plth" data-plttog="1" aria-expanded="' + (open ? 'true' : 'false') + '">' +
        '<span class="pltt">Разминка' + (bar ? ' и блины' : '') + '</span>' +
        '<span class="plts">' + esc(sub) + '</span>' +
        '<span class="pltar" aria-hidden="true"></span>' +
      '</button>' +
      '<div class="pltl">' + body + '</div>' +
    '</div>';
  }

  /* Разметка отдаётся через общий реестр: своего места в render() у фишки
     нет и быть не должно. Пустая обёртка остаётся всегда — по ней фишка
     находит себя, когда вес поменяли прямо в поле. */
  HOOK.card.push(function (e, g, j, d) {
    return '<div class="plt" data-plt="' + j + '">' + build(e, g, j, d) + '</div>';
  });

  // пересобрать себя, не трогая чужую разметку и ничего не перерисовывая
  function repaint() {
    document.querySelectorAll('#exl .plt').forEach(box => {
      const j = +box.dataset.plt;
      const day = dayOf(sel); if (!day) return;
      const ex = (day.ex || [])[j]; if (!ex) return;
      const rec = S.rec[sel] || { log: {} };
      try { box.innerHTML = build(ex, (rec.log || {})[j] || {}, j, day); } catch (err) { box.innerHTML = ''; }
    });
  }

  document.addEventListener('click', ev => {
    const t = ev.target.closest && ev.target.closest('[data-plttog],[data-pltr]');
    if (!t || !t.closest('.plt')) return;
    if (t.dataset.plttog) { open = !open; repaint(); return; }
    const k = t.dataset.pltr;
    if (done[k]) delete done[k]; else done[k] = 1;
    t.classList.toggle('pltdn', !!done[k]);
    t.setAttribute('aria-pressed', done[k] ? 'true' : 'false');
  });

  /* Вес поменяли прямо в карточке — лесенка обязана поехать за ним.
     Обработчик приложения на #exl срабатывает раньше и успевает
     записать новое значение в журнал, отсюда оно и читается. */
  document.addEventListener('input', ev => {
    const inp = ev.target.closest && ev.target.closest('#exl input[data-f="w"]');
    if (!inp) return;
    repaint();
  });
})();
