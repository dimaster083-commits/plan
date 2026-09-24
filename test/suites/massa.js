/* Массовый выпуск: новый человек не получает чужих цифр, без веса тела
   настройка не закрывается, без своих весов старт считается от веса тела;
   напоминание о копии приходит, только когда есть что терять. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const chk = (ok, name, info = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '   → ' + info : '')); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(APP); await page.waitForTimeout(1200);

  const f = await page.evaluate(() => ({ on: $('setup').classList.contains('on'),
    vals: [...document.querySelectorAll('#setupRows input'), $('anH'), $('anBw'), $('anGoal')].map(x => x.value),
    note: !!document.querySelector('.setnote') }));
  chk(f.on, 'первый запуск открывает настройку');
  chk(f.vals.every(v => v === ''), 'в первой настройке нет чужих цифр', f.vals.join(','));
  chk(f.note, 'есть предупреждение о хранении и о том, что это не медицинский совет');

  await page.click('#setOk');
  await page.waitForTimeout(150);
  chk(await page.evaluate(() => $('setup').classList.contains('on') && !S.setup), 'без веса тела настройка не закрывается');

  await page.fill('#anBw', '80');
  await page.dispatchEvent('#anBw', 'input');
  await page.click('#setOk');
  await page.waitForTimeout(300);
  const s = await page.evaluate(() => ({ setup: S.setup, a: S.anchors, goal: num($('anGoal').value), open: $('setup').classList.contains('on') }));
  chk(s.setup && !s.open, 'с одним весом тела настройка закрывается');
  chk(s.a.b === 40 && s.a.s === 47.5 && s.a.d === 55, 'осторожный старт от веса тела 80 кг', JSON.stringify(s.a));
  chk(s.goal === 80, 'пустая цель — держать нынешний вес', String(s.goal));

  // есть что терять и копии давно не было — после перезагрузки спросит
  await page.evaluate(() => {
    for (let i = 1; i <= 3; i++) { const d = new Date(); d.setDate(d.getDate() - i * 2);
      const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
      recRW(z.toISOString().slice(0, 10)).wo = 1; }
    S.bkAt = 0; S.bkAsk = 0; flush();
  });
  await page.reload(); await page.waitForTimeout(3200);
  const ask1 = await page.evaluate(() => $('ask').classList.contains('on') && /копи/i.test($('askT').textContent));
  chk(ask1, 'три тренировки без копии — предлагает сохранить');
  await page.click('#askN');
  await page.reload(); await page.waitForTimeout(3200);
  chk(await page.evaluate(() => !$('ask').classList.contains('on')), 'отказался — неделю не переспрашивает');
  // новичок не зовётся охотником; классы и ранги как в первоисточниках
  const lv = await page.evaluate(() => {
    const out = { sl1: jobOf(1), sl5: jobOf(5), sl17: jobOf(17), sl40: jobOf(40), r60: rankTitle(60), r1: rankTitle(1) };
    S.xp = 16 * PER; render(); levelUp(17);
    out.up = $('lvup').querySelector('b').textContent; out.upR = $('lvupR').textContent;
    void 0; render();
    out.h1 = $('st8job').textContent;
    return out;
  });
  chk(lv.sl1 === 'Пробуждённый' && lv.sl5 === 'Охотник' && lv.sl17 === 'Некромант' && lv.sl40 === 'Монарх теней',
    'Система: пробуждённый → охотник → некромант → Монарх теней', JSON.stringify(lv));
  chk(lv.r1 === 'РАНГ E' && lv.r60 === 'НАЦ. УРОВЕНЬ', 'ранги E…S и национальный уровень');
  chk(lv.up === 'СМЕНА КЛАССА' && lv.upR === 'НЕКРОМАНТ', 'смена класса — своё окно', lv.up + ' / ' + lv.upR);
  chk(lv.h1 === 'Некромант', 'заголовок карточки — класс по уровню', lv.h1);
  chk(!errs.length, 'без ошибок страницы', errs.join('; '));
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(err => { console.log('FATAL ' + err.message); process.exit(1); });
