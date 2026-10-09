/* Heatmap regressions: real recorded working sets drive continuous color;
   brightness persists independently, and full recap bars remain visible. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let failures = 0;
function check(name, actual, verify) {
  try { verify(actual); console.log('✓ ' + name); }
  catch (error) { failures++; console.log('✗ ' + name + ' → ' + error.message + '; actual=' + JSON.stringify(actual)); }
}
const channels = s => (s.match(/[\d.]+/g) || []).slice(0, 3).map(Number);
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(APP);
    await page.waitForFunction(() => typeof paintMusMap === 'function' && typeof S === 'object');
    await page.evaluate(() => {
      S = build(); S.setup = 1; S.sound = 0; S.mapBrightness = 100;
      S.days.forEach(d => { d.ex = []; });
      S.days[0].ex = [{ n: 'Жим лёжа', g: 'Грудь', s: 10, r: '8', w: 80 }];
      $('setup').classList.remove('on'); tab = 'prog'; pSec = 'load'; render();
    });
    // Wrong discrete bucket branch would collapse 1/4 and 5/9 into identical colors.
    const colors = await page.evaluate(() => {
      const out = {};
      for (const n of [0, 1, 4, 5, 9, 10, 12]) {
        S.rec = { [today()]: { log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: n,
          rs: Array(n).fill(8), w: 80, r: '8', sd: 1 } } } }; entCache = null;
        paintMusMap();
        out[n] = getComputedStyle(document.querySelector('#bmapBox [data-mus="Грудь"]')).fill;
      }
      return out;
    });
    check('1 и 4 рабочих подхода имеют разные цвета', colors, a => assert.notEqual(a[1], a[4]));
    check('5 и 9 рабочих подходов имеют разные цвета', colors, a => assert.notEqual(a[5], a[9]));
    check('цвет плавно идёт от синего к красному и насыщается на норме', colors, a => {
      const low = channels(a[1]), high = channels(a[9]), full = channels(a[10]);
      assert.ok(low[2] > low[0]); assert.ok(high[0] > high[2]);
      assert.ok(high[0] > low[0]); assert.ok(full[0] > full[2]); assert.equal(a[10], a[12]);
      assert.equal(a[0], 'rgb(38, 55, 78)');
    });
    const noNorm = await page.evaluate(() => {
      S.days[0].ex = []; paintMusMap(); openMuscle('Грудь');
      return { text: $('shB').textContent, level: mmLevel('Грудь', 12),
        color: getComputedStyle(document.querySelector('#bmapBox [data-mus="Грудь"]')).fill,
        focus: document.querySelector('#shB .bmap').getAttribute('data-mode') };
    });
    check('без плановой нормы подходы не выдаются за выполненную норму', noNorm, a => {
      assert.notEqual(a.level, 3); assert.match(a.text, /норма не задана/i); assert.doesNotMatch(a.text, /норма добрана/i);
      assert.notEqual(a.color, colors[10]);
    });
    check('анатомический фокус обозначен отдельно от нагрузки', noNorm, a => assert.equal(a.focus, 'focus'));
    const working = await page.evaluate(() => {
      sheetClose(); S.days[0].ex = [{ n: 'Жим лёжа', g: 'Грудь', s: 10, r: '8', w: 80 }];
      S.rec = { [today()]: { log: { 0: { done: 1, n: 'Жим лёжа', g: 'Грудь', s: 2,
        rs: [8, 8], wu: [6, 6, 6], dr: [10, 10], w: 80, r: '8', sd: 1 } } } }; entCache = null;
      paintMusMap();
      return { sets: vol7m()['Грудь'], total: daySets(today()),
        text: document.querySelector('#mlist [data-mus="Грудь"]').textContent,
        color: getComputedStyle(document.querySelector('#bmapBox [data-mus="Грудь"]')).fill,
        dot: getComputedStyle(document.querySelector('#mlist [data-mus="Грудь"] i')).backgroundColor };
    });
    check('разминка и дроп не добавляют рабочие подходы на карте', working, a => {
      assert.equal(a.sets, 2); assert.equal(a.total, 2); assert.match(a.text, /2\s*\/\s*10/);
    });
    check('точка мышцы использует тот же непрерывный цвет', working, a => assert.equal(a.dot, a.color));
    const balance = await page.evaluate(() => {
      paintRadar();
      return { bar: getComputedStyle(document.querySelector('#rad [data-g="Грудь"] .bb i')).backgroundColor,
        fill: getComputedStyle(document.querySelector('#bmapBox [data-mus="Грудь"]')).fill };
    });
    check('баланс подходов использует тот же цвет, что карта', balance, a => assert.equal(a.bar, a.fill));
    const slider = await page.evaluate(() => {
      const input = $('mmBrightness');
      return input ? { min: +input.min, max: +input.max, h: input.getBoundingClientRect().height,
        w: input.getBoundingClientRect().width, label: document.querySelector('label[for="mmBrightness"]')?.textContent,
        width: document.documentElement.scrollWidth } : null;
    });
    check('отдельная яркость доступна на 320 px с зоной касания 44 px', slider, a => {
      assert.ok(a, 'нет регулятора яркости'); assert.ok(a.min >= 30 && a.max === 100);
      assert.ok(a.h >= 44 && a.w >= 44); assert.ok(a.width <= 320); assert.match(a.label, /яркость/i);
    });
    if (slider) {
      const before = await page.evaluate(() => ({ rec: JSON.stringify(S.rec), days: JSON.stringify(S.days), sets: vol7m()['Грудь'] }));
      await page.evaluate(() => {
        const input = $('mmBrightness'); input.value = '40'; input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await page.waitForFunction(() => JSON.parse(localStorage.getItem(KEY) || '{}').mapBrightness === 40);
      const changed = await page.evaluate(() => ({ value: S.mapBrightness, rec: JSON.stringify(S.rec), days: JSON.stringify(S.days),
        sets: vol7m()['Грудь'], color: getComputedStyle(document.querySelector('#bmapBox [data-mus="Грудь"]')).fill }));
      check('яркость меняет только отображение и сохраняется на устройстве', changed, a => {
        assert.equal(a.value, 40); assert.equal(a.rec, before.rec); assert.equal(a.days, before.days); assert.equal(a.sets, before.sets);
        assert.ok(channels(a.color).every((v, i) => v < channels(working.color)[i]));
      });
      await page.reload(); await page.waitForFunction(() => typeof S === 'object' && S?.setup === 1);
      const reloaded = await page.evaluate(() => { tab = 'prog'; pSec = 'load'; render(); return { state: S.mapBrightness, value: +$('mmBrightness').value }; });
      check('яркость восстанавливается после перезагрузки', reloaded, a => { assert.equal(a.state, 40); assert.equal(a.value, 40); });
    } else {
      check('яркость меняет только отображение и сохраняется на устройстве', null, a => assert.ok(a, 'нет регулятора яркости'));
      check('яркость восстанавливается после перезагрузки', null, a => assert.ok(a, 'нет регулятора яркости'));
    }
    const normalized = await page.evaluate(() => {
      const result = [];
      for (const value of [undefined, null, '', 'bad', {}, 5, 150, '63']) {
        S.mapBrightness = value; scrubKeys(); result.push(S.mapBrightness ?? null);
      }
      return result;
    });
    check('старые и правленые копии получают безопасную яркость', normalized,
      a => assert.deepEqual(a, [80, 80, 80, 80, 80, 40, 100, 63]));
    const recap = await page.evaluate(async () => {
      S.mapBrightness = 100;
      S.days.forEach(d => { d.ex = []; });
      S.days[0].ex = [{ n: 'Жим лёжа', g: 'Грудь', s: 10, r: '8', w: 80 }];
      const row = n => ({ done: 1, n: 'Жим лёжа', g: 'Грудь', s: n, rs: Array(n).fill(8), w: 80, r: '8', sd: 1 });
      S.rec = { [mondayOf(today())]: { log: { 0: row(12) } } }; entCache = null;
      openWeek();
      const chest = [...document.querySelectorAll('#shB .wkm')].find(el => el.querySelector('span').textContent === 'Грудь');
      const week = { bar: getComputedStyle(chest.querySelector('u')).backgroundColor,
        fill: getComputedStyle(document.querySelector('#shB .bmap [data-mus="Грудь"]')).fill,
        width: chest.querySelector('u').getBoundingClientRect().width };
      const blob = await wkPng(mondayOf(today())), bitmap = await createImageBitmap(blob);
      const canvas = document.createElement('canvas'); canvas.width = bitmap.width; canvas.height = bitmap.height;
      const ctx = canvas.getContext('2d'); ctx.drawImage(bitmap, 0, 0);
      week.png = Array.from(ctx.getImageData(430, 775, 1, 1).data).slice(0, 3);
      // October target: round(10 * 31 / 7) = 44; 22 sets is exactly half.
      S.rec = { '2020-10-01': { log: { 0: row(22) } } }; entCache = null;
      openMonth('2020-10');
      const monthChest = [...document.querySelectorAll('#shB .wkm')].find(el => el.querySelector('span').textContent === 'Грудь');
      return { week, month: { text: monthChest.textContent, transform: monthChest.querySelector('u').style.transform,
        color: getComputedStyle(monthChest.querySelector('u')).backgroundColor } };
    });
    check('полоса недельного итога при 100%+ видима и совпадает с картой и PNG', recap, a => {
      assert.notEqual(a.week.bar, 'rgba(0, 0, 0, 0)'); assert.equal(a.week.bar, a.week.fill);
      assert.ok(a.week.width > 20); assert.deepEqual(a.week.png, channels(a.week.fill));
    });
    check('месячная шкала сохраняет норму программы × дни/7', recap, a => {
      assert.match(a.month.text, /22\s*\/\s*44/); assert.equal(a.month.transform, 'scaleX(0.5)'); assert.equal(a.month.color, colors[5]);
    });
    const liveSheet = await page.evaluate(() => {
      if (typeof setMapBrightness !== 'function') return null;
      const bar = document.querySelector('#shB .wkm u.mm2');
      if (!bar) return null;
      const before = getComputedStyle(bar).backgroundColor;
      setMapBrightness(40);
      return { before, after: getComputedStyle(document.querySelector('#shB .wkm u.mm2')).backgroundColor };
    });
    check('яркость обновляет уже открытую карту и полосы итогов', liveSheet, a => { assert.ok(a); assert.notEqual(a.before, a.after); });
    check('карта и настройка не вызывают ошибок страницы', errors, a => assert.deepEqual(a, []));
  } finally { await browser.close(); }
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.log('FATAL ' + error.stack); process.exitCode = 1; });
