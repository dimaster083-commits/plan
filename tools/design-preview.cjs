/* Reproducible UI review with synthetic data; never touches a user's profile. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../test/env');
const path = require('node:path');
const fs = require('node:fs');
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(APP); await page.waitForTimeout(1400);
    await page.evaluate(() => {
      S.setup = 1; S.sound = 0; S.rec = {}; S.pr = {}; S.start = mondayOf(today());
      document.getElementById('setup').classList.remove('on');
      const d = dayOf(today()); d.t = 'up1'; d.s = 'Сила · верх тела';
      d.ex = [
        { n: 'Жим лёжа', s: 3, r: '8-10', w: 60, g: 'Грудь' },
        { n: 'Тяга верхнего блока', s: 3, r: '10-12', w: 50, g: 'Спина' },
        { n: 'Жим гантелей сидя', s: 3, r: '8-10', w: 18, g: 'Плечи' }
      ];
      const prev = addDays(today(), -7);
      S.rec[prev] = { wo: 1, sp: {}, log: { 0: { ...d.ex[0], done: 1, rs: [10, 9, 8], ws: [60, 62.5, 65] } } };
      S.rec[addDays(today(), -1)] = { wo: 1, sp: {}, log: { 0: { ...d.ex[1], done: 1, rs: [12, 12, 10] } } };
      entCache = null; save(); tab = 'wo'; sel = today(); exOpen = null; render();
    });
    const out = path.resolve(__dirname, '../test/out'); fs.mkdirSync(out, { recursive: true });
    const prefix = process.argv[2] || 'design';
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      for (const screen of ['gym', 'exercise', 'progress', 'muscles']) {
        await page.evaluate(screen => {
          tab = screen === 'progress' || screen === 'muscles' ? 'prog' : 'wo';
          exOpen = screen === 'exercise' ? 0 : null; render(); window.scrollTo(0, 0);
        }, screen);
        if (screen === 'muscles') await page.locator('#bmapBox').scrollIntoViewIfNeeded();
        await page.waitForTimeout(400);
        await page.screenshot({ path: path.join(out, `${prefix}-${screen}-${width}.png`) });
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
        console.log(`${screen} ${width}: overflow=${overflow}`);
      }
    }
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { tab = 'wo'; exOpen = 0; render(); window.scrollTo(0, 0); });
    await page.screenshot({ path: path.join(out, `${prefix}-reduce-320.png`) });
    console.log('Page errors:', errors);
    if (errors.length) process.exitCode = 1;
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exitCode = 1; });
