/* =========================================================================
   ЗАМЕРЫ — обхваты тела по датам.
   Весы показывают одну цифру на всё тело и умеют молчать: вес стоит
   неделю, а талия за это время ушла на два сантиметра, и бицепс вырос.
   Сантиметр это видит, а весы — нет. Поэтому замеры стоят рядом с весом
   и фотографиями, третьей опорой.

   Правила этого блока:
   · всё лежит в S.mes[дата] = {талия:80, ...}; поля может не быть вовсе —
     состояние приходит из старой копии, и падать на этом нельзя;
   · одна дата — один замер: повторная запись перезаписывает, а не заводит
     вторую строку;
   · пустое поле значит «не записал», а не «ноль». Ноль в истории — это
     ложь, которой потом верят;
   · дельта считается к ПРЕДЫДУЩЕМУ заполненному замеру этого же обхвата,
     а не к первому и не к нулю. Нет предыдущего — нет дельты;
   · рост не равен успеху: талия вниз — хорошо, бицепс вверх — хорошо.
     Направление показываем честно знаком, а оценку — цветом темы.
   ========================================================================= */

const MES_MIN = 10, MES_MAX = 250;          // обхват человека; 0 и 999 — это опечатка

/* ключ · подпись · куда «хорошо»: +1 вверх, −1 вниз, 0 — как посмотреть */
const MES_POLE = [
  ['шея',    'Шея',    0],
  ['грудь',  'Грудь',  1],
  ['талия',  'Талия',  -1],
  ['живот',  'Живот',  -1],
  ['бёдра',  'Бёдра',  0],
  ['бицепс', 'Бицепс', 1],
  ['бедро',  'Бедро',  1],
  ['голень', 'Голень', 1]
];
const MES_KEYS = MES_POLE.map(x => x[0]);
const MES_NAME = {}; const MES_DIR = {};
MES_POLE.forEach(x => { MES_NAME[x[0]] = x[1]; MES_DIR[x[0]] = x[2]; });

let mesDraft = '';          // дата, открытая в форме

/* ---------- число ----------
   Своё, а не num(): num('абв') и num('-5') дают 0, а ноль здесь означал бы
   «обхват 0 см». Негодное значение должно исчезнуть, а не превратиться в цифру. */
function mesNum(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).trim().replace(',', '.');
  if (!s) return null;
  if (!/^\d{1,3}(\.\d{1,2})?$/.test(s)) return null;   // буквы, минус, «80см», «--»
  const n = parseFloat(s);
  if (!isFinite(n)) return null;
  if (n < MES_MIN || n > MES_MAX) return null;         // 0 и 999 — не обхват
  return Math.round(n * 10) / 10;
}

/* ---------- хранилище ----------
   Чинится при каждом обращении: копия может прийти без поля, с чужим типом,
   с мусорным ключом вместо даты или с «талия: abc». */
function mesEnsure() {
  if (typeof S !== 'object' || !S) return {};
  if (!S.mes || typeof S.mes !== 'object' || Array.isArray(S.mes)) S.mes = {};
  Object.keys(S.mes).forEach(k => {
    const r = S.mes[k];
    const годная = /^\d{4}-\d{2}-\d{2}$/.test(k) && !isNaN(at(k).getTime());
    if (!годная || !r || typeof r !== 'object' || Array.isArray(r)) { delete S.mes[k]; return; }
    Object.keys(r).forEach(f => {
      const n = mesNum(r[f]);
      if (MES_KEYS.indexOf(f) < 0 || n === null) delete r[f]; else r[f] = n;
    });
    if (!Object.keys(r).length) delete S.mes[k];
  });
  return S.mes;
}

function mesGet(ds) {
  const r = mesEnsure()[ds];
  const o = {};
  if (r) Object.keys(r).forEach(k => { o[k] = r[k]; });
  return o;
}

