/* Oct 03 mobile audit regressions: real keyboard/modal behavior and rendered
   touch targets. Each check names the missing user-visible behavior it guards.
   Isolated Chromium context and synthetic journal; no real profile is opened. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
function check(value, name, detail) {
  if (!value) fails++;
  console.log(`  ${value ? '✓' : '✗'} ${name}${detail ? ' → ' + JSON.stringify(detail) : ''}`);
}
const activeInside = (page, id) => page.evaluate(id => !!document.activeElement.closest('#' + id), id);
// Inspect actual visible keyboard stops, then exercise the boundary with a real key.
async function cycle(page, id, backwards) {
  const stops = page.locator('#' + id).locator('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]');
  const visible = [];
  for (let i = 0; i < await stops.count(); i++) if (await stops.nth(i).isVisible()) visible.push(stops.nth(i));
  if (!visible.length) return false;
  await (backwards ? visible[0] : visible[visible.length - 1]).focus();
  await page.keyboard.press(backwards ? 'Shift+Tab' : 'Tab');
  return (backwards ? visible[visible.length - 1] : visible[0]).evaluate(e => e === document.activeElement);
}
// A pointer-only div cannot pass: reach it through normal Tab navigation.
async function keyboardReach(page, selector) {
  await page.evaluate(() => { document.activeElement.blur(); window.scrollTo(0, 0); });
  for (let i = 0; i < 90; i++) {
    await page.keyboard.press('Tab');
    if (await page.evaluate(s => document.activeElement.matches(s), selector)) return true;
  }
  return false;
}
function seed() {
  S.setup = 1; S.sound = 0; S.bw = 72; S.hints = 1;
  S.rec = {}; S.map = {}; S.start = mondayOf(today());
  S.days = build().days;
  document.getElementById('setup').classList.remove('on');
  const d = dayOf(today());
  d.t = 'up1'; d.s = 'Сила · верх тела';
  d.ex = [{ n: 'Жим лёжа', s: 3, r: '8-10', w: 60, g: 'Грудь' }];
  entCache = null; save(); tab = 'wo'; sel = today(); exOpen = null; render();
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(APP);
    await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
    // Initial setup is scheduled after boot; wait for that real state before seeding.
    await page.waitForSelector('#setup.on');
    await page.evaluate(seed);

    // Removing keyboard activation from exercise cards must fail this path.
    const gymReach = await keyboardReach(page, '.exrow[data-open]');
    if (gymReach) await page.keyboard.press('Enter');
    check(gymReach && await page.locator('.exf').isVisible(), 'Зал: Tab и Enter открывают упражнение', { reachable: gymReach });
    await page.evaluate(() => { exOpen = null; render(); });
    for (const width of [320, 390, 414]) {
      await page.setViewportSize({ width, height: width === 320 ? 568 : width === 390 ? 844 : 896 });
      const rect = await page.locator('#dnm').boundingBox();
      check(rect && rect.width >= 44 && rect.height >= 44, `Название дня: цель не меньше 44×44 на ${width}`, rect);
    }
    await page.setViewportSize({ width: 320, height: 568 });

    // Infinite shadow/background animation remains costly even when visually subtle.
    const paint = await page.evaluate(() => document.getAnimations().filter(a => {
      const e = a.effect, t = e && e.target;
      return t && t.closest('.fin') && e.getTiming().iterations === Infinity &&
        e.getKeyframes().some(k => ['boxShadow', 'backgroundPosition', 'backgroundPositionX', 'filter', 'width', 'height'].some(p => p in k));
    }).map(a => ({ name: a.animationName, target: a.effect.target.id, iterations: 'Infinity' })));
    check(!paint.length, 'CTA: нет бесконечной анимации paint-свойств', paint);

    await page.locator('[data-tab="ex"]').click();
    await page.waitForSelector('.lcard[data-lib]');
    const libReach = await keyboardReach(page, '.lcard[data-lib]');
    if (libReach) await page.keyboard.press('Enter');
    check(libReach && await page.locator('#sh.on .lmap').isVisible(), 'Каталог: Tab и Enter открывают страницу упражнения', { reachable: libReach });
    await page.evaluate(() => sheetClose());

    // Actual opener click must focus modal content and retain focus at both boundaries.
    await page.locator('#exf').click();
    check(await activeInside(page, 'sh'), 'Фильтры: открытие переводит фокус внутрь шторки');
    check(await cycle(page, 'sh', false), 'Фильтры: Tab с последнего элемента возвращается к первому');
    check(await cycle(page, 'sh', true), 'Фильтры: Shift+Tab с первого возвращается к последнему');
    await page.keyboard.press('Escape');
    check(!await page.locator('#sh').evaluate(e => e.classList.contains('on')), 'Фильтры: Escape закрывает шторку');
    check(await page.locator('#exf').evaluate(e => e === document.activeElement), 'Фильтры: после Escape фокус возвращается к кнопке открытия');
    await page.evaluate(() => sheetClose());

    const hint = page.locator('#scr-ex [data-hint="lib"]').first();
    await hint.click();
    check(await activeInside(page, 'hsh'), 'Подсказка: открытие переводит фокус внутрь');
    check(await cycle(page, 'hsh', false), 'Подсказка: Tab не выходит на фон');
    check(await cycle(page, 'hsh', true), 'Подсказка: Shift+Tab не выходит на фон');
    await page.keyboard.press('Escape');
    check(await page.locator('#hsh').evaluate(e => e.hidden), 'Подсказка: Escape закрывает окно');
    check(await hint.evaluate(e => e === document.activeElement), 'Подсказка: после Escape фокус возвращается к кнопке открытия');

    // Missing focus handoff leaves keys on the lower sheet; missing restoration
    // leaves focus on the hidden Cancel button after dismissing confirmation.
    // Use the actual unsaved-measurements exit, not a replacement ask handler.
    await page.evaluate(() => openMeas());
    await page.locator('[data-mk="waist"]').fill('80');
    await page.locator('#shX').click();
    await page.waitForSelector('#ask.on');
    check(await activeInside(page, 'ask'), 'Незаписанные замеры: подтверждение получает фокус');
    await page.locator('#askN').click();
    check(await page.locator('#shX').evaluate(e => e === document.activeElement),
      'Незаписанные замеры: Отмена возвращает фокус на закрытие нижней шторки');
    check(await page.locator('#sh').evaluate(e => e.classList.contains('on')) &&
      await page.locator('[data-mk="waist"]').inputValue() === '80',
      'Незаписанные замеры: после Отмены шторка и введённое значение сохраняются');
    // Close through the real confirmation before continuing independent checks.
    await page.locator('#shX').click();
    await page.locator('#askY').click();

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.evaluate(() => { tab = 'wo'; exOpen = 0; render(); });
    const reduced = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    check(reduced === 0, 'Уменьшение движения: упражнение остаётся статичным', { running: reduced });
    check(errors.length === 0, 'Нет ошибок JavaScript', errors);
    await context.close();
  } finally { await browser.close(); }
  console.log(`mobile-oct03: ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
