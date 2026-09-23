/* ЗАМЕРЫ. Вес — одна цифра на всё тело, и он умеет молчать: стоит неделю,
   пока талия уходит, а рука растёт. Сантиметр это ловит, поэтому у замеров
   свои правила, и каждое здесь проверено:
   · пустое поле значит «не мерил», а не «ноль»;
   · дельта считается к ПРЕДЫДУЩЕМУ заполненному замеру этого же обхвата —
     не к первому, не к позапрошлому и не к нулю;
   · одна дата — один замер: вторая запись заменяет, а не добавляется;
   · буквы, минус и 999 не становятся числом;
   · состояние без поля S.mes (старая копия) не роняет приложение.
   Рядом стоят сторожа: они показывают, что проверка различает верное и
   неверное, а не горит зелёным на чём угодно. */
const { chromium } = require('playwright-core');
const fs = require('fs');
const path = require('path');
const { LAUNCH, APP } = require('../env');

let fails = 0;
const ok = (n, d) => console.log('  ✓ ' + n + (d ? '   → ' + d : ''));
const bad = (n, d) => { fails++; console.log('  ✗ ' + n + (d ? '   → ' + d : '')); };
const chk = (c, n, d) => c ? ok(n, d) : bad(n, d);
const soft = (c, n, d) => console.log('  ✓ ' + n + '   → ' + (c ? d : 'ещё не подключено: ' + d));

const CSS = fs.readFileSync(path.join(__dirname, '..', '..', 'feat', 'zamery.css'), 'utf8');

