/* Main grams are transient raw input until validation succeeds.
   Breaks caught: neutral redraw discards raw; Undo overwrites a later draft;
   index/name matching moves a draft to a duplicate/replacement/date; dirty
   display contaminates saved food/totals; valid input fails to commit/Undo.
   All expected grams/macros are literals from the synthetic100kcal/10P/2F/15C
   per100g fixture. No assertions depend on private draft identities. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
const A = '2026-10-13', B = '2026-10-14', SOURCE = '2026-10-12';
const TIME = '2026-10-14T12:00:00+10:00', RAW = '1e309';
const GRAMS = '#mll [data-ml="0"] input[data-g="0"]';
const unvisitedOnly = process.argv.includes('--unvisited-only');
const redrawOnly = process.argv.includes('--redraw-only');
const PHOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
let checks = 0, failures = 0;
const tap = async (p, selector) => {
  await p.locator(selector).first().click();
  await p.waitForTimeout(280); // real260ms finger guard, never retry a click
};
const fill = async (p, selector, value, blur = true) => {
  await p.locator(selector).fill(value);
  if (blur) await p.locator(selector).blur();
  await p.waitForTimeout(60);
};
const foodUI = p => p.evaluate(() => ({
  sel, tab,
  grams:[...document.querySelectorAll('#mll [data-ml]')].map(m =>
    [...m.querySelectorAll('input[data-g]')].map(i => i.value)),
  invalid:[...document.querySelectorAll('#mll [data-ml]')].map(m =>
    [...m.querySelectorAll('input[data-g]')].map(i => i.getAttribute('aria-invalid'))),
  totals:[$('tKc').firstChild.textContent.trim(),$('tPr').firstChild.textContent.trim(),
    $('tFa').textContent,$('tCa').textContent],
  undo:!$('undo').hidden,
  focus:document.activeElement?.id || document.activeElement?.getAttribute('data-g') || null,
}));
// Read another dated journal directly; this helper never changes sel/render/focus.
const journal = p => p.evaluate(() => {
  flush();
  return {rec:JSON.parse(JSON.stringify(S.rec)),food:JSON.parse(JSON.stringify(S.myFood)),
    tpl:JSON.parse(JSON.stringify(S.tpl)),sums:['2026-10-12','2026-10-13','2026-10-14'].map(ds => daySum(ds)),
    disk:JSON.parse(localStorage.getItem(KEY)),rawState:JSON.stringify(S),
    rawDisk:localStorage.getItem(KEY)};
});
function recorded(s, grams = [['125'],['50']], sums = {k:175,p:17.5,f:3.5,c:26.25}) {
  assert.deepEqual(s.rec[A].ml.map(m => m.items.map(i => i.g)),grams,'recorded grams');
  assert.deepEqual(s.disk.rec[A].ml.map(m => m.items.map(i => i.g)),grams,'disk grams');
  for (const [key,want] of Object.entries(sums)) {
    assert.ok(Math.abs(s.sums[1][key]-want)<1e-10,
      'hand-derived dated '+key+': '+s.sums[1][key]+' expected '+want);
  }
  assert.ok(s.sums.every(sum => Object.values(sum).every(Number.isFinite)),'all saved dated totals finite');
  assert.ok(!s.rawState.includes(RAW) && !s.rawDisk.includes(RAW),'raw never enters state/disk');
}
async function rawVisible(p, raw = RAW, meal = 0, item = 0) {
  const ui = await foodUI(p);
  assert.equal(ui.grams[meal][item],raw,'own exact raw string must stay visible');
  assert.equal(ui.invalid[meal][item],'true','visible invalid draft stays marked');
}
async function totalsUI(p, want = ['175','18','жиры 4 г','углеводы 26 г']) {
  assert.deepEqual((await foodUI(p)).totals,want,'display totals use recorded food');
}
async function selectFoodDate(p, ds = A) {
  if ((await foodUI(p)).tab !== 'food') await tap(p,'[data-tab="food"]');
  if ((await foodUI(p)).sel !== ds) await tap(p,'#chips [data-d="'+ds+'"]');
}
async function reloadFood(p, ds = A) {
  await p.evaluate(() => flush()); await p.reload();
  await p.waitForFunction(() => typeof render === 'function' && !$('setup').classList.contains('on'));
  await selectFoodDate(p,ds);
}
async function seed(p, options = {}) {
  await p.clock.setFixedTime(new Date(options.firstFood ? '2026-10-13T12:00:00+10:00' : TIME));
  await p.evaluate(options => {
    closePick(); sheetClose(); if ($('ask').classList.contains('on')) askClose(false);
    S=build(); migrate(); S.setup=1; S.sound=0; S.hints=0; S.bw='80'; S.goal='80';
    S.height=180; S.age=30; S.sex='m'; S.bkAsk=Date.now(); S.rec={}; S.pause={}; applyNutri();
    S.myFood=[{n:'DRAFT Food',k:100,p:10,f:2,c:15}]; invalidateFood();
    recRW('2026-10-13').ml=[
      {n:'Meal A',note:'',items:[{p:'DRAFT Food',g:'125'}]},
      {n:'Meal A second',note:'',items:[{p:'DRAFT Food',g:'50'}]},
    ];
    recRW('2026-10-14').ml=[{n:'Meal B',note:'',items:[{p:'DRAFT Food',g:'250'}]}];
    recRW('2026-10-12').ml=[{n:'Replacement',note:'',items:[{p:'DRAFT Food',g:'400'}]}];
    S.tpl=[{n:'Replacement template',ml:[{n:'Replacement',note:'',items:[{p:'DRAFT Food',g:'400'}]}]}];
    if (options.duplicates) {
      S.rec['2026-10-13'].ml[0].items=[{p:'DRAFT Food',g:'125'},{p:'DRAFT Food',g:'125'},{p:'DRAFT Food',g:'50'}];
      S.rec['2026-10-13'].ml[1].items=[];
    }
    if (options.equalSource) S.rec['2026-10-12'].ml=JSON.parse(JSON.stringify(S.rec['2026-10-13'].ml));
    if (options.huge) {
      S.myFood=[{n:'DRAFT Food',k:1e308,p:0,f:0,c:0}]; invalidateFood();
      S.rec['2026-10-13'].ml=[{n:'Huge',note:'',items:[{p:'DRAFT Food',g:'100'}]}];
      delete S.rec['2026-10-12']; delete S.rec['2026-10-14']; S.tpl=[];
    }
    closeSetup(); undoDrop(); save(); flush();
  },options);
  // Real load resets transient forms between tests; no private reset API.
  if (options.firstFood) {
    await p.reload();
    await p.waitForFunction(() => typeof render === 'function' && !$('setup').classList.contains('on'));
    assert.equal(await p.evaluate(() => tab),'wo','fixture reload must begin on real default Workout screen');
    assert.equal(await p.evaluate(() => sel),A,'Tuesday fixture must select13October');
  } else await reloadFood(p);
}
async function check(p, width, name, fn, options = {}) {
  if (unvisitedOnly && !options.firstFood) return;
  if (redrawOnly && !options.redraw) return;
  checks++;
  await seed(p,options);
  try { await fn(); console.log('✓ '+width+' '+name); }
  catch (e) {
    failures++; console.log('✗ '+width+' '+name+' → '+e.message);
    if (e.code !== 'ERR_ASSERTION') throw e; // launch/selector errors are not meaningful RED
  }
}
async function openFood(p) { await tap(p,'[data-pick="0"]'); await fill(p,'#fq','DRAFT Food'); }
async function copySource(p) { await tap(p,'#cpBtn'); await tap(p,'[data-from="2026-10-12"]'); await tap(p,'#askY'); }

(async () => {
  const browser=await chromium.launch(LAUNCH);
  try { for (const width of [320,390]) {
    const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},
      timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});
    await ctx.route('https://**/*',r => r.abort());
    try {
      const p=await ctx.newPage(), errors=[]; p.setDefaultTimeout(7000);
      p.on('pageerror',e => errors.push(e.message));
      await p.clock.install({time:new Date(TIME)}); await p.clock.resume(); await p.clock.setFixedTime(new Date(TIME));
      await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p,'#setSkip');
      await check(p,width,'workout Undo before first Food visit keeps later main raw',async () => {
        await tap(p,'#fin'); assert.ok(await p.evaluate(() => S.rec['2026-10-13'].t0),'real workout start is recorded');
        await tap(p,'[data-tab="food"]'); await fill(p,GRAMS,RAW);
        recorded(await journal(p)); assert.equal((await foodUI(p)).undo,true);
        await tap(p,'#undoB'); assert.ok(!await p.evaluate(() => S.rec['2026-10-13'].t0),'Undo removes workout start');
        recorded(await journal(p)); await totalsUI(p); await rawVisible(p);
      },{firstFood:true});
      await check(p,width,'workout Undo before any Food visit keeps raw on unvisited other date',async () => {
        await tap(p,'#fin'); await tap(p,'[data-tab="food"]'); await tap(p,'#chips [data-d="2026-10-12"]');
        await fill(p,GRAMS,RAW); await tap(p,'#undoB');
        assert.ok(!await p.evaluate(() => S.rec['2026-10-13'].t0)); recorded(await journal(p));
        const s=await journal(p);
        assert.equal(s.rec[SOURCE].ml[0].items[0].g,'400'); assert.equal(s.disk.rec[SOURCE].ml[0].items[0].g,'400');
        assert.deepEqual(s.sums[0],{k:400,p:40,f:8,c:60});
        assert.equal((await foodUI(p)).sel,SOURCE,'checking Undo must not redirect selected date');
        await totalsUI(p,['400','40','жиры 8 г','углеводы 60 г']); await rawVisible(p);
      },{firstFood:true});
      await check(p,width,'workout Undo after viewing A keeps later raw on previously unvisited other date',async () => {
        await tap(p,'[data-tab="food"]'); await tap(p,'[data-tab="wo"]'); await tap(p,'#fin');
        await tap(p,'[data-tab="food"]'); await tap(p,'#chips [data-d="2026-10-12"]'); await fill(p,GRAMS,RAW);
        await tap(p,'#undoB'); assert.ok(!await p.evaluate(() => S.rec['2026-10-13'].t0));
        recorded(await journal(p)); assert.equal((await foodUI(p)).sel,SOURCE);
        await rawVisible(p);
        await tap(p,'#chips [data-d="2026-10-13"]'); assert.deepEqual((await foodUI(p)).grams,[['125'],['50']]);
        await tap(p,'#chips [data-d="2026-10-12"]'); await rawVisible(p);
      },{firstFood:true});
      await check(p,width,'invalid raw stays outside journal and disk',async () => {
        await fill(p,GRAMS,RAW); await rawVisible(p); recorded(await journal(p)); await totalsUI(p);
        assert.equal((await foodUI(p)).undo,false,'invalid text alone is not a saved action');
      });
      await check(p,width,'same-date button redraw preserves raw',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#chips [data-d="2026-10-13"]');
        recorded(await journal(p)); await totalsUI(p); await rawVisible(p);
      });
      await check(p,width,'tab roundtrip preserves own raw',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'[data-tab="prog"]'); await tap(p,'[data-tab="food"]');
        recorded(await journal(p)); await totalsUI(p); await rawVisible(p);
      });
      await check(p,width,'date roundtrip preserves raw only on originating date',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#chips [data-d="2026-10-14"]');
        assert.deepEqual((await foodUI(p)).grams,[['250']]);
        assert.deepEqual((await journal(p)).sums[2],{k:250,p:25,f:5,c:37.5});
        await tap(p,'#chips [data-d="2026-10-13"]'); recorded(await journal(p)); await rawVisible(p);
      });
      await check(p,width,'add meal preserves raw on untouched item',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#addMl');
        recorded(await journal(p),[['125'],['50'],[]]); await totalsUI(p); await rawVisible(p);
      });
      await check(p,width,'Undo add meal preserves pre-existing raw',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#addMl'); await tap(p,'#undoB');
        recorded(await journal(p)); await totalsUI(p); await rawVisible(p);
      });
      await check(p,width,'Undo preserves raw entered after original action',async () => {
        await tap(p,'#addMl'); await fill(p,GRAMS,RAW);
        assert.equal((await foodUI(p)).undo,true); await tap(p,'#undoB');
        recorded(await journal(p)); await totalsUI(p); await rawVisible(p);
      });
      await check(p,width,'removing other product preserves unaffected raw',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#mll [data-ml="1"] [data-rm="0"]');
        recorded(await journal(p),[['125'],[]],{k:125,p:12.5,f:2.5,c:18.75});
        await totalsUI(p,['125','13','жиры 3 г','углеводы 19 г']); await rawVisible(p);
      });
      await check(p,width,'Undo removing other product preserves raw',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#mll [data-ml="1"] [data-rm="0"]'); await tap(p,'#undoB');
        recorded(await journal(p)); await totalsUI(p); await rawVisible(p);
      });
      await check(p,width,'duplicate draft follows second row after preceding deletion',async () => {
        await fill(p,'#mll [data-ml="0"] input[data-g="1"]',RAW);
        await tap(p,'#mll [data-ml="0"] [data-rm="0"]');
        recorded(await journal(p),[['125','50'],[]]);
        assert.equal((await foodUI(p)).grams[0][1],'50','raw must not transplant into following product');
        await rawVisible(p,RAW,0,0);
      },{duplicates:true});
      await check(p,width,'Undo leading duplicate deletion restores original raw row',async () => {
        await fill(p,'#mll [data-ml="0"] input[data-g="1"]',RAW);
        await tap(p,'#mll [data-ml="0"] [data-rm="0"]'); await tap(p,'#undoB');
        recorded(await journal(p),[['125','125','50'],[]],{k:300,p:30,f:6,c:45});
        assert.equal((await foodUI(p)).grams[0][0],'125','first duplicate must stay clean');
        await rawVisible(p,RAW,0,1);
      },{duplicates:true});
      await check(p,width,'Undo restores raw on explicitly removed product itself',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#mll [data-ml="0"] [data-rm="0"]');
        recorded(await journal(p),[[],['50']],{k:50,p:5,f:1,c:7.5});
        await tap(p,'#undoB'); recorded(await journal(p)); await rawVisible(p);
      });
      await check(p,width,'picker search and filters keep main and independent KBJU drafts',async () => {
        await fill(p,GRAMS,RAW); await openFood(p); await fill(p,'#nfK','222,50');
        await tap(p,'[data-ch=""]'); await fill(p,'#fq','DRAFT Other'); await fill(p,'#nfP','12,5');
        await fill(p,'#fq','DRAFT Food'); assert.equal(await p.locator('#nfK').inputValue(),'222,50');
        await fill(p,'#fq','DRAFT Other'); assert.equal(await p.locator('#nfP').inputValue(),'12,5');
        recorded(await journal(p)); await rawVisible(p);
      });
      await check(p,width,'saving custom nutrients keeps main raw and dynamic totals',async () => {
        await fill(p,GRAMS,RAW); await openFood(p); await fill(p,'#nfK','200'); await tap(p,'#nfSave');
        recorded(await journal(p),[['125'],['50']],{k:350,p:17.5,f:3.5,c:26.25});
        await totalsUI(p,['350','18','жиры 4 г','углеводы 26 г']); await rawVisible(p);
      });
      await check(p,width,'Undo custom nutrients keeps main raw and restores database totals',async () => {
        await fill(p,GRAMS,RAW); await openFood(p); await fill(p,'#nfK','200'); await tap(p,'#nfSave'); await tap(p,'#undoB');
        recorded(await journal(p)); await totalsUI(p); assert.equal(await p.locator('#nfK').inputValue(),'100'); await rawVisible(p);
      });
      await check(p,width,'rename Undo preserves later KBJU draft and selected canonical item',async () => {
        await fill(p,GRAMS,RAW); await openFood(p); await tap(p,'[data-add="DRAFT Food"]');
        await fill(p,'#nfN','draft food'); await tap(p,'#nfSave'); await fill(p,'#nfK','222,50'); await tap(p,'#undoB');
        assert.equal(await p.locator('#nfK').inputValue(),'222,50');
        assert.deepEqual(await p.evaluate(() => picked),[{p:'DRAFT Food',g:100}]);
        assert.equal((await journal(p)).food[0].n,'DRAFT Food'); recorded(await journal(p)); await rawVisible(p);
      });
      await check(p,width,'replacement ration displays its saved grams without old raw',async () => {
        await fill(p,GRAMS,RAW); await copySource(p);
        recorded(await journal(p),[['400']],{k:400,p:40,f:8,c:60});
        assert.deepEqual((await foodUI(p)).grams,[['400']]);
        await tap(p,'#chips [data-d="2026-10-14"]'); assert.deepEqual((await foodUI(p)).grams,[['250']]);
        await tap(p,'#chips [data-d="2026-10-13"]'); assert.deepEqual((await foodUI(p)).grams,[['400']]);
      });
      await check(p,width,'Undo replacement restores draft only on original food',async () => {
        await fill(p,GRAMS,RAW); await copySource(p); await tap(p,'#undoB');
        recorded(await journal(p)); await rawVisible(p);
      });
      await check(p,width,'literal-equal replacement does not inherit original raw',async () => {
        await fill(p,GRAMS,RAW); await copySource(p);
        recorded(await journal(p)); assert.deepEqual((await foodUI(p)).grams,[['125'],['50']]);
        // Existing policy: no serialized journal change means no journal Undo.
        assert.equal((await foodUI(p)).undo,false);
        await tap(p,'#chips [data-d="2026-10-14"]'); await tap(p,'#chips [data-d="2026-10-13"]');
        assert.deepEqual((await foodUI(p)).grams,[['125'],['50']]);
      },{equalSource:true});
      await check(p,width,'template replacement does not inherit raw',async () => {
        await fill(p,GRAMS,RAW); await tap(p,'#cpBtn'); await tap(p,'[data-tpl="0"]'); await tap(p,'#askY');
        recorded(await journal(p),[['400']],{k:400,p:40,f:8,c:60}); assert.deepEqual((await foodUI(p)).grams,[['400']]);
      });
      await check(p,width,'import replaces even identical food without carrying session raw',async () => {
        const backup=await p.evaluate(() => ({v:3,state:JSON.parse(JSON.stringify(S)),photos:{}}));
        await fill(p,GRAMS,RAW); await tap(p,'[data-tab="prog"]');
        const chooserPromise=p.waitForEvent('filechooser'); await tap(p,'#imp'); const chooser=await chooserPromise;
        await chooser.setFiles({name:'synthetic-food-main.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});
        await p.locator('#ask.on').waitFor(); await tap(p,'#askY');
        await p.waitForFunction(() => sel==='2026-10-14' && /восстановлен/i.test($('noteT').textContent));
        await selectFoodDate(p); recorded(await journal(p)); assert.deepEqual((await foodUI(p)).grams,[['125'],['50']]);
        assert.equal((await foodUI(p)).undo,false);
      });
      await check(p,width,'reload discards session raw but retains recorded dated food',async () => {
        await fill(p,GRAMS,RAW); recorded(await journal(p)); await reloadFood(p);
        recorded(await journal(p)); assert.deepEqual((await foodUI(p)).grams,[['125'],['50']]);
        assert.deepEqual((await foodUI(p)).invalid,[[null],[null]]); await totalsUI(p);
      });
      await check(p,width,'valid comma grams commit through disk and field Undo',async () => {
        await fill(p,GRAMS,'200,50');
        recorded(await journal(p),[['200,50'],['50']],{k:250.5,p:25.05,f:5.01,c:37.575});
        await totalsUI(p,['251','25','жиры 5 г','углеводы 38 г']);
        assert.equal((await foodUI(p)).undo,true); await tap(p,'#undoB'); recorded(await journal(p));
        assert.deepEqual((await foodUI(p)).grams,[['125'],['50']]); await reloadFood(p); recorded(await journal(p));
      });
      await check(p,width,'focused empty is temporary and blurred empty keeps established zero model',async () => {
        await fill(p,GRAMS,'',false); recorded(await journal(p));
        assert.equal(await p.locator(GRAMS).evaluate(el => document.activeElement===el),true);
        // Reading journal must not change focus or commit an unfinished empty field.
        assert.equal(await p.locator(GRAMS).evaluate(el => document.activeElement===el),true);
        await p.locator(GRAMS).blur(); await p.waitForTimeout(80);
        recorded(await journal(p),[[''],['50']],{k:50,p:5,f:1,c:7.5}); await totalsUI(p,['50','5','жиры 1 г','углеводы 8 г']);
        await tap(p,'#undoB'); recorded(await journal(p)); assert.equal(await p.locator(GRAMS).inputValue(),'125');
      });
      await check(p,width,'neutral redraw does not commit focused empty grams',async () => {
        await fill(p,GRAMS,'',false); recorded(await journal(p));
        await p.evaluate(() => paintFood());
        recorded(await journal(p)); await totalsUI(p);
        assert.equal(await p.locator(GRAMS).inputValue(),'','unfinished empty remains visible');
        assert.equal(await p.locator(GRAMS).evaluate(el => document.activeElement===el),true,'neutral redraw retains editing focus');
        assert.equal((await foodUI(p)).undo,false,'neutral redraw is not a saved field action');
        await p.keyboard.press('Tab'); await p.waitForTimeout(80);
        recorded(await journal(p),[[''],['50']],{k:50,p:5,f:1,c:7.5});
        await totalsUI(p,['50','5','жиры 1 г','углеводы 8 г']);
        assert.equal((await foodUI(p)).undo,true,'intentional empty blur after redraw still offers field Undo');
        await tap(p,'#undoB'); recorded(await journal(p));
        assert.equal(await p.locator(GRAMS).inputValue(),'125');
      },{redraw:true});
      await check(p,width,'pending native photo Undo does not commit focused empty grams',async () => {
        await p.evaluate(async photo => {await phPut('2026-10-13',photo);PHCACHE.clear();await phSync();},PHOTO);
        await tap(p,'[data-tab="photo"]'); await p.locator('#phT img').waitFor();
        await tap(p,'#phDel'); await tap(p,'#askY');
        await p.waitForFunction(() => !!undoRec && !PH.includes('2026-10-13'));
        await p.evaluate(() => {
          window.foodAuditTx=IDBDatabase.prototype.transaction; window.foodAuditGate=null;
          const setter=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete').set;
          let held=false;
          IDBDatabase.prototype.transaction=function(...args){
            const tx=foodAuditTx.apply(this,args);
            if(args[1]==='readwrite'&&!held){
              held=true;
              Object.defineProperty(tx,'oncomplete',{configurable:true,set(fn){
                setter.call(tx,event=>{window.foodAuditGate=()=>fn.call(tx,event);});
              }});
            }
            return tx;
          };
        });
        try {
          await tap(p,'#undoB'); await p.waitForFunction(() => !!foodAuditGate);
          await tap(p,'[data-tab="food"]'); await fill(p,GRAMS,'',false);
          recorded(await journal(p)); assert.equal(await p.locator(GRAMS).inputValue(),'');
          await p.evaluate(() => {IDBDatabase.prototype.transaction=foodAuditTx;foodAuditGate();});
          await p.waitForFunction(() => !undoRec?.busy); await p.waitForTimeout(100);
          recorded(await journal(p)); await totalsUI(p);
          assert.equal(await p.locator(GRAMS).inputValue(),'','late neutral render retains unfinished empty');
          assert.equal(await p.locator(GRAMS).evaluate(el => document.activeElement===el),true);
          assert.equal((await foodUI(p)).undo,false,'no phantom grams Undo after photo restoration');
          assert.equal(await p.evaluate(() => phGet('2026-10-13')),PHOTO,'native Undo restores exact photo');
          await reloadFood(p); recorded(await journal(p));
        } finally {await p.evaluate(() => {if(window.foodAuditTx)IDBDatabase.prototype.transaction=foodAuditTx;});}
      },{redraw:true});
      await check(p,width,'invalid negative text leaves prior Undo available',async () => {
        await tap(p,'#addMl'); await fill(p,GRAMS,'-2'); recorded(await journal(p),[['125'],['50'],[]]);
        await rawVisible(p,'-2'); assert.equal((await foodUI(p)).undo,true); await tap(p,'#undoB'); recorded(await journal(p));
      });
      await check(p,width,'finite grams rejected by aggregate overflow remain draft across redraw',async () => {
        await fill(p,GRAMS,'200'); const s=await journal(p);
        assert.equal(s.rec[A].ml[0].items[0].g,'100'); assert.equal(s.disk.rec[A].ml[0].items[0].g,'100');
        assert.equal(s.sums[1].k,1e308); assert.ok(Number.isFinite(s.sums[1].k));
        await tap(p,'#chips [data-d="2026-10-13"]'); await rawVisible(p,'200');
        assert.equal((await journal(p)).sums[1].k,1e308);
      },{huge:true});
      checks++; try {
        assert.deepEqual(errors,[]); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth>innerWidth),false);
        console.log('✓ '+width+' no uncaught errors or horizontal overflow');
      } catch(e) { failures++; console.log('✗ '+width+' runtime/layout → '+e.message); }
    } finally { await ctx.close(); }
  }} finally { await browser.close(); }
  console.log('FOOD MAIN DRAFT: '+checks+' checks, '+failures+' failures'); process.exitCode=failures?1:0;
})().catch(e => { console.error(e.stack); process.exitCode=2; });
