/* Audit collector. Exit 0 means collection completed, NOT that the app is healthy.
   Production source is never modified; only isolated synthetic browser contexts. */
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');
const result = { baseline: '1.4.8.8.1 / 4d8d72b', contexts: [] };
async function run(browser, viewport) {
  const context = await browser.newContext({ viewport, timezoneId: 'Asia/Vladivostok', locale: 'ru-RU', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(8000);
  const out = { viewport, checks: [], errors: [] }; result.contexts.push(out);
  page.on('pageerror', e => out.errors.push(e.message));
  const check = (name, pass, evidence) => { out.checks.push({ name, pass: !!pass, evidence }); console.log(viewport.width + ' ' + (pass ? 'OK ' : 'OBSERVED ') + name); };
  const click = async selector => { await page.locator(selector).first().click(); await page.waitForTimeout(320); };
  const fill = async (selector, value) => { await page.locator(selector).first().fill(value); await page.locator(selector).first().blur(); await page.waitForTimeout(80); };
  const state = () => page.evaluate(() => ({ date: sel, sum: daySum(sel), meals: mealsOf(sel), history: S.rec['2026-10-08'].ml,
    historicalSum: daySum('2026-10-08'), historicalKString: String(daySum('2026-10-08').k), totals: $('tKc').textContent, protein: $('tPr').textContent,
    customKString: S.myFood.map(f => ({n:f.n,k:String(f.k)})),
    norm: { kc: normDay(sel).kc, pr: normDay(sel).pr }, manual: S.kcManual, tpl: S.tpl, custom: S.myFood }));
  const undo = async () => { await click('#undoB'); };
  try {
    await page.clock.install({ time: new Date('2026-10-10T02:00:00Z') }); await page.clock.resume();
    await page.goto(APP); await page.waitForFunction(() => typeof S === 'object' && typeof render === 'function'); await page.waitForTimeout(1400);
    await page.evaluate(() => {
      S = build(); S.setup = 1; S.sound = 0; S.hints = 0; S.bw = '80'; S.goal = '90'; S.height = 180; S.age = 30; S.sex = 'm';
      scrubKeys(); migrate(); S.bw = '80'; S.goal = '90'; S.kcManual = 0; applyNutri();
      S.myFood = [{ n: 'AUDIT Food', k: 100, p: 10, f: 2, c: 15 }]; invalidateFood();
      recRW('2026-10-08').ml = [{ n: 'Исторический', note: '', items: [{ p: 'AUDIT Food', g: '125' }] }];
      recRW('2026-10-09').ml = [{ n: 'Вчера', note: '', items: [{ p: 'Рис белый отварной', g: '300' }] }];
      recRW(today()).ml = [{ n: 'Сегодня', note: '', items: [{ p: 'Гречка отварная', g: '200' }] }];
      $('setup').classList.remove('on'); sel = today(); tab = 'wo'; save(); render();
    });
    await click('[data-tab="food"]');
    out.inventory = await page.locator('#scr-food button').evaluateAll(els => els.map(el => { const r = el.getBoundingClientRect(); return {
      text: el.textContent.trim(), id: el.id, aria: el.getAttribute('aria-label'), data: { ...el.dataset },
      visible: !!(r.width && r.height) && !el.hidden, width: Math.round(r.width), height: Math.round(r.height) }; }));
    let s = await state(); check('Initial totals = buckwheat 200g = 220 kcal, protein 8.4g', s.sum.k === 220 && s.sum.p === 8.4, s);
    await click('[data-d="2026-10-08"]'); s = await state(); check('Select historical food date uses own record', s.sum.k === 125 && s.meals[0].items[0].g === '125', s);
    await click('#toToday'); check('Today button returns original food', (await state()).sum.k === 220, await state());
    await click('[data-d="2026-10-07"]'); check('Empty date starts blank', (await state()).sum.k === 0, await state());
    await click('#cpLast'); check('Repeat last ration uses latest actual record (Oct10)', (await state()).sum.k === 220, await state()); await undo();
    check('Undo repeat ration restores empty date', (await state()).sum.k === 0, await state()); await click('#toToday');
    const spBefore = await page.evaluate(() => ({len:dayOf(sel).sp.length,xp:S.xp}));
    await click('#spl [data-tog="0"]'); check('Supplement individual toggle', await page.evaluate(() => !!recOf(sel).sp[0]), await page.locator('#spCnt').textContent()); await undo();
    await click('#spAll'); check('Supplement all toggle', await page.evaluate(() => Object.keys(recOf(sel).sp).length === dayOf(sel).sp.length), await page.locator('#spCnt').textContent()); await undo();
    await click('#addSp'); check('Add supplement', await page.evaluate(n => dayOf(sel).sp.length === n + 1, spBefore.len), await page.locator('#spCnt').textContent()); await undo();
    await click('#spl [data-spd="0"]'); await click('#askN'); check('Cancel supplement removal', await page.evaluate(n => dayOf(sel).sp.length === n, spBefore.len), spBefore);
    await click('#spl [data-spd="0"]'); await click('#askY'); check('Remove supplement', await page.evaluate(n => dayOf(sel).sp.length === n - 1, spBefore.len), spBefore); await undo();
    await click('[data-tab="wo"]'); await click('#rd'); await click('#askN'); await click('[data-tab="food"]'); check('Cancel day reset preserves food', (await state()).sum.k === 220, await state());
    await click('[data-tab="wo"]'); await click('#rd'); out.resetPrompt = await page.locator('#askT').textContent(); await click('#askY'); await click('[data-tab="food"]');
    check('Confirmed day reset clears food as well as marks', (await state()).sum.k === 0, {prompt:out.resetPrompt,state:await state()}); await undo();
    check('Undo day reset restores ration', (await state()).sum.k === 220, await state());
    check('Food viewport has no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), await page.evaluate(() => ({width:innerWidth,scroll:document.documentElement.scrollWidth})));
    await fill('[data-g="0"]', '125.5'); s = await state(); check('Decimal grams totals are consistent', Math.abs(s.sum.k - 138.05) < 1e-8, s);
    await undo(); s = await state(); check('Undo grams restores 200g', s.meals[0].items[0].g === '200', s);
    for (const v of ['', '0', '-20', 'abc', '12abc', 'Infinity', '1e309']) {
      await fill('[data-g="0"]', v); s = await state();
      check('Grams input ' + JSON.stringify(v), Number.isFinite(s.sum.k) && !s.totals.includes('Infinity'), s);
    }
    await fill('[data-g="0"]', '200');
    await click('[data-rm="0"]'); s = await state(); check('Remove product updates totals', s.sum.k === 0, s); await undo();
    await click('#addMl'); s = await state(); check('Add meal', s.meals.length === 2, s);
    await undo(); check('Undo add meal', (await state()).meals.length === 1, await state());
    await page.locator('#addMl').dblclick({ delay: 20 }); await page.waitForTimeout(320);
    check('Double tap add meal creates only one', (await state()).meals.length === 2, await state()); await undo();
    await click('[data-mld="0"]'); await click('#askN'); check('Cancel meal delete preserves food', (await state()).sum.k === 220, await state());
    await click('[data-mld="0"]'); await click('#askY'); check('Delete meal clears selected date only', (await state()).meals.length === 0 && (await state()).historicalSum.k === 125, await state()); await undo();
    await click('[data-pick="0"]'); await fill('#fq', 'Гречка отварная'); await click('[data-add="Гречка отварная"]');
    await click('#fpX'); await click('#askN'); check('Picker cancel-close keeps selection', await page.locator('#fp').evaluate(el => el.classList.contains('on')), await page.locator('#fpAdd').textContent());
    await click('[data-add="Гречка отварная"]'); check('Product toggle deselects', await page.locator('#fpbar').evaluate(el => !el.classList.contains('on')), 'toggle');
    await click('[data-add="Гречка отварная"]'); await click('#fpAdd'); check('Picker adds product', (await state()).meals[0].items.length === 2, await state()); await undo();
    await click('[data-pick="0"]'); await click('[data-ch="Вкусно и точка"]');
    check('Picker restaurant filter', await page.locator('[data-ch="Вкусно и точка"]').evaluate(el => el.classList.contains('on')), 'restaurant chip');
    await click('[data-ch=""]'); await click('#fpX');
    await click('#cpBtn'); await click('[data-from="2026-10-09"]'); await click('#askN'); check('Cancel copy preserves day', (await state()).sum.k === 220, await state());
    await click('[data-from="2026-10-09"]'); await click('#askY'); check('Copy uses other date and leaves history', (await state()).sum.k === 348 && (await state()).historicalSum.k === 125, await state()); await undo();
    await click('#cpBtn'); await click('[data-save]'); await fill('#askI', 'AUDIT template'); await click('#askY');
    check('Save template clones actual food', (await state()).tpl.length === 1, await state());
    await click('[data-tdel="0"]'); await click('#askN'); check('Cancel template deletion', (await state()).tpl.length === 1, await state());
    await click('[data-tdel="0"]'); await click('#askY'); check('Delete template', (await state()).tpl.length === 0, await state()); await undo();
    await click('[data-tpl="0"]'); await click('#askN'); check('Cancel template apply', (await state()).sum.k === 220, await state());
    await click('[data-tpl="0"]'); await click('#askY'); check('Apply template', (await state()).sum.k === 220, await state());
    await click('[data-pick="0"]'); await fill('#fq', 'AUDIT New');
    await fill('#nfK', '200'); await fill('#nfP', '12.5'); await click('#fpX');
    const draftClosed = await page.locator('#fp').evaluate(el => !el.classList.contains('on'));
    check('FOOD-04 closing unsaved custom-food form requests confirmation', !draftClosed, {closed:draftClosed,ask:await page.locator('#ask').evaluate(el => el.classList.contains('on'))});
    if (draftClosed) { await click('[data-pick="0"]'); await fill('#fq', 'AUDIT New'); }
    else { await click('#askN'); }
    await fill('#nfN', ''); await click('#nfSave'); check('Empty product name rejected', (await state()).custom.length === 1, await state());
    await fill('#nfN', 'AUDIT New'); await fill('#nfK', '200'); await fill('#nfP', '12,5'); await fill('#nfF', '3.5'); await fill('#nfC', '30'); await click('#nfSave');
    check('Create custom food with decimal macros', (await state()).custom.some(f => f.n === 'AUDIT New' && f.p === 12.5 && f.f === 3.5), await state());
    await click('[data-my="AUDIT New"]'); await click('#askN'); check('Cancel custom delete', (await state()).custom.length === 2, await state());
    await click('[data-my="AUDIT New"]'); await click('#askY'); check('Delete unused custom food', (await state()).custom.length === 1, await state()); await undo();
    if (await page.locator('#fp').evaluate(el => el.classList.contains('on'))) await click('#fpX');
    await click('[data-pick="0"]'); await fill('#fq', 'AUDIT Food'); await fill('#nfK', '200'); await click('#nfSave');
    s = await state(); check('FOOD-01 historical custom-food calories immutable after catalog edit', s.historicalSum.k === 125, s);
    await fill('#nfK', 'abc'); await click('#nfSave'); s = await state(); check('FOOD-02 invalid calories rejected rather than zero saved', s.custom.find(f => f.n === 'AUDIT Food').k !== 0, s);
    await fill('#nfK', '1e309'); await click('#nfSave'); s = await state(); check('FOOD-03 nonfinite custom calories rejected', Number.isFinite(s.custom.find(f => f.n === 'AUDIT Food').k), s);
    await click('#fpX');
    const beforeProfile = await state(); await click('[data-tab="prog"]'); await fill('#bw', '85'); await fill('#goalIn', '75'); await click('[data-tab="food"]');
    s = await state(); check('Mass/goal changes norm without editing meals', JSON.stringify(s.meals) === JSON.stringify(beforeProfile.meals) && s.norm.kc !== beforeProfile.norm.kc, {before:beforeProfile,after:s});
    await fill('#kc', '2500'); await fill('#pr', '180'); s = await state(); check('Manual norms shown consistently', s.norm.kc === '2500' && s.norm.pr === '180' && s.totals.includes('/ 2500'), s);
    await click('#kcAuto'); s = await state(); check('Return calculation restores auto', !s.manual && s.norm.kc !== '2500', s);
    const beforeSwitch = await state(); await click('[data-tab="wo"]'); await click('[data-tab="food"]'); check('Food/workout switching preserves meals', JSON.stringify((await state()).meals) === JSON.stringify(beforeSwitch.meals), await state());
    await page.reload(); await page.waitForFunction(() => typeof render === 'function'); await click('[data-tab="food"]');
    s = await state(); check('Reload preserves food grams and custom catalogue', JSON.stringify(s.meals) === JSON.stringify(beforeSwitch.meals), s);
    check('FOOD-03 nonfinite custom calories survive reload safely', Number.isFinite(s.custom.find(f => f.n === 'AUDIT Food').k), s);
    check('No JS runtime errors', out.errors.length === 0, out.errors);
  } catch (e) { out.fatal = e.stack; }
  finally { await context.close(); }
}
(async () => { let browser; try {
  browser = await chromium.launch(LAUNCH);
  await run(browser, { width: 320, height: 568 }); await run(browser, { width: 390, height: 844 });
  console.log(JSON.stringify(process.env.AUDIT_FULL ? result : { ...result, contexts: result.contexts.map(c => ({ ...c, inventory: c.inventory.filter(x => x.visible),
    checks: c.checks.map(x => x.pass ? { name: x.name, pass: x.pass } : { ...x, evidence: !x.evidence.date ? x.evidence : {
      date: x.evidence.date, sum: x.evidence.sum, historicalKString:x.evidence.historicalKString,
      customKString:x.evidence.customKString, totals:x.evidence.totals, protein:x.evidence.protein,
      grams:x.evidence.meals && x.evidence.meals[0] && x.evidence.meals[0].items } }) })) }, null, 2));
  console.log('AUDIT COLLECTOR: complete; failed expectations are findings, not a green health check.');
  console.log('COUNTS ' + JSON.stringify(result.contexts.map(c => ({width:c.viewport.width, checks:c.checks.length, observed:c.checks.filter(x=>!x.pass).length, fatal:!!c.fatal, errors:c.errors.length}))));
  process.exitCode = result.contexts.some(c => c.fatal) ? 2 : 0;
} finally { if (browser) await browser.close(); } })().catch(e => { console.error(e); process.exitCode = 2; });