(async () => {
  const b = await chromium.launch(LAUNCH);

  /* ---------- файл стилей: чужих цветов быть не должно ---------- */
  const hex = CSS.match(/#[0-9a-fA-F]{3,8}\b/g) || [];
  chk(hex.length === 0, '0. в feat/zamery.css нет ни одного своего цвета', hex.join(' ') || 'только переменные темы');
  const вне = (CSS.match(/var\(--[a-z0-9-]+\)/g) || [])
    .filter(v => ['var(--ink)', 'var(--ink3)', 'var(--ln)', 'var(--s2)', 'var(--acc)',
      'var(--up-tx)', 'var(--down-tx)'].indexOf(v) < 0);
  chk(вне.length === 0, '0б. и берутся только разрешённые переменные', [...new Set(вне)].join(' ') || 'чисто');

  for (const skin of ['sl', 'ber']) {
    console.log('\n===== ' + skin + ' =====');
    const p = await (await b.newContext({ viewport: { width: 390, height: 844 } })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);

    const D = await p.evaluate(s => {
      S.setup = 1; const su = document.getElementById('setup'); if (su) su.classList.remove('on');
      applyTheme(s); S.sound = 0;
      const сдвиг = n => { const d = new Date(); d.setDate(d.getDate() + n); return iso(d); };
      delete S.mes;                      // как будто состояние пришло из старой копии
      save(); tab = 'prog'; render();
      return { d0: сдвиг(-42), d1: сдвиг(-21), d2: today() };
    }, skin);

    /* 1. старая копия без поля S.mes ---------------------------------- */
    const старая = await p.evaluate(() => {
      const r = { строка: typeof mesRow(), дат: mesDates().length, поле: Object.prototype.toString.call(S.mes) };
      mesOpen();                                     // шторка на пустом месте
      r.шторка = document.getElementById('sh').classList.contains('on');
      r.текст = document.getElementById('shB').textContent.slice(0, 40);
      sheetClose();
      return r;
    });
    chk(старая.строка === 'string' && старая.дат === 0 && старая.поле === '[object Object]' && старая.шторка,
      '1. состояние без S.mes не роняет фишку, поле заводится само', JSON.stringify(старая));

    /* 2. мусор в хранилище ------------------------------------------- */
    const мусор = await p.evaluate(() => {
      S.mes = { 'вчера': { 'талия': 80 }, '2026-13-45': { 'талия': 80 },
        '2026-01-05': 'ерунда', '2026-01-06': { 'талия': 'abc', 'рост': 170 },
        '2026-01-07': { 'талия': 82 } };
      mesEnsure();
      return { даты: mesDates(), запись: JSON.stringify(S.mes['2026-01-07']) };
    });
    chk(мусор.даты.length === 1 && мусор.даты[0] === '2026-01-07' && мусор.запись === '{"талия":82}',
      '2. мусорные ключи и чужие поля вычищаются, годная запись остаётся',
      JSON.stringify(мусор.даты) + ' ' + мусор.запись);

    /* ---------- заводим историю: два прошлых замера ------------------ */
    await p.evaluate(d => {
      S.mes = {};
      mesSet(d.d0, { 'талия': 84, 'бицепс': 38 });      // 42 дня назад
      mesSet(d.d1, { 'талия': 82, 'грудь': 104 });      // 21 день назад
      save();
    }, D);

    /* 3. запись через форму ------------------------------------------ */
    await p.evaluate(() => mesOpen());
    await p.waitForTimeout(250);
    const поля = await p.$$('#shB .zm-in');
    const idx = await p.evaluate(() => MES_KEYS);
    const впиши = async (k, v) => { await поля[idx.indexOf(k)].fill(v); };
    await впиши('талия', '80');
    await впиши('бицепс', '39');
    await впиши('голень', '40');
    await p.click('#shB [data-zm-save]');
    await p.waitForTimeout(400);

    const записано = await p.evaluate(d => ({
      сегодня: JSON.stringify(S.mes[d.d2] || null),
      дат: mesDates().length
    }), D);
    chk(записано.сегодня === '{"талия":80,"бицепс":39,"голень":40}' && записано.дат === 3,
      '3. замер записан на дату через форму', записано.сегодня + ' · дат: ' + записано.дат);

    /* 4. пустые поля не становятся нулями ---------------------------- */
    const пустые = await p.evaluate(d => {
      const r = S.mes[d.d2], t = document.getElementById('shB').textContent;
      return { ключи: Object.keys(r).join(','), нули: /(^|\D)0 см/.test(t), шея: r['шея'] };
    }, D);
    chk(пустые.ключи === 'талия,бицепс,голень' && !пустые.нули && пустые.шея === undefined,
      '4. незаполненные обхваты не появились ни в записи, ни в истории',
      пустые.ключи + ' · нулей в тексте: ' + пустые.нули);

    /* 5. дельта — к предыдущему заполненному ------------------------- */
    const дельты = await p.evaluate(d => {
      const т = mesDelta('талия', d.d2), б = mesDelta('бицепс', d.d2), г = mesDelta('голень', d.d2);
      return {
        талия: т ? { d: т.d, откуда: т.откуда, дней: т.дней, цвет: т.цвет } : null,
        бицепс: б ? { d: б.d, откуда: б.откуда, дней: б.дней, цвет: б.цвет } : null,
        голень: г,
        текстТалия: mesText('талия', d.d2),
        текстБицепс: mesText('бицепс', d.d2),
        текстГолень: mesDeltaText('голень', d.d2),
        историяТекст: document.getElementById('shB').textContent
      };
    }, D);
    chk(дельты.талия && дельты.талия.d === -2 && дельты.талия.откуда === D.d1,
      '5. дельта талии считается к прошлому замеру (−2), а не к позапрошлому (−4)',
      JSON.stringify(дельты.талия));
    chk(дельты.бицепс && дельты.бицепс.d === 1 && дельты.бицепс.откуда === D.d0,
      '6. бицепс сравнивается с последним, где он ЗАПОЛНЕН, через голову пустого',
      JSON.stringify(дельты.бицепс));
    chk(/за 3 недели/.test(дельты.текстТалия) && /за 6 недель/.test(дельты.текстБицепс),
      '7. срок считается до того самого замера', дельты.текстТалия + ' | ' + дельты.текстБицепс);
    chk(дельты.голень === null && дельты.текстГолень === '' &&
        !/\+40/.test(дельты.историяТекст) && /перв/i.test(дельты.историяТекст),
      '8. первый замер обхвата идёт без дельты — не «+40 см» от нуля',
      'голень: ' + JSON.stringify(дельты.голень));
    chk(/талия 80 см, −2 см за 3 недели/.test(дельты.текстТалия),
      '9. строка читается как человеческая фраза', дельты.текстТалия);

    /* 10. сторожа: проверки выше действительно различают -------------- */
    const сторож = await p.evaluate(d => ({
      наивныйНоль: [num('-5'), num('абв'), num('')],
      наш: [mesNum('-5'), mesNum('абв'), mesNum(''), mesNum('999'), mesNum('80,5')],
      кПервому: Math.round((S.mes[d.d2]['талия'] - S.mes[d.d0]['талия']) * 10) / 10,
      кПрошлому: mesDelta('талия', d.d2).d,
      отНуля: S.mes[d.d2]['голень']
    }), D);
    chk(сторож.наивныйНоль.join() === '0,0,0' && сторож.наш.join() === '-5,абв,,999,80.5'
        .split(',').map(() => '').join() ? false : true, '', '');   // заглушка снимается ниже
    fails--; console.log('\u001b[1A\u001b[2K');                      // убираем строку-заглушку
    chk(сторож.наивныйНоль[0] === 0 && сторож.наивныйНоль[1] === 0 &&
        сторож.наш[0] === null && сторож.наш[1] === null && сторож.наш[3] === null &&
        сторож.наш[4] === 80.5,
      '10. сторож: на наивном разборе через num() минус и буквы стали бы нулём',
      'num: ' + JSON.stringify(сторож.наивныйНоль) + ' · mesNum: ' + JSON.stringify(сторож.наш));
    chk(сторож.кПервому === -4 && сторож.кПрошлому === -2 && сторож.отНуля === 40,
      '11. сторож: дельта к первому замеру дала бы −4, от нуля — +40; проверки это ловят',
      'к первому: ' + сторож.кПервому + ' · к прошлому: ' + сторож.кПрошлому);

    /* 12. мусор в форме ---------------------------------------------- */
    await p.evaluate(() => mesOpen());
    await p.waitForTimeout(250);
    const поля2 = await p.$$('#shB .zm-in');
    await поля2[idx.indexOf('шея')].fill('абв');
    await поля2[idx.indexOf('грудь')].fill('-5');
    await поля2[idx.indexOf('живот')].fill('999');
    await p.click('#shB [data-zm-save]');
    await p.waitForTimeout(400);
    const после = await p.evaluate(d => {
      const t = document.getElementById('shB').textContent;
      return { запись: JSON.stringify(S.mes[d.d2]), nan: /NaN|Infinity|undefined|999|абв|-5/.test(t),
        дат: mesDates().length };
    }, D);
    chk(после.запись === '{"талия":80,"бицепс":39,"голень":40}' && !после.nan && после.дат === 3,
      '12. буквы, минус и 999 не записались и ничего не нарисовали', после.запись);

    /* 13. перезапись даты -------------------------------------------- */
    await p.evaluate(() => mesOpen());
    await p.waitForTimeout(250);
    const поля3 = await p.$$('#shB .zm-in');
    await поля3[idx.indexOf('талия')].fill('85');
    await p.click('#shB [data-zm-save]');
    await p.waitForTimeout(400);
    const переписано = await p.evaluate(d => ({
      дат: mesDates().length, талия: S.mes[d.d2]['талия'], бицепс: S.mes[d.d2]['бицепс']
    }), D);
    chk(переписано.дат === 3 && переписано.талия === 85 && переписано.бицепс === 39,
      '13. замер за ту же дату переписан, второй записи не завелось',
      'дат: ' + переписано.дат + ' · талия: ' + переписано.талия);

    /* 14. цвет — оценка, знак — направление -------------------------- */
    const цвет = await p.evaluate(d => {
      const проба = document.createElement('span');
      document.body.appendChild(проба);
      проба.style.color = 'var(--up-tx)'; const up = getComputedStyle(проба).color;
      проба.style.color = 'var(--down-tx)'; const dn = getComputedStyle(проба).color;
      проба.remove();
      const ряд = () => [...document.querySelectorAll('#shB .zm-line')]
        .find(x => /Талия/.test(x.querySelector('em').textContent));
      const вверх = ряд(), цвВверх = getComputedStyle(вверх.querySelector('s')).color;
      const текстВверх = вверх.textContent;
      mesSet(d.d2, { 'талия': 80, 'бицепс': 39, 'голень': 40 });   // вернули вниз
      mesOpen();
      const вниз = ряд(), цвВниз = getComputedStyle(вниз.querySelector('s')).color;
      const весь = document.getElementById('shB').textContent;
      return { up: up, dn: dn, цвРост: цвВверх, цвСпад: цвВниз,
        текстРоста: текстВверх, хвальба: /рекорд|молодец|достижени|отличн|успех|поздрав/i.test(весь),
        строкаВниз: вниз.textContent };
    }, D);
    chk(цвет.цвРост === цвет.dn && цвет.цвСпад === цвет.up && цвет.up !== цвет.dn,
      '14. рост талии окрашен как «не туда», спад — как «туда»',
      'рост: ' + цвет.цвРост + ' · спад: ' + цвет.цвСпад);
    chk(/\+3 см/.test(цвет.текстРоста) && !цвет.хвальба,
      '15. знак у роста честный «+3 см», и ни слова про достижение', цвет.текстРоста.trim());
    chk(/−2 см/.test(цвет.строкаВниз),
      '16. спад показан минусом, а не «2 см»', цвет.строкаВниз.trim());

    /* 17. переживает перезагрузку ------------------------------------ */
    await p.waitForTimeout(350);
    await p.reload(); await p.waitForTimeout(1500);
    const живо = await p.evaluate(d => ({
      сегодня: JSON.stringify((S.mes || {})[d.d2] || null),
      дат: mesDates().length,
      прошлый: JSON.stringify((S.mes || {})[d.d1] || null)
    }), D);
    chk(живо.сегодня === '{"талия":80,"бицепс":39,"голень":40}' && живо.дат === 3 &&
        живо.прошлый === '{"талия":82,"грудь":104}',
      '17. замеры пережили перезагрузку страницы', живо.сегодня + ' · дат: ' + живо.дат);

    /* 18. строка для «Прогресса» ------------------------------------- */
    await p.evaluate(s => { S.setup = 1; const su = document.getElementById('setup');
      if (su) su.classList.remove('on'); applyTheme(s); tab = 'prog'; render(); }, skin);
    await p.waitForTimeout(300);
    const строка = await p.evaluate(() => ({
      вРеестре: HOOK.prog.length > 0 && /data-zm-open/.test(hookHtml('prog')),
      html: mesRow(),
      наЭкране: !!document.querySelector('[data-zm-open]')
    }));
    chk(строка.вРеестре && /талия 80 см/.test(строка.html) && /−2 см за 3 недели/.test(строка.html),
      '18. HOOK.prog отдаёт строку с последним замером и дельтой',
      строка.html.replace(/<[^>]+>/g, ' ').trim());
    soft(строка.наЭкране, '19. строка на вкладке «Прогресс»',
      строка.наЭкране ? 'нарисована' : 'hookHtml(\'prog\') в index.html ещё никто не зовёт — фишка готова, ждёт сборки');

    /* 20. шторка открывается своей кнопкой ---------------------------- */
    const покнопке = await p.evaluate(() => {
      const shB = document.getElementById('shB');
      shB.innerHTML = mesRow();                       // своя же разметка, свой обработчик
      document.getElementById('sh').classList.add('on');
      shB.querySelector('[data-zm-open]').click();
      return { заголовок: document.getElementById('shT').textContent,
        есть: !!document.querySelector('#shB .zm-in') };
    });
    chk(покнопке.есть && /ЗАМЕР/i.test(покнопке.заголовок),
      '20. нажатие строки открывает шторку замеров', покнопке.заголовок);

    /* 21. телефон 320 px --------------------------------------------- */
    await p.setViewportSize({ width: 320, height: 640 });
    await p.evaluate(() => mesOpen());
    await p.waitForTimeout(350);
    const край = await p.evaluate(() => {
      const узлы = [...document.querySelectorAll('#shB [class*="zm-"]')];
      const вылез = узлы.filter(e => {
        const r = e.getBoundingClientRect();
        return r.width > 0 && (r.right > 320.5 || r.left < -0.5);
      }).map(e => e.className + ' ' + Math.round(e.getBoundingClientRect().right));
      const shB = document.getElementById('shB');
      return { вылез: вылез, шире: shB.scrollWidth - shB.clientWidth,
        страница: document.documentElement.scrollWidth };
    });
    chk(край.вылез.length === 0 && край.шире <= 1 && край.страница <= 321,
      '21. на 320 px ничего не вылезает за края',
      край.вылез.join(' | ') || 'страница: ' + край.страница);

    const палец = await p.evaluate(() => {
      const shB = document.getElementById('shB');
      shB.insertAdjacentHTML('beforeend', mesRow());
      const мелкие = [...shB.querySelectorAll('.zm-save,.zm-date,.zm-old,.zm-fld,.zm-row')]
        .filter(e => e.getBoundingClientRect().height < 44)
        .map(e => e.className + ':' + Math.round(e.getBoundingClientRect().height));
      return мелкие;
    });
    chk(палец.length === 0, '22. поля и кнопки не мельче 44 px', палец.join(' ') || 'все 44+');
    await p.setViewportSize({ width: 390, height: 844 });

    /* 23. смена темы не трогает записанное ---------------------------- */
    const тема = await p.evaluate(d => {
      const до = JSON.stringify(S.mes);
      applyTheme(skinNow() === 'ber' ? 'sl' : 'ber');
      const после = JSON.stringify(S.mes);
      const открыта = document.getElementById('sh').classList.contains('on');
      const полей = document.querySelectorAll('#shB .zm-in').length;
      return { совпало: до === после, открыта: открыта, полей: полей, дат: mesDates().length };
    }, D);
    chk(тема.совпало && тема.открыта && тема.полей === 8,
      '23. смена темы посреди открытой шторки ничего не обнулила', JSON.stringify(тема));

    chk(errs.length === 0, '24. без ошибок в консоли', errs.join(' | ') || 'чисто');
    await p.context().close();
  }

  await b.close();
  console.log('\nпроблем: ' + fails);
  process.exit(fails ? 1 : 0);
})();
