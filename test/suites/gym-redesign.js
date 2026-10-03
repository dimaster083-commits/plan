/* Gym redesign contracts. A fresh Chromium context contains only synthetic
   fixtures. Expectations are hand-derived; actions use the real delegated UI.
   Catches: tall header hiding the first card, tiny targets, template/common
   loads replacing real work-row loads, broken nested actions, render writes,
   and costly or inaccessible motion. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let failures = 0;
function check(name, actual, verify) {
  try { verify(actual); console.log('✓ ' + name); }
  catch (error) {
    failures++;
    console.log('✗ ' + name + ' → ' + error.message + '; actual=' + JSON.stringify(actual));
  }
}

// Keep current migration flags so reload tests the saved fixture, not an old
// version migration. No personal localStorage is ever opened by this context.
function seed(withLogs = false) {
  S.setup = 1; S.sound = 0; S.bw = 72; S.hints = 1;
  S.days = build().days; S.rec = {}; S.map = {}; S.pr = {}; S.once = {};
  // Plan not started: this fixture is not an easier cycle week, so the
  // untouched 42.5 kg exercise stays exactly 42.5 kg after weightFor.
  S.start = addDays(today(), 7); S.pause = {}; S.exNote = {};
  document.getElementById('setup').classList.remove('on');
  const ds = today(), d = dayOf(ds);
  d.t = 'up1'; d.s = 'Сила · верх тела';
  d.ex = [
    { n: 'Жим лёжа', s: 3, r: '6-8', w: 100, g: 'Грудь' },
    { n: 'Тяга штанги в наклоне', s: 5, r: '6-8', w: 100, g: 'Спина' },
    { n: 'Сгибания рук со штангой', s: 2, r: '6-8', w: 100, g: 'Руки' },
    { n: 'Жим стоя', s: 3, r: '6-8', w: 42.5, g: 'Плечи' },
    { n: 'Разводка гантелей', s: 2, r: '6-8', w: 100, g: 'Грудь' }
  ];
  if (withLogs) S.rec[ds] = { log: {
    0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: '3', r: '6-8', w: '100', rs: [6, 6, 6], ws: [60, 80, 100], vol: 1440, sd: 1, xp: 12 },
    1: { s: '5', r: '6-8', w: '100', rs: [6, 6, 6, 6, 6], ws: [20, 65, 75, 85, 30], kinds: ['w', '', '', 'f', 'd'] },
    2: { done: 1, n: 'Сгибания рук со штангой', g: 'Руки', s: '2', r: '6-8', w: '47.5', rs: [6, 6], ws: ['', ''], vol: 570, sd: 1, xp: 12 },
    4: { done: 1, n: 'Разводка гантелей', g: 'Грудь', s: '0', r: '6-8', w: '100', rs: [], wu: [6], dr: [6], vol: 0, sd: 1, xp: 12 }
  }, sp: {}, wo: 0 };
  entCache = null; wkCache = null; justDone = -1;
  tab = 'wo'; sel = ds; exOpen = null; editPast = false;
  render(); recomputeStats(1); render(); save(); flush(); window.scrollTo(0, 0);
}

function visibleAnimations() {
  return document.getAnimations().filter(a => {
    const target = a.effect && a.effect.target;
    return target && target.getClientRects().length &&
      (target.closest('#scr-wo,#statusbar,#daysbar,#dayctx') || target.id === 'wall') &&
      a.playState === 'running';
  }).map(a => {
    const timing = a.effect.getTiming();
    const keys = a.effect.getKeyframes();
    const metadata = ['offset', 'computedOffset', 'easing', 'composite'];
    const properties = [...new Set(keys.flatMap(k => Object.keys(k).filter(p => !metadata.includes(p))))];
    return { name: a.animationName || a.transitionProperty, duration: timing.duration,
      iterations: Number.isFinite(timing.iterations) ? timing.iterations : 'Infinity',
      unexpected: properties.filter(p => p !== 'opacity' && p !== 'transform') };
  });
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 568 }, hasTouch: true });
    const page = await context.newPage();
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(APP);
    await page.waitForSelector('#setup.on');
    await page.evaluate(seed);

    // A tall status/day panel or obscuring workout bar fails without scrolling.
    const first = await page.evaluate(() => {
      const card = document.querySelector('.exrow'), bar = document.getElementById('wobar');
      const r = card.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const title = card.querySelector('.n').getBoundingClientRect();
      const image = card.querySelector('.exth'), photo = image && image.getBoundingClientRect();
      return { scrollY, card: { top: r.top, bottom: r.bottom }, bar: { top: b.top, bottom: b.bottom },
        viewport: innerHeight, photo: photo && { left: photo.left, right: photo.right, width: photo.width, height: photo.height }, titleLeft: title.left };
    });
    check('320×568: первая карточка целиком видна над кнопкой тренировки без прокрутки', first, x => {
      assert.equal(x.scrollY, 0);
      assert.ok(x.card.top >= 0 && x.card.bottom <= x.bar.top + 1, 'карточка должна целиком находиться выше wobar');
      assert.ok(x.bar.bottom <= x.viewport + 1, 'кнопка тренировки должна находиться в viewport');
    });
    check('Фото техники находится слева от названия и достаточно крупное', first, x => {
      assert.ok(x.photo && x.photo.right <= x.titleLeft + 1 && x.photo.width >= 40 && x.photo.height >= 44);
    });

    for (const [width, height] of [[320, 568], [390, 844], [414, 896]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => { render(); window.scrollTo(0, 0); });
      const layout = await page.evaluate(() => {
        const targets = [...document.querySelectorAll('#scr-wo button,#scr-wo [role="button"],#scr-wo .exrow,#statusbar button,#daysbar button,#dayctx button')]
          .filter(e => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden');
        return { width: document.documentElement.scrollWidth,
          small: targets.map(e => ({ id: e.id || e.dataset.go || e.dataset.swap || e.className,
            width: e.getBoundingClientRect().width, height: e.getBoundingClientRect().height }))
            .filter(r => r.width < 43.9 || r.height < 43.9) };
      });
      check(`${width}: экран влезает по ширине, цели касания ≥44×44`, layout, x => {
        assert.ok(x.width <= width + 1, 'горизонтального переполнения быть не должно');
        assert.deepEqual(x.small, [], 'слишком маленькие цели касания');
      });
    }

    await page.evaluate(seed, true);
    // Using g.w/template load or warmup/drop values fails these literal fixtures.
    const loads = await page.locator('.exrow').evaluateAll(rows => rows.map(row => {
      const el = row.querySelector('.kg'), style = getComputedStyle(el);
      return { text: el.textContent.trim().replace(/,/g, '.').replace(/\s/g, '').replace(/[-—]/g, '–'),
        font: parseFloat(style.fontSize), visible: el.getClientRects().length > 0,
        done: row.classList.contains('done') };
    }));
    const expected = ['60–100', '65–85', '47.5', '42.5', '–'];
    for (let j = 0; j < expected.length; j++) check(`Вес карточки ${j}: ${expected[j]} кг из настоящих рабочих строк`, loads[j], x => {
      assert.equal(x.text, expected[j]);
      assert.ok(x.visible && x.font >= 20, 'вес должен быть видимым и крупным, включая выполненные карточки');
    });

    const beforeView = await page.evaluate(() => JSON.stringify(S));
    await page.locator('.exrow[data-open="3"] .n').click();
    await page.waitForSelector('.exf');
    await page.locator('[data-close]').click();
    await page.waitForSelector('.exrow[data-open="3"]');
    await page.evaluate(() => { render(); render(); });
    check('Открытие, возврат и повторная отрисовка не меняют личное состояние', await page.evaluate(() => JSON.stringify(S)), x => assert.equal(x, beforeView));

    await page.evaluate(seed, false);
    await page.locator('.exrow [data-swap="0"]').click();
    await page.waitForSelector('#sh.on #swQ');
    const nested = await page.evaluate(() => ({ open: exOpen, title: document.getElementById('shT').textContent.trim(), cards: document.querySelectorAll('.exrow').length }));
    check('Вложенная кнопка замены открывает аналоги и сохраняет список упражнений', nested, x => {
      assert.equal(x.open, null); assert.equal(x.title, 'ЗАМЕНА'); assert.equal(x.cards, 5);
    });
    await page.locator('#shX').click();
    await page.locator('#fin').click();
    const started = await page.evaluate(() => ({ t0: recOf(sel).t0, closed: !!recOf(sel).wo }));
    check('Начать запускает тренировку и не закрывает её', started, x => { assert.ok(x.t0 > 0); assert.equal(x.closed, false); });
    await page.evaluate(() => flush());
    await page.reload();
    await page.waitForSelector('.exrow[data-open="0"]');
    const resumed = await page.evaluate(() => ({ t0: recOf(sel).t0, closed: !!recOf(sel).wo, text: document.getElementById('fin').textContent }));
    check('После перезагрузки продолжается та же начатая тренировка', resumed, x => {
      assert.equal(x.t0, started.t0); assert.equal(x.closed, false); assert.match(x.text, /Завершить/);
    });
    await page.locator('.exrow[data-open="0"] .n').click();
    await page.waitForSelector('.exf');
    const ws = page.locator('.exf [data-ws]'), rs = page.locator('.exf [data-rs]');
    for (let i = 0; i < 3; i++) { await ws.nth(i).fill(String([60, 80, 100][i])); await rs.nth(i).fill('6'); }
    await page.locator('.exf [data-go="0"]').click();
    await page.locator('[data-close]').click();
    const done = await page.evaluate(() => ({ done: recOf(sel).log[0].done, rows: recOf(sel).log[0].ws, ton: dayTon(sel), count: document.getElementById('woEx').textContent }));
    check('Закрытие через карточку сохраняет 60/80/100, 1440 кг и 1/5', done, x => {
      assert.equal(x.done, 1); assert.deepEqual(x.rows, [60, 80, 100]); assert.equal(x.ton, 1440); assert.equal(x.count, '1/5');
    });
    const motion = await page.evaluate(visibleAnimations);
    check('Анимации Зала конечные ≤450 мс и меняют только opacity/transform', motion, x => {
      assert.deepEqual(x.filter(a => a.iterations === 'Infinity' || Number(a.duration) > 450 || a.unexpected.length), []);
    });
    await page.waitForFunction(() => !pendingActions.has('go0'));
    await page.locator('.exrow [data-go="0"]').click();
    const undone = await page.evaluate(() => ({ done: !!recOf(sel).log[0].done, ton: dayTon(sel), count: document.getElementById('woEx').textContent, open: exOpen }));
    check('Повторное касание отметки снимает выполнение без открытия карточки', undone, x => {
      assert.equal(x.done, false); assert.equal(x.ton, 0); assert.equal(x.count, '0/5'); assert.equal(x.open, null);
    });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.locator('.exrow[data-open="0"] .n').click();
    const reduced = await page.evaluate(visibleAnimations);
    check('Уменьшение движения оставляет Зал статичным', reduced, x => assert.deepEqual(x, []));
    await page.evaluate(seed, false);
    const pastHead = await page.evaluate(() => {
      const past = addDays(today(), -1), now = Date.now();
      S.rec[past] = { wo: 1, t0: now - 12 * 60000, t1: now, sp: {}, log: {
        0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: 3, r: '2', w: 100,
          rs: [2, 2, 2], ws: [60, 80, 100], vol: 480 }
      } };
      entCache = null; sel = past; editPast = false; render();
      return { total: $('woBig').textContent, exercises: $('woEx').textContent,
        sets: $('woSets').textContent, time: $('woTime').textContent,
        history: !!document.querySelector('.jrow'), skipHidden: $('skipDay').hidden };
    });
    check('История дня: 480 кг, 1 упражнение, 3 подхода и 12 минут из его журнала', pastHead, x => {
      assert.equal(x.total, '480'); assert.equal(x.exercises, '1');
      assert.equal(x.sets, '3'); assert.equal(x.time, '12 мин'); assert.equal(x.history, true);
    });
    check('В журнале прошлого дня нельзя случайно поставить пропуск', pastHead, x => assert.equal(x.skipHidden, true));
    const largeCount = await page.evaluate(() => {
      try {
        const html = exRow({ n: 'Жим лёжа', s: 3, r: '6-8', w: 40, g: 'Грудь' }, 0,
          { log: { 0: { s: '150000', w: '40' } } }, 1);
        const box = document.createElement('div'); box.innerHTML = html;
        return { load: box.querySelector('.kg').textContent, error: null };
      } catch (error) { return { error: error.name }; }
    });
    check('Опечатка в числе подходов не роняет список и не размножает вычисления веса', largeCount,
      x => assert.deepEqual(x, { load: '40', error: null }));
    check('Новые сценарии не создают ошибок JavaScript', errors, x => assert.deepEqual(x, []));
    await context.close();
  } finally { await browser.close(); }
  console.log(`gym-redesign: ${failures} failed`);
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error('FATAL', error); process.exitCode = 1; });
