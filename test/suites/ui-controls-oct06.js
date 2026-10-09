/* Oct 06: real keyboard navigation and System controls in fresh synthetic
   contexts. Missing picker/photo focus guards, lost pending choices, and
   undersized controls must fail their user-visible paths. */
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let fails = 0;
function check(value, name, detail) {
  if (!value) fails++;
  console.log(`  ${value ? '✓' : '✗'} ${name}${detail ? ' → ' + JSON.stringify(detail) : ''}`);
}
const inside = (page, id) => page.evaluate(id => !!document.activeElement.closest('#' + id), id);
async function cycle(page, id, back) {
  const stops = page.locator('#' + id).locator('button:not([disabled]),input:not([disabled]),textarea:not([disabled]),select:not([disabled]),a[href],[tabindex="0"]');
  const visible = [];
  for (let i = 0; i < await stops.count(); i++) if (await stops.nth(i).isVisible()) visible.push(stops.nth(i));
  if (!visible.length) return false;
  await (back ? visible[0] : visible[visible.length - 1]).focus();
  await page.keyboard.press(back ? 'Shift+Tab' : 'Tab');
  return (back ? visible[visible.length - 1] : visible[0]).evaluate(e => e === document.activeElement);
}
async function cooldown(page) {
  await page.waitForFunction(() => performance.now() - lastTap.t >= UNDO_TAP_MS);
}
async function fresh(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 320, height: 568 } });
  const page = await context.newPage();
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(APP);
  await page.waitForSelector('#setup.on');
  await page.evaluate(() => {
    S.setup = 1; S.sound = 0; S.bw = 72; S.hints = 1;
    S.rec = {}; S.start = mondayOf(today()); S.map = {}; S.days = build().days;
    document.getElementById('setup').classList.remove('on');
    sel = today(); tab = 'food';
    recRW(sel).ml = [{ n: 'Завтрак', note: '', items: [] }];
    save(); render();
  });
  return { context, page };
}
async function controls(page, selectors, name) {
  const items = await page.evaluate(selectors => selectors.flatMap(selector =>
    [...document.querySelectorAll(selector)].filter(e => e.getClientRects().length).map(e => {
      const r = e.getBoundingClientRect(), s = getComputedStyle(e);
      return { selector, width: r.width, height: r.height, radius: parseFloat(s.borderTopLeftRadius), right: r.right, left: r.left };
    })), selectors);
  check(items.length > 0 && items.every(x => x.width >= 43.99 && x.height >= 43.99), name + ': цели 44×44', items.filter(x => x.width < 43.99 || x.height < 43.99).slice(0, 5));
  check(items.length > 0 && items.every(x => x.radius >= 10 && x.radius <= 14), name + ': скругление Системы 10–14 px', items.filter(x => x.radius < 10 || x.radius > 14).slice(0, 5));
}
(async () => {
  const browser = await chromium.launch(LAUNCH), errors = [];
  try {
    {
      const { context, page } = await fresh(browser, errors);
      // Editable meal titles were only 24 px tall, unlike the other fields.
      for (const width of [320, 390]) {
        await page.setViewportSize({ width, height: width === 320 ? 568 : 844 });
        const names = await page.locator('.mlh input[data-mf="n"]').evaluateAll(fields => fields.map(x => {
          const r = x.getBoundingClientRect(); return { width: r.width, height: r.height };
        }));
        check(names.length > 0 && names.every(x => x.width >= 43.99 && x.height >= 43.99),
          `Еда на ${width} px: редактируемое название приёма имеет цель 44×44`, names);
      }
      await context.close();
    }
    {
      const { context, page } = await fresh(browser, errors);
      const opener = page.locator('[data-pick="0"]');
      await opener.click();
      await page.waitForSelector('#fp.on');
      check(await inside(page, 'fp'), 'Подбор еды: открытие сразу переводит фокус внутрь');
      check(await page.locator('#fp').evaluate(e => e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true' && !!e.getAttribute('aria-label')), 'Подбор еды: окно имеет доступное имя и семантику диалога');
      check(await cycle(page, 'fp', false), 'Подбор еды: Tab остаётся внутри');
      check(await cycle(page, 'fp', true), 'Подбор еды: Shift+Tab остаётся внутри');
      await controls(page, ['#fpX', '#fp .chains button', '#fp .fpi'], 'Подбор еды на 320 px');
      const fit = await page.evaluate(() => document.getElementById('fp').scrollWidth <= innerWidth && document.getElementById('fq').getBoundingClientRect().width >= 180);
      check(fit, 'Подбор еды: поиск и закрытие влезают в 320 px');
      await page.keyboard.press('Escape');
      const closed = await page.locator('#fp').evaluate(e => !e.classList.contains('on'));
      check(closed, 'Подбор еды: Escape закрывает пустой подбор');
      check(closed && await opener.evaluate(e => e === document.activeElement), 'Подбор еды: закрытие возвращает фокус к кнопке продукта');
      await context.close();
    }
    {
      const { context, page } = await fresh(browser, errors);
      const opener = page.locator('[data-pick="0"]');
      await opener.click();
      await page.locator('#fp .fpi').first().click();
      const pending = await page.evaluate(() => JSON.stringify(picked));
      await page.keyboard.press('Escape');
      const asking = await page.locator('#ask').evaluate(e => e.classList.contains('on'));
      check(asking, 'Выбранная еда: Escape запускает существующий вопрос закрытия');
      if (asking) {
        check(await inside(page, 'ask'), 'Выбранная еда: подтверждение получает фокус');
        check(await cycle(page, 'ask', false) && await cycle(page, 'ask', true), 'Выбранная еда: Tab и Shift+Tab держатся в подтверждении');
        await page.locator('#askN').click();
        check(await page.evaluate(pending => document.getElementById('fp').classList.contains('on') && JSON.stringify(picked) === pending && mealsOf(sel)[0].items.length === 0, pending), 'Выбранная еда: кнопка Отмена сохраняет выбор без записи в рацион');
        check(await inside(page, 'fp'), 'Выбранная еда: отмена возвращает фокус в подбор');
        await cooldown(page);
        await page.keyboard.press('Escape');
        await page.waitForSelector('#ask.on');
        await page.locator('#askY').click();
        await page.waitForFunction(() => !document.getElementById('fp').classList.contains('on'));
        check(await page.evaluate(() => picked.length === 0 && mealsOf(sel)[0].items.length === 0), 'Выбранная еда: подтверждённый выход очищает только незаписанный выбор');
        check(await opener.evaluate(e => e === document.activeElement), 'Выбранная еда: подтверждённый выход возвращает фокус к открытию');
      }
      await context.close();
    }
    {
      const { context, page } = await fresh(browser, errors);
      await page.evaluate(async () => {
        const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
        await phPut(addDays(today(), -7), png); await phPut(today(), png); await phSync();
        tab = 'photo'; render();
      });
      const opener = page.locator('#phCmp');
      await opener.click();
      await page.waitForSelector('#ov.on');
      check(await inside(page, 'ov'), 'Фото: открытие сравнения переводит фокус внутрь');
      check(await page.locator('#ov').evaluate(e => e.getAttribute('role') === 'dialog' && e.getAttribute('aria-modal') === 'true' && document.getElementById(e.getAttribute('aria-labelledby'))?.textContent.trim()), 'Фото: сравнение имеет имя и семантику диалога');
      check(await cycle(page, 'ov', false), 'Фото: Tab остаётся внутри сравнения');
      check(await cycle(page, 'ov', true), 'Фото: Shift+Tab остаётся внутри сравнения');
      await controls(page, ['#ovX', '#selA', '#selB', '#quick button', '#strip button'], 'Фото на 320 px');
      check(await page.evaluate(() => document.getElementById('ov').scrollWidth <= innerWidth), 'Фото: сравнение влезает в 320 px');
      await page.keyboard.press('Escape');
      const closed = await page.locator('#ov').evaluate(e => !e.classList.contains('on'));
      check(closed, 'Фото: Escape закрывает сравнение');
      check(closed && await opener.evaluate(e => e === document.activeElement), 'Фото: закрытие возвращает фокус к сравнению');
      await context.close();
    }
    {
      const { context, page } = await fresh(browser, errors);
      await page.evaluate(() => { sheet('НИЖНЕЕ ОКНО', '<button id="lowerPick">Подобрать</button>'); document.getElementById('lowerPick').onclick = () => openPick(0); });
      await page.locator('#lowerPick').click();
      check(await inside(page, 'fp') && await cycle(page, 'fp', false), 'Стопка окон: подбор получает фокус над нижней шторкой');
      const upper = await page.evaluate(() => +getComputedStyle(document.getElementById('fp')).zIndex > +getComputedStyle(document.getElementById('sh')).zIndex);
      check(upper, 'Стопка окон: подбор виден над нижней шторкой');
      await page.keyboard.press('Escape');
      check(await page.evaluate(() => !document.getElementById('fp').classList.contains('on') && document.getElementById('sh').classList.contains('on') && document.activeElement.id === 'lowerPick'), 'Стопка окон: Escape закрывает только подбор и возвращает фокус в шторку');
      await page.evaluate(() => { closePick(); openHint('meals'); ask('Подтвердить действие?', 'ПОДТВЕРДИТЬ'); });
      check(await inside(page, 'ask') && await cycle(page, 'ask', false), 'Стопка окон: подтверждение выше подсказки удерживает фокус');
      const top = await page.evaluate(() => +getComputedStyle(document.getElementById('ask')).zIndex > +getComputedStyle(document.getElementById('hsh')).zIndex);
      check(top, 'Стопка окон: подтверждение визуально выше подсказки');
      await page.keyboard.press('Escape');
      check(await page.evaluate(() => !document.getElementById('ask').classList.contains('on') && !document.getElementById('hsh').hidden), 'Стопка окон: Escape сначала отменяет только подтверждение');
      await context.close();
    }
    {
      const { context, page } = await fresh(browser, errors);
      await page.locator('[data-tab="ex"]').click();
      await page.waitForSelector('.lcard[data-lib]');
      await page.locator('#exf').click();
      await controls(page, ['#shX', '[data-lf="pl:core"]'], 'Фильтры на 320 px');
      await page.locator('[data-lf="pl:core"]').click();
      await page.locator('[data-lfdone]').click();
      await controls(page, ['.lpill[data-lclr]'], 'Снятие фильтра на 320 px');
      await page.evaluate(() => { tab = 'wo'; render(); });
      await controls(page, ['#rd'], 'Сброс дня на 320 px');
      const roles = await page.evaluate(() => {
        const primary = getComputedStyle(document.getElementById('phCmp'));
        const secondary = getComputedStyle(document.getElementById('phHist'));
        return primary.backgroundColor !== secondary.backgroundColor;
      });
      check(roles, 'Кнопки: основное действие отличается от вторичного');
      await context.close();
    }
    check(errors.length === 0, 'Нет ошибок JavaScript', errors);
  } finally { await browser.close(); }
  console.log(`ui-controls-oct06: ${fails} failed`);
  process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
