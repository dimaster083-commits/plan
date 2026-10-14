/* v7 read-only audit: synthetic local browser contexts, actual UI buttons.
   Runtime is untouched. Exit 1 means an independently stated draft-preservation
   expectation failed; exit 2 means the probe itself failed. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../../env');
const A = '2026-10-13', B = '2026-10-14', SRC = '2026-10-12';
const TIME = '2026-10-14T12:00:00+10:00', RAW = '1e309';
const G = '#mll [data-ml="0"] input[data-g="0"]';
const observations = [];
let failures = 0;
const tap = async (p, s) => { await p.locator(s).first().click(); await p.waitForTimeout(280); };
const fill = async (p, s, value, blur = true) => {
  await p.locator(s).fill(value);
  if (blur) await p.locator(s).blur();
  await p.waitForTimeout(60);
};
const state = p => p.evaluate(() => ({
  sel, tab, rec: JSON.parse(JSON.stringify(S.rec)),
  myFood: JSON.parse(JSON.stringify(S.myFood)), tpl: JSON.parse(JSON.stringify(S.tpl)),
  sums: ['2026-10-12', '2026-10-13', '2026-10-14'].map(ds => daySum(ds)),
  ui: [...document.querySelectorAll('#mll [data-ml]')].map(m => ({
    name: m.querySelector('[data-mf="n"]').value,
    grams: [...m.querySelectorAll('input[data-g]')].map(i => i.value),
    invalid: [...m.querySelectorAll('input[data-g]')].map(i => i.getAttribute('aria-invalid')),
  })),
  totals: [$('tKc').textContent, $('tPr').textContent, $('tFa').textContent, $('tCa').textContent],
  undo: !!undoRec, picker: $('fp').classList.contains('on'),
  picked: JSON.parse(JSON.stringify(picked)),
  form: ['N','K','P','F','C'].map(k => $('nf'+k)?.value ?? null),
  disk: (() => { const s = JSON.parse(localStorage.getItem(KEY)); return {rec:s.rec,myFood:s.myFood,tpl:s.tpl}; })(),
}));
const firstGram = s => s.ui[0]?.grams[0];
const assertJournal = (s, grams = '125', calories = 175) => {
  assert.equal(s.rec[A].ml[0].items[0].g, grams);
  assert.equal(s.sums[1].k, calories);
  for (const sum of s.sums) assert.ok(Object.values(sum).every(Number.isFinite));
};
async function seed(p) {
  await p.evaluate(() => {
    closePick(); sheetClose(); if ($('ask').classList.contains('on')) askClose(false);
    S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0;
    S.bw = '80'; S.goal = '80'; S.height = 180; S.age = 30; S.sex = 'm';
    S.bkAsk = Date.now(); S.rec = {}; S.pause = {}; applyNutri();
    S.myFood = [{n:'AUDIT Food',k:100,p:10,f:2,c:15}]; invalidateFood();
    recRW('2026-10-13').ml = [
      {n:'Meal A',note:'',items:[{p:'AUDIT Food',g:'125'}]},
      {n:'Meal A second',note:'',items:[{p:'AUDIT Food',g:'50'}]},
    ];
    recRW('2026-10-14').ml = [{n:'Meal B',note:'',items:[{p:'AUDIT Food',g:'250'}]}];
    recRW('2026-10-12').ml = [{n:'Replacement',note:'',items:[{p:'AUDIT Food',g:'400'}]}];
    S.tpl = [{n:'Replacement template',ml:[{n:'Replacement',note:'',items:[{p:'AUDIT Food',g:'400'}]}]}];
    sel = '2026-10-13'; mo = '2026-10'; tab = 'food'; lastDay = today(); exOpen = null;
    closeSetup(); undoDrop(); save(); flush(); render();
  });
}
async function reloadFood(p) {
  await p.evaluate(() => flush()); await p.reload();
  await p.waitForFunction(() => typeof render === 'function');
  await tap(p, '[data-tab="food"]'); await tap(p, '#chips [data-d="2026-10-13"]');
  return state(p);
}
async function check(p, width, name, expected, fn) {
  await seed(p);
  const evidence = {};
  let error = null;
  try { await fn(evidence); }
  catch (e) { if (e.code !== 'ERR_ASSERTION') throw e; failures++; error = e.message; }
  const observation = {width,name,status:error ? 'DRAFT_EXPECTATION_FAILED' : 'PASS',expected,...evidence,error};
  observations.push(observation);
  const stages = Object.fromEntries(Object.entries(evidence).map(([k,s]) => [k,{
    date:s.sel,tab:s.tab,uiGrams:s.ui.map(m => m.grams),invalid:s.ui.map(m => m.invalid),
    savedGrams:s.rec[A].ml.map(m => m.items.map(i => i.g)),dayK:s.sums[1].k,
    otherDateK:s.sums[2].k,totals:s.totals,undo:s.undo,form:s.form,picked:s.picked,
    diskGrams:s.disk.rec[A].ml.map(m => m.items.map(i => i.g)),
  }]));
  console.log(JSON.stringify({width,name,status:observation.status,expected,stages,error}));
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320,390]) {
      const ctx = await browser.newContext({viewport:{width,height:width === 320 ? 568 : 844},
        timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce',serviceWorkers:'block'});
      await ctx.route('https://**/*',r => r.abort());
      try {
        const p = await ctx.newPage(), errors = []; p.setDefaultTimeout(7000);
        p.on('pageerror',e => errors.push(e.message));
        await p.clock.install({time:new Date(TIME)}); await p.clock.resume();
        await p.clock.setFixedTime(new Date(TIME));
        await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p,'#setSkip');
        await check(p,width,'invalid main grams stays outside saved journal',
          'raw is visible/invalid; journal, daily total, disk remain valid; reload restores saved125',async e => {
            await fill(p,G,RAW); e.raw = await state(p); assertJournal(e.raw);
            assert.equal(firstGram(e.raw),RAW); assert.equal(e.raw.ui[0].invalid[0],'true');
            assert.equal(e.raw.disk.rec[A].ml[0].items[0].g,'125');
            e.reload = await reloadFood(p); assertJournal(e.reload); assert.equal(firstGram(e.reload),'125');
          });
        await check(p,width,'general Undo loses later invalid main grams',
          'Undo add-meal restores2meals/saved125 but keeps later raw1e309 for original item',async e => {
            await tap(p,'#addMl'); await fill(p,G,RAW); e.beforeUndo = await state(p);
            assert.equal(e.beforeUndo.undo,true); await tap(p,'#undoB'); e.afterUndo = await state(p);
            assertJournal(e.afterUndo); assert.equal(e.afterUndo.rec[A].ml.length,2);
            e.reload = await reloadFood(p); assertJournal(e.reload); assert.equal(firstGram(e.reload),'125');
            assert.equal(firstGram(e.afterUndo),RAW);
          });
        await check(p,width,'adding meal redraw loses existing invalid main grams',
          'add and Undo retain raw for original item while totals use saved125',async e => {
            await fill(p,G,RAW); e.before = await state(p); await tap(p,'#addMl'); e.afterAdd = await state(p);
            await tap(p,'#undoB'); e.afterUndo = await state(p); assertJournal(e.afterUndo);
            assert.equal(firstGram(e.afterAdd),RAW); assert.equal(firstGram(e.afterUndo),RAW);
          });
        await check(p,width,'remove other meal item plus Undo loses raw',
          'remove/Undo other item preserve raw on unaffected original item; saved totals restore175',async e => {
            await fill(p,G,RAW); await tap(p,'#mll [data-ml="1"] [data-rm="0"]'); e.afterRemove = await state(p);
            await tap(p,'#undoB'); e.afterUndo = await state(p); assertJournal(e.afterUndo);
            assert.equal(e.afterUndo.sums[1].k,175); assert.equal(firstGram(e.afterUndo),RAW);
          });
        await check(p,width,'duplicate items shift index after earlier deletion and Undo',
          'raw belongs to second125g duplicate through first-row deletion and Undo; no index/name transplantation',async e => {
            await p.evaluate(() => {
              mealsRW('2026-10-13')[0].items = [{p:'AUDIT Food',g:'125'},{p:'AUDIT Food',g:'125'},{p:'AUDIT Food',g:'50'}];
              mealsRW('2026-10-13')[1].items = []; save(); flush(); paintFood();
            });
            await fill(p,'#mll [data-ml="0"] input[data-g="1"]',RAW);
            await tap(p,'#mll [data-ml="0"] [data-rm="0"]'); e.afterRemove = await state(p);
            assert.deepEqual(e.afterRemove.rec[A].ml[0].items.map(i => i.g),['125','50']);
            assert.equal(e.afterRemove.sums[1].k,175);
            await tap(p,'#undoB'); e.afterUndo = await state(p);
            assert.deepEqual(e.afterUndo.rec[A].ml[0].items.map(i => i.g),['125','125','50']);
            assert.equal(e.afterUndo.sums[1].k,300); assert.equal(e.afterUndo.sums[2].k,250);
            e.reload = await reloadFood(p); assert.equal(e.reload.sums[1].k,300);
            assert.deepEqual(e.reload.ui[0].grams,['125','125','50']);
            assert.equal(e.afterRemove.ui[0].grams[0],RAW); assert.equal(e.afterUndo.ui[0].grams[1],RAW);
          });
        await check(p,width,'tab roundtrip loses raw',
          'food→progress→food retains raw in same dated item; journal remains unchanged',async e => {
            await fill(p,G,RAW); e.before = await state(p); await tap(p,'[data-tab="prog"]');
            await tap(p,'[data-tab="food"]'); e.after = await state(p); assertJournal(e.after);
            assert.deepEqual(e.after.rec,e.before.rec); assert.equal(firstGram(e.after),RAW);
          });
        await check(p,width,'date roundtrip avoids transplant but loses originating draft',
          'B displays250, returning A restores its raw1e309; neither journal date changes',async e => {
            await fill(p,G,RAW); e.before = await state(p); await tap(p,'#chips [data-d="2026-10-14"]');
            e.otherDate = await state(p); assert.equal(firstGram(e.otherDate),'250');
            await tap(p,'#chips [data-d="2026-10-13"]'); e.origin = await state(p);
            assert.deepEqual(e.origin.rec,e.before.rec); assertJournal(e.origin); assert.equal(firstGram(e.origin),RAW);
          });
        await check(p,width,'open picker/filter/search do not redraw main grams',
          'main raw remains through pure picker filter/search while custom KBJU raw retains exact strings',async e => {
            await fill(p,G,RAW); await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food');
            await fill(p,'#nfK','222,50'); await tap(p,'[data-ch=""]');
            await fill(p,'#fq','AUDIT Other'); await fill(p,'#nfP','12,5');
            await fill(p,'#fq','AUDIT Food'); e.after = await state(p);
            assertJournal(e.after); assert.equal(firstGram(e.after),RAW); assert.equal(e.after.form[1],'222,50');
            await fill(p,'#fq','AUDIT Other'); assert.equal((await state(p)).form[2],'12,5');
          });
        await check(p,width,'picker drafts and selected positions cannot switch dates/tabs through backdrop',
          'date/tab buttons are obscured by picker; raw KBJU and selected100g stay in originating context',async e => {
            await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food'); await tap(p,'[data-add="AUDIT Food"]');
            await fill(p,'#nfK','222,50');
            for (const selector of ['#chips [data-d="2026-10-14"]','[data-tab="prog"]']) {
              let obstruction = null;
              try { await p.locator(selector).click({timeout:500}); }
              catch (error) { obstruction = error.message; }
              assert.ok(obstruction?.includes('intercepts pointer events'),'background button must be inaccessible while picker is open');
            }
            e.after = await state(p); assert.equal(e.after.sel,A); assert.equal(e.after.tab,'food');
            assert.equal(e.after.picker,true); assert.equal(e.after.form[1],'222,50');
            assert.deepEqual(e.after.picked,[{p:'AUDIT Food',g:100}]); assertJournal(e.after);
            await tap(p,'#fpX'); await tap(p,'#askN'); e.declined = await state(p);
            assert.equal(e.declined.form[1],'222,50'); assert.deepEqual(e.declined.picked,e.after.picked);
          });
        await check(p,width,'saving custom food redraw loses main draft',
          'custom200 changes dynamic totals as before; main raw remains outside journal; Undo restores nutrient100',async e => {
            await fill(p,G,RAW); await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food');
            await fill(p,'#nfK','200'); await tap(p,'#nfSave'); e.afterSave = await state(p);
            assertJournal(e.afterSave,'125',350); await tap(p,'#undoB'); e.afterUndo = await state(p);
            assertJournal(e.afterUndo); assert.equal(e.afterUndo.myFood[0].k,100);
            assert.equal(firstGram(e.afterSave),RAW); assert.equal(firstGram(e.afterUndo),RAW);
          });
        await check(p,width,'rename Undo protects picker raw but loses main grams',
          'case rename+Undo keep later222,50 picker raw and main1e309; saved grams remain125',async e => {
            await fill(p,G,RAW); await tap(p,'[data-pick="0"]'); await fill(p,'#fq','AUDIT Food');
            await tap(p,'[data-add="AUDIT Food"]'); await fill(p,'#nfN','audit food'); await tap(p,'#nfSave');
            await fill(p,'#nfK','222,50'); await tap(p,'#undoB'); e.afterUndo = await state(p);
            assert.equal(e.afterUndo.form[1],'222,50'); assert.equal(e.afterUndo.picked[0].p,'AUDIT Food');
            assertJournal(e.afterUndo); assert.equal(e.afterUndo.myFood[0].n,'AUDIT Food');
            assert.equal(firstGram(e.afterUndo),RAW);
          });
        await check(p,width,'replacement ration excludes raw transplant; Undo original draft is lost',
          'replacement displays400, Undo restores original125 and its pendingraw; no draft copies to replacement',async e => {
            await fill(p,G,RAW); await tap(p,'#cpBtn'); await tap(p,'[data-from="2026-10-12"]');
            await tap(p,'#askY'); e.replacement = await state(p);
            assert.equal(firstGram(e.replacement),'400'); assert.equal(e.replacement.sums[1].k,400);
            await tap(p,'#undoB'); e.original = await state(p); assertJournal(e.original);
            e.reload = await reloadFood(p); assertJournal(e.reload); assert.equal(firstGram(e.reload),'125');
            assert.equal(firstGram(e.original),RAW);
          });
        await check(p,width,'identical replacement has separate form identity and no journal Undo',
          'copied equal ration renders saved125, no raw transplant and no journal Undo because S snapshot is equal',async e => {
            await p.evaluate(() => { recRW('2026-10-12').ml = JSON.parse(JSON.stringify(mealsOf('2026-10-13'))); save(); flush(); });
            await fill(p,G,RAW); await tap(p,'#cpBtn'); await tap(p,'[data-from="2026-10-12"]'); await tap(p,'#askY');
            e.replacement = await state(p); assert.equal(firstGram(e.replacement),'125'); assertJournal(e.replacement);
            assert.equal(e.replacement.undo,false); e.reload = await reloadFood(p); assertJournal(e.reload);
          });
        await check(p,width,'valid comma grams commits then field Undo restores journal',
          'valid200,50 writes journal/derivatives; Undo restores125; reload preserves125',async e => {
            await fill(p,G,'200,50'); e.saved = await state(p); assertJournal(e.saved,'200,50',250.5);
            assert.equal(e.saved.undo,true); await tap(p,'#undoB'); e.undone = await state(p); assertJournal(e.undone);
            assert.equal(firstGram(e.undone),'125'); e.reload = await reloadFood(p); assertJournal(e.reload);
          });
        await check(p,width,'empty focus draft remains transient until blur commits zero',
          'empty while focused leaves journal125; blur commits0 under established model',async e => {
            await fill(p,G,'',false); e.focused = await state(p); assertJournal(e.focused);
            await p.locator(G).blur(); await p.waitForTimeout(80); e.blurred = await state(p);
            assertJournal(e.blurred,'',50); assert.equal(firstGram(e.blurred),'');
          });
        await check(p,width,'invalid blur does not destroy prior Undo',
          'after add and invalid blur Undo remains armed; validation error does not save raw',async e => {
            await tap(p,'#addMl'); await fill(p,G,'-2'); e.invalid = await state(p);
            assert.equal(e.invalid.undo,true); assert.equal(firstGram(e.invalid),'-2'); assertJournal(e.invalid);
          });
        assert.deepEqual(errors,[]); assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > innerWidth),false);
        console.log(JSON.stringify({width,name:'runtime and width',status:'PASS',errors}));
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  console.log('FOOD_DRAFT_AUDIT '+JSON.stringify({observations:observations.length,failedExpectations:failures}));
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 2; });
