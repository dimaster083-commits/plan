/* Аудит хранилища: ремонт состояния (scrubKeys), копия и восстановление,
   CSV, офлайн-кэш. Каждый пункт с пометкой «ошибка» падал на старом коде:
   - копия с пятью днями расписания проходила проверку, и шторка «Неделя»
     падала на S.days[5].k; девять дней и чужие подписи дня тоже оставались;
   - id упражнения базы из копии вставлялся в src картинки как есть —
     кавычка в id дописывала в разметку свой атрибут;
   - заметки массивом молча терялись, объект вместо строки показывался
     «[object Object]»; квест месяца из тысячи одинаковых id давал тысячу
     наград опыта; строка вместо списка в записи подхода роняла снятие отметки;
   - CSV считал тоннаж по плану, а не по записанным подходам и весам, и
     подписывал перенесённую дату чужим днём недели;
   - фото каталога с jsDelivr лежали в кэше версии и стирались при каждой
     выкладке — «кэшируются после показа» жило до следующего обновления. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'audit-store-'));
const clone = o => JSON.parse(JSON.stringify(o));

/* ---------- сервис-воркер в песочнице: какие кэши живут после выкладки ---------- */
async function swCheck() {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'sw.js'), 'utf8');
  const puts = new Map();                 // имя кэша → ключи
  const deleted = [];
  function worker(code, have) {
    const handlers = {};
    const ctx = {
      self: { addEventListener: (t, f) => { handlers[t] = f; }, location: { origin: 'https://x' }, skipWaiting() {}, clients: { claim() {} } },
      caches: {
        open: async name => ({
          put: async (k) => { if (!puts.has(name)) puts.set(name, []); puts.get(name).push(typeof k === 'string' ? k : k.url); },
          addAll: async () => {}, keys: async () => []
        }),
        keys: async () => have, delete: async k => { deleted.push(k); return true; }, match: async () => null
      },
      fetch: async () => ({ ok: true, status: 200, type: 'cors', clone() { return this; } }),
      URL, console, Promise, setTimeout
    };
    vm.createContext(ctx);
    vm.runInContext(code, ctx);
    return handlers;
  }
  const h1 = worker(src, []);
  const pic = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Barbell_Curl/0.jpg';
  let pr; h1.fetch({ request: { method: 'GET', mode: 'cors', url: pic }, respondWith: x => { pr = x; } });
  await pr; await new Promise(r => setTimeout(r, 20));
  const where = [...puts.keys()].find(k => puts.get(k).indexOf(pic) >= 0);
  // следующая выкладка: ключ кэша меняется, активация чистит старое
  const next = src.replace(/const CACHE = "[^"]+"/, 'const CACHE = "sys-gym-999"');
  const h2 = worker(next, [where, 'sys-gym-1']);
  let act; h2.activate({ waitUntil: x => { act = x; } }); await act;
  chk(!!where && deleted.indexOf(where) < 0 && deleted.indexOf('sys-gym-1') >= 0,
    '12. ошибка: фото каталога переживают выкладку, старая сборка чистится', JSON.stringify({ кэш: where, стёрто: deleted }));
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 320, height: 700 } });
  const p = await ctx.newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  const base = await p.evaluate(() => {
    S.setup = 1; S.sound = 0; document.getElementById('setup').classList.remove('on');
    S.bw = '80'; S.rec = {}; S.map = {}; flush();
    return JSON.parse(JSON.stringify(S));
  });
  const T = await p.evaluate(() => ({ ks: TPL.map(d => d.k), today: today(), ym: today().slice(0, 7),
    mon: addDays(mondayOf(today()), -7) }));

  // восстановление — настоящим путём: файл, вопрос, ремонт, запись
  const restore = async obj => {
    const f = path.join(TMP, 'c' + Math.random() + '.json');
    fs.writeFileSync(f, typeof obj === 'string' ? obj : JSON.stringify(obj));
    await p.setInputFiles('#impFile', f); await p.waitForTimeout(300);
    if (await p.evaluate(() => document.getElementById('ask').classList.contains('on'))) await p.click('#askY');
    await p.waitForTimeout(500);
    return p.evaluate(() => document.getElementById('noteT').textContent);
  };
  // состояние прямо в хранилище и перезагрузка — путь load()
  const boot = async text => {
    await p.evaluate(t => { canSave = false; clearTimeout(saveTimer); localStorage.setItem('sys-gym-v3', t); }, text);
    await p.reload(); await p.waitForTimeout(900);
    await p.evaluate(() => { document.getElementById('setup').classList.remove('on'); });
  };

  // 1. копия с пятью днями расписания и чужими подписями — ровно семь дней недели
  const st1 = clone(base); st1.days = st1.days.slice(0, 5); st1.days.forEach(d => { d.k = 'Пн'; });
  const n1 = await restore({ v: 3, state: st1, photos: {} });
  const r1 = await p.evaluate(() => {
    const out = { n: S.days.length, ks: S.days.map(d => d && d.k).join(','), err: '' };
    try { wkMode = 'all'; openWeekPlan(today()); out.all = document.querySelectorAll('#shB [data-wpd]').length;
      wkMode = 'this'; openWeekPlan(today()); out.this = document.querySelectorAll('#shB [data-wpd]').length; sheetClose(); }
    catch (e) { out.err = e.message; }
    return out;
  });
  chk(r1.n === 7 && r1.ks === T.ks.join(',') && r1.all === 7 && r1.this === 7 && !r1.err,
    '1. ошибка: копия с пятью днями — семь дней, подписи по дню недели, «Неделя» открывается', n1 + ' ' + JSON.stringify(r1));

  // 2. девять дней — лишние отрезаются, индекс по-прежнему день недели
  const st2 = clone(base); st2.days = st2.days.concat(clone(st2.days.slice(0, 2)));
  await restore({ v: 3, state: st2, photos: {} });
  const r2 = await p.evaluate(() => ({ n: S.days.length, t: S.days.map(d => d.t).join(','), tpl: build().days.map(d => d.t).join(',') }));
  chk(r2.n === 7 && r2.t === r2.tpl, '2. ошибка: копия с девятью днями — семь', JSON.stringify(r2));

  // 3. id упражнения базы из копии не дописывает атрибуты в разметку
  const st3 = clone(base);
  st3.myEx = { 'Моё': 'Грудь', 'Второе': 'Руки' };
  st3.libEx = { 'Моё': ['x" data-xss="1', 'Грудь'], 'Второе': ['Barbell_Curl', 'Бицепс'] };
  st3.days.forEach(d => { d.ex.push({ n: 'Моё', s: 3, r: '8-10', w: 20, g: 'Грудь' }, { n: 'Второе', s: 3, r: '8-10', w: 10, g: 'Руки' }); });
  await p.evaluate(() => { tab = 'wo'; });
  await restore({ v: 3, state: st3, photos: {} });
  const r3 = await p.evaluate(() => { tab = 'wo'; render();
    return { xss: !!document.querySelector('[data-xss]'), bad: !!(S.libEx && S.libEx['Моё']),
      good: JSON.stringify(S.libEx && S.libEx['Второе']), pics: document.querySelectorAll('img.exth').length }; });
  chk(!r3.xss && !r3.bad && r3.good === '["Barbell_Curl","Бицепс"]',
    '3. ошибка: кавычка в id базы из копии выброшена, годный id на месте', JSON.stringify(r3));

  // 4. заметки массивом: после ремонта пишутся и переживают перезагрузку
  const st4 = clone(base); st4.exNote = [];
  await boot(JSON.stringify(st4));
  const r4a = await p.evaluate(() => {
    const ds = addDays(mondayOf(today()), 1);          // вторник — день с упражнениями
    sel = ds; tab = 'wo'; exOpen = 0; render();
    const ta = document.querySelector('[data-exnote]');
    if (!ta) return { ta: false, arr: Array.isArray(S.exNote) };
    ta.value = 'сиденье на 4'; ta.dispatchEvent(new Event('input', { bubbles: true }));
    flush();
    return { ta: true, arr: Array.isArray(S.exNote), name: ta.dataset.exnote };
  });
  await p.reload(); await p.waitForTimeout(900);
  const r4 = await p.evaluate(n => ({ note: (S.exNote || {})[n] || '' }), r4a.name);
  chk(r4a.ta && !r4a.arr && r4.note === 'сиденье на 4', '4. ошибка: заметка при заметках-массиве не теряется', JSON.stringify([r4a, r4]));

  // 5. заметка-объект не показывается «[object Object]»
  const st5 = clone(base); st5.exNote = { 'Жим лёжа': { a: 1 }, 'Присед со штангой': 'узко' };
  await boot(JSON.stringify(st5));
  const r5 = await p.evaluate(() => ({ html: noteHtml('Жим лёжа'), keep: S.exNote['Присед со штангой'] }));
  chk(!/object Object/.test(r5.html) && r5.keep === 'узко', '5. ошибка: заметка не строкой выброшена, строка на месте', JSON.stringify(r5));

  // 6. квест месяца: тысяча одинаковых id — одна награда, мусорные месяцы уходят
  const st6a = clone(base); st6a.quest = { [T.ym]: ['wo'] };
  await boot(JSON.stringify(st6a));
  const xp0 = await p.evaluate(() => S.xp);
  const st6 = clone(base); st6.quest = { [T.ym]: Array(1000).fill('wo'), junk: ['wo'], '2026-13': ['wo'] };
  await boot(JSON.stringify(st6));
  const r6 = await p.evaluate(() => ({ xp: S.xp, q: JSON.stringify(S.quest) }));
  chk(r6.xp === xp0 && r6.q === JSON.stringify({ [T.ym]: ['wo'] }), '6. ошибка: квест из копии не накручивает опыт', JSON.stringify({ xp0, xp: r6.xp, q: r6.q.slice(0, 120) }));

  // 7. строка вместо списка в записи подхода не роняет снятие отметки
  const st7 = clone(base);
  st7.rec = { [T.today]: { log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: 3, r: '8-10', w: 60, rs: [8, 8, 8],
    wu: '5', dr: 7, fl: 'x', ws: 'abc', kinds: 3, bump: 'x', rbump: [5], vol: 1440, xp: 10 } }, sp: {}, wo: 0 } };
  await boot(JSON.stringify(st7));
  const r7 = await p.evaluate(() => {
    sel = today(); tab = 'wo'; render();
    try { toggleSet(0); } catch (e) { return { err: e.message }; }
    const l = S.rec[today()].log[0];
    return { done: l.done, rs: JSON.stringify(l.rs) };
  });
  chk(!r7.err && r7.done === 0, '7. ошибка: снятие отметки при кривых списках в записи', JSON.stringify(r7));

  // 8. ключи __proto__ из копии не остаются в словарях
  const st8 = clone(base);
  let txt8 = JSON.stringify(st8);
  txt8 = txt8.slice(0, -1) + ',"myEx":{"__proto__":"Грудь","Своё":"Руки"},"exNote":{"__proto__":"x"},"libEx":{"__proto__":["Barbell_Curl",null]}}';
  await boot(txt8);
  const r8 = await p.evaluate(() => {
    const own = o => !!o && Object.prototype.hasOwnProperty.call(o, '__proto__');
    return { myEx: own(S.myEx), exNote: own(S.exNote), libEx: own(S.libEx), keep: S.myEx && S.myEx['Своё'] };
  });
  chk(!r8.myEx && !r8.exNote && !r8.libEx && r8.keep === 'Руки', '8. ключи __proto__ выброшены, остальное на месте', JSON.stringify(r8));

  // 9. круг «копия → восстановление»: новые ключи состояния доезжают как были
  await boot(JSON.stringify(base));
  const made = await p.evaluate(() => {
    const mon = mondayOf(today()), tue = addDays(mon, 1);
    S.pause = { [mon]: 1 }; S.fav = ['Barbell_Curl']; S.myEx = { 'Сгибания со штангой': 'Руки' };
    S.libEx = { 'Сгибания со штангой': ['Barbell_Curl', 'Бицепс'] }; S.exNote = { 'Жим лёжа': 'хват шире' };
    S.meas = { [today()]: { chest: 101 } }; S.quest = { [today().slice(0, 7)]: ['bw'] };
    S.days[1].ex[0].ss = 1;
    swapWeekdays(1, 3);
    S.rec[addDays(mon, -6)] = { log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: 3, r: '8-10', w: 60, rs: [8, 8, 8],
      wu: [10], kinds: ['w', '', '', ''], vol: 1440, xp: 10 } }, sp: {}, wo: 1 };
    flush();
    const pick = () => JSON.stringify(['pause', 'fav', 'myEx', 'libEx', 'exNote', 'meas', 'quest', 'map'].map(k => S[k])
      .concat([S.days.map(d => d.ex.map(e => e.ss || 0).join('')).join('|'), S.rec[addDays(mon, -6)].log[0].wu]));
    window.__pick = pick;
    return { copy: { v: 3, saved: new Date().toISOString(), state: JSON.parse(JSON.stringify(S)), photos: {} }, sig: pick() };
  });
  await p.evaluate(() => { S.pause = {}; S.fav = []; S.exNote = {}; flush(); });
  await restore(made.copy);
  const sig9 = await p.evaluate(() => window.__pick());
  chk(sig9 === made.sig, '9. пауза, избранное, база, заметки, замеры, квесты, переносы и суперсет переживают копию', sig9.slice(0, 160));

  // 10. старая копия без новых ключей открывает все экраны
  const old = clone(base);
  ['pause', 'fav', 'libEx', 'exNote', 'meas', 'quest', 'myEx', 'mig14', 'mig15', 'mig16'].forEach(k => { delete old[k]; });
  old.days.forEach(d => d.ex.forEach(e => { delete e.ss; }));
  const e0 = errs.length;
  const n10 = await restore({ v: 3, state: old, photos: {} });
  const r10 = await p.evaluate(async () => {
    const out = { err: '' };
    try {
      ['wo', 'food', 'prog', 'photo', 'ex'].forEach(t => { tab = t; render(); });
      wkMode = 'this'; openWeekPlan(today()); sheetClose();
      openWeek(mondayOf(today())); sheetClose();
      out.days = S.days.length; out.map = typeof S.map;
    } catch (e) { out.err = e.message; }
    return out;
  });
  chk(/восстановлен/i.test(n10) && !r10.err && r10.days === 7 && errs.length === e0, '10. старая копия без новых ключей — все экраны целы',
    n10 + ' ' + JSON.stringify(r10) + ' ' + errs.slice(e0).join(' | '));

  // 11. CSV: тоннаж — как в журнале (по подходам и их весам), день — по дате
  await boot(JSON.stringify(base));
  const r11 = await p.evaluate(mon => {
    S.rec = {}; S.map = {};
    S.map[mon] = 1;                     // понедельник взял тренировку вторника
    S.rec[mon] = { log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: 3, r: '8-10', w: 60, rs: [10, 10, 8], ws: [60, 70, 80] } }, sp: {}, wo: 1 };
    entCache = null;
    const row = buildCsv().split('\r\n').find(x => x.indexOf(mon) === 0).split(';');
    return { day: row[1], ton: row[10], dayTon: dayTon(mon) };
  }, T.mon);
  chk(r11.day === 'Пн' && r11.ton === String(r11.dayTon) && r11.dayTon === 1940,
    '11. ошибка: CSV — тоннаж журнала и день недели самой даты', JSON.stringify(r11));

  await swCheck();

  chk(!errs.length, 'нет ошибок JS', errs.length ? [...new Set(errs)].join(' | ') : '');
  await b.close();
  console.log('провалено: ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
