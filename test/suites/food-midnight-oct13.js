/* Captures food action dates before asynchronous confirmation/naming.
   Literal 125/250/300/400 kcal fixtures; real UI, clock and visibility handler. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
let checks=0,failures=0;
const a='2026-10-12',b='2026-10-13';
const tap=async(p,s)=>{await p.locator(s).first().click();await p.waitForTimeout(280);};
const state=p=>p.evaluate(()=>({rec:JSON.parse(JSON.stringify(S.rec)),tpl:JSON.parse(JSON.stringify(S.tpl)),
  sums:['2026-10-11','2026-10-12','2026-10-13'].map(ds=>daySum(ds).k)}));
async function seed(p){
  await p.clock.setFixedTime(new Date('2026-10-12T23:59:00+10:00'));
  await p.evaluate(()=>{
    S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.bw='80';S.goal='80';S.bkAsk=Date.now();S.rec={};
    S.myFood=[{n:'MIDNIGHT Food',k:100,p:10,f:2,c:15}];invalidateFood();
    for(const[ds,g]of[['2026-10-11','300'],['2026-10-12','125'],['2026-10-13','250']])
      recRW(ds).ml=[{n:'Meal '+ds,note:'',items:[{p:'MIDNIGHT Food',g}]}];
    S.tpl=[{n:'MIDNIGHT Template',ml:[{n:'Template',note:'',items:[{p:'MIDNIGHT Food',g:'400'}]}]}];
    sel='2026-10-12';mo='2026-10';tab='food';lastDay=today();closeSetup();sheetClose();closePick();
    if($('ask').classList.contains('on'))askClose(false);undoDrop();save();flush();render();
  });
}
async function nextDay(p){
  await p.clock.setFixedTime(new Date('2026-10-13T00:01:00+10:00'));
  await p.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));
  assert.equal(await p.evaluate(()=>sel),b,'real visibility handler must select new day');
}
async function reload(p){await p.evaluate(()=>flush());await p.reload();await p.waitForFunction(()=>typeof render==='function');}
async function begin(p,op){
  if(op==='delete')await tap(p,'[data-mld="0"]');
  else{await tap(p,'#cpBtn');await tap(p,op==='copy'?'[data-from="2026-10-11"]':op==='apply'?'[data-tpl="0"]':'[data-save]');}
  if(op==='save')await p.locator('#askI').fill('MIDNIGHT Saved');
  assert.equal(await p.locator('#ask').evaluate(x=>x.classList.contains('on')),true);
}
async function check(p,width,name,fn){checks++;await seed(p);try{await fn();console.log('✓ '+width+' '+name);}
  catch(e){failures++;console.log('✗ '+width+' '+name+' → '+e.message);}}
(async()=>{const browser=await chromium.launch(LAUNCH);try{for(const width of[320,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});
  await ctx.route('https://**/*',r=>r.abort());
  try{const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
    await p.clock.install({time:new Date('2026-10-12T23:59:00+10:00')});await p.clock.resume();await p.goto(APP);await p.waitForSelector('#setup.on');await tap(p,'#setSkip');
    for(const op of['copy','apply','delete','save']){
      await check(p,width,op+' midnight cancel leaves all dates and templates',async()=>{
        const before=await state(p);await begin(p,op);await nextDay(p);await tap(p,'#askN');assert.deepEqual(await state(p),before);
      });
      await check(p,width,op+' midnight confirm targets original date after reload',async()=>{
        await begin(p,op);await nextDay(p);await tap(p,'#askY');await reload(p);const s=await state(p);
        assert.equal(s.sums[0],300,'source day is unchanged');assert.equal(s.sums[2],250,'new day is unchanged');
        if(op==='save'){assert.equal(s.sums[1],125);assert.equal(s.tpl.at(-1).ml[0].items[0].g,'125','template captures original day');}
        else{assert.equal(s.sums[1],op==='copy'?300:op==='apply'?400:0,'original day receives confirmed action');
          if(op==='delete')assert.equal(s.rec[a].ml.length,0);}
      });
      await check(p,width,op+' midnight Undo restores all dates and templates through reload',async()=>{
        const before=await state(p);await begin(p,op);await nextDay(p);await tap(p,'#askY');await tap(p,'#undoB');
        assert.deepEqual(await state(p),before);await reload(p);assert.deepEqual(await state(p),before);
      });
    }
    for(const op of['copy','apply','save'])await check(p,width,op+' retains displayed payload while confirmation waits',async()=>{
      await begin(p,op);
      await p.evaluate(op=>{
        if(op==='copy')S.rec['2026-10-11'].ml[0].items[0].g='999';
        else if(op==='apply')S.tpl[0].ml[0].items[0].g='999';
        else S.rec['2026-10-12'].ml[0].items[0].g='999';
        save();flush();
      },op);
      await tap(p,'#askY');const s=await state(p);
      if(op==='save')assert.equal(s.tpl.at(-1).ml[0].items[0].g,'125','named template uses displayed ration snapshot');
      else assert.equal(s.sums[1],op==='copy'?300:400,'copied payload matches displayed source snapshot');
      assert.equal(s.sums[2],250);
    });
    await check(p,width,'midnight product picker adds to captured original meal and Undo',async()=>{
      const before=await state(p);await tap(p,'[data-pick="0"]');await p.locator('#fq').fill('MIDNIGHT Food');await tap(p,'[data-add="MIDNIGHT Food"]');
      await nextDay(p);await tap(p,'#fpAdd');assert.deepEqual((await state(p)).sums,[300,225,250]);await tap(p,'#undoB');assert.deepEqual(await state(p),before);
    });
    checks++;try{assert.deepEqual(errors,[]);console.log('✓ '+width+' no uncaught errors');}catch(e){failures++;console.log('✗ '+width+' uncaught errors '+e.message);}
  }finally{await ctx.close();}
}}finally{await browser.close();}console.log('FOOD MIDNIGHT: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=2;});