/* Запись замера. Одна дата — одна запись: перезапись, а не вторая строка.
   Пустой набор стирает дату целиком, а не оставляет пустой скелет. */
function mesSet(ds, obj) {
  const m = mesEnsure();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(ds)) || isNaN(at(ds).getTime())) return null;
  const кл = {};
  MES_KEYS.forEach(k => {
    const n = mesNum((obj || {})[k]);
    if (n !== null) кл[k] = n;
  });
  if (!Object.keys(кл).length) { delete m[ds]; save(); return null; }
  m[ds] = кл;
  save();
  return кл;
}

const mesDates = () => Object.keys(mesEnsure()).sort();      // ISO сортируется как дата
const mesLast = () => { const d = mesDates(); return d.length ? d[d.length - 1] : ''; };

/* Предыдущий ЗАПОЛНЕННЫЙ этим обхватом замер. Не предыдущая дата вообще:
   если в прошлый раз мерили только бицепс, талию сравнивать не с чем. */
function mesPrev(k, ds) {
  const m = mesEnsure();
  const p = mesDates().filter(d => d < ds && m[d][k] !== undefined);
  return p.length ? p[p.length - 1] : '';
}

function mesDelta(k, ds) {
  const m = mesEnsure(), r = m[ds];
  if (!r || r[k] === undefined) return null;
  const p = mesPrev(k, ds);
  if (!p) return null;                       // первый раз — дельты нет, а не «+80 см»
  const d = Math.round((r[k] - m[p][k]) * 10) / 10;
  const дней = Math.abs(daysBetween(p, ds));
  const dir = MES_DIR[k] || 0;
  const знак = d > 0 ? 1 : d < 0 ? -1 : 0;
  return { было: m[p][k], стало: r[k], d: d, дней: дней, откуда: p,
    добро: !!dir && знак === dir, зло: !!dir && знак === -dir,
    цвет: (!dir || !знак) ? 'zm-fl' : (знак === dir ? 'zm-up' : 'zm-dn') };
}

const mesPl = (n, f) => { const a = Math.abs(n) % 100, b = a % 10;
  return a > 10 && a < 20 ? f[2] : b > 1 && b < 5 ? f[1] : b === 1 ? f[0] : f[2]; };
function mesSrok(дней) {
  const n = Math.abs(дней);
  if (n < 14) return 'за ' + n + ' ' + mesPl(n, ['день', 'дня', 'дней']);
  if (n < 60) { const w = Math.round(n / 7); return 'за ' + w + ' ' + mesPl(w, ['неделю', 'недели', 'недель']); }
  const mo = Math.round(n / 30);
  return 'за ' + mo + ' ' + mesPl(mo, ['месяц', 'месяца', 'месяцев']);
}
/* Знак настоящий: минус так минус. Плюс на талии — это плюс на талии,
   достижением он здесь не называется. */
const mesZnak = d => d > 0 ? '+' + kg(d) : d < 0 ? '−' + kg(Math.abs(d)) : '0';
function mesDeltaText(k, ds) {
  const dl = mesDelta(k, ds);
  if (!dl) return '';
  if (!dl.d) return 'как было ' + mesSrok(dl.дней);
  return mesZnak(dl.d) + ' см ' + mesSrok(dl.дней);
}
/* «талия 80 см, −2 см за 3 недели» — одной строкой, как это читает человек */
function mesText(k, ds) {
  const r = mesGet(ds || mesLast());
  if (r[k] === undefined) return '';
  const t = mesDeltaText(k, ds || mesLast());
  return MES_NAME[k].toLowerCase() + ' ' + kg(r[k]) + ' см' + (t ? ', ' + t : '');
}

