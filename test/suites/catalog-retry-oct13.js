/* BUG-0006: offline swap fallback must recover after real lazy-library retry. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
let checks=0,failures=0;
const tap=async(p,s)=>{await p.locator(s).first().click();await p.waitForTimeout(280);};
(async()=>{const browser=await chromium.launch(LAUNCH);try{for(const width of[320,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.route('https://**/*',r=>r.abort());await ctx.route('**/exlib.js',r=>r.abort());
  try{const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
    await p.clock.install({time:new Date('2026-10-13T02:00:00Z')});await p.clock.resume();await p.goto(APP);await p.waitForSelector('#setup.on');await tap(p,'#setSkip');
    await p.evaluate(()=>{S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.bw='80';S.bkAsk=Date.now();sel='2026-10-13';tab='wo';closeSetup();sheetClose();undoDrop();save();flush();render();});
    await tap(p,'[data-swap="0"]');await p.locator('#swBox .lmsg').filter({hasText:'не загрузилась'}).waitFor();
    checks++;try{assert.ok(await p.locator('[data-swpick]').count(),'offline alternatives remain usable');console.log('✓ '+width+' offline fallback has alternatives');}
    catch(e){failures++;console.log('✗ '+width+' offline fallback → '+e.message);}
    await tap(p,'#shX');await ctx.unroute('**/exlib.js');await tap(p,'[data-tab="ex"]');await p.waitForFunction(()=>!!LIB&&LIB.byId.size===876);
    await tap(p,'[data-tab="wo"]');await tap(p,'[data-swap="0"]');await p.locator('[data-swpick]').first().waitFor();
    checks++;try{assert.equal(await p.locator('#swBox .lmsg').filter({hasText:'не загрузилась'}).count(),0,'successful retry removes stale offline warning');console.log('✓ '+width+' successful retry removes offline warning');}
    catch(e){failures++;console.log('✗ '+width+' successful retry → '+e.message);}
    await tap(p,'#shX');await tap(p,'[data-swap="0"]');await p.locator('[data-swpick]').first().waitFor();
    checks++;try{assert.equal(await p.locator('#swBox .lmsg').filter({hasText:'не загрузилась'}).count(),0);assert.deepEqual(errors,[]);console.log('✓ '+width+' subsequent swap stays recovered without errors');}
    catch(e){failures++;console.log('✗ '+width+' subsequent swap → '+e.message);}
    // The actual loader builds LIB first; only its callback delivery is delayed.
    // Deliver the latest request first, then the obsolete success/failure.
    for(const outcome of['success','failure']){
      await tap(p,'#shX');
      await p.evaluate(()=>{window.__auditLoader=loadLib;window.__auditQueue=[];
        loadLib=()=>window.__auditLoader().then(L=>new Promise((ok,no)=>window.__auditQueue.push({ok:()=>ok(L),no})));});
      try{
        await tap(p,'[data-swap="0"]');await p.waitForFunction(()=>window.__auditQueue.length===1);
        await tap(p,'#shX');await tap(p,'[data-swap="1"]');await p.waitForFunction(()=>window.__auditQueue.length===2);
        await p.evaluate(()=>window.__auditQueue[1].ok());await p.locator('[data-swpick]').first().waitFor();
        const current=await p.evaluate(()=>({from:SW.from,ids:SW.cands.map(x=>x.o.id),text:$('swBox').textContent}));
        await p.evaluate(outcome=>{if(outcome==='success')window.__auditQueue[0].ok();else window.__auditQueue[0].no(new Error('delayed obsolete load'));},outcome);
        await p.waitForTimeout(80);
        checks++;try{
          const after=await p.evaluate(()=>({from:SW.from,ids:SW.cands.map(x=>x.o.id),text:$('swBox').textContent,offline:!!SW.offline}));
          assert.deepEqual({from:after.from,ids:after.ids,text:after.text},current,'obsolete callback preserves latest candidates');
          assert.equal(after.offline,false,'obsolete callback cannot restore offline flag');console.log('✓ '+width+' obsolete '+outcome+' preserves current swap');
        }catch(e){failures++;console.log('✗ '+width+' obsolete '+outcome+' → '+e.message);}
      }finally{await p.evaluate(()=>{loadLib=window.__auditLoader;delete window.__auditLoader;delete window.__auditQueue;});}
    }
  }finally{await ctx.close();}
}}finally{await browser.close();}console.log('CATALOG RETRY: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=2;});
