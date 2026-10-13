/* Independent caccb68 audit. Only synthetic browser state; production is untouched.
   Exit 1 = an independently stated expectation failed; KNOWN/LIMIT are separate. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');
const out = []; let failures = 0;
const a = '2026-10-12', b = '2026-10-13';
const time = '2026-10-12T23:59:00+10:00';
const tap = async (p,s) => { await p.locator(s).first().click(); await p.waitForTimeout(280); };
const fill = async (p,s,v) => { await p.locator(s).fill(v); };
const snap = p => p.evaluate(() => ({sel,rec:JSON.parse(JSON.stringify(S.rec)),tpl:JSON.parse(JSON.stringify(S.tpl)),
  picked:JSON.parse(JSON.stringify(picked)),myFood:JSON.parse(JSON.stringify(S.myFood)),
  sums:['2026-10-11','2026-10-12','2026-10-13'].map(ds=>daySum(ds))}));
async function seed(p) {
  await p.clock.setFixedTime(new Date(time));
  await p.evaluate(() => {
    S=build(); migrate(); S.setup=1; S.sound=0; S.hints=0; S.bw='80'; S.goal='80';
    S.height=180; S.age=30; S.sex='m'; S.bkAsk=Date.now(); S.rec={}; S.pause={}; applyNutri();
    S.myFood=[{n:'AUDIT Food',k:100,p:10,f:2,c:15}]; invalidateFood();
    for (const [ds,g] of [['2026-10-11','300'],['2026-10-12','125'],['2026-10-13','250']])
      recRW(ds).ml=[{n:'Meal '+ds,note:'',items:[{p:'AUDIT Food',g}]}];
    S.tpl=[{n:'AUDIT Template',ml:[{n:'Template Meal',note:'',items:[{p:'AUDIT Food',g:'400'}]}]}];
    sel='2026-10-12'; mo='2026-10'; tab='food'; lastDay=today(); exOpen=null; libPick=null;
    closeSetup(); sheetClose(); closePick(); if($('ask').classList.contains('on')) askClose(false);
    undoDrop(); save(); flush(); render();
  });
}
async function midnight(p) {
  await p.clock.setFixedTime(new Date('2026-10-13T00:01:00+10:00'));
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await p.evaluate(()=>sel),b);
}
async function check(p,width,name,expected,fn) {
  await seed(p);
  try { const actual=await fn(); out.push({width,name,status:'PASS',expected,actual}); console.log(JSON.stringify(out.at(-1))); }
  catch(e) { if(e.code!=='ERR_ASSERTION') throw e;
    failures++; const actual=await snap(p); out.push({width,name,status:'NEW_DEFECT',expected,actual,error:e.message}); console.log(JSON.stringify(out.at(-1))); }
}
async function fresh(browser,width,failLib=false) {
  const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.route('https://**/*',r=>r.abort());
  if(failLib) await ctx.route('**/exlib.js',r=>r.abort());
  const p=await ctx.newPage(); p.setDefaultTimeout(6500); const errors=[];
  p.on('pageerror',e=>errors.push(e.message));
  await p.clock.install({time:new Date(time)}); await p.clock.resume(); await p.clock.setFixedTime(new Date(time));
  await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p,'#setSkip'); await seed(p);
  return {ctx,p,errors};
}
(async()=>{
  const browser=await chromium.launch(LAUNCH);
  try { for(const width of [320,390]) {
    const {ctx,p,errors}=await fresh(browser,width);
    try {
      await check(p,width,'copy confirmation after midnight','copy replaces Oct12 only; Oct13 stays 250 kcal',async()=>{
        await tap(p,'#cpBtn'); await tap(p,'[data-from="2026-10-11"]'); await midnight(p); await tap(p,'#askY');
        const s=await snap(p); assert.equal(s.sums[1].k,300); assert.equal(s.sums[2].k,250); return s.sums;
      });
      await check(p,width,'template confirmation after midnight','template replaces Oct12 only; Oct13 stays 250 kcal',async()=>{
        await tap(p,'#cpBtn'); await tap(p,'[data-tpl="0"]'); await midnight(p); await tap(p,'#askY');
        const s=await snap(p); assert.equal(s.sums[1].k,400); assert.equal(s.sums[2].k,250); return s.sums;
      });
      await check(p,width,'delete meal confirmation after midnight','remove Oct12 meal only; Oct13 stays 250 kcal',async()=>{
        await tap(p,'[data-mld="0"]'); await midnight(p); await tap(p,'#askY');
        const s=await snap(p); assert.equal(s.rec[a].ml.length,0); assert.equal(s.sums[2].k,250); return s.sums;
      });
      await check(p,width,'save template naming after midnight','template saves ration shown when naming started:125 kcal',async()=>{
        await tap(p,'#cpBtn'); await tap(p,'[data-save]'); await fill(p,'#askI','Late Template');
        await midnight(p); await tap(p,'#askY'); const s=await snap(p);
        assert.equal(s.tpl.at(-1).ml[0].items[0].g,'125'); return s.tpl.at(-1);
      });
      await check(p,width,'picker add after midnight','picker adds 100g to originating Oct12 meal; Oct13 unchanged',async()=>{
        await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food'); await tap(p,'[data-add="AUDIT Food"]');
        await midnight(p); await tap(p,'#fpAdd'); const s=await snap(p);
        assert.equal(s.sums[1].k,225); assert.equal(s.sums[2].k,250); return s.sums;
      });
      await check(p,width,'selected custom product case rename','selected position follows case rename and counts 100 kcal',async()=>{
        await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food'); await tap(p,'[data-add="AUDIT Food"]');
        await fill(p,'#nfN','audit food'); await tap(p,'#nfSave');
        const pending=await p.evaluate(()=>({picked,db:S.myFood,history:daySum('2026-10-11')}));
        await tap(p,'#fpAdd'); const s=await snap(p);
        assert.equal(s.sums[1].k,225); assert.equal(s.rec[a].ml[0].items.at(-1).p,'audit food'); return {pending,sums:s.sums};
      });
      await check(p,width,'copy clone, undo and reload','copy is independent; Undo restores 125g through reload',async()=>{
        await tap(p,'#cpBtn'); await tap(p,'[data-from="2026-10-11"]'); await tap(p,'#askY');
        assert.equal((await snap(p)).sums[1].k,300); await tap(p,'#undoB');
        await p.evaluate(()=>flush()); await p.reload(); await p.waitForFunction(()=>typeof render==='function');
        await p.evaluate(()=>{sel='2026-10-12';tab='food';render();});
        const s=await snap(p); assert.equal(s.sums[1].k,125); assert.equal(s.sums[0].k,300); return s.sums;
      });
      await check(p,width,'case rename updates existing history/templates and undo','existing references follow canonical case, Undo restores old key',async()=>{
        await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food'); await fill(p,'#nfN','audit food'); await tap(p,'#nfSave');
        let s=await snap(p); assert.equal(s.sums[0].k,300); assert.equal(s.tpl[0].ml[0].items[0].p,'audit food');
        await tap(p,'#undoB'); s=await snap(p); assert.equal(s.myFood[0].n,'AUDIT Food'); assert.equal(s.sums[0].k,300); return s.sums;
      });
      await check(p,width,'dynamic custom nutrients are known LIMIT-004','100→200 updates prior 125g from125→250 kcal with original date/grams',async()=>{
        await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food'); await fill(p,'#nfK','200'); await tap(p,'#nfSave');
        const s=await snap(p); assert.equal(s.sums[1].k,250); assert.equal(s.rec[a].ml[0].items[0].g,'125'); return {classification:'LIMIT-004',sums:s.sums};
      });
      await check(p,width,'pause uses rest norms and preserves completed training norms','unclosed paused day rest; completed training +200 kcal',async()=>{
        const result=await p.evaluate(()=>{
          const ds='2026-10-13'; S.pause[mondayOf(ds)]=1;
          const rest=nutriFor('rest'),training=nutriFor(dayOf(ds).t), before=normDay(ds).kc;
          recRW(ds).wo=1; const after=normDay(ds).kc; sel=ds; render();
          return {rest:rest.kc,training:training.kc,before,after,ui:$('kc').value};
        });
        assert.equal(result.before,result.rest); assert.equal(result.after,result.training); assert.equal(+result.ui,+result.training); return result;
      });
      await check(p,width,'catalog normalization/favorites/duplicates/rest','876 full ids; е/ё same; favorites reflect Undo; existing id rejected',async()=>{
        await tap(p,'[data-tab="ex"]'); await p.waitForFunction(()=>!!LIB);
        const result=await p.evaluate(()=>{
          Object.assign(LF,{scope:'all',q:'жим лёжа',mu:'',eq:'',lv:0,pl:'',cat:'',safe:false,ru:false}); paintLib();
          const yo=libList().map(o=>o.id); LF.q='жим лежа'; const ye=libList().map(o=>o.id);
          LF.q=''; LF.scope='mine'; S.fav=[]; paintLib(); return {yo,ye,n:LIB.byId.size};
        }); assert.deepEqual(result.yo,result.ye); assert.equal(result.n,876);
        await p.evaluate(()=>{LF.scope='all';LF.q='';paintLib();}); await fill(p,'#exs','inchworm'); await tap(p,'[data-lfav="Inchworm"]');
        assert.equal(await p.evaluate(()=>libMineIds().has('Inchworm')),true); await tap(p,'#undoB');
        assert.equal(await p.evaluate(()=>libMineIds().has('Inchworm')),false);
        const dup=await p.evaluate(()=>{
          const ds='2026-10-13',id='Dumbbell_Bench_Press';libAdd(id,ds);undoDrop(); const before=JSON.stringify(S);
          libAdd(id,ds);const same=before===JSON.stringify(S); return {same,ds,n:dayOf(ds).ex.filter(e=>S.libEx?.[e.n]?.[0]===id||e.n==='Жим гантелей лёжа').length};
        }); assert.equal(dup.same,true); assert.equal(dup.n,1);
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true); return {normalization:result.yo.length,dup};
      });
      assert.deepEqual(errors,[]); console.log(JSON.stringify({width,status:'PASS',name:'uncaught runtime errors',actual:errors}));
    } finally {await ctx.close();}
    const retry=await fresh(browser,width,true);
    try {
      await retry.p.evaluate(()=>{sel='2026-10-13';tab='wo';render();}); await tap(retry.p,'[data-swap="0"]');
      await retry.p.locator('#swBox .lmsg').filter({hasText:'не загрузилась'}).waitFor();
      await tap(retry.p,'#shX'); await retry.ctx.unroute('**/exlib.js');
      await tap(retry.p,'[data-tab="ex"]'); await retry.p.waitForFunction(()=>!!LIB);
      await tap(retry.p,'[data-tab="wo"]'); await tap(retry.p,'[data-swap="0"]'); await retry.p.locator('[data-swpick]').first().waitFor();
      const actual=await retry.p.evaluate(()=>({loaded:LIB.byId.size,offline:SW.offline,text:$('swBox').textContent.match(/База каталога[^.]+\./)?.[0]}));
      assert.equal(actual.loaded,876);
      out.push({width,status:actual.offline&&actual.text?'KNOWN_DEFECT':'PASS',name:'BUG-0006',expected:'successful retry removes offline warning',actual}); console.log(JSON.stringify(out.at(-1)));
    } finally {await retry.ctx.close();}
  }} finally {await browser.close();}
  console.log('AUDIT '+JSON.stringify({observations:out.length,newFailedExpectations:failures,known:out.filter(x=>x.status==='KNOWN_DEFECT').length}));
  process.exitCode=failures?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=2;});
