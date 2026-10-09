/* A late IndexedDB photo comparison must not reopen a dismissed window,
   replace a newer selection, or take focus from a newer confirmation.
   The real database is seeded; only the timing of its reads is delayed. */
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let fails = 0;
function check(value, name, detail) {
  if (!value) fails++;
  console.log(`  ${value ? '✓' : '✗'} ${name}${detail ? ' → ' + JSON.stringify(detail) : ''}`);
}
async function fresh(browser, errors) {
  const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
  await context.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'click' && this.id === 'phCmp') {
        return add.call(this, type, function (...args) {
          (window.cmpDone || (window.cmpDone = [])).push(Promise.resolve(listener.apply(this, args)));
        }, options);
      }
      return add.call(this, type, listener, options);
    };
  });
  const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
  await page.goto(APP); await page.waitForSelector('#setup.on');
  const date = await page.evaluate(async () => {
    S.setup = 1; S.bw = 72; S.sound = 0; document.getElementById('setup').classList.remove('on');
    const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
    const date = today() === mondayOf(today()) ? addDays(today(), 1) : addDays(today(), -1);
    await phPut(today(), png); await phPut(date, png); await phSync();
    sel = today(); tab = 'photo'; render(); return date;
  });
  await page.waitForFunction(() => !document.getElementById('phDel').hidden);
  return { context, page, date };
}
async function delaySync(page) {
  await page.evaluate(() => {
    const sync = phSync;
    window.finishCmp = [];
    phSync = () => new Promise(resolve => {
      finishCmp.push(async () => { await sync(); resolve(); });
    });
  });
}
async function finish(page, i, done = i) {
  await page.evaluate(async ({ i, done }) => { await finishCmp[i](); await cmpDone[done]; }, { i, done });
}
const state = page => page.evaluate(() => ({
  compare: document.getElementById('ov').classList.contains('on'),
  ask: document.getElementById('ask').classList.contains('on'), active: document.activeElement.id, A, B, tab, sel
}));
(async () => {
  const browser = await chromium.launch(LAUNCH), errors = [];
  try {
    {
      const { context, page } = await fresh(browser, errors);
      await delaySync(page); await page.locator('#phCmp').click();
      await page.waitForFunction(() => finishCmp.length === 1);
      await page.locator('#phDel').click(); await page.waitForSelector('#ask.on');
      check((await state(page)).active === 'askN', 'Фото: новый вопрос удаления получает фокус до завершения сравнения');
      await finish(page, 0);
      const late = await state(page);
      check(late.ask && late.active === 'askN' && !late.compare, 'Фото: позднее сравнение не открывается и не крадёт фокус вопроса', late);
      await page.keyboard.press('Escape');
      check(await page.evaluate(() => PH.length === 2 && !document.getElementById('ask').classList.contains('on') && !document.getElementById('ov').classList.contains('on')), 'Фото: отмена вопроса сохраняет оба снимка без скрытого сравнения');
      await context.close();
    }
    for (const change of ['tab', 'date']) {
      const { context, page, date } = await fresh(browser, errors);
      await delaySync(page); await page.locator('#phCmp').click();
      await page.waitForFunction(() => finishCmp.length === 1);
      if (change === 'tab') await page.locator('[data-tab="food"]').click();
      else {
        await page.locator('#phHist').click();
        await page.locator('#stripAll [data-open="' + date + '"]').click();
      }
      const before = await state(page);
      await finish(page, 0);
      const after = await state(page);
      check(!after.compare && after.active === before.active && after.tab === before.tab && after.sel === before.sel,
        change === 'tab' ? 'Фото: уход с вкладки отменяет запоздавшее открытие' : 'Фото: смена даты отменяет запоздавшее открытие', after);
      await context.close();
    }
    {
      const { context, page } = await fresh(browser, errors);
      await delaySync(page); await page.locator('#phCmp').click();
      await page.waitForFunction(() => performance.now() - lastTap.t >= UNDO_TAP_MS);
      await page.locator('#phCmp').click(); await page.waitForFunction(() => finishCmp.length === 2);
      await finish(page, 1); await page.waitForSelector('#ov.on');
      await page.locator('#selA').selectOption(await page.evaluate(() => today()));
      await page.locator('#selA').focus();
      const before = await state(page);
      await finish(page, 0);
      const after = await state(page);
      check(after.compare && after.A === before.A && after.B === before.B && after.active === 'selA', 'Фото: старый запрос не заменяет выбор и фокус нового сравнения', after);
      await page.keyboard.press('Escape');
      check(await page.locator('#phCmp').evaluate(e => e === document.activeElement), 'Фото: актуальное сравнение закрывается с возвратом фокуса');
      await context.close();
    }
    {
      const { context, page } = await fresh(browser, errors);
      await page.locator('#phCmp').click(); await page.waitForSelector('#ov.on');
      await delaySync(page);
      // Re-enter the real handler while the existing comparison is open;
      // its close button remains a real visible user action.
      await page.evaluate(() => document.getElementById('phCmp').click());
      await page.waitForFunction(() => finishCmp.length === 1);
      await page.locator('#ovX').click();
      const before = await state(page);
      await finish(page, 0, 1);
      const after = await state(page);
      check(!after.compare && after.active === before.active, 'Фото: закрытие отменяет незавершённый запрос и окно не открывается снова', after);
      await context.close();
    }
    {
      const { context, page, date } = await fresh(browser, errors);
      const photos = await page.evaluate(async date => {
        const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff0000'; ctx.fillRect(0, 0, 1, 1); const old = canvas.toDataURL();
        ctx.fillStyle = '#0000ff'; ctx.fillRect(0, 0, 1, 1); const current = canvas.toDataURL();
        await phPut(date, old); await phPut(today(), current); PHCACHE.clear(); await phSync();
        return { old, current };
      }, date);
      await page.locator('#phCmp').click(); await page.waitForSelector('#ov.on');
      await page.waitForFunction(src => document.querySelector('#picA img')?.src === src, photos.old);
      await page.evaluate(date => {
        const load = phLoad, paint = paintCmp;
        window.paintJobs = []; window.finishPaint = null;
        let delay = true;
        phLoad = d => {
          if (d !== date || !delay) return load(d);
          delay = false;
          return new Promise(resolve => { finishPaint = async () => resolve(await load(d)); });
        };
        paintCmp = () => { const job = paint(); paintJobs.push(job); return job; };
      }, date);
      // Real select changes render the new selection while an older read waits.
      await page.locator('#selA').selectOption(date);
      await page.waitForFunction(() => typeof finishPaint === 'function');
      await page.locator('#selA').selectOption(await page.evaluate(() => today()));
      await page.evaluate(async () => { await paintJobs[1]; });
      await page.evaluate(async () => { await finishPaint(); await paintJobs[0]; });
      const painted = await page.evaluate(() => ({
        A, B, selected: document.getElementById('selA').value,
        left: document.querySelector('#picA img')?.src, right: document.querySelector('#picB img')?.src
      }));
      check(painted.A === await page.evaluate(() => today()) && painted.selected === painted.A &&
        painted.left === photos.current && painted.right === photos.current,
      'Фото: запоздавшая загрузка не подменяет фото актуального выбора', painted);
      await context.close();
    }
    check(errors.length === 0, 'Нет ошибок JavaScript', errors);
  } finally { await browser.close(); }
  console.log(`modal-async-oct06: ${fails} failed`); process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