/* ---------- строка на «Прогрессе» ---------- */
function mesGlavnoe(ds) {                   // что вынести в одну строку
  const r = mesGet(ds);
  const важные = ['талия', 'живот', 'грудь', 'бицепс'];
  return важные.filter(k => r[k] !== undefined)[0] ||
         MES_KEYS.filter(k => r[k] !== undefined)[0] || '';
}
function mesKratko(ds) {
  const r = mesGet(ds);
  const есть = MES_KEYS.filter(k => r[k] !== undefined);
  return есть.slice(0, 3).map(k => MES_NAME[k].toLowerCase() + ' ' + kg(r[k])).join(' · ') +
         (есть.length > 3 ? ' · ещё ' + (есть.length - 3) : '');
}
function mesRow() {
  const ds = mesLast();
  if (!ds) return '<button class="zm-row" type="button" data-zm-open="1">' +
    '<b>Замеры</b><span>сантиметр ещё не доставали</span><i>записать</i></button>';
  const k = mesGlavnoe(ds), r = mesGet(ds), dl = mesDelta(k, ds);
  return '<button class="zm-row" type="button" data-zm-open="1"><b>Замеры</b>' +
    '<span>' + esc(MES_NAME[k].toLowerCase() + ' ' + kg(r[k]) + ' см') + '</span>' +
    (dl ? '<i class="' + dl.цвет + '">' + esc(mesDeltaText(k, ds)) + '</i>'
        : '<i>' + esc(fmt(ds, 1)) + '</i>') + '</button>';
}
HOOK.prog.push(function () { return mesRow(); });

/* ---------- шторка ---------- */
function mesFormHtml(ds) {
  const r = mesGet(ds);
  return '<div class="zm-win"><h5>Замер на дату</h5>' +
    '<input class="zm-date" id="zmDate" type="date" value="' + esc(ds) + '" aria-label="Дата замера">' +
    '<div class="zm-grid">' + MES_POLE.map(f =>
      '<label class="zm-fld"><em>' + esc(f[1]) + '</em>' +
      '<input class="zm-in" type="text" inputmode="decimal" data-zm-f="' + esc(f[0]) + '"' +
      ' value="' + (r[f[0]] !== undefined ? esc(kg(r[f[0]])) : '') + '"' +
      ' placeholder="—" aria-label="' + esc(f[1]) + ', см"><u>см</u></label>').join('') +
    '</div>' +
    '<button class="zm-save" type="button" data-zm-save="1">Записать замер</button>' +
    '<p class="zm-hint">Все поля необязательные: меряй то, что меряешь. ' +
    'Пустое поле — «не записал», нулём оно не станет. ' +
    'Повторная запись на ту же дату заменяет прежнюю.</p></div>';
}

function mesHistHtml() {
  const ds = mesDates();
  if (!ds.length) return '<div class="zm-win"><h5>История</h5>' +
    '<p class="zm-none">Записей пока нет. Вес умеет стоять на месте неделями, ' +
    'пока талия уходит, а бицепс растёт — это видно только сантиметром.</p></div>';
  const last = ds[ds.length - 1], r = mesGet(last);
  const строки = MES_KEYS.filter(k => r[k] !== undefined).map(k => {
    const dl = mesDelta(k, last);
    return '<div class="zm-line"><em>' + esc(MES_NAME[k]) + '</em>' +
      '<b>' + esc(kg(r[k]) + ' см') + '</b>' +
      (dl ? '<s class="' + dl.цвет + '">' + esc(mesDeltaText(k, last)) + '</s>'
          : '<s class="zm-fl">первая запись</s>') + '</div>';
  }).join('');
  const прошлые = ds.slice(0, -1).reverse().slice(0, 10).map(d =>
    '<button class="zm-old" type="button" data-zm-old="' + esc(d) + '">' +
    '<b>' + esc(fmt(d)) + '</b><span>' + esc(mesKratko(d)) + '</span></button>').join('');
  return '<div class="zm-win"><h5>Последний замер</h5>' +
    '<div class="zm-when"><b>' + esc(fmt(last)) + '</b><i>' +
    esc(last === today() ? 'сегодня' : mesSrok(Math.abs(daysBetween(last, today()))) + ' до сегодня') +
    '</i></div>' + строки +
    '<p class="zm-hint">Цвет — оценка, знак — направление. Талию и живот хорошо ' +
    'видеть вниз, грудь и руки — вверх; шею и бёдра сами решайте.</p></div>' +
    (прошлые ? '<div class="zm-win"><h5>Прежние замеры</h5>' + прошлые +
      '<p class="zm-hint">Нажми дату, чтобы поправить тот замер.</p></div>' : '');
}

