/* Быстрый дым: открывается ли приложение в светлой и тёмной системной
   теме без ошибок в консоли. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');

const SKIP = /^(wipe|exp|imp|csv|phAdd|phDel|phFile|impFile|setOk|setSkip)$/;

async function run(theme) {
  const browser = await chromium.launch(LAUNCH);
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: theme });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => d.dismiss().catch(() => {}));

  await page.goto(APP);
  await page.waitForTimeout(500);

  // закрыть первичную настройку и засеять журнал за прошлые дни
  await page.evaluate(() => {
    const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
    const back = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
    S.setup = 1;
    S.bw = '72'; S.bw0 = '70'; S.goal = '95'; S.height = 177;
    for (const [k, n] of [[1,1],[3,3],[5,5],[8,8],[10,10]]) {
      const ds = back(n), d = dayOf(ds);
      const r = recRW(ds);
      r.wo = 1; r.t0 = Date.now() - 4e6; r.t1 = Date.now() - 3.6e6; r.bw = '71.' + n;
      (d.ex || []).forEach((e, j) => {
        r.log[j] = { done: 1, n: e.n, g: e.g, s: e.s, r: String(e.r), w: e.w,
          rs: [8,8,8], vol: 8 * 3 * (+e.w || 0), xp: 12 };
      });
      r.ml = [{ n: 'Завтрак', note: '', items: [{ p: 'Овсянка', g: '100' }] },
              { n: 'Обед', note: '', items: [{ p: 'Рис', g: '150' }] }];
    }
    save(); render();
  });
  await page.evaluate(() => { const s = document.getElementById('setup'); if (s) s.classList.remove('on'); });
  await page.waitForTimeout(300);

  let clicked = 0;
  for (const t of ['wo', 'prog', 'food', 'photo']) {
    await page.evaluate(tb => { tab = tb; render(); }, t);
    await page.waitForTimeout(250);
    const on = await page.evaluate(id => { const e = document.querySelector(id); return !!e && e.classList.contains('on'); }, '#scr-' + t);
    if (!on) errors.push('вкладка ' + t + ' не открылась');

    const handles = await page.$$('button');
    for (const h of handles) {
      const ok = await h.evaluate(b => b.offsetParent !== null && !b.disabled
        && b.getBoundingClientRect().width > 0 && !/^(wipe|exp|imp|csv|phAdd|phDel|setOk|setSkip)$/.test(b.id)).catch(() => false);
      if (!ok) continue;
      await h.click({ timeout: 2000, force: true }).catch(() => {});
      clicked++;
      await page.waitForTimeout(50);
      await page.evaluate(() => {
        try { sheetClose(); } catch (e) {}
        try { askClose(false); } catch (e) {}
        ['fp','ov','setup'].forEach(id => { const el = document.getElementById(id); if (el) el.classList.remove('on'); });
        document.body.style.overflow = '';
      });
      await page.waitForTimeout(30);
    }
  }
  const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  await browser.close();
  return { clicked, bg, errors };
}

(async () => {
  for (const th of ['light', 'dark']) {
    const r = await run(th);
    console.log(`\n=== ${th.toUpperCase()} === нажато кнопок: ${r.clicked}, фон: ${r.bg}`);
    console.log(r.errors.length ? [...new Set(r.errors)].slice(0, 20).join('\n') : 'ошибок нет');
  }
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
