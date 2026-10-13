/* A selected own product must follow canonical case rename, including Undo.
   Omitting transient picked from rename/reverse mapping creates ghost food. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
let checks=0,failures=0;
const tap=async(p,s)=>{await p.locator(s).first().click();await p.waitForTimeout(280);};
const state=p=>p.evaluate(()=>({rec:JSON.parse(JSON.stringify(S.rec)),tpl:JSON.parse(JSON.stringify(S.tpl)),
  food:JSON.parse(JSON.stringify(S.myFood)),picked:JSON.parse(JSON.stringify(picked)),
  sum:daySum('2026-10-12').k,history:daySum('2026-10-11').k}));
async function seed(p){await p.evaluate(()=>{
  S=build();migrate();S.setup=1;S.sound=0;S.hints=0;S.bw='80';S.goal='80';S.bkAsk=Date.now();S.rec={};
  S.myFood=[{n:'RENAME Food',k:100,p:10,f:2,c:15}];invalidateFood();
  recRW('2026-10-12').ml=[{n:'Current',note:'',items:[{p:'RENAME Food',g:'125'}]}];
  recRW('2026-10-11').ml=[{n:'History',note:'',items:[{p:'RENAME Food',g:'300'}]}];
  S.tpl=[{n:'Template',ml:[{n:'Template Meal',items:[{p:'RENAME Food',g:'400'}]}]}];
  sel='2026-10-12';mo='2026-10';tab='food';closeSetup();sheetClose();closePick();
  if($('ask').classList.contains('on'))askClose(false);undoDrop();save();flush();render();
});}
async function pick(p){await tap(p,'[data-pick="0"]');await p.locator('#fq').fill('RENAME Food');await tap(p,'[data-add="RENAME Food"]');}
async function rename(p){await p.locator('#nfN').fill('rename food');await tap(p,'#nfSave');}
async function reload(p){await p.evaluate(()=>flush());await p.reload();await p.waitForFunction(()=>typeof render==='function');}
async function check(p,width,name,fn){checks++;await seed(p);try{await fn();console.log('✓ '+width+' '+name);}
  catch(e){failures++;console.log('✗ '+width+' '+name+' → '+e.message);}}
(async()=>{const browser=await chromium.launch(LAUNCH);try{for(const width of[320,390]){
  const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});await ctx.route('https://**/*',r=>r.abort());
  try{const p=await ctx.newPage(),errors=[];p.setDefaultTimeout(6000);p.on('pageerror',e=>errors.push(e.message));
    await p.clock.install({time:new Date('2026-10-12T02:00:00Z')});await p.clock.resume();await p.goto(APP);await p.waitForSelector('#setup.on');await tap(p,'#setSkip');
    await check(p,width,'case rename updates selected reference and persists counted food',async()=>{
      await pick(p);await rename(p);const pending=await state(p);await tap(p,'#fpAdd');await reload(p);const after=await state(p);
      assert.equal(after.sum,225,'125g original +100g selected =225 kcal');assert.equal(after.history,300);
      assert.deepEqual(pending.picked,[{p:'rename food',g:100}]);assert.equal(after.rec['2026-10-12'].ml[0].items.at(-1).p,'rename food');
      assert.equal(after.tpl[0].ml[0].items[0].p,'rename food');
    });
    await check(p,width,'Undo rename restores selected name without losing selection',async()=>{
      await pick(p);const before=await state(p);await rename(p);await tap(p,'#undoB');assert.deepEqual(await state(p),before);
      await tap(p,'#fpAdd');assert.equal((await state(p)).sum,225);await reload(p);assert.equal((await state(p)).sum,225);
    });
    await check(p,width,'Undo added renamed food preserves canonical database and history',async()=>{
      await pick(p);await rename(p);const before=await state(p);await tap(p,'#fpAdd');await tap(p,'#undoB');
      const after=await state(p);assert.deepEqual(after.rec,before.rec);assert.deepEqual(after.food,before.food);assert.equal(after.history,300);
      await reload(p);assert.equal((await state(p)).sum,125);assert.equal((await state(p)).food[0].n,'rename food');
    });
    await check(p,width,'renamed selected product toggles off without duplicate old name',async()=>{
      await pick(p);await rename(p);await tap(p,'[data-add="rename food"]');assert.deepEqual((await state(p)).picked,[]);
    });
    await check(p,width,'declining close after rename keeps canonical selected reference',async()=>{
      await pick(p);await rename(p);await tap(p,'#fpX');await tap(p,'#askN');
      assert.deepEqual((await state(p)).picked,[{p:'rename food',g:100}]);await tap(p,'#fpAdd');assert.equal((await state(p)).sum,225);
    });
    await check(p,width,'confirming close discards transient selected position without added ghost',async()=>{
      await pick(p);await rename(p);await tap(p,'#fpX');await tap(p,'#askY');assert.deepEqual((await state(p)).picked,[]);
      await reload(p);const s=await state(p);assert.equal(s.sum,125);assert.equal(s.history,300);assert.equal(s.rec['2026-10-12'].ml[0].items.length,1);
    });
    await check(p,width,'Undo rename preserves later raw nutrient draft and restores selected key',async()=>{
      await pick(p);await rename(p);await p.locator('#nfK').fill('222,50');await tap(p,'#undoB');
      assert.equal(await p.locator('#nfK').inputValue(),'222,50');assert.deepEqual((await state(p)).picked,[{p:'RENAME Food',g:100}]);
      assert.equal((await state(p)).food[0].n,'RENAME Food');await tap(p,'#fpX');await tap(p,'#askN');assert.equal(await p.locator('#nfK').inputValue(),'222,50');
    });
    checks++;try{assert.deepEqual(errors,[]);console.log('✓ '+width+' no uncaught errors');}catch(e){failures++;console.log('✗ '+width+' uncaught errors '+e.message);}
  }finally{await ctx.close();}
}}finally{await browser.close();}console.log('FOOD PICKED RENAME: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=2;});
