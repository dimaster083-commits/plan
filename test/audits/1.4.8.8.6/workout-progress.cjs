/* Diagnostic probe, production state is synthetic and isolated.
   Exit 0 means recorded observations reproduced, not bug-free application. */
const { chromium } = require('playwright-core');
const assert = require('node:assert/strict');
const { APP, LAUNCH } = require('../../env');
async function tap(p, s) { await p.locator(s).click(); await p.waitForTimeout(290); }
function seed(mode) {
  S=build(); migrate(); S.setup=1; S.hints=0; S.sound=0; S.bw='80'; S.goal='80';
  S.start='2026-09-28'; S.bkAsk=Date.now(); S.quest={};
  S.vol=Object.fromEntries(GROUPS.map(([g])=>[g,0])); S.pr={}; S.xp=0;
  sel=today(); tab='wo'; exOpen=mode==='rows'?0:null; editPast=false;
  if(mode==='rows') {
    S.start=addDays(today(),7);
    S.days.forEach(d=>{d.ex=[];});
    const d=dayOf(sel); d.t='up1'; d.s='Синтетический зал';
    d.ex=[{n:'Жим лёжа',g:'Грудь',w:60,s:4,r:'8-10'}];
    S.rec[sel]={log:{},sp:{},t0:Date.now()-300000};
  } else {
    for(const ds of ['2026-10-06','2026-10-08']) {
      const d=dayOf(ds),e=d.ex[0];
      S.rec[ds]={wo:1,log:{0:{done:1,n:e.n,g:e.g,w:40,s:3,r:'8-10',rs:[8,8,8],ws:[40,40,40],vol:960}},sp:{},dt:d.t};
    }
    if(mode==='delete') S.days[1].ex=[{n:'Жим лёжа',g:'Грудь',w:60,s:3,r:'8-10'}];
  }
  entCache=null; wkCache=null; closeSetup(); undoDrop(); pendingActions.clear(); lastTap={k:'',t:0};
  applyNutri(); save(); flush(); render(); window.scrollTo(0,0);
}
function historical() {return {streak:streak(),cycle:planWeek('2026-10-13'),need:weekNeed('2026-10-06'),past:S.rec['2026-10-06'],ton:dayTon('2026-10-06')};}
function rows() {
  return {done:!!recOf(sel).log[0].done,log:recOf(sel).log[0],xp:S.xp,w:dayOf(sel).ex[0].w,
    sets:daySets(sel),ton:dayTon(sel),total:S.vol['Грудь'],range:rangeData(sel,1),
    visible:[...document.querySelectorAll('.ex .setr .srow')].map(r=>({r:r.querySelector('[data-rs]').value,w:r.querySelector('[data-ws]').value,k:r.querySelector('[data-rs]').dataset.kind,on:r.classList.contains('on')}))};
}
(async()=>{
 const b=await chromium.launch(LAUNCH); const errors=[];
 try {for(const width of [320,390]) {
  const ctx=await b.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',hasTouch:true});
  await ctx.addInitScript(()=>{const D=Date,offset=new D('2026-10-13T12:00:00+10:00').valueOf()-D.now();window.Date=class extends D{constructor(...a){super(...(a.length?a:[D.now()+offset]));}static now(){return D.now()+offset;}};});
  try {
   const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(10000);
   await p.goto(APP);await p.waitForSelector('#setup.on');
   // WP-01: historical week's two completions remain below its three-day threshold.
   await p.evaluate(seed,'streak'); const before=await p.evaluate(historical);
   assert.equal(before.streak,0);assert.equal(before.need,3);assert.equal(before.cycle,1);
   await tap(p,'#wkPlan');await tap(p,'[data-wpm="all"]');await tap(p,'[data-wpd="1"]');await tap(p,'[data-wpt="rest"]');
   await tap(p,'#askY');await p.waitForFunction(()=>S.days[1].t==='rest');
   const after=await p.evaluate(historical);assert.equal(after.streak,1);assert.equal(after.need,3);assert.equal(after.cycle,1);
   console.log('KNOWN BUG-0013 '+width+' '+JSON.stringify({before,after}));
   await tap(p,'#shX');await tap(p,'#undoB');assert.deepEqual(await p.evaluate(historical),before);
   await p.evaluate(seed,'streak');await tap(p,'#wkPlan');await tap(p,'[data-wpm="all"]');await tap(p,'[data-wpd="1"]');await tap(p,'[data-wpt="rest"]');await tap(p,'#askY');await tap(p,'#shX');await p.evaluate(()=>flush());
   await p.reload();await p.waitForFunction(()=>S.setup===1);assert.equal(await p.evaluate(()=>streak()),1);
   console.log('KNOWN reload '+width+' false historical streak=1; Undo separately restored baseline');
   // WP-02: deleting today's sole template exercise, while retaining history.
   await p.evaluate(seed,'delete'); const delBefore=await p.evaluate(historical);
   await tap(p,'.exrow[data-open="0"]');await tap(p,'[data-del="0"]');await tap(p,'#askY');
   await p.waitForFunction(()=>S.days[1].ex.length===0);
   await p.waitForFunction(()=>document.querySelector('#ask').classList.contains('on'));
   await tap(p,'#askN');const delAfter=await p.evaluate(historical);
   assert.equal(delBefore.need,3);assert.equal(delBefore.cycle,1);
   assert.equal(delAfter.need,2);assert.equal(delAfter.cycle,2);assert.equal(delAfter.ton,960);
   assert.deepEqual(delAfter.past,delBefore.past);
   console.log('LIMIT-003 REPRO historical cycle after sole-exercise deletion '+width+' '+JSON.stringify({before:delBefore,after:delAfter}));
   await tap(p,'#undoB');assert.deepEqual(await p.evaluate(historical),delBefore);
   // Repeat mutation and persistence (ask handlers are genuine UI).
   await tap(p,'.exrow[data-open="0"]');await tap(p,'[data-del="0"]');await tap(p,'#askY');await p.waitForFunction(()=>document.querySelector('#ask').classList.contains('on'));await tap(p,'#askN');await p.evaluate(()=>flush());
   await p.reload();await p.waitForFunction(()=>S.setup===1);assert.equal(await p.evaluate(()=>planWeek('2026-10-13')),2);
   // WP-03: variable row weights, warmup/failure/drop, shrink/restore and real Undo.
   await p.evaluate(seed,'rows');
   const weights=['20','60','65','25'],reps=['12','8','9','6'];
   for(let i=0;i<4;i++){await p.locator('[data-ws="'+i+'"]').fill(weights[i]);await p.locator('[data-rs="'+i+'"]').fill(reps[i]);}
   await tap(p,'[data-kindcyc="0"]');
   await tap(p,'[data-kindcyc="2"]');await tap(p,'[data-kindcyc="2"]');
   await tap(p,'[data-kindcyc="3"]');await tap(p,'[data-kindcyc="3"]');await tap(p,'[data-kindcyc="3"]');
   await tap(p,'[data-tick="1"]');await tap(p,'[data-tick="2"]');
   await p.locator('[data-f="s"]').fill('3');await p.locator('[data-f="s"]').blur();
   assert.equal(await p.evaluate(()=>!!recOf(sel).log[0].done),false);
   await p.locator('[data-f="s"]').fill('4');await p.locator('[data-f="s"]').blur();
   const draft=await p.evaluate(()=>JSON.stringify(S)); const draftRows=await p.evaluate(rows);
   assert.deepEqual(draftRows.visible.map(r=>r.w),weights);assert.deepEqual(draftRows.visible.map(r=>r.k),['w','','f','d']);
   await tap(p,'[data-tick="3"]');const done=await p.evaluate(rows);
   assert.equal(done.done,true);assert.equal(done.ton,1065);assert.equal(done.total,1065);assert.equal(done.sets,2);
   assert.equal(done.range.ton,1065);assert.equal(done.range.sets,2);assert.equal(done.w,60);assert.deepEqual(done.log.ws,[60,65]);assert.deepEqual(done.log.rs,[8,9]);
   await tap(p,'#undoB');assert.equal(await p.evaluate(()=>JSON.stringify(S)),draft);
   assert.deepEqual((await p.evaluate(rows)).visible,draftRows.visible);
   await tap(p,'[data-complete="0"]');await p.evaluate(()=>flush());await p.reload();await p.waitForFunction(()=>S.setup===1);
   assert.equal(await p.evaluate(()=>dayTon(today())),1065);assert.equal(await p.evaluate(()=>daySets(today())),2);
   console.log('PASS mixed types + 4→3→4 + completion + Undo + reload '+width+' journal/range/total=1065kg and 2 work sets');
   // WP-04: RPE10 only reverses progression, explicit Undo remains exact.
   await p.evaluate(seed,'rows');await p.locator('[data-f="s"]').fill('3');await p.locator('[data-f="s"]').blur();
   for(let i=0;i<3;i++)await p.locator('[data-rs="'+i+'"]').fill('10');
   await tap(p,'[data-complete="0"]');assert.equal(await p.evaluate(()=>dayOf(sel).ex[0].w),62.5);
   const progressed=await p.evaluate(()=>JSON.stringify(S));await tap(p,'[data-rpe="10"]');
   assert.equal(await p.evaluate(()=>dayOf(sel).ex[0].w),60);assert.equal(await p.evaluate(()=>dayTon(sel)),1800);
   await tap(p,'#undoB');assert.equal(await p.evaluate(()=>JSON.stringify(S)),progressed);
   await tap(p,'[data-rpe="10"]');await tap(p,'[data-rpe="10"]');assert.equal(await p.evaluate(()=>dayOf(sel).ex[0].w),62.5);
   await p.evaluate(()=>flush());await p.reload();await p.waitForFunction(()=>S.setup===1);assert.equal(await p.evaluate(()=>dayOf(today()).ex[0].w),62.5);assert.equal(await p.evaluate(()=>dayTon(today())),1800);
   console.log('PASS completion + RPE10 + Undo + remove RPE + reload '+width+' working=62.5kg, closed volume=1800kg');
  } finally {await ctx.close();}
 }} finally {await b.close();}
 assert.deepEqual(errors,[]);console.log('AUDIT COMPLETE: known BUG-0013 and LIMIT-003 reproduced; other scoped crossings passed.');
})().catch(e=>{console.error('PROBE FAILURE',e);process.exitCode=1;});
