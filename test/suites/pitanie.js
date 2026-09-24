/* Питание и темп по исследованиям: поддержание по Миффлину — Сан Жеору,
   набор +12 %, снижение −20 %; коридоры 0,25–0,5 % (набор) и 0,5–1 %
   (снижение) массы в неделю; темп — наклон по всем замерам, а не два
   крайних; поправка калорий от разрыва, шагом 100–400. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const chk = (ok, name, info = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '   → ' + info : '')); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(APP); await page.waitForTimeout(1000);
  const r = await page.evaluate(() => {
    S.setup = 1; $('setup').classList.remove('on'); S.kcManual = 0;
    S.bw = '80'; S.height = 180; S.age = 30; S.sex = 'm';
    const m80 = maintOf(80);                       // (800+1125-150+5)*1.45 = 2581
    S.sex = 'f'; const f80 = maintOf(80); S.sex = 'm';
    // цель — средняя за неделю: дни тренировки и отдыха вместе (4 и 3 в шаблоне)
    const wk = () => { const wo = S.days.filter(d => d.t !== 'rest').length;
      return { kc: (wo * num(nutriFor('up1').kc) + (7 - wo) * num(nutriFor('rest').kc)) / 7 }; };
    S.goal = '90'; const up = wk(); const gainR = paceRange();
    S.goal = '70'; const dn = wk(); const lossR = paceRange();
    S.goal = '80'; const keep = wk();
    // вес скачет от воды: 80, 81,5, 80,2, 80,9 за три недели — прямая, а не два края
    const noisy = paceOf([['2026-09-01', 80], ['2026-09-08', 81.5], ['2026-09-15', 80.2], ['2026-09-22', 80.9]]);
    S.goal = '90';
    const small = kcalFix(gainR[0] + gainR[1] ? (gainR[0] + gainR[1]) / 2 - 0.05 : 0);
    const big = kcalFix(-1);
    return { m80, f80, up: +up.kc, dn: +dn.kc, keep: +keep.kc, gainR, lossR, noisy, small, big };
  });
  chk(Math.abs(r.m80 - 2581) < 2, 'поддержание по Миффлину — Сан Жеору, мужчина 80 кг 180 см 30 лет', Math.round(r.m80) + '');
  chk(r.m80 - r.f80 > 230 && r.m80 - r.f80 < 250, 'для женщины поддержание ниже на 166×1,45', Math.round(r.m80 - r.f80) + '');
  chk(Math.abs(r.up - Math.round(r.m80 * 1.12 / 10) * 10) <= 10, 'набор: +12 % к поддержанию в среднем за неделю', r.up + '');
  chk(Math.abs(r.dn - Math.round(r.m80 * 0.8 / 10) * 10) <= 10, 'снижение: −20 % в среднем за неделю', r.dn + '');
  chk(Math.abs(r.keep - Math.round(r.m80 / 10) * 10) <= 10, 'удержание: ровно поддержание в среднем за неделю', r.keep + '');
  chk(Math.abs(r.gainR[0] - 0.2) < 1e-9 && Math.abs(r.gainR[1] - 0.4) < 1e-9, 'коридор набора 0,25–0,5 % массы', JSON.stringify(r.gainR));
  chk(Math.abs(r.lossR[0] + 0.8) < 1e-9 && Math.abs(r.lossR[1] + 0.4) < 1e-9, 'коридор снижения 0,5–1 % массы', JSON.stringify(r.lossR));
  // два крайних замера дали бы +0,3 кг/нед; наклон по всем — около +0,15
  chk(r.noisy && r.noisy.per > 0.05 && r.noisy.per < 0.25, 'темп — наклон по всем замерам, а не два крайних', r.noisy && r.noisy.per.toFixed(3));
  chk(r.small.k === 100 && r.small.add, 'мелкий разрыв — поправка не меньше 100 ккал', JSON.stringify(r.small));
  chk(r.big.k === 400 && r.big.add, 'большой разрыв — поправка не больше 400 ккал', JSON.stringify(r.big));
  const calc = await page.evaluate(() => {
    S.goal = '90'; tab = 'prog'; pSec = 'goal'; render();
    return { txt: $('calcBox').textContent, m: String(Math.round(maintOf(num(S.bw)))), kc: nutriFor('up1').kc };
  });
  chk(calc.txt.includes(calc.m) && calc.txt.includes(calc.kc) && /0,2.*0,4/.test(calc.txt),
    'калькулятор показывает поддержание, норму и коридор теми же цифрами', calc.txt.slice(0, 120));
  chk(!errs.length, 'без ошибок страницы', errs.join('; '));
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(err => { console.log('FATAL ' + err.message); process.exit(1); });
