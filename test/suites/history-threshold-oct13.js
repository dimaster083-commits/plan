/* Regression: historical qualification belongs to the past plan, including
   whether its training slot had exercises. Synthetic isolated Chromium only.
   Baseline 1.4.8.8.5 is intentionally RED for BUG-0013 and LIMIT-003. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {APP,LAUNCH}=require('../env');
let failures=0,checks=0;
function check(name,actual,expected){checks++;try{assert.deepEqual(actual,expected);console.log('  ✓ '+name);}catch(e){failures++;console.log('  ✗ '+name+' expected='+JSON.stringify(expected)+' actual='+JSON.stringify(actual));}}
async function tap(p,s){await p.locator(s).click();await p.waitForTimeout(290);}
function seed(empty){
 S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.bw='80';S.goal='80';S.start='2026-09-28';S.bkAsk=Date.now();
 S.days.forEach(d=>{if(d.t!=='rest')d.ex=d.ex.slice(0,1);});
 S.rec={};S.quest={};S.pr={};S.xp=0;S.map={};S.pause={};
 S.vol=Object.fromEntries(GROUPS.map(([g])=>[g,0]));
 for(const ds of ['2026-10-06','2026-10-08']){const d=dayOf(ds),e=d.ex[0];S.rec[ds]={wo:1,log:{0:{done:1,n:e.n,g:e.g,w:40,s:3,r:'8-10',rs:[8,8,8],ws:[40,40,40],vol:960}},sp:{},dt:d.t};}
 if(empty)S.days[1].ex=[];
 sel=today();tab='wo';exOpen=null;editPast=false;entCache=null;wkCache=null;closeSetup();undoDrop();pendingActions.clear();lastTap={k:'',t:0};applyNutri();save();flush();render();
}
const state=()=>{const r=S.rec['2026-10-06'];return {need:weekNeed('2026-10-06'),cycle:planWeek('2026-10-13'),streak:streak(),current:weekNeed(),past:JSON.stringify({wo:r.wo,log:r.log,sp:r.sp,dt:r.dt}),ton:dayTon('2026-10-06')};};
async function type(p,t){await tap(p,'#wkPlan');await tap(p,'[data-wpm="all"]');await tap(p,'[data-wpd="1"]');await tap(p,'[data-wpt="'+t+'"]');await tap(p,'#askY');await tap(p,'#shX');}
async function remove(p){await tap(p,'.exrow[data-open="0"]');await tap(p,'[data-del="0"]');await tap(p,'#askY');await p.waitForFunction(()=>document.querySelector('#ask').classList.contains('on'));await tap(p,'#askN');}
async function reload(p){await p.evaluate(()=>flush());await p.reload();await p.waitForFunction(()=>S.setup===1);}
(async()=>{
 const b=await chromium.launch(LAUNCH),errors=[];
 try{for(const width of [320,390]){
  const ctx=await b.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',hasTouch:true});
  await ctx.addInitScript(()=>{const D=Date,offset=new D('2026-10-13T12:00:00+10:00').valueOf()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+offset]));}static now(){return D.now()+offset;}};});
  try{const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);await p.goto(APP);await p.waitForSelector('#setup.on');
   await p.evaluate(seed,false);const baseline=await p.evaluate(state);
   check(width+' independent historical fixture',[baseline.need,baseline.cycle,baseline.streak],[3,1,0]);
   await type(p,'rest');let v=await p.evaluate(state);
   check(width+' BUG-0013 type change preserves old threshold/cycle/streak',[v.need,v.cycle,v.streak],[3,1,0]);
   check(width+' rest removes slot from current template',v.current,2);
   await tap(p,'#undoB');check(width+' type-change Undo',await p.evaluate(state),baseline);
   await type(p,'rest');await reload(p);v=await p.evaluate(state);
   check(width+' BUG-0013 reload historical threshold/cycle/streak',[v.need,v.cycle,v.streak],[3,1,0]);
   await p.evaluate(seed,false);const before=await p.evaluate(state),snap=await p.evaluate(()=>JSON.stringify(S));
   await remove(p);v=await p.evaluate(state);
   check(width+' LAST-EX preserves historical threshold/cycle',[v.need,v.cycle],[3,1]);
   check(width+' current empty training slot excluded',v.current,2);
   check(width+' retained historical log/volume',[v.past,v.ton],[before.past,960]);
   await tap(p,'#undoB');check(width+' delete Undo full state',await p.evaluate(()=>JSON.stringify(S)),snap);
   await remove(p);await reload(p);v=await p.evaluate(state);
   check(width+' LAST-EX reload preserves historical threshold/cycle',[v.need,v.cycle],[3,1]);
   // The reverse edge: a training slot that was empty must remain empty in
   // historical eligibility after a type change populates its current plan.
   await p.evaluate(seed,true);v=await p.evaluate(state);
   check(width+' historical/current originally empty slot',[v.need,v.current,v.cycle],[2,2,2]);
   const emptyBefore=await p.evaluate(()=>JSON.stringify(S));await type(p,'lo1');v=await p.evaluate(state);
   check(width+' filling formerly empty historical slot preserves old qualification',[v.need,v.cycle],[2,2]);
   check(width+' newly populated current training slot counts',v.current,3);
   await tap(p,'#undoB');check(width+' empty-slot type-change Undo',await p.evaluate(()=>JSON.stringify(S)),emptyBefore);
   await type(p,'lo1');await reload(p);v=await p.evaluate(state);
   check(width+' empty historical slot survives reload',[v.need,v.cycle,v.current],[2,2,3]);
   // A replacement is still one nonempty training slot. Exercise identity
   // must not alter either historical or current qualification.
   await p.evaluate(seed,false);const original=await p.evaluate(()=>dayOf(today()).ex[0].n);
   await tap(p,'[data-swap="0"]');await p.waitForSelector('[data-swpick="0"]');await tap(p,'[data-swpick="0"]');await tap(p,'[data-swm="1"]');await tap(p,'[data-swgo]');
   check(width+' global replacement actually changed exercise',await p.evaluate(n=>dayOf(today()).ex[0].n!==n,original),true);
   v=await p.evaluate(state);check(width+' global replacement preserves eligibility',[v.need,v.cycle,v.current],[3,1,3]);
   await tap(p,'#undoB');check(width+' replacement Undo restores exercise',await p.evaluate(()=>dayOf(today()).ex[0].n),original);
   for(const addition of ['own','core','library']){
    await p.evaluate(seed,true);
    await tap(p,'#addEx');
    if(addition==='own'){
     await p.locator('#exq').fill('Синтетический жим октября');await tap(p,'[data-myex="Грудь"]');
    }else if(addition==='core'){
     await p.locator('#exq').fill('Жим лёжа');await tap(p,'[data-addex="Жим лёжа"]');
    }else{
     await tap(p,'[data-libpick]');await p.waitForSelector('[data-libadd]');await tap(p,'[data-libadd]:not([disabled]) >> nth=0');
    }
    check(width+' '+addition+' addition actually fills slot',await p.evaluate(()=>dayOf(today()).ex.length),1);
    v=await p.evaluate(state);check(width+' '+addition+' first addition preserves empty past/current populated',[v.need,v.cycle,v.current],[2,2,3]);
    await reload(p);v=await p.evaluate(state);check(width+' '+addition+' addition eligibility survives reload',[v.need,v.cycle,v.current],[2,2,3]);
    // Reload dismisses the temporary Undo; independently repeat its actual action.
    await p.evaluate(seed,true);const undoBase=await p.evaluate(()=>JSON.stringify(S));await tap(p,'#addEx');
    if(addition==='own'){await p.locator('#exq').fill('Другой синтетический жим');await tap(p,'[data-myex="Грудь"]');}
    else if(addition==='core'){await p.locator('#exq').fill('Жим лёжа');await tap(p,'[data-addex="Жим лёжа"]');}
    else{await tap(p,'[data-libpick]');await p.waitForSelector('[data-libadd]');await tap(p,'[data-libadd]:not([disabled]) >> nth=0');}
    await tap(p,'#undoB');check(width+' '+addition+' first-addition Undo',await p.evaluate(()=>JSON.stringify(S))===undoBase,true);
   }
   await p.evaluate(seed,true);await tap(p,'#addEx');await p.locator('#exq').fill('Жим лёжа');await tap(p,'[data-addex="Жим лёжа"]');
   const metadata=await p.evaluate(async()=>{
    const dates=Object.keys(S.rec).filter(ds=>!['2026-10-06','2026-10-08'].includes(ds));
    return {falseKept:S.rec['2026-10-06'].pe===false,metadataCount:dates.length,
     silent:dates.every(ds=>!recOf(ds).wo&&dayEntries(ds).length===0&&dayTon(ds)===0&&daySum(ds).k===0),
     history:historyDays().sort(),photos:await phKeys(),wo:rangeData('2026-09-28',16).wo,ton:rangeData('2026-09-28',16).ton};
   });
   check(width+' false eligibility explicitly stored',metadata.falseKept,true);
   check(width+' metadata-only dates exist but have no food/work',metadata.metadataCount>0&&metadata.silent,true);
   check(width+' metadata not counted in history/photos/workouts',[metadata.history,metadata.photos,metadata.wo,metadata.ton],[['2026-10-06','2026-10-08'],[],2,1920]);
   await tap(p,'[data-tab="prog"]');check(width+' visible progress history excludes metadata dates',await p.locator('#hist [data-day]').count(),2);await tap(p,'[data-tab="wo"]');
   const preSwap=await p.evaluate(()=>JSON.stringify(S));await tap(p,'#wkPlan');await tap(p,'[data-wpm="all"]');await tap(p,'[data-wpd="1"]');await tap(p,'[data-wpd="3"]');await tap(p,'#shX');
   check(width+' swapWeekdays retains false and historical qualification',await p.evaluate(()=>[S.rec['2026-10-06'].pe,weekNeed('2026-10-06'),planWeek('2026-10-13')]),[false,2,2]);
   await tap(p,'#undoB');check(width+' swapWeekdays Undo restores false snapshot/full state',await p.evaluate(()=>JSON.stringify(S))===preSwap,true);
   const imported=await p.evaluate(()=>{const copy=JSON.parse(JSON.stringify(S));copy.rec['2026-09-29'].pe=false;copy.rec['2026-10-08'].pe=true;copy.rec['2026-10-12']={log:{},sp:{},wo:0,pe:'false'};return {v:3,state:copy,photos:{}};});
   await p.setInputFiles('#impFile',{name:'synthetic-eligibility.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(imported))});await p.waitForSelector('#ask.on');await tap(p,'#askY');
   await p.waitForFunction(()=>document.getElementById('noteT').textContent.includes('восстановлен'));
   check(width+' import validates pe while retaining false/true',await p.evaluate(()=>[S.rec['2026-09-29'].pe,S.rec['2026-10-06'].pe,S.rec['2026-10-08'].pe,Object.hasOwn(S.rec['2026-10-12'],'pe')]),[false,false,true,false]);
   await reload(p);check(width+' imported false eligibility survives reload',await p.evaluate(()=>[S.rec['2026-10-06'].pe,weekNeed('2026-10-06'),planWeek('2026-10-13')]),[false,2,2]);
   // A start date inside a week must protect that whole week's qualification.
   await p.evaluate(seed,false);await p.evaluate(()=>{
    S.start='2026-09-30';S.rec={};
    for(const ds of ['2026-10-01','2026-10-03']){const d=dayOf(ds),e=d.ex[0];S.rec[ds]={wo:1,log:{0:{done:1,n:e.n,g:e.g,w:40,s:3,r:'8-10',rs:[8,8,8],ws:[40,40,40],vol:960}},sp:{},dt:d.t};}
    entCache=null;wkCache=null;save();flush();render();
   });
   check(width+' midweek start independent old qualification',await p.evaluate(()=>[weekNeed('2026-09-28'),planWeek('2026-10-13')]),[3,1]);
   const midweekLog=await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(S.rec).map(([ds,r])=>[ds,r.log]))));
   await type(p,'rest');
   check(width+' midweek start type edit protects whole first week',await p.evaluate(()=>[weekNeed('2026-09-28'),planWeek('2026-10-13')]),[3,1]);
   check(width+' midweek start keeps original work rows',await p.evaluate(()=>JSON.stringify(Object.fromEntries(Object.entries(S.rec).filter(([,r])=>Object.keys(r.log||{}).length).map(([ds,r])=>[ds,r.log])))),midweekLog);
   await reload(p);
   check(width+' midweek start historical qualification survives reload',await p.evaluate(()=>[weekNeed('2026-09-28'),planWeek('2026-10-13')]),[3,1]);
   await p.evaluate(seed,false);await p.evaluate(()=>{S.rec['2026-09-28']={log:{},sp:{},wo:0,pe:false};save();flush();render();});await tap(p,'.exrow[data-open="0"]');await tap(p,'[data-del="0"]');await tap(p,'#askY');await p.waitForFunction(()=>document.querySelector('#ask').classList.contains('on'));
   check(width+' deletion captures true for past date without journal',await p.evaluate(()=>S.rec['2026-09-29'].pe),true);
   await tap(p,'#askY');
   check(width+' purging exercise history retains true/false metadata-only qualification',await p.evaluate(()=>[S.rec['2026-09-29']&&S.rec['2026-09-29'].pe,S.rec['2026-09-28']&&S.rec['2026-09-28'].pe,weekNeed('2026-09-29')]),[true,false,3]);
   check(width+' confirmed purge still deletes primary exercise log',await p.evaluate(()=>Object.keys(S.rec['2026-10-06'].log).length),0);
  }finally{await ctx.close();}
 }}finally{await b.close();}
 check('no browser errors',errors,[]);console.log('history-threshold-oct13: '+failures+' failed / '+checks+' checks');process.exitCode=failures?1:0;
})().catch(e=>{console.error('HARNESS FAILURE',e);process.exitCode=1;});
