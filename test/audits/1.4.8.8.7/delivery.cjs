/* Real served release, separate synthetic browser profiles; never owner data.
   The reused delivery check verifies canonical served bytes, activated worker
   and native photo/journal/food across offline reload. This adds v7 UI paths. */
const assert=require('node:assert/strict'),path=require('node:path');
const {spawn}=require('node:child_process');
const {chromium}=require('playwright-core');
const {LAUNCH}=require('../../env');
const url=process.env.GYM_APP_URL||'https://dimaster083-commits.github.io/plan/';
const DAY='2026-10-13',GRAMS='#mll [data-ml="0"] input[data-g="0"]';
async function baseDelivery(){
  await new Promise((resolve,reject)=>{
    const child=spawn(process.execPath,[path.resolve(__dirname,'../1.4.8.8.6/delivery.cjs')],{stdio:'inherit',env:process.env});
    child.on('error',reject);child.on('close',code=>code===0?resolve():reject(new Error('base delivery exit '+code)));
  });
}
async function tap(p,s){await p.locator(s).first().click();await p.clock.runFor(280);}
async function recorded(p){
  assert.deepEqual(await p.evaluate(()=>{
    flush();return [S.rec['2026-10-13'].ml[0].items[0].g,
      JSON.parse(localStorage.getItem(KEY)).rec['2026-10-13'].ml[0].items[0].g,
      daySum('2026-10-13').k];
  }),['125','125',125]);
}
(async()=>{
  await baseDelivery();
  const browser=await chromium.launch(LAUNCH);
  try{for(const width of [320,390]){
    const context=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',reducedMotion:'reduce'});
    try{
      const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
      // Start before the pause target; the clock runs between API calls.
      await p.clock.install({time:new Date('2026-10-12T12:00:00+10:00')});
      await p.clock.pauseAt(new Date('2026-10-13T12:00:00+10:00'));
      assert.equal(await p.evaluate(()=>Date.now()),Date.parse('2026-10-13T12:00:00+10:00'));
      await p.goto(url);await p.clock.runFor(800);await tap(p,'#setSkip');
      await p.evaluate(()=>{
        S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.bw='80';S.start='2026-09-28';
        S.bkAt=0;S.bkAsk=0;S.rec={};S.map={};S.pause={};
        for(const ds of ['2026-10-06','2026-10-08','2026-10-10']){
          const d=dayOf(ds),e=d.ex[0];S.rec[ds]={wo:1,dt:d.t,sp:{},log:{0:{done:1,n:e.n,g:e.g,w:40,s:1,r:'8',rs:[8],ws:[40],vol:320}}};
        }
        S.myFood=[{n:'Served v7 fixture',k:100,p:10,f:2,c:15}];
        recRW('2026-10-13').ml=[{n:'Served fixture',items:[{p:'Served v7 fixture',g:'125'}]}];
        invalidateFood();sel=today();tab='wo';scrubKeys();recomputeStats(1);undoDrop();save();flush();render();
      });
      await p.reload();
      await tap(p,'#fin');await tap(p,'[data-tab="food"]');await p.fill(GRAMS,'1e309');
      await tap(p,'#undoB');await recorded(p);
      assert.equal(await p.locator(GRAMS).inputValue(),'1e309');
      assert.ok((await p.locator(GRAMS).boundingBox()).height>=44);
      assert.equal(await p.locator(GRAMS).getAttribute('aria-invalid'),'true');
      console.log('✓ served '+width+' first Food visit/old workout Undo preserves raw, valid totals and44px');
      await p.fill(GRAMS,'');await p.evaluate(()=>paintFood());await recorded(p);
      assert.equal(await p.locator(GRAMS).inputValue(),'');
      await p.keyboard.press('Tab');await p.clock.runFor(100);
      assert.equal(await p.evaluate(()=>S.rec['2026-10-13'].ml[0].items[0].g),'');
      await tap(p,'#undoB');await recorded(p);
      console.log('✓ served '+width+' neutral empty redraw is not save; real blur commits0 and field Undo restores125');
      await tap(p,'[data-tab="wo"]');await tap(p,'#fin');
      await tap(p,'[data-tab="prog"]');await tap(p,'[data-meas="1"]');await p.fill('[data-mk="waist"]','87,5');
      await p.clock.runFor(3000);
      assert.deepEqual(await p.evaluate(()=>[!!undoRec,S.bkAsk,$('ask').classList.contains('on')]),[true,0,false]);
      await tap(p,'#undoB');
      assert.deepEqual(await p.evaluate(()=>[$('sh').classList.contains('on'),document.querySelector('[data-mk="waist"]').value,
        $('sh').contains(document.activeElement),document.body.style.overflow,!!undoRec]),[true,'87,5',true,'hidden',false]);
      await tap(p,'[data-measave="1"]');await p.clock.runFor(500);
      assert.equal(await p.evaluate(()=>S.meas[today()].waist),87.5);
      assert.equal(await p.evaluate(()=>S.bkAsk),0,'reminder must wait whole measurement Undo');
      await p.clock.runFor(7500);await p.locator('#ask.on').waitFor();
      assert.match(await p.locator('#askT').innerText(),/Копии прогресса/);
      assert.ok(await p.evaluate(()=>S.bkAsk)>0);await tap(p,'#askN');
      await recorded(p);assert.deepEqual(errors,[]);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
      console.log('✓ served '+width+' unrelated form/raw/focus/lock retained; backup waits modal and full Undo then appears');
    }finally{await context.close();}
  }}finally{await browser.close();}
})().catch(e=>{console.error('FATAL',e.stack);process.exitCode=1;});
