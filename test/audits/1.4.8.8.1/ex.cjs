/* Independent catalogue audit. AUDIT ONLY: reproduced defects are explicit,
   exit 0 means the probe completed, never that every product check passed. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env.js');
const out = [];
const fixed = '2026-10-09T23:30:00+10:00';
let browser;
function log(view, name, status, evidence) {
  const r = { view, name, status, evidence }; out.push(r); console.log(JSON.stringify(r));
}
async function click(page, selector) {
  await page.locator(selector).first().click();
  await page.waitForTimeout(280); // product's 260 ms deliberate double-tap guard
}
async function fixture(page, date = '2026-10-09') {
  await page.evaluate(date => {
    S = build(); S.setup = 1; S.bw = 80; S.hints = 0;
    sel = date; mo = date.slice(0,7); tab = 'wo'; exOpen = null; libPick = null;
    Object.assign(LF, { scope:'core', q:'', mu:'', eq:'', lv:0, pl:'', cat:'', safe:false, ru:false });
    libN = 40; closeSetup(); sheetClose(); save(); render();
  }, date);
}
async function fresh(view, options = {}) {
  const ctx = await browser.newContext({ viewport:view, timezoneId:'Asia/Vladivostok', locale:'ru-RU',
    reducedMotion:'reduce', serviceWorkers:'block' });
  if (options.failLib) await ctx.route('**/exlib.js', route => route.abort('failed'));
  // Remote photos are deliberately blocked: functional audit never uploads owner data.
  await ctx.route('https://**/*', route => route.abort('failed'));
  const page = await ctx.newPage(); page.setDefaultTimeout(7000);
  await page.clock.install({time:new Date(fixed)});
  await page.clock.setFixedTime(new Date(fixed));
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.goto(APP);
  await page.locator('#tabs [data-tab="ex"]').waitFor();
  await page.locator('#setup.on').waitFor();
  await page.locator('#anBw').fill('80');
  await click(page,'#setOk');
  await fixture(page);
  return { ctx, page, errors };
}
async function catalog(page) {
  await click(page, '[data-tab="ex"]');
  await page.waitForFunction(() => !!LIB && document.querySelector('#exgrid .lcard'));
}
async function check(view, page, name, fn) {
  try { await fn(); } catch (e) { log(view,name,'HARNESS/UNEXPECTED',e.message); throw e; }
}
async function runView(v) {
  const view = `${v.width}x${v.height}`, {ctx,page,errors} = await fresh(v);
  try {
    await catalog(page);
    await check(view,page,'base/scopes/search/pagination', async () => {
      assert.equal(await page.evaluate(() => LIB.list.length),876);
      assert.equal(await page.locator('#exgrid .lcard').count(),40);
      assert.match(await page.locator('#exact').innerText(),/^40 /);
      const inventory=await page.locator('#scr-ex button').evaluateAll(bs=>bs.filter(b=>b.getClientRects().length).map(b=>({label:b.getAttribute('aria-label')||b.textContent.trim(),key:b.id||Object.keys(b.dataset).join(','),width:Math.round(b.getBoundingClientRect().width),height:Math.round(b.getBoundingClientRect().height)})));
      log(view,'visible catalogue button inventory','OBSERVED',inventory);
      await click(page,'[data-lscope="all"]');
      assert.match(await page.locator('#exact').innerText(),/^876 /);
      await click(page,'#exmore'); assert.equal(await page.locator('#exgrid .lcard').count(),80);
      await page.locator('#exs').fill('подъем');
      const names = await page.locator('#exgrid .lcopy b').allTextContents();
      assert.ok(names.length); assert.ok(names.every(n => /подъ[её]м/i.test(n)));
      await page.locator('#exs').fill('AUDIT_нет_такого');
      assert.equal(await page.locator('#exgrid .lcard').count(),0);
      await click(page,'[data-lscope="core"]');
      await click(page,'[data-lall]');
      assert.equal(await page.locator('#exs').inputValue(),'AUDIT_нет_такого');
      log(view,'base/scopes/search/pagination','PASS',{core:40,all:876,more:80,yoSearch:names.length,queryRetained:true});
    });
    await fixture(page); await catalog(page);
    await check(view,page,'muscle chips/all filter buttons',async()=>{
      const keys = await page.locator('[data-lmu]').evaluateAll(bs=>bs.map(b=>b.dataset.lmu));
      for (const k of keys) {
        await click(page,`[data-lmu="${k}"]`);
        assert.equal(await page.locator(`[data-lmu="${k}"]`).getAttribute('aria-pressed'),'true');
        assert.equal(await page.evaluate(()=>libList().every(libMatch)),true);
        await click(page,`[data-lmu="${k}"]`);
      }
      await click(page,'[data-lscope="all"]'); await click(page,'#exf');
      const filters = await page.locator('[data-lf]').evaluateAll(bs=>bs.map(b=>b.dataset.lf));
      for (const key of filters) {
        await click(page,`[data-lf="${key}"]`);
        const [field,value] = key.split(':');
        const actual = await page.evaluate(field=>LF[field],field);
        if(!['safe','ru'].includes(field)) assert.equal(String(actual),value);
      }
      await click(page,'[data-lfdone]'); assert.equal(await page.locator('#sh').evaluate(el=>el.classList.contains('on')),false);
      const pills = await page.locator('[data-lclr]').evaluateAll(bs=>bs.map(b=>b.dataset.lclr));
      for(const key of pills) await click(page,`[data-lclr="${key}"]`);
      assert.equal(await page.locator('[data-lclr]').count(),0);
      log(view,'muscle chips/all filter buttons','PASS',{chips:keys.length,filterButtons:filters.length,clearPills:pills.length});
    });
    await fixture(page); await catalog(page);
    await check(view,page,'favourite/detail/keyboard/back/geometry',async()=>{
      const card = page.locator('#exgrid .lcard').first(); const id=await card.getAttribute('data-lib');
      await click(page,`#exgrid [data-lfav="${id}"]`);
      assert.equal(await page.locator('#sh').evaluate(el=>el.classList.contains('on')),false);
      await click(page,'[data-lmu="fav"]'); assert.equal(await page.locator('#exgrid .lcard').count(),1);
      await card.press('Enter'); await page.locator('.lpage').waitFor();
      assert.equal(await page.locator('#sh [data-libadd]').isDisabled(),true); // Friday is rest
      assert.ok(await page.locator('.lmap svg').count());
      const geo = await page.locator('#sh .lbtns button').evaluateAll(bs=>bs.map(b=>({text:b.textContent,w:b.getBoundingClientRect().width,h:b.getBoundingClientRect().height})));
      const ladder = await page.locator('#sh .lstep [data-lib]').count();
      if(ladder){ await click(page,'#sh .lstep [data-lib]'); await page.locator('.lpage').waitFor(); }
      await click(page,'#shX');
      const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);
      assert.equal(overflow,false);
      await click(page,`#exgrid [data-lfav="${id}"]`); assert.equal(await page.locator('#exgrid .lcard').count(),0);
      await click(page,'#undoB'); assert.equal(await page.evaluate(id=>S.fav.includes(id),id),true);
      log(view,'favourite/detail/keyboard/back/geometry','PASS',{id,ladder,geo,overflow,undo:true});
    });
    await fixture(page,'2026-10-10');
    await check(view,page,'picker/add/duplicate/undo/reload',async()=>{
      await click(page,'#addEx');
      const disabledBefore = await page.locator('[data-addex][disabled]').count(); assert.ok(disabledBefore>0);
      await page.locator('#exq').fill('жим'); await click(page,'[data-libpick]');
      assert.equal(await page.locator('#exs').inputValue(),'жим');
      const target = page.locator('#exgrid [data-libadd]:not([disabled])').first();
      const id = await target.getAttribute('data-libadd');
      const before=await page.evaluate(()=>dayOf(sel).ex.length); await target.click();
      await page.waitForFunction(n=>dayOf(sel).ex.length===n+1,before);
      await click(page,'#addEx'); await click(page,'[data-libpick]');
      await page.locator('#exs').fill('');
      const o = await page.evaluate(id=>({n:libResolve(id).n,name:libExerciseName(libResolve(id))}),id);
      await page.locator('#exs').fill(o.n);
      assert.equal(await page.locator(`[data-libadd="${id}"]`).isDisabled(),true);
      await click(page,'#lpickX'); await click(page,'#undoB');
      assert.equal(await page.evaluate(()=>dayOf(sel).ex.length),before);
      await click(page,'#addEx'); await page.locator('#exq').fill('Аудит своё упражнение');
      await click(page,'[data-myex="Плечи"]');
      assert.equal(await page.evaluate(()=>myEx()['Аудит своё упражнение']),'Плечи');
      await page.waitForTimeout(600); await page.reload(); await page.locator('#tabs').waitFor();
      await catalog(page); await click(page,'[data-lscope="mine"]'); await page.locator('#exs').fill('Аудит своё');
      assert.equal(await page.locator('#exgrid .lcard').count(),1);
      await click(page,'#exgrid .lcard'); await page.locator('.lpage').waitFor();
      assert.match(await page.locator('.lpage').innerText(),/Ваше упражнение/);
      await click(page,'#shX');
      log(view,'picker/add/duplicate/undo/reload','PASS',{id,disabledBefore,customPersisted:true});
    });
    await fixture(page,'2026-10-10');
    await check(view,page,'swap/date/all/back/duplicate/history',async()=>{
      const original=await page.evaluate(()=>dayOf(sel).ex[0].n);
      await click(page,'[data-swap="0"]'); await page.locator('[data-swpick]').first().waitFor();
      const eqs=await page.locator('[data-sweq]').evaluateAll(bs=>bs.map(b=>b.dataset.sweq));
      for(const k of eqs) await click(page,`[data-sweq="${k}"]`);
      await click(page,'[data-sweq=""]'); await page.locator('#swQ').fill('AUDIT_нет');
      assert.equal(await page.locator('[data-swpick]').count(),0); await page.locator('#swQ').fill('');
      if(await page.locator('[data-swmore]').count()) await click(page,'[data-swmore]');
      await click(page,'[data-swpick]'); await page.locator('#swW').fill('17.5');
      await click(page,'[data-swm="1"]'); assert.equal(await page.locator('#swW').inputValue(),'17.5');
      await click(page,'[data-swback]'); await click(page,'[data-swpick]');
      const next=await page.evaluate(()=>SW.pick.o.n); await page.locator('#swW').fill('17.5');
      await click(page,'[data-swm="0"]'); await click(page,'[data-swgo]');
      assert.equal(await page.evaluate(()=>dayOf(sel).ex[0].n),next);
      assert.equal(await page.evaluate(()=>S.days[dayIdx(sel)].ex[0].n),original);
      assert.equal(await page.evaluate(()=>dayOf(sel).ex[0].w),17.5);
      await click(page,'#undoB'); assert.equal(await page.evaluate(()=>dayOf(sel).ex[0].n),original);
      await click(page,'[data-swap="0"]'); await page.locator('[data-swpick]').first().waitFor();
      await click(page,'[data-swpick]'); await click(page,'[data-swm="1"]'); await click(page,'[data-swgo]');
      assert.notEqual(await page.evaluate(()=>S.days[dayIdx(sel)].ex[0].n),original);
      await click(page,'#undoB');
      // Synthetic closed journal fixture exercises actual catalogue history output.
      await page.evaluate(()=>{ const d='2026-10-03', e=dayOf(d).ex[0]; S.rec[d]={log:{0:{n:e.n,g:e.g,w:30,s:1,r:'8',rs:[8],ws:[30],done:1,vol:240}}}; save(); });
      await catalog(page); const id=await page.evaluate(()=>LIB.list.find(o=>o.own===EXDB[dayOf('2026-10-03').ex[0].n][0]).id);
      await page.locator('#exs').fill(original); await click(page,`#exgrid [data-lib="${id}"]`);
      await page.locator('.llast').waitFor(); assert.match(await page.locator('.llast').innerText(),/30/);
      await click(page,'#shX');
      log(view,'swap/date/all/back/duplicate/history','PASS',{original,next,eqButtons:eqs.length,history:240});
    });
    await fixture(page,'2026-10-10'); await catalog(page);
    await check(view,page,'date/day change while detail open',async()=>{
      await click(page,'[data-lscope="all"]'); await page.locator('#exs').fill('жим');
      const id=await page.locator('#exgrid .lcard').first().getAttribute('data-lib');
      await click(page,`#exgrid [data-lib="${id}"]`); const label=await page.locator('#sh [data-libadd]').innerText();
      assert.match(label,/10/);
      // While a sheet is open, actual tabs/day buttons must be intercepted.
      const tabBox=await page.locator('[data-tab="wo"]').boundingBox();
      await page.mouse.click(tabBox.x+tabBox.width/2,tabBox.y+tabBox.height/2);
      assert.equal(await page.evaluate(()=>tab),'ex');
      // Browser resumed the next day: real app visibilitychange handler.
      await page.clock.setSystemTime(new Date('2026-10-11T00:00:10+10:00'));
      await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
      await page.waitForFunction(()=>sel==='2026-10-11');
      const before=await page.evaluate(()=>dayOf(sel).ex.length);
      if(!await page.locator('#sh [data-libadd]').isDisabled()) {
        await click(page,'#sh [data-libadd]');
        const added=await page.evaluate(before=>dayOf(sel).ex.length-before,before);
        assert.equal(added,1);
        log(view,'EX-01','REPRODUCED DEFECT',{label,actualDate:'2026-10-11',added,trigger:'real visibilitychange handler at next-day browser time; actual apply click'});
      } else log(view,'date/day change while detail open','LIMITED',{label,reason:'selected item already in day; no apply'});
    });
    log(view,'uncaught page errors','PASS',errors); assert.deepEqual(errors,[]);
  } finally { await ctx.close(); }
  const fail=await fresh(v,{failLib:true});
  try {
    await click(fail.page,'[data-tab="ex"]'); await fail.page.locator('#exgrid .lmsg').filter({hasText:'не удалось'}).waitFor();
    await click(fail.page,'[data-tab="wo"]'); await fixture(fail.page,'2026-10-10'); await click(fail.page,'#addEx');
    assert.ok(await fail.page.locator('[data-addex]').count());
    await click(fail.page,'#shX'); await fixture(fail.page,'2026-10-10');
    await click(fail.page,'[data-swap="0"]'); await fail.page.locator('#swBox .lmsg').filter({hasText:'не загрузилась'}).waitFor();
    assert.ok(await fail.page.locator('[data-swpick]').count());
    await click(fail.page,'[data-swpick]'); await click(fail.page,'[data-swgo]');
    log(view,'lazy loading failure/offline fallback','PASS',{programPicker:true,offlineSwap:true});
    // Same document successful retry, no page refresh.
    await fail.ctx.unroute('**/exlib.js'); await click(fail.page,'[data-tab="ex"]');
    await fail.page.waitForFunction(()=>!!LIB);
    log(view,'failed library retry','PASS',{rows:await fail.page.evaluate(()=>LIB.list.length)});
    await fixture(fail.page,'2026-10-10'); await click(fail.page,'[data-swap="0"]');
    await fail.page.locator('[data-swpick]').first().waitFor();
    const stale=await fail.page.locator('#swBox .lmsg').filter({hasText:'не загрузилась'}).count();
    if(stale) log(view,'EX-02','REPRODUCED DEFECT',{rows:await fail.page.evaluate(()=>LIB.list.length),message:await fail.page.locator('#swBox .lmsg').innerText(),afterSuccessfulRetry:true});
    else log(view,'offline banner recovery','PASS',{stale:false});
  } finally { await fail.ctx.close(); }
}
(async()=>{
  try {
    browser=await chromium.launch(LAUNCH);
    for(const v of [{width:320,height:568},{width:390,height:844}]) await runView(v);
    console.log('AUDIT COMPLETE: '+out.filter(r=>r.status==='REPRODUCED DEFECT').length+' reproduced defect observations. Exit 0 is probe completion, not all-green product validation.');
  } catch(e) { console.error(e.stack); process.exitCode=1; }
  finally { if(browser) await browser.close(); }
})();
