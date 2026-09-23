/* «КАК В ПРОШЛЫЙ РАЗ»: повтор прошлого захода одной кнопкой и своя заметка
   к упражнению.

   Меряем ровно то, ради чего фишка сделана: в поля попадают числа прошлого
   захода, а не сегодняшние подсказки программы; журнал получает именно их;
   у упражнения без истории кнопки нет; заметка живёт с упражнением, а не с
   днём, переживает перезагрузку и не разрывает вёрстку на 320 px.

   Каждая проверка устроена так, чтобы падать, если фишки нет или она делает
   вид: подпись сверяется целиком, поля сверяются до и после нажатия. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs = require('fs');
const path = require('path');

let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);

// поля карточки: вес, подходы, повторы и клетки повторов
const ПОЛЯ = j => {
  const c = document.querySelector('#exl .ex[data-j="' + j + '"]');
  if (!c) return null;
  return {
    w: c.querySelector('[data-f="w"]').value,
    s: c.querySelector('[data-f="s"]').value,
    r: c.querySelector('[data-f="r"]').value,
    rs: [...c.querySelectorAll('[data-rs]')].map(x => x.value)
  };
};

const ЗАМЕТКА = 'Тренажёр №7, сиденье на 4, спинка вертикально. Правое плечо щёлкает — не разводить широко.';
const ДЛИННАЯ = 'заметкабезпробелов'.repeat(28).slice(0, 500);

(async () => {
  const css = fs.readFileSync(path.join(__dirname, '..', '..', 'feat', 'proshloe.css'), 'utf8');
  const hex = css.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  chk(hex.length === 0, '0. в стилях фишки нет своих цветов — только переменные тем',
    hex.join(' ') || 'ни одного hex');

  const b = await chromium.launch(LAUNCH);
  for (const skin of ['sl', 'ber']) {
    console.log('\n===== ' + skin + ' =====');
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1400);

    /* ---------- затравка: один заход 12 дней назад ---------- */
    const seed = await p.evaluate(s => {
      const iso2 = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
        return z.toISOString().slice(0, 10); };
      S.setup = 1; document.getElementById('setup').classList.remove('on');
      applyTheme(s); S.sound = 0;
      S.anchors = { b: 70, s: 50, d: 60 }; S.bw = '75'; deriveWeights();
      S.rec = {}; S.exNote = {};

      const d = dayOf(today());
      if (d.t === 'rest' || !(d.ex || []).length) {
        const x = S.days.find(y => y.t !== 'rest' && (y.ex || []).length);
        d.t = x.t; d.s = x.s; d.ex = x.ex.map(e => ({ ...e }));
      }
      const nm = d.ex[0].n;
      d.ex[0].w = '30';                       // рабочий вес заведомо не равен прошлому заходу
      d.ex[0].s = '3'; d.ex[0].r = '6-10';
      d.ex.push({ n: 'Тяга новичка', s: '3', r: '8-10', w: '25', g: d.ex[0].g });
      const jnew = d.ex.length - 1;

      const пр = new Date(); пр.setDate(пр.getDate() - 12);
      const dpr = iso2(пр);
      const dp = dayOf(dpr); if (!Array.isArray(dp.ex)) dp.ex = [];
      const r = recRW(dpr); r.wo = 1;
      r.log[0] = { done: 1, n: nm, g: d.ex[0].g, s: '5', r: '9', w: '62,5',
        rs: [9, 9, 9, 9, 9], vol: 45 * 62.5, xp: 12 };

      // другой день недели, где стоит то же упражнение
      let другой = '', jдр = -1;
      for (let k = 1; k <= 6; k++) {
        const dd = new Date(); dd.setDate(dd.getDate() - k);
        const ds = iso2(dd);
        if (ds === dpr || dayIdx(ds) === dayIdx(today())) continue;
        const day = dayOf(ds);
        if (day.t === 'rest' || !Array.isArray(day.ex) || !day.ex.length) continue;
        day.ex.push({ ...d.ex[0] });
        другой = ds; jдр = day.ex.length - 1; break;
      }

      save(); flush(); recomputeStats(1); entCache = null;
      tab = 'wo'; sel = today(); exOpen = 0; render();
      return { nm, jnew, dpr, другой, jдр, метка: fmt(dpr, 1) };
    }, skin);
    await p.waitForTimeout(350);

    chk(!!seed.другой, '1. затравка готова: прошлый заход и второй день с тем же упражнением',
      seed.nm + ' · ' + seed.dpr + ' · второй день ' + (seed.другой || 'не нашёлся'));

    /* ---------- 2-3. кнопка и подпись ---------- */
    const вид = await p.evaluate(() => {
      const c = document.querySelector('#exl .ex[data-j="0"]');
      return { кнопка: !!c.querySelector('[data-pr-rep]'),
        подпись: (c.querySelector('.pr-was') || {}).textContent || '' };
    });
    chk(вид.кнопка, '2. в карточке есть кнопка повтора прошлого захода');
    const ждём = 'в прошлый раз 5×9 · 62,5 кг · 12 дней назад, ' + seed.метка;
    chk(вид.подпись.trim() === ждём, '3. подпись называет верные числа и верную дату',
      '«' + вид.подпись.trim() + '» ждали «' + ждём + '»');

    const box = await (await p.$('#exl .ex[data-j="0"] [data-pr-rep]')).boundingBox();
    chk(box && box.width >= 44 && box.height >= 44, '4. кнопка не меньше 44×44',
      box ? Math.round(box.width) + '×' + Math.round(box.height) : 'кнопки нет');

    /* ---------- 5-6. подстановка ---------- */
    const до = await p.evaluate(ПОЛЯ, 0);
    chk(до.w !== '62,5' && до.s !== '5' && до.rs.join('') !== '99999',
      '5. до нажатия в полях стоит не прошлый заход, а подсказка программы',
      JSON.stringify(до));

    await p.click('#exl .ex[data-j="0"] [data-pr-rep]');
    await p.waitForTimeout(300);
    const после = await p.evaluate(ПОЛЯ, 0);
    chk(после.w === '62,5' && после.s === '5' && после.r === '9'
      && после.rs.length === 5 && после.rs.every(v => v === '9'),
      '6. нажатие кладёт в поля ровно прошлые числа', JSON.stringify(после));

    /* ---------- 7. приложение видит подставленное ---------- */
    await p.click('#exl .ex[data-j="0"] [data-go]');
    await p.waitForTimeout(450);
    const журнал = await p.evaluate(() => {
      const l = (S.rec[today()] || { log: {} }).log[0] || {};
      const e = dayEntries(today())[0] || {};
      return { w: l.w, s: l.s, r: l.r, rs: (l.rs || []).join('/'), vol: l.vol,
        ew: e.w, es: e.s, er: e.r };
    });
    chk(журнал.w === '62,5' && журнал.s === '5' && журнал.r === '9'
      && журнал.rs === '9/9/9/9/9' && журнал.vol === 45 * 62.5,
      '7. в журнал ушло подставленное, а не цифры из плана', JSON.stringify(журнал));
    chk(журнал.ew === 62.5 && журнал.es === 5 && журнал.er === '9',
      '8. и разбор дня читает те же числа',
      журнал.ew + ' кг · ' + журнал.es + '×' + журнал.er);

    /* ---------- 9. упражнение без истории ---------- */
    const новое = await p.evaluate(j => {
      exOpen = j; render();
      const c = document.querySelector('#exl .ex[data-j="' + j + '"]');
      return { есть: !!c, кнопка: !!c.querySelector('[data-pr-rep]'),
        подпись: !!c.querySelector('.pr-was'), заметка: !!c.querySelector('.pr-nt-t') };
    }, seed.jnew);
    chk(новое.есть && !новое.кнопка && !новое.подпись,
      '9. у упражнения без истории кнопки и подписи нет вовсе',
      JSON.stringify(новое));
    chk(новое.заметка, '10. а поле заметки в такой карточке всё равно есть');

    /* ---------- 11-12. заметка живёт с упражнением ---------- */
    await p.evaluate(() => { exOpen = 0; render(); });
    await p.waitForTimeout(250);
    await p.fill('#exl .ex[data-j="0"] .pr-nt-t', ЗАМЕТКА_ТЕКСТ.replace('', ''));
    await p.waitForTimeout(300);
    const вСостоянии = await p.evaluate(() => { flush();
      return (S.exNote || {})[dayOf(today()).ex[0].n] || ''; });
    chk(вСостоянии === ЗАМЕТКА, '11. заметка легла в состояние под именем упражнения',
      вСостоянии.slice(0, 30) + '…');

    await p.reload(); await p.waitForTimeout(1500);
    const послеПерезагрузки = await p.evaluate(() => {
      S.setup = 1; document.getElementById('setup').classList.remove('on');
      tab = 'wo'; sel = today(); exOpen = 0; render();
      const t = document.querySelector('#exl .ex[data-j="0"] .pr-nt-t');
      return { есть: !!t, текст: t ? t.value : '', skin: document.documentElement.dataset.skin };
    });
    chk(послеПерезагрузки.есть && послеПерезагрузки.текст === ЗАМЕТКА,
      '12. заметка пережила перезагрузку и видна в карточке',
      послеПерезагрузки.текст.slice(0, 30) + '…');

    const вДругомДне = await p.evaluate(([ds, j]) => {
      sel = ds; exOpen = j; editPast = false; render();
      const c = document.querySelector('#exl .ex[data-j="' + j + '"]');
      const t = c ? c.querySelector('.pr-nt-t') : null;
      return { день: ds, имя: c ? c.querySelector('.exname').textContent : '',
        текст: t ? t.value : null };
    }, [seed.другой, seed.jдр]);
    chk(вДругомДне.имя === seed.nm && вДругомДне.текст === ЗАМЕТКА,
      '13. то же упражнение в другом дне показывает ту же заметку',
      вДругомДне.день + ' · ' + вДругомДне.имя);

    /* ---------- 14-15. старая копия без поля exNote ---------- */
    const былоОшибок = errs.length;
    await p.evaluate(() => {
      const raw = JSON.parse(localStorage.getItem('sys-gym-v3'));
      delete raw.exNote;                       // копия снята до появления фишки
      localStorage.setItem('sys-gym-v3', JSON.stringify(raw));
    });
    await p.reload(); await p.waitForTimeout(1500);
    const старая = await p.evaluate(() => {
      S.setup = 1; document.getElementById('setup').classList.remove('on');
      tab = 'wo'; sel = today(); exOpen = 0; render();
      const c = document.querySelector('#exl .ex[data-j="0"]');
      const t = c ? c.querySelector('.pr-nt-t') : null;
      return { карточка: !!c, поле: !!t, текст: t ? t.value : null,
        поля: !!(c && c.querySelector('[data-f="w"]')) };
    });
    chk(старая.карточка && старая.поля && errs.length === былоОшибок,
      '14. состояние без поля exNote не роняет приложение',
      errs.slice(былоОшибок).join(' | ') || 'без ошибок');
    await p.fill('#exl .ex[data-j="0"] .pr-nt-t', 'после старой копии');
    await p.waitForTimeout(300);
    const новаяЗаметка = await p.evaluate(() => { flush();
      return (S.exNote || {})[dayOf(today()).ex[0].n] || ''; });
    chk(старая.поле && старая.текст === '' && новаяЗаметка === 'после старой копии',
      '15. поле заметки на старой копии пустое и снова пишется', новаяЗаметка);

    /* ---------- 16. длинная заметка на 320 px ---------- */
    await p.setViewportSize({ width: 320, height: 640 });
    await p.evaluate(t => {
      S.exNote[dayOf(today()).ex[0].n] = t; save(); flush();
      tab = 'wo'; sel = today(); exOpen = 0; render();
    }, ДЛИННАЯ);
    await p.waitForTimeout(350);
    const вёрстка = await p.evaluate(() => {
      const c = document.querySelector('#exl .ex[data-j="0"]');
      const t = c.querySelector('.pr-nt-t');
      const rt = t.getBoundingClientRect(), rc = c.getBoundingClientRect();
      return { ширина: document.documentElement.scrollWidth,
        тело: document.body.scrollWidth,
        лево: Math.round(rt.left), право: Math.round(rt.right),
        высота: Math.round(rt.height), карточка: Math.round(rc.right),
        длина: t.value.length, вширь: t.scrollWidth - t.clientWidth };
    });
    chk(вёрстка.длина === 500 && вёрстка.ширина <= 320 && вёрстка.тело <= 320
      && вёрстка.лево >= 0 && вёрстка.право <= 320 && вёрстка.карточка <= 320
      && вёрстка.высота <= 140 && вёрстка.вширь <= 1,
      '16. заметка в 500 знаков не вылезает за края на 320 px', JSON.stringify(вёрстка));
    await p.setViewportSize({ width: 390, height: 844 });

    chk(errs.length === 0, '17. без ошибок в консоли', [...new Set(errs)].join(' | ') || 'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпровалено: ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
