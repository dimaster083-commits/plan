/* =========================================================================
   ФИШКА: МАКСИМУМ И РЕКОРДЫ
   Сила меряется не тоннажем, а тем, сколько ты можешь поднять один раз.
   Расчётный максимум (1ПМ) по Эпли, рекорды по повторам и проценты от
   максимума — всё по журналу, по ФАКТИЧЕСКИ сделанным повторам (rs),
   а не по тому, что стоит в плане.
   ========================================================================= */
(function () {
  const PCT = [95, 90, 85, 80, 75, 70, 60];   // проценты от максимума, сверху вниз
  const REPS = [1, 3, 5, 8, 10, 12];          // ступени рекордов по повторам
  const LIE = 12;                             // выше — формула Эпли завышает

  /* Все подходы упражнения из журнала, по одному на КАЖДЫЙ сделанный подход.
     rs — это то, что человек реально записал в клетки повторов; план (r)
     берётся только когда клетки пустые. Подход без веса силу не меряет. */
  function mkSets(name) {
    const out = [];
    const rec = (typeof S === 'object' && S && S.rec) ? S.rec : {};
    Object.keys(rec).sort().forEach(ds => {
      const day = dayOf(ds); if (!day) return;
      const lg = (rec[ds] || {}).log || {};
      Object.keys(lg).forEach(j => {
        const l = lg[j] || {}, p = (day.ex || [])[j] || {};
        if ((l.n || p.n) !== name || !l.done) return;
        const w = num(pick(l.w, p.w)); if (!w) return;
        const rs = (l.rs && l.rs.length) ? l.rs.map(num).filter(v => v > 0) : null;
        if (rs && rs.length) rs.forEach(r => out.push({ d: ds, w: w, r: r }));
        else {
          // клеток нет — судим по плану, но по НИЗУ диапазона: «6-10» это
          // гарантированные 6, а не обещанные 10.
          const r = firstRep(pick(l.r, p.r));
          const s = Math.max(1, Math.round(num(pick(l.s, p.s))));
          if (r > 0) for (let k = 0; k < s; k++) out.push({ d: ds, w: w, r: r });
        }
      });
    });
    return out;
  }

  /* Эпли: 1ПМ = вес × (1 + повторы / 30).
     Один повтор — это уже максимум, никакой формулы там не нужно: 100×1
     это ровно 100, а не 103,3. */
  function mkPM(w, r) {
    w = num(w); r = num(r);
    if (!w || !r) return 0;
    return Math.round(w * (1 + (r > 1 ? r / 30 : 0)));
  }

  // подход, из которого выведен максимум
  function mkBest(sets) {
    let best = null;
    (sets || []).forEach(s => {
      const pm = mkPM(s.w, s.r);
      if (!pm) return;
      if (!best || pm > best.pm) best = { w: s.w, r: s.r, d: s.d, pm: pm };
    });
    return best;
  }

  /* Рекорд на N повторов — лучший вес среди подходов, где сделано НЕ МЕНЬШЕ
     N раз. Сделал 10 на 80 кг — это заодно и рекорд на 8, и на 5, и на 3. */
  function mkRecords(sets) {
    return REPS.map(n => {
      let best = null;
      (sets || []).forEach(s => {
        if (s.r < n) return;
        if (!best || s.w > best.w) best = { w: s.w, d: s.d, r: s.r };
      });
      return { n: n, w: best ? best.w : 0, d: best ? best.d : '', r: best ? best.r : 0 };
    });
  }

  /* Проценты от максимума весами по сетке приложения (granOf/roundW).
     На лёгких весах сетка грубее шага в 5 %: два процента попадают на один
     и тот же вес. Тогда строки склеиваются в одну («90–85 %»), а не врут
     разными числами про один вес. Из-за этого таблица всегда строго убывает. */
  function mkPercents(pm) {
    const out = [];
    PCT.forEach(p => {
      const w = roundW(num(pm) * p / 100);
      const last = out[out.length - 1];
      if (last && last.w === w) last.to = p;
      else out.push({ from: p, to: p, w: w });
    });
    return out;
  }

  const mkDate = ds => (String(ds).length === 10)
    ? String(ds).slice(8, 10) + '.' + String(ds).slice(5, 7) : '';
  const mkPctLabel = row => (row.from === row.to ? row.from : row.from + '–' + row.to) + ' %';

  /* ---------- разметка ---------- */

  // полная таблица: максимум, рекорды по повторам, проценты
  function mkFull(name) {
    const sets = mkSets(name), best = mkBest(sets);
    if (!best) return '';
    const shaky = best.r > LIE;
    let h = '<div class="mkx"><div class="mkx-top">' +
      '<span class="mkx-l">Расчётный максимум (1ПМ)</span>' +
      '<span class="mkx-pm">' + (shaky ? '≈ ' : '') + kg(best.pm) + '<i>кг</i></span>' +
      '<span class="mkx-f">лучший подход: ' + kg(best.w) + ' кг × ' + kg(best.r) +
      ' → ' + kg(best.pm) + ' кг' + (mkDate(best.d) ? ' · ' + mkDate(best.d) : '') +
      '</span></div>';

    if (shaky) h += '<p class="mkx-warn">В лучшем подходе ' + kg(best.r) +
      ' повторов. Дальше ' + LIE + ' формула Эпли завышает и точного числа не даёт: ' +
      'считай это прикидкой, а не рекордом. Чтобы узнать максимум — сделай ' +
      'тяжёлый подход на 3–5 повторов.</p>';

    h += '<div class="mkx-h">Рекорды по повторам</div><table class="mkt">' +
      '<tr><th class="mk-k">Повторы</th><th>Лучший вес</th><th class="mk-d">Когда</th></tr>' +
      mkRecords(sets).map(r => '<tr><td class="mk-k">' + r.n + '</td>' +
        (r.w ? '<td class="mk-w">' + kg(r.w) + ' кг</td>' : '<td class="mk-no">—</td>') +
        '<td class="mk-d">' + (r.w ? mkDate(r.d) : '') + '</td></tr>').join('') +
      '</table>';

    h += '<div class="mkx-h">Проценты от максимума</div><table class="mkt">' +
      '<tr><th class="mk-k">Доля</th><th>Вес</th></tr>' +
      mkPercents(best.pm).map(r => '<tr><td class="mk-k">' + mkPctLabel(r) + '</td>' +
        '<td class="mk-w">' + kg(r.w) + ' кг</td></tr>').join('') +
      '</table>';

    h += '<p class="mkx-note">Формула Эпли: вес × (1 + повторы / 30). Один повтор ' +
      'берётся как есть. Веса — по сетке приложения: килограмм до 20 кг, 2,5 кг выше.</p>' +
      '</div>';
    return h;
  }

  /* Строка в раскрытой карточке. Пустой журнал — пустая строка: молчим,
     а не показываем «0 кг». */
  HOOK.card.push(function (e, g, j, d) {
    const name = (g && g.n) || (e && e.n) || '';
    if (!name) return '';
    const best = mkBest(mkSets(name));
    if (!best || !best.pm) return '';
    return '<div class="mk"><button type="button" class="mk-b" data-mk="' + esc(name) + '"' +
      ' aria-label="Максимум и рекорды">' +
      '<span class="mk-t">' +
        '<span class="mk-l">Расчётный максимум</span>' +
        '<span class="mk-v">' + (best.r > LIE ? '≈ ' : '') + kg(best.pm) + '<i>кг</i></span>' +
        '<span class="mk-f">' + kg(best.w) + ' кг × ' + kg(best.r) + ' → ' +
          kg(best.pm) + ' кг</span>' +
      '</span><span class="mk-g">▸</span></button></div>';
  });

  // свой обработчик на своей разметке: чужие не трогаем
  const host = document.getElementById('exl');
  if (host) host.addEventListener('click', ev => {
    const b = ev.target.closest('[data-mk]');
    if (!b) return;
    const name = b.dataset.mk;
    const html = mkFull(name);
    if (html) sheet(name, html);
  });

  // наружу — для проверок
  window.MAKS = { pm: mkPM, sets: mkSets, best: mkBest,
    records: mkRecords, percents: mkPercents, full: mkFull, LIE: LIE };
})();
