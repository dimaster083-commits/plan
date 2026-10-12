/* BUG-0009: raw custom-food drafts survive picker redraws and guarded exits.
   Isolated synthetic profiles; all actions use actual browser UI events. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let checks = 0, failures = 0;
const raw = ['DRAFT Renamed', '200', '12,5', '3.50', ''];
const baseline = ['DRAFT Saved', '100', '10', '2', '15'];
const tap = async (p, s) => { await p.locator(s).first().click(); await p.waitForTimeout(280); };
const fill = async (p, s, v) => { await p.locator(s).fill(v); await p.locator(s).blur(); await p.waitForTimeout(170); };
const values = p => p.evaluate(() => ['N','K','P','F','C'].map(k => $('nf'+k)?.value ?? null));
const on = (p, id) => p.locator('#'+id).evaluate(el => el.classList.contains('on'));
const state = p => p.evaluate(() => ({ rec:S.rec, myFood:S.myFood, tpl:S.tpl,
  sum:daySum(sel), history:daySum('2026-10-08'), disk:localStorage.getItem(KEY) }));
async function edit(p, strings = raw) {
  for (let i=0;i<5;i++) await fill(p, '#nf'+['N','K','P','F','C'][i], strings[i]);
}
async function open(p, query='DRAFT New') { await tap(p,'[data-pick="0"]'); await fill(p,'#fq',query); }
async function seed(p) {
  await p.evaluate(() => {
    S=build(); migrate(); S.setup=1; S.sound=0; S.hints=0; S.bw='80'; S.goal='80';
    S.bkAsk=Date.now(); applyNutri(); S.rec={};
    S.myFood=[{n:'DRAFT Saved',k:100,p:10,f:2,c:15}]; invalidateFood();
    recRW('2026-10-08').ml=[{n:'История',items:[{p:'DRAFT Saved',g:'125'}]}];
    recRW('2026-10-12').ml=[{n:'А',items:[]},{n:'Б',items:[]}];
    S.tpl=[{n:'Шаблон',ml:[{n:'Шаблон',items:[{p:'DRAFT Saved',g:'125'}]}]}];
    sel='2026-10-12'; mo='2026-10'; tab='food'; exOpen=null;
    closeSetup(); sheetClose(); $('fp').classList.remove('on');
    if ($('ask').classList.contains('on')) askClose(false);
    undoDrop(); save(); flush(); render();
  });
}
async function expectAsk(p) { assert.ok(await on(p,'ask'),'draft exit must ask before discarding'); }
async function check(p, width, name, fn) {
  checks++;
  try { await seed(p); await fn(); console.log('✓ '+width+' '+name); }
  catch(e) { failures++; console.log('✗ '+width+' '+name+' → '+e.message); }
}
(async()=>{
  const browser=await chromium.launch(LAUNCH);
  try {
    for (const width of [320,390]) {
      const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},
        timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce'});
      await ctx.route('https://**/*',r=>r.abort());
      try {
        const p=await ctx.newPage(), errors=[]; p.setDefaultTimeout(6000);
        p.on('pageerror',e=>errors.push(e.message));
        await p.clock.install({time:new Date('2026-10-12T02:00:00Z')}); await p.clock.resume();
        await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p,'#setSkip');
        await check(p,width,'untouched autoform closes without warning or writes',async()=>{
          const before=await state(p); await open(p); await tap(p,'#fpX');
          assert.equal(await on(p,'fp'),false); assert.equal(await on(p,'ask'),false);
          assert.deepEqual(await state(p),before);
        });
        await check(p,width,'unchanged saved product baseline is clean',async()=>{
          await open(p,'DRAFT Saved'); assert.deepEqual(await values(p),baseline);
          await tap(p,'#fpX'); assert.equal(await on(p,'ask'),false); assert.equal(await on(p,'fp'),false);
        });
        for (const method of ['×','Escape']) await check(p,width,method+' decline preserves and confirm discards raw form',async()=>{
          const before=await state(p); await open(p); await edit(p);
          if(method==='×') await tap(p,'#fpX'); else {await p.keyboard.press('Escape'); await p.waitForTimeout(280);}
          await expectAsk(p); await tap(p,'#askN'); assert.deepEqual(await values(p),raw);
          assert.equal(await p.locator('#fq').inputValue(),'DRAFT New'); assert.ok(await on(p,'fp'));
          await tap(p,'#fpX'); await expectAsk(p); await tap(p,'#askY');
          assert.equal(await on(p,'fp'),false); await open(p);
          assert.deepEqual(await values(p),['DRAFT New','','','','']); assert.deepEqual(await state(p),before);
        });
        await check(p,width,'chips and equivalent case/space key preserve exact raw strings',async()=>{
          const before=await state(p); await open(p); await edit(p);
          await tap(p,'[data-ch=""]'); assert.deepEqual(await values(p),raw);
          await tap(p,'[data-ch]:not([data-ch=""])'); assert.deepEqual(await values(p),raw);
          await fill(p,'#fq','  draft NEW  '); assert.deepEqual(await values(p),raw);
          assert.deepEqual(await state(p),before);
        });
        await check(p,width,'different search keys keep independent temporary raw drafts',async()=>{
          await open(p); await edit(p); await fill(p,'#fq','DRAFT Other');
          await fill(p,'#nfK','111,50'); await fill(p,'#fq','DRAFT New');
          assert.deepEqual(await values(p),raw); await fill(p,'#fq','DRAFT Other');
          assert.deepEqual(await values(p),['DRAFT Other','111,50','','','']);
        });
        await check(p,width,'hidden dirty form triggers close guard and refusal keeps query',async()=>{
          await open(p); await edit(p); await fill(p,'#fq','Рис белый отварной'); await tap(p,'#fpX');
          await expectAsk(p); await tap(p,'#askN');
          assert.equal(await p.locator('#fq').inputValue(),'Рис белый отварной');
          await fill(p,'#fq','DRAFT New'); assert.deepEqual(await values(p),raw);
        });
        await check(p,width,'existing selected-food warning and refusal remain intact',async()=>{
          await open(p,'Рис белый отварной'); await tap(p,'[data-add="Рис белый отварной"]');
          await tap(p,'#fpX'); await expectAsk(p); await tap(p,'#askN');
          assert.deepEqual(await p.evaluate(()=>picked),[{p:'Рис белый отварной',g:100}]);
          await tap(p,'#fpX'); await tap(p,'#askY'); assert.equal(await on(p,'fp'),false);
        });
        await check(p,width,'fpAdd guards draft before writing and keeps meal undo',async()=>{
          const before=await state(p); await open(p,'Рис белый отварной');
          await tap(p,'[data-add="Рис белый отварной"]'); await fill(p,'#fq','DRAFT New'); await edit(p);
          await tap(p,'#fpAdd'); await expectAsk(p); assert.deepEqual(await state(p),before);
          await tap(p,'#askN'); assert.deepEqual(await values(p),raw);
          assert.equal(await p.evaluate(()=>picked.length),1);
          await tap(p,'#fpAdd'); await expectAsk(p); await tap(p,'#askY');
          assert.deepEqual(await p.evaluate(()=>mealsOf(sel)[0].items),[{p:'Рис белый отварной',g:100}]);
          assert.equal(await on(p,'fp'),false); await tap(p,'#undoB');
          const after=await state(p); assert.deepEqual(after.rec,before.rec);
          assert.deepEqual(after.history,before.history); assert.deepEqual(after.myFood,before.myFood);
        });
        await check(p,width,'valid save resets baseline without changing historical item strings',async()=>{
          await open(p,'DRAFT Saved'); await fill(p,'#nfK','200'); await tap(p,'#nfSave');
          assert.deepEqual(await values(p),['DRAFT Saved','200','10','2','15']);
          const s=await state(p); assert.equal(s.history.k,250);
          assert.deepEqual(s.rec['2026-10-08'].ml[0].items,[{p:'DRAFT Saved',g:'125'}]);
          await tap(p,'#fpX'); assert.equal(await on(p,'ask'),false); assert.equal(await on(p,'fp'),false);
        });
        await check(p,width,'invalid finite save stays raw dirty and cannot mutate state',async()=>{
          const before=await state(p); await open(p,'DRAFT Saved'); await fill(p,'#nfK','1e309');
          await tap(p,'#nfSave'); assert.deepEqual(await state(p),before);
          await tap(p,'[data-ch=""]'); assert.equal((await values(p))[1],'1e309');
          await tap(p,'#fpX'); await expectAsk(p); await tap(p,'#askN');
          assert.equal((await values(p))[1],'1e309');
        });
        await check(p,width,'undo saved product refreshes clean form and historical totals',async()=>{
          await open(p,'DRAFT Saved'); await fill(p,'#nfK','200'); await tap(p,'#nfSave'); await tap(p,'#undoB');
          assert.deepEqual(await values(p),baseline); assert.equal((await state(p)).history.k,125);
          await tap(p,'#fpX'); assert.equal(await on(p,'ask'),false);
        });
        await check(p,width,'undo saved product preserves later unsaved raw form',async()=>{
          await open(p,'DRAFT Saved'); await fill(p,'#nfK','200'); await tap(p,'#nfSave');
          await fill(p,'#nfK','222,50'); await tap(p,'#undoB');
          assert.equal((await state(p)).myFood[0].k,100); assert.equal((await values(p))[1],'222,50');
          await tap(p,'#fpX'); await expectAsk(p);
        });
        await check(p,width,'existing picker finite-total overflow guard retains selection',async()=>{
          await p.evaluate(()=>{S.myFood.push({n:'DRAFT Huge',k:1e308,p:0,f:0,c:0});
            mealsRW(sel)[0].items=[{p:'DRAFT Huge',g:100}]; invalidateFood();save();flush();paintFood();});
          const before=await state(p); await open(p,'DRAFT Huge');
          await tap(p,'[data-add="DRAFT Huge"]'); await tap(p,'#fpAdd');
          assert.deepEqual(await state(p),before); assert.ok(await on(p,'fp'));
          assert.equal(await p.evaluate(()=>picked.length),1); assert.equal(await on(p,'ask'),false);
        });
        await check(p,width,'temporary drafts never persist and backdrop retains them',async()=>{
          const before=await state(p); const keys=await p.evaluate(()=>Object.keys(localStorage).sort());
          await open(p); await edit(p); await p.mouse.click(width-2,(width===320?568:844)-2);
          assert.ok(await on(p,'fp')); assert.deepEqual(await values(p),raw); assert.deepEqual(await state(p),before);
          assert.deepEqual(await p.evaluate(()=>Object.keys(localStorage).sort()),keys);
          await p.reload(); await p.waitForFunction(()=>typeof render==='function'); await p.waitForTimeout(700);
          await tap(p,'[data-tab="food"]'); await open(p);
          assert.deepEqual(await values(p),['DRAFT New','','','','']);
        });
        checks++; try { assert.deepEqual(errors,[]); assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
          console.log('✓ '+width+' no runtime errors or horizontal overflow');
        } catch(e) {failures++; console.log('✗ '+width+' runtime/layout → '+e.message);}
      } finally {await ctx.close();}
    }
  } finally {await browser.close();}
  console.log('FOOD DRAFT: '+checks+' checks, '+failures+' failures'); process.exitCode=failures?1:0;
})().catch(e=>{console.error(e.stack);process.exitCode=2;});