function mesOpen(ds) {
  mesEnsure();
  mesDraft = (ds && /^\d{4}-\d{2}-\d{2}$/.test(String(ds))) ? String(ds) : (mesLast() || today());
  sheet('ЗАМЕРЫ', mesFormHtml(mesDraft) + mesHistHtml());
}

function mesSaveForm() {
  const di = document.getElementById('zmDate');
  const ds = (di && /^\d{4}-\d{2}-\d{2}$/.test(di.value)) ? di.value : (mesDraft || today());
  const obj = {}; let плохих = 0;
  MES_KEYS.forEach(k => {
    const i = document.querySelector('.zm-in[data-zm-f="' + k + '"]');
    if (!i) return;
    const raw = String(i.value || '').trim();
    if (!raw) return;                       // пусто — просто не мерили
    const n = mesNum(raw);
    if (n === null) плохих++; else obj[k] = n;
  });
  const res = mesSet(ds, obj);
  mesDraft = ds;
  sheet('ЗАМЕРЫ', mesFormHtml(ds) + mesHistHtml());
  try { if (typeof tab !== 'undefined' && tab === 'prog') render(); } catch (e) { /* экран подождёт */ }
  if (плохих) note(плохих === 1 ? 'Одно поле не понял — в сантиметрах, от 10 до 250'
                                : 'Не понял полей: ' + плохих);
  else if (res) note('Замер записан: ' + fmt(ds));
  else note('Замер за ' + fmt(ds) + ' очищен');
}

/* Свои обработчики — свои, чужие не трогаем. Разметка шторки переписывается
   целиком при каждом открытии, поэтому слушаем документ, а не кнопки. */
document.addEventListener('click', e => {
  const t = e.target;
  if (!t || !t.closest) return;
  if (t.closest('[data-zm-open]')) { mesOpen(); return; }
  if (t.closest('[data-zm-save]')) { mesSaveForm(); return; }
  const o = t.closest('[data-zm-old]');
  if (o) mesOpen(o.dataset.zmOld);
});
/* Смена даты в форме: если на эту дату замер уже есть — показываем его,
   если нет — оставляем набранное, человек не обязан вводить заново. */
document.addEventListener('change', e => {
  const i = e.target && e.target.closest ? e.target.closest('#zmDate') : null;
  if (!i) return;
  const ds = /^\d{4}-\d{2}-\d{2}$/.test(i.value) ? i.value : (mesDraft || today());
  mesDraft = ds;
  const r = mesGet(ds);
  if (!Object.keys(r).length) return;
  MES_KEYS.forEach(k => {
    const f = document.querySelector('.zm-in[data-zm-f="' + k + '"]');
    if (f) f.value = r[k] !== undefined ? kg(r[k]) : '';
  });
});

/* Наружу — чтобы фишку было видно из кода и из проверок */
window.mesNum = mesNum; window.mesEnsure = mesEnsure; window.mesGet = mesGet;
window.mesSet = mesSet; window.mesDates = mesDates; window.mesLast = mesLast;
window.mesPrev = mesPrev; window.mesDelta = mesDelta; window.mesText = mesText;
window.mesDeltaText = mesDeltaText; window.mesSrok = mesSrok; window.mesRow = mesRow;
window.mesOpen = mesOpen; window.mesSaveForm = mesSaveForm; window.MES_KEYS = MES_KEYS;
window.MES_NAME = MES_NAME; window.MES_DIR = MES_DIR;

mesEnsure();
