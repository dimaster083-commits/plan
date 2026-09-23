/* Одним нажатием: пустой день повторяет рацион последнего дня с едой,
   «Принял всё» отмечает все добавки и не начисляет опыт дважды. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const chk = (ok, name, info = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '   → ' + info : '')); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(APP); await page.waitForTimeout(1000);
  await page.evaluate(() => {
    S.setup = 1; $('setup').classList.remove('on');
    const d = new Date(); d.setDate(d.getDate() - 2);
    const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
    const ds = z.toISOString().slice(0, 10);
    recRW(ds).ml = [{ n: 'Завтрак', note: '', items: [{ p: 'Овсянка на воде готовая', g: '250' }] }];
    save(); tab = 'food'; sel = today(); render();
  });

  const shown = await page.evaluate(() => !$('cpLast').hidden && $('cpLast').textContent);
  chk(!!shown && /Повторить рацион/.test(shown), 'в пустом дне есть кнопка повтора рациона', String(shown));
  await page.click('#cpLast');
  await page.waitForTimeout(200);
  const copied = await page.evaluate(() => ({ n: mealsOf(sel).length, k: daySum(sel).k, hid: $('cpLast').hidden }));
  chk(copied.n === 1 && copied.k > 0, 'нажатие копирует рацион в сегодня', JSON.stringify(copied));
  chk(copied.hid, 'после заполнения кнопка прячется');

  const sp = await page.evaluate(() => {
    const r = recRW(sel); r.sp = { 0: 1 }; save(); paintSupp();
    return { n: dayOf(sel).sp.length, xp: S.xp, hid: $('spAll').hidden };
  });
  chk(sp.n > 1 && !sp.hid, '«Принял всё» видна, пока не всё отмечено');
  await page.click('#spAll');
  await page.waitForTimeout(150);
  const after = await page.evaluate(() => ({ marked: Object.keys(recOf(sel).sp).length, xp: S.xp, hid: $('spAll').hidden, xpSp: XP_SP }));
  chk(after.marked === sp.n, 'отмечены все добавки', after.marked + ' из ' + sp.n);
  chk(after.xp - sp.xp === (sp.n - 1) * after.xpSp, 'опыт только за неотмеченные', (after.xp - sp.xp) + '');
  chk(after.hid, 'когда всё отмечено, кнопка прячется');
  chk(!errs.length, 'без ошибок страницы', errs.join('; '));
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(err => { console.log('FATAL ' + err.message); process.exit(1); });
