/* ФИШКА «КАК В ПРОШЛЫЙ РАЗ»
   ------------------------------------------------------------------------
   Убирает ручной ввод там, где его можно не делать.

   1. «Повторить прошлый заход» — одно нажатие ставит в поля карточки вес,
      подходы и повторы того захода, который человек уже отработал. Рядом
      мелко написано, что именно подставится. Первый раз упражнение делается
      без подсказки — тогда кнопки нет вовсе.
   2. Заметка к упражнению — номер тренажёра, высота сиденья, что болит.
      Живёт с упражнением, а не с днём: `S.exNote[имя]`. Лежит в S, значит
      переживает перезагрузку и попадает в резервную копию вместе со всем
      остальным.

   Прошлый заход берётся из журнала (lastDone / exHistory), а не считается
   по плану: план мог смениться, а журнал — это то, что человек правда сделал.
*/
(function () {

  /* ---------- заметки ---------- */
  /* Копия состояния может быть старой — без поля exNote, — или правленой
     руками, и тогда на его месте лежит что угодно. Чиним на месте и молча:
     упасть здесь значит отнять у человека всю карточку. */
  function заметки() {
    if (!S.exNote || typeof S.exNote !== 'object' || Array.isArray(S.exNote)) S.exNote = {};
    return S.exNote;
  }
  function заметка(имя) {
    const z = заметки()[имя];
    return typeof z === 'string' ? z : '';
  }
  function записать(имя, текст) {
    const z = заметки();
    if (String(текст).trim() === '') delete z[имя]; else z[имя] = String(текст);
    save();
  }

  /* ---------- прошлый заход ---------- */

  /* Дата прошлого захода. Числа даёт lastDone, а дату — история упражнения:
     в ней записи лежат вместе с датами. История весов пропускает упражнения
     без отягощения, поэтому для них дата ищется тем же lastDone шагами по
     журналу назад: день прошлого захода — первый день, до которого lastDone
     уже возвращает другую запись. */
  function датаЗахода(имя, до, l, ист) {
    if (ист.length && num(l.w) > 0) return ист[ист.length - 1][0];
    const дни = Object.keys(S.rec).filter(d => d < до).sort().reverse();
    for (const d of дни) if (lastDone(имя, d) !== l) return d;
    return ист.length ? ист[ист.length - 1][0] : '';
  }

  function прошлый(имя, до) {
    if (!имя || !до) return null;
    const l = lastDone(имя, до);
    if (!l) return null;
    const ист = exHistory(имя).filter(x => x[0] < до);
    const дата = датаЗахода(имя, до, l, ист);
    const к = ист.filter(x => x[0] === дата).pop() || null;
    const w = num(pick(l.w, к ? к[1] : 0));
    const s = String(pick(l.s, к ? к[2] : '') ?? '').trim();
    const r = String(pick(l.r, к ? к[3] : '') ?? '').trim();
    const rs = (l.rs && l.rs.length && l.rs.some(v => num(v) > 0))
      ? l.rs.map(v => num(v)) : null;
    if (!w && !s && !r && !rs) return null;
    return { дата: дата, w: w, s: s, r: r, rs: rs };
  }

  // «4×8», а если подходы прошли вразнобой — «10/9/8»
  function схема(п) {
    if (п.rs && п.rs.length) {
      const все = п.rs.every(v => v === п.rs[0]);
      if (!все || !п.s) return п.rs.join('/');
      return п.rs.length + '×' + п.rs[0];
    }
    return (п.s || '?') + '×' + (п.r || '?');
  }

  function дней(n) {
    const a = n % 100, b = n % 10;
    if (a > 10 && a < 20) return n + ' дней';
    if (b === 1) return n + ' день';
    if (b >= 2 && b <= 4) return n + ' дня';
    return n + ' дней';
  }

  function когда(дата, до) {
    if (!дата) return '';
    const n = daysBetween(дата, до);
    if (!isFinite(n) || n < 0) return fmt(дата, 1);
    const словом = n === 0 ? 'сегодня' : n === 1 ? 'вчера' : дней(n) + ' назад';
    return словом + ', ' + fmt(дата, 1);
  }

  function подпись(п, до) {
    const вес = п.w ? kg(п.w) + ' кг' : 'без отягощения';
    const к = когда(п.дата, до);
    return 'в прошлый раз ' + схема(п) + ' · ' + вес + (к ? ' · ' + к : '');
  }

  /* ---------- разметка ---------- */
  HOOK.card.push(function (e, g, j, d) {
    const имя = (e && e.n) ? String(e.n) : '';
    if (!имя) return '';
    // Закрытый подход переписывать нечем: он уже в журнале.
    const п = g && g.done ? null : прошлый(имя, sel);
    const н = заметка(имя);
    return '<div class="pr-box">' +
      (п ? '<button class="pr-rep" data-pr-rep="' + j + '">Повторить прошлый заход</button>' +
        '<div class="pr-was">' + esc(подпись(п, sel)) + '</div>' : '') +
      '<label class="pr-nt"><span class="pr-nt-l">Заметка к упражнению</span>' +
      '<textarea class="pr-nt-t" rows="2" data-pr-note="' + esc(имя) + '" ' +
      'placeholder="номер тренажёра, высота сиденья, что болит" ' +
      'aria-label="Заметка к упражнению">' + esc(н) + '</textarea></label></div>';
  });

  /* ---------- подстановка ---------- */
  const дёрнуть = el => el.dispatchEvent(new Event('input', { bubbles: true }));

  function подставить(карта, п) {
    const w = карта.querySelector('[data-f="w"]');
    if (w && п.w) { w.value = kg(п.w); дёрнуть(w); }
    const r = карта.querySelector('[data-f="r"]');
    if (r && п.r) { r.value = п.r; дёрнуть(r); }
    // Число подходов меняем последним из трёх полей: на него приложение
    // пересобирает клетки повторов, и заполнять надо уже новые клетки.
    const s = карта.querySelector('[data-f="s"]');
    if (s && п.s) { s.value = п.s; дёрнуть(s); }
    const прост = /^\s*\d+\s*$/.test(п.r) ? String(num(п.r)) : '';
    [...карта.querySelectorAll('[data-rs]')].forEach((inp, i) => {
      const v = п.rs ? (п.rs[i] === undefined ? '' : String(п.rs[i])) : прост;
      if (v === '' || v === '0') return;
      inp.value = v;
      дёрнуть(inp);
    });
  }

  $('exl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-pr-rep]');
    if (!b) return;
    ev.preventDefault();
    const карта = b.closest('.ex');
    if (!карта) return;
    const j = num(карта.dataset.j);
    const e = ((dayOf(sel) || {}).ex || [])[j];
    const п = e ? прошлый(e.n, sel) : null;
    if (!п) { note('Прошлого захода нет'); return; }
    подставить(карта, п);
    note('Подставлено как в прошлый раз');
  });

  /* ---------- ввод заметки ---------- */
  /* Заметка сохраняется по мере набора и никого не перерисовывает: перерисовка
     посреди набора вырвала бы поле из-под пальца. */
  $('exl').addEventListener('input', ev => {
    const t = ev.target.closest('[data-pr-note]');
    if (!t) return;
    записать(t.dataset.prNote, t.value);
  });

  // Первая отрисовка могла пройти до того, как фишка встала на место.
  if (typeof exOpen !== 'undefined' && exOpen !== null) render();
})();
