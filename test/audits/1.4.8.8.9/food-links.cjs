/* Scoped v9 audit only. Actual Chrome UI with synthetic isolated contexts.
   No application mutations. Literal expected arithmetic is stated per case.
   Exit 1 = a product expectation failed; exit 2 = broken audit/harness. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');
const A='2026-10-13', B='2026-10-14', C='2026-10-15', D='2026-10-16';
const G='#mll [data-ml="0"] input[data-g="0"]', NAME='LINK Food';
const caseArg=process.argv.indexOf('--case');
const caseFilter=(caseArg>=0?process.argv[caseArg+1]:null)||process.env.FOOD_CASE;
let checks=0, failures=0, sequences=0;
const tap=async(p,s)=>{ await p.locator(s).first().click(); await p.waitForTimeout(275); };
const fill=async(p,s,v,blur=true)=>{ await p.locator(s).first().fill(v); if(blur) await p.locator(s).first().blur(); await p.waitForTimeout(175); };
async function seed(p) {
  await p.goto(APP); await p.waitForFunction(()=>typeof render==='function');
  await p.waitForSelector('#setup.on'); await tap(p,'#setSkip');
  await p.evaluate(()=>{
    S=build(); migrate(); S.setup=1; S.hints=0; S.sound=0; S.bkAsk=Date.now();
    S.bw='80'; S.goal='80'; S.height=180; S.age=30; S.sex='m'; S.act='sit';
    S.rec={}; S.pause={}; S.map={}; applyNutri();
    S.myFood=[{n:'LINK Food',k:100,p:10,f:2,c:15}]; invalidateFood();
    for(const [ds,g] of [['2026-10-13','125'],['2026-10-14','250'],['2026-10-15','50']])
      recRW(ds).ml=[{n:'Meal '+ds,note:'',items:[{p:'LINK Food',g}]}];
    S.tpl=[{n:'400g template',ml:[{n:'Template',note:'',items:[{p:'LINK Food',g:'400'}]}]}];
    sel='2026-10-13'; mo='2026-10'; tab='food'; lastDay=today(); exOpen=null;
    closeSetup(); undoDrop(); save(); flush(); render();
  });
}
async function state(p) {
  return p.evaluate(()=>{
    flush(); const disk=JSON.parse(localStorage.getItem(KEY));
    return {sel,bw:S.bw,goal:S.goal,kcManual:S.kcManual,rec:S.rec,tpl:S.tpl,myFood:S.myFood,
      sums:['2026-10-13','2026-10-14','2026-10-15','2026-10-16'].map(daySum),
      ui:[$('tKc').textContent,$('tPr').textContent,$('tFa').textContent,$('tCa').textContent],
      norms:[$('kc').value,$('pr').value], grams:[...document.querySelectorAll('#mll input[data-g]')].map(x=>x.value),
      picked:JSON.parse(JSON.stringify(picked)), form:['N','K','P','F','C'].map(k=>$('nf'+k)?.value??null),
      picker:$('fp').classList.contains('on'), pickBar:$('fpbar').classList.contains('on'), undo:!!undoRec,disk};
  });
}
function equal(actual,expected,label){ checks++; assert.deepEqual(actual,expected,label); }
function finite(s){ checks++; assert.ok(s.sums.every(t=>Object.values(t).every(Number.isFinite)),'all dated totals are finite'); }
function totals(s,a=125,b=250,c=50){
  equal(s.sums.map(x=>x.k),[a,b,c,0],'dated kcal literals'); finite(s);
  equal([s.rec[A].ml[0].items[0].g,s.rec[B].ml[0].items[0].g,s.rec[C].ml[0].items[0].g],['125','250','50'],'grams remain dated');
  equal([s.disk.rec[A].ml[0].items[0].g,s.disk.rec[B].ml[0].items[0].g,s.disk.rec[C].ml[0].items[0].g],['125','250','50'],'disk grams remain dated');
}
async function picker(p){await tap(p,'[data-pick="0"]');await fill(p,'#fq',NAME);}
async function closePicker(p){ await tap(p,'#fpX'); if(await p.locator('#ask.on').count()) await tap(p,'#askY'); }
async function date(p,ds){await tap(p,'#chips [data-d="'+ds+'"]');}
async function reload(p){await p.reload();await p.waitForFunction(()=>typeof render==='function');await tap(p,'[data-tab="food"]');await date(p,A);return state(p);}
async function run(browser,width,name,expected,fn){
  if(caseFilter && !name.startsWith(caseFilter+' '))return;
  sequences++;
  const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.route('https://**/*',r=>r.abort());
  const e={}; let error=null;
  try {
    const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(7000);p.on('pageerror',x=>errors.push(x.message));
    await p.clock.install({time:new Date('2026-10-15T12:00:00+10:00')});await p.clock.resume();await p.clock.setFixedTime(new Date('2026-10-15T12:00:00+10:00'));
    await seed(p);
    try{await fn(p,e);equal(errors,[],'no page errors');equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'no horizontal overflow');}
    catch(x){if(x.code!=='ERR_ASSERTION')throw x;failures++;error=x.message;}
    const evidence=Object.fromEntries(Object.entries(e).map(([k,s])=>[k,typeof s==='string'?s:{
      sel:s.sel,bw:s.bw,goal:s.goal,kcManual:s.kcManual,norms:s.norms,sums:s.sums,ui:s.ui,grams:s.grams,picked:s.picked,form:s.form,picker:s.picker,pickBar:s.pickBar,undo:s.undo,
      savedGrams:[A,B,C].map(ds=>s.rec[ds]?.ml.map(m=>m.items)),diskGrams:[A,B,C].map(ds=>s.disk.rec[ds]?.ml.map(m=>m.items)),myFood:s.myFood,tpl:s.tpl,
    }]));
    console.log(JSON.stringify({width,name,expected,status:error?'EXPECTATION_FAILED':'PASS',...evidence,runtimeErrors:errors,error}));
  } finally {await ctx.close();}
}
(async()=>{
 const browser=await chromium.launch(LAUNCH);
 try{for(const width of [320,390]){
  await run(browser,width,'F1 body mass Undo with later live custom form',
   '90kg losing:2270/200; Undo restores80kg2670/150, pending222,50 nutrient string and dated food',async(p,e)=>{
    await fill(p,G,'1e309');await tap(p,'[data-tab="prog"]');await fill(p,'#bw','90');await tap(p,'[data-tab="food"]');
    e.changed=await state(p);equal(e.changed.norms,['2270','200'],'manual Mifflin arithmetic after90kg');totals(e.changed);
    await picker(p);await fill(p,'#nfK','222,50',false);await tap(p,'#undoB');e.undone=await state(p);
    equal(e.undone.bw,'80');equal(e.undone.norms,['2670','150']);equal(e.undone.form[1],'222,50');equal(e.undone.picker,true);equal(e.undone.grams[0],'1e309');totals(e.undone);
    await closePicker(p);await date(p,B);equal((await state(p)).norms,['2470','150']);e.reload=await reload(p);totals(e.reload);equal(e.reload.norms,['2670','150']);equal(e.reload.grams,['125']);
   });
  await run(browser,width,'F2 manual norms goal auto Undo date and reload',
   'manual2100/160 survives goal90; automatic2980/170; Undo manual2100/160 and rest2470/150; food unchanged',async(p,e)=>{
    await fill(p,G,'-2');await fill(p,'#kc','2100');await fill(p,'#pr','160');await tap(p,'[data-tab="prog"]');await fill(p,'#goalIn','90');await tap(p,'[data-tab="food"]');
    e.manual=await state(p);equal(e.manual.norms,['2100','160']);totals(e.manual);
    await tap(p,'#kcAuto');e.auto=await state(p);equal(e.auto.norms,['2980','170']);equal(e.auto.grams,['-2']);totals(e.auto);
    await picker(p);await fill(p,'#nfP','00012,50',false);await tap(p,'#undoB');e.undone=await state(p);equal(e.undone.norms,['2100','160']);equal(e.undone.form[2],'00012,50');equal(e.undone.grams,['-2']);totals(e.undone);
    await closePicker(p);await date(p,B);equal((await state(p)).norms,['2470','150']);e.reload=await reload(p);equal(e.reload.norms,['2100','160']);equal(e.reload.goal,'90');totals(e.reload);
   });
  await run(browser,width,'F3 dynamic nutrient decimals template copy Undo reload',
   '200.5kcal12.5p3f21c per100g:125g250.625/15.625/3.75/26.25;250g501.25;50g100.25;copy125g toB thenUndo250g',async(p,e)=>{
    await picker(p);for(const [id,v] of [['K','200,5'],['P','12,5'],['F','3'],['C','21']])await fill(p,'#nf'+id,v);await tap(p,'#nfSave');e.saved=await state(p);
    totals(e.saved,250.625,501.25,100.25);equal(e.saved.sums[0],{k:250.625,p:15.625,f:3.75,c:26.25});equal(e.saved.ui,['251 / 2670 ккал','16 / 150 г','жиры 4 г','углеводы 26 г']);
    await closePicker(p);await tap(p,'#cpBtn');await tap(p,'[data-save]');await fill(p,'#askI','125g saved after nutrient edit');await tap(p,'#askY');await tap(p,'#shX');
    await date(p,B);await tap(p,'#cpBtn');await tap(p,'[data-tpl="1"]');await tap(p,'#askY');e.copied=await state(p);equal(e.copied.sums.map(x=>x.k),[250.625,250.625,100.25,0]);equal(e.copied.rec[B].ml[0].items[0].g,'125');
    await tap(p,'#undoB');e.undone=await state(p);totals(e.undone,250.625,501.25,100.25);e.reload=await reload(p);totals(e.reload,250.625,501.25,100.25);equal(e.reload.tpl[1].ml[0].items,[{p:NAME,g:'125'}]);
   });
  await run(browser,width,'F4 selected product deletion and Undo',
   'deletion drops totals as warned; Undo restores saved food and the100g selected position removed by that same action',async(p,e)=>{
    await picker(p);await tap(p,'[data-add="'+NAME+'"]');await fill(p,'#nfP','0012,50',false);e.selected=await state(p);equal(e.selected.picked,[{p:NAME,g:100}]);
    await tap(p,'[data-my="'+NAME+'"]');e.warning=await p.locator('#askT').textContent();await tap(p,'#askY');e.deleted=await state(p);equal(e.deleted.sums.map(x=>x.k),[0,0,0,0]);equal(e.deleted.picked,[]);equal(e.deleted.form[2],'0012,50');
    await tap(p,'#undoB');e.undone=await state(p);totals(e.undone);equal(e.undone.form[2],'0012,50');
    // Capture the durable result before the independent transient selection assertion.
    equal(e.undone.disk.myFood,[{n:NAME,k:100,p:10,f:2,c:15}]);
    e.reload=await reload(p);totals(e.reload);equal(e.reload.myFood,[{n:NAME,k:100,p:10,f:2,c:15}]);
    equal(e.undone.picked,[{p:NAME,g:100}],'Undo must restore the selection removed by deletion');
   });
  await run(browser,width,'F5 case rename template deletion Undo apply',
   'case rename follows all dates and template; delete→Undo restores base; applying400g template toB gives400 thenUndo250',async(p,e)=>{
    await picker(p);await fill(p,'#nfN','link food');await tap(p,'#nfSave');e.renamed=await state(p);totals(e.renamed);equal(e.renamed.tpl[0].ml[0].items,[{p:'link food',g:'400'}]);
    await tap(p,'[data-my="link food"]');await tap(p,'#askY');await tap(p,'#undoB');e.restored=await state(p);totals(e.restored);equal(e.restored.myFood[0].n,'link food');
    await closePicker(p);await date(p,B);await tap(p,'#cpBtn');await tap(p,'[data-tpl="0"]');await tap(p,'#askY');e.applied=await state(p);equal(e.applied.sums.map(x=>x.k),[125,400,50,0]);
    await tap(p,'#undoB');e.undone=await state(p);totals(e.undone);e.reload=await reload(p);totals(e.reload);equal(e.reload.rec[A].ml[0].items[0].p,'link food');equal(e.reload.disk.tpl[0].ml[0].items[0].p,'link food');
   });
  await run(browser,width,'F6 live custom form and picker date across visibility midnight',
   'resumeOct16 changes visible date; product edit200 applies existing dated food; picked100g still added to originOct13; Undo only addition; reload same',async(p,e)=>{
    await picker(p);await tap(p,'[data-add="'+NAME+'"]');await fill(p,'#nfK','200');
    await p.clock.setFixedTime(new Date('2026-10-16T00:01:00+10:00'));await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));e.resumed=await state(p);
    equal(e.resumed.sel,D);equal(e.resumed.form[1],'200');equal(e.resumed.picked,[{p:NAME,g:100}]);equal(e.resumed.grams,[]);
    await tap(p,'#nfSave');e.saved=await state(p);totals(e.saved,250,500,100);equal(e.saved.sums[3].k,0);equal(e.saved.norms,['2470','150']);
    await tap(p,'#fpAdd');e.added=await state(p);equal(e.added.sums.map(x=>x.k),[450,500,100,0]);equal(e.added.rec[A].ml[0].items,[{p:NAME,g:'125'},{p:NAME,g:100}]);equal(e.added.ui[0],'0 / 2470 ккал');
    await tap(p,'#undoB');e.undone=await state(p);totals(e.undone,250,500,100);equal(e.undone.sel,D);e.reload=await reload(p);totals(e.reload,250,500,100);
   });
 }}finally{await browser.close();}
 console.log('FOOD_LINKS_AUDIT '+JSON.stringify({sequences,checks,failedExpectations:failures}));process.exitCode=failures?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=2;});
