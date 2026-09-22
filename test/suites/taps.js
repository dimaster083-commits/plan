/* Быстрый второй тап не должен повторно записывать упражнение или подход. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const chk = (ok, name, info = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '   → ' + info : '')); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(APP); await page.waitForTimeout(1200);
  await page.evaluate(() => {
    S.setup = 1; $('setup').classList.remove('on');
    const d = dayOf(today());
    if (d.t === 'rest') { const src = S.days.find(x => x.ex && x.ex.length); d.t = src.t; d.ex = src.ex.map(x => ({...x})); }
    tab = 'wo'; sel = today(); render();
  });
  const before = await page.evaluate(() => dayOf(sel).ex.length);
  await page.click('#addEx');
  // Два touch-события приходят до следующей перерисовки; программный click
  // повторяет именно этот короткий интервал без ожидания уже закрытой шторки.
  await page.evaluate(() => {
    const pick = document.querySelector('[data-addex]');
    pick.click(); pick.click();
  });
  await page.waitForTimeout(250);
  const after = await page.evaluate(() => dayOf(sel).ex.length);
  chk(after === before + 1, 'двойной тап добавляет упражнение один раз', `${before} → ${after}`);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(err => { console.log('FATAL ' + err.message); process.exit(1); });
