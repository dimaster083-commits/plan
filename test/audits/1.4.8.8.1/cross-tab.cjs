/* Independent root cross-tab audit: real interactions on synthetic data only.
   Exit 0 documents findings, not an application health PASS. */
const {chromium}=require('playwright-core');
const assert=require('node:assert/strict');
const {APP,LAUNCH}=require('../../env');
const PNG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
async function tap(p,selector){await p.click(selector);await p.waitForTimeout(290);}
async function open(p){await p.goto(APP);await p.waitForFunction(()=>S&&S.setup);}
async function fixture(p){
  await p.evaluate(()=>{
    S=build();migrate();S.setup=1;S.hints=0;S.sound=0;S.bw='80';S.goal='80';S.start='2026-09-28';S.bkAsk=Date.now();
    for(const ds of ['2026-09-29','2026-10-01']){
      const e=dayOf(ds).ex[0];S.rec[ds]={wo:1,log:{0:{done:1,n:e.n,g:e.g,w:40,s:3,r:'8-10',rs:[8,8,8],ws:[40,40,40],vol:960}},sp:{},dt:dayOf(ds).t};
    }
    S.rec['2026-10-10']={log:{},sp:{},ml:[{n:'Синтетическая еда',items:[{p:'Овсяные хлопья сухие',g:100}]}]};
    sel='2026-10-10';tab='wo';exOpen=null;closeSetup();undoDrop();applyNutri();save();flush();render();
  });
}
(async()=>{
  const browser=await chromium.launch(LAUNCH);
  try{
    for(const width of [320,390]){
      const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok'});
      await ctx.addInitScript(()=>{
        const D=Date,base=new D('2026-10-10T12:00:00+10:00').valueOf(),mark=performance.now();
        window.auditDayOffset=0;
        window.Date=class extends D{constructor(...args){super(...(args.length?args:[base+window.auditDayOffset+performance.now()-mark]));}static now(){return base+window.auditDayOffset+performance.now()-mark;}};
      });
      try{
        const p=await ctx.newPage();p.setDefaultTimeout(8000);await p.goto(APP);await p.waitForSelector('#setup.on');await tap(p,'#setSkip');await fixture(p);
        const before=await p.evaluate(()=>({streak:streak(),week:planWeek('2026-10-10'),food:JSON.stringify(recOf(sel).ml),past:JSON.stringify(S.rec['2026-09-29']),need:weekNeed('2026-09-29')}));
        assert.equal(before.streak,0);assert.equal(before.week,1);assert.equal(before.need,3);
        await tap(p,'#wkPlan');await tap(p,'[data-wpm="all"]');await tap(p,'[data-wpd="1"]');await tap(p,'[data-wpt="rest"]');
        if(await p.locator('#ask.on').count())await tap(p,'#askY');
        await p.waitForFunction(()=>S.days[1].t==='rest');
        const after=await p.evaluate(()=>({streak:streak(),week:planWeek('2026-10-10'),food:JSON.stringify(recOf(sel).ml),past:JSON.stringify(S.rec['2026-09-29']),need:weekNeed('2026-09-29')}));
        assert.equal(after.streak,1);assert.equal(after.week,1);assert.equal(after.need,3);assert.equal(after.food,before.food);
        console.log('DEFECT CROSS-01 '+width+' historical streak retroactively changes while cycle stays '+JSON.stringify({before,after}));
        await tap(p,'#shX');await p.reload();await p.waitForFunction(()=>S&&S.setup);
        assert.equal(await p.evaluate(()=>streak()),1);console.log('REPRO reload CROSS-01 '+width+' streak=1');
        const foodBeforeReset=await p.evaluate(()=>JSON.stringify(recOf(sel).ml));
        await tap(p,'#rd');const resetText=await p.locator('#askT').innerText();await tap(p,'#askY');
        assert.equal(await p.evaluate(()=>recOf(sel).ml),undefined);
        console.log('DEFECT CROSS-02 '+width+' clear marks silently deletes food '+JSON.stringify({resetText,foodBeforeReset}));
        await tap(p,'#undoB');assert.equal(await p.evaluate(()=>JSON.stringify(recOf(sel).ml)),foodBeforeReset);
        console.log('PASS '+width+' undo reset restores food');
        await p.evaluate(()=>{S.rec['2026-10-11']={log:{},sp:{},ml:[{n:'Завтра',items:[{p:'Овсяные хлопья сухие',g:200}]}]};save();flush();});
        await tap(p,'#rd');const oldDateText=await p.locator('#askT').innerText();
        await p.evaluate(()=>{window.auditDayOffset=864e5;document.dispatchEvent(new Event('visibilitychange'));});
        assert.equal(await p.evaluate(()=>sel),'2026-10-11');await tap(p,'#askY');
        const midnight=await p.evaluate(()=>({oldFood:recOf('2026-10-10').ml,newFood:recOf('2026-10-11').ml,selected:sel}));
        assert(midnight.oldFood);assert.equal(midnight.newFood,undefined);
        console.log('DEFECT CROSS-03 '+width+' reset confirms old date but clears new date '+JSON.stringify({oldDateText,midnight}));
        await tap(p,'#undoB');await p.evaluate(()=>{window.auditDayOffset=0;document.dispatchEvent(new Event('visibilitychange'));});
        // Two genuine windows share localStorage; old state must not overwrite new state.
        const p2=await ctx.newPage();p2.setDefaultTimeout(8000);await open(p2);
        await tap(p,'#gear');await tap(p,'[data-snd]');await tap(p,'#shX');
        const disk1=await p.evaluate(()=>localStorage.getItem(KEY));
        await tap(p2,'#gear');await tap(p2,'[data-hints]');
        await p2.waitForFunction(()=>flush.conflict===1);
        assert.equal(await p2.evaluate(()=>localStorage.getItem(KEY)),disk1);
        console.log('PASS '+width+' stale window write refused; new disk unchanged');await p2.close();
        // First and second destructive confirmations: cancel is always non-destructive.
        await p.evaluate(async({PNG})=>{await phPut('2026-10-10',PNG);PHCACHE.set('2026-10-10',PNG);await phSync();}, {PNG});
        await tap(p,'[data-tab="prog"]');await tap(p,'#wipe');await tap(p,'#askN');
        assert.equal(await p.evaluate(async()=>!!await phGet('2026-10-10')),true);
        await tap(p,'#wipe');await tap(p,'#askY');await tap(p,'#askN');
        assert.equal(await p.evaluate(()=>S.bw),'80');console.log('PASS '+width+' both wipe cancellations retain journal/photo');
        await tap(p,'#wipe');await tap(p,'#askY');
        await Promise.all([p.waitForEvent('load'),p.click('#askY')]);await p.waitForSelector('#setup.on');
        const wiped=await p.evaluate(async()=>({bw:S.bw,rec:Object.keys(S.rec).length,photos:await Promise.race([phKeys(),new Promise(r=>setTimeout(()=>r('BLOCKED'),3000))])}));
        assert.equal(wiped.rec,0);assert.deepEqual(wiped.photos,[]);console.log('PASS '+width+' confirmed wipe actual journal/photos '+JSON.stringify(wiped));
      }finally{await ctx.close();}
    }
    console.log('AUDIT COMPLETE; CROSS-01/02/03 reproduced at both widths, no fixes applied');
  }finally{await browser.close();}
})().catch(e=>{console.error('AUDIT HARNESS FAILURE',e);process.exitCode=1;});
