/* BUG-0007/0008: invalid edits cannot erase valid food data or persist Infinity.
   Real UI events, synthetic profiles, independent phone contexts. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let failures = 0, checks = 0;
const huge = '1' + '0'.repeat(308); // finite Number; multiplying by 2 overflows
async function tap(p, s) { await p.locator(s).first().click(); await p.waitForTimeout(290); }
async function fill(p, s, v) {
  await p.locator(s).first().fill(v);
  await p.locator(s).first().blur(); // actual change/blur, not direct handler calls
  await p.waitForTimeout(180); // application's 150ms persistence debounce
}
async function seed(p, kcal = 100) {
  await p.evaluate(kcal => {
    S = build(); migrate(); S.setup = 1; S.hints = 0; S.sound = 0;
    S.bw = '80'; S.goal = '80'; S.bkAsk = Date.now(); applyNutri();
    S.myFood = [{n:'NUMERIC Food',k:kcal,p:10,f:2,c:15}]; invalidateFood();
    S.rec = {};
    for (const ds of ['2026-10-08','2026-10-10']) {
      recRW(ds).ml = [{n:'Синтетический приём',note:'',items:[{p:'NUMERIC Food',g:'200'}]}];
    }
    S.tpl = [{n:'Синтетический шаблон',ml:[{n:'Шаблон',items:[{p:'NUMERIC Food',g:'200'}]}]}];
    sel = '2026-10-10'; mo = '2026-10'; tab = 'food'; exOpen = null;
    closeSetup(); sheetClose(); $('fp').classList.remove('on'); undoDrop(); save(); flush(); render();
  }, kcal);
}
async function state(p) {
  return p.evaluate(() => ({rec:S.rec,myFood:S.myFood,tpl:S.tpl,
    today:daySum('2026-10-10'),history:daySum('2026-10-08'),
    shown:[$('tKc').textContent,$('tPr').textContent],disk:localStorage.getItem(KEY)}));
}
async function editCustom(p) { await tap(p,'[data-pick="0"]'); await fill(p,'#fq','NUMERIC Food'); }
async function check(name, fn) {
  checks++;
  try { await fn(); console.log('✓ '+name); }
  catch(e) { failures++; console.log('✗ '+name+' → '+e.message); }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320,390]) {
      const ctx = await browser.newContext({viewport:{width,height:width===320?568:844},
        timezoneId:'Asia/Vladivostok',locale:'ru-RU',reducedMotion:'reduce'});
      await ctx.route('https://**/*', r => r.abort());
      try {
        const p = await ctx.newPage(); p.setDefaultTimeout(8000);
        const errors = []; p.on('pageerror', e => errors.push(e.message));
        await p.clock.install({time:new Date('2026-10-10T02:00:00Z')}); await p.clock.resume();
        await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p,'#setSkip');
        for (const v of ['abc','12abc','-2','Infinity','1e309',huge]) {
          await check(width+' invalid grams preserve state/disk/totals '+v.slice(0,20), async () => {
            await seed(p,v===huge?1000:100); const before = await state(p);
            await fill(p,'[data-g="0"]',v);
            assert.deepEqual(await state(p),before,'invalid grams must retain the last valid record');
            assert.equal(await p.locator('[data-g="0"]').first().inputValue(),v,'invalid draft remains visible');
          });
        }
        for (const field of ['K','P','F','C']) for (const v of ['abc','12abc','-2','Infinity','1e309',huge]) {
          await check(width+' custom '+field+' rejects atomically '+v.slice(0,20), async () => {
            await seed(p); await editCustom(p); const before = await state(p);
            // Valid neighbouring edit must not partially commit when this field fails.
            await fill(p,field==='K'?'#nfP':'#nfK','33');
            await fill(p,'#nf'+field,v); await tap(p,'#nfSave');
            assert.deepEqual(await state(p),before,'invalid form must preserve database, history, templates and disk');
          });
        }
        for (const reference of ['history','template']) {
          await check(width+' custom overflow only in '+reference+' rejects atomically', async () => {
            await seed(p);
            await p.evaluate(reference => {
              S.rec['2026-10-10'].ml[0].items[0].g = '100';
              S.rec['2026-10-08'].ml[0].items[0].g = reference === 'history' ? '200' : '100';
              S.tpl[0].ml[0].items[0].g = reference === 'template' ? '200' : '100';
              save(); flush(); paintFood();
            }, reference);
            await editCustom(p); const before = await state(p);
            await fill(p,'#nfK',huge); await tap(p,'#nfSave');
            assert.deepEqual(await state(p),before,'all referenced meals must stay finite, including non-selected references');
          });
        }
        await check(width+' grams reject day aggregation overflow across finite meals', async () => {
          await seed(p);
          await p.evaluate(huge => {
            S.rec['2026-10-10'].ml = [
              {n:'Первая порция',items:[{p:'NUMERIC Food',g:huge}]},
              {n:'Вторая порция',items:[{p:'NUMERIC Food',g:'200'}]}
            ];
            save(); flush(); paintFood();
          }, huge);
          const before = await state(p);
          await p.locator('#mll [data-ml="1"] [data-g="0"]').fill(huge);
          await p.locator('#mll [data-ml="1"] [data-g="0"]').blur();
          await p.waitForTimeout(180);
          assert.deepEqual(await state(p),before,'finite item/meal calculations must also yield a finite day sum');
        });
        await check(width+' nutrient reject day aggregation overflow across finite meals', async () => {
          await seed(p);
          await p.evaluate(() => {
            S.rec['2026-10-10'].ml = [
              {n:'Первая порция',items:[{p:'NUMERIC Food',g:'100'}]},
              {n:'Вторая порция',items:[{p:'NUMERIC Food',g:'100'}]}
            ];
            S.rec['2026-10-08'].ml[0].items[0].g = '100';
            S.tpl[0].ml[0].items[0].g = '100';
            save(); flush(); paintFood();
          });
          await editCustom(p); const before = await state(p);
          await fill(p,'#nfK',huge); await tap(p,'#nfSave');
          assert.deepEqual(await state(p),before,'finite meal calculations must also yield a finite day sum');
        });
        await check(width+' overflow guard follows meal then day accumulation order', async () => {
          await seed(p);
          await p.evaluate(tiny => {
            S.myFood.push({n:'NUMERIC Small',k:Number(tiny),p:0,f:0,c:0});
            invalidateFood();
            S.rec['2026-10-10'].ml = [
              {n:'Большая порция',items:[{p:'NUMERIC Food',g:'100'}]},
              {n:'Маленькие порции',items:Array.from({length:10}, () => ({p:'NUMERIC Small',g:'100'}))}
            ];
            S.rec['2026-10-08'].ml[0].items[0].g = '100';
            S.tpl[0].ml[0].items[0].g = '100';
            save(); flush(); paintFood();
          }, '1' + '0'.repeat(291));
          await editCustom(p); const before = await state(p);
          // Decimal representation of MAX_VALUE, without disallowed exponent syntax.
          await fill(p,'#nfK','17976931348623157' + '0'.repeat(292));
          await tap(p,'#nfSave');
          assert.deepEqual(await state(p),before,'flattening additions can hide overflow that actual grouped totals produce');
        });
        await check(width+' picker addition rejects overflow from valid unused huge custom food', async () => {
          await seed(p);
          await p.evaluate(() => {
            S.myFood = []; S.tpl = []; S.rec = {};
            recRW(sel).ml = [{n:'Синтетический приём',items:[]}];
            invalidateFood(); save(); flush(); paintFood();
          });
          await tap(p,'[data-pick="0"]'); await fill(p,'#fq','NUMERIC Huge');
          await fill(p,'#nfK',huge);
          for (const f of ['P','F','C']) await fill(p,'#nf'+f,'0');
          await tap(p,'#nfSave');
          assert.equal((await state(p)).myFood[0].k,Number(huge),'finite unused nutrient must be accepted');
          await tap(p,'#fpl [data-add="NUMERIC Huge"]'); await tap(p,'#fpAdd');
          assert.equal((await state(p)).today.k,Number(huge),'first finite 100g portion must be accepted');
          await tap(p,'[data-pick="0"]'); await fill(p,'#fq','NUMERIC Huge');
          await tap(p,'#fpl [data-add="NUMERIC Huge"]'); const before = await state(p);
          await tap(p,'#fpAdd');
          assert.deepEqual(await state(p),before,'overflowing addition must preserve day, database and disk');
          assert.ok(await p.locator('#fp').evaluate(el => el.classList.contains('on')),'picker stays open for correction');
          assert.equal(await p.evaluate(() => picked.length),1,'selection is retained after rejected addition');
        });
        for (const [v,want] of [['125,5',125.5],['125.5',125.5],['0',0],['',0]]) {
          await check(width+' valid grams '+JSON.stringify(v)+' / undo / reload', async () => {
            await seed(p); const before = await state(p);
            await fill(p,'[data-g="0"]',v); const after = await state(p);
            assert.ok(Math.abs(after.today.k-want)<1e-9); assert.equal(after.history.k,200);
            assert.deepEqual(after.rec['2026-10-08'],before.rec['2026-10-08']);
            await tap(p,'#undoB'); assert.equal((await state(p)).today.k,200);
            await fill(p,'[data-g="0"]',v);
            await p.reload(); await p.waitForFunction(() => S && S.setup);
            assert.ok(Math.abs((await state(p)).today.k-want)<1e-9); assert.equal((await state(p)).history.k,200);
          });
        }
        await check(width+' clear-before-replace keeps last valid grams until completion', async () => {
          await seed(p); const before = await state(p);
          await p.locator('[data-g="0"]').first().fill('');
          await p.waitForTimeout(180);
          assert.deepEqual(await state(p),before);
          await fill(p,'[data-g="0"]','125,5'); assert.ok(Math.abs((await state(p)).today.k-125.5)<1e-9);
          await tap(p,'#undoB'); assert.equal((await state(p)).today.k,200);
        });
        for (const v of ['0','']) {
          await check(width+' custom explicit/blank zero '+JSON.stringify(v), async () => {
            await seed(p); await editCustom(p);
            for (const f of ['K','P','F','C']) await fill(p,'#nf'+f,v);
            await tap(p,'#nfSave'); const s = await state(p);
            assert.deepEqual(s.myFood,[{n:'NUMERIC Food',k:0,p:0,f:0,c:0}]);
            assert.deepEqual(s.today,{k:0,p:0,f:0,c:0}); assert.deepEqual(s.history,s.today);
          });
        }
        await check(width+' valid custom decimal edit recalculates existing dates / undo / reload', async () => {
          await seed(p); await editCustom(p);
          await fill(p,'#nfK','200,5'); await fill(p,'#nfP','12.5'); await tap(p,'#nfSave');
          let s = await state(p); assert.equal(s.today.k,401); assert.equal(s.history.k,401);
          assert.equal(s.today.p,25); assert.equal(s.history.p,25);
          assert.equal(s.rec['2026-10-08'].ml[0].items[0].g,'200');
          await tap(p,'#undoB'); assert.equal((await state(p)).history.k,200);
          await fill(p,'#nfK','200,5'); await fill(p,'#nfP','12.5'); await tap(p,'#nfSave');
          await p.reload(); await p.waitForFunction(() => S && S.setup);
          s = await state(p); assert.equal(s.history.k,401); assert.equal(s.history.p,25);
        });
        await check(width+' no JavaScript errors',async()=>assert.deepEqual(errors,[]));
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  console.log('NUMERIC FOOD '+checks+' checks, '+failures+' failures');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 2; });
