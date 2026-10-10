/* BUG-0001/0002/0005/0019: real buttons on isolated synthetic journals.
   Breaks caught: whole-day deletion, mutable confirmation date, mutable
   catalogue-card date. Expected volumes/XP are hand-calculated fixtures. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let failures = 0;
async function tap(p, selector) { await p.click(selector); await p.waitForTimeout(290); }
async function seed(p) {
  await p.evaluate(() => {
    window.testDayOffset = 0;
    document.dispatchEvent(new Event('visibilitychange'));
    S = build(); migrate(); S.setup = 1; S.hints = 0; S.sound = 0;
    S.bw = '80'; S.goal = '80'; S.start = '2026-09-28'; S.bkAsk = Date.now();
    S.quest = {}; S.volBase = {}; S.xpBase = 0;
    const e = dayOf('2026-10-10').ex[0], di = dayIdx('2026-10-10');
    e.w = 55; e.r = '10'; e.fixed = 1;
    const log = (w, vol) => ({ n: e.n, g: e.g, w, s: 3, r: '8', rs: [8,8,8], ws: [w,w,w], done: 1, vol, xp: 12 });
    S.rec = {
      '2026-10-03': { log: {0: {...log(30,240), s: 1, rs: [8], ws: [30]}}, sp: {}, wo: 0 },
      '2026-10-10': {
        // Duplicate legacy names must not leave a phantom personal record.
        log: {0: {...log(40,960), bump: [[di,0,40,0,55]], rbump: [[di,0,'8','10']]}, 1: log(50,1200)},
        sp: {0:1}, wo: 1, t0: Date.now()-3600000, t1: Date.now(), skip: 1,
        ml: [{n:'Тестовый завтрак',items:[{p:'Овсяные хлопья сухие',g:100}]}],
        bw:'80', note:'Сохранить заметку', dt:dayOf('2026-10-10').t, dn:'Исторический день',
        extraMeta: 'Не удалять независимые данные'
      },
      '2026-10-11': {log:{0:log(20,480)},sp:{},wo:1,note:'Другой день'}
    };
    S.pr[e.n] = 50;
    sel = '2026-10-10'; mo = '2026-10'; tab = 'wo'; exOpen = null; libPick = null; editPast = false;
    closeSetup(); sheetClose(); undoDrop(); save(); flush(); render();
  });
}
async function state(p) {
  return p.evaluate(() => {
    const name = dayOf('2026-10-10').ex[0].n;
    return {rec: S.rec, days: S.days, pr: S.pr[name], xp: S.xp,
      ton: dayTon('2026-10-10'), sets: daySets('2026-10-10'),
      total: Object.values(S.vol).reduce((a,b)=>a+b,0),
      w: dayOf('2026-10-10').ex[0].w, reps: dayOf('2026-10-10').ex[0].r};
  });
}
async function midnight(p) {
  await p.evaluate(() => { window.testDayOffset = 864e5; document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForFunction(() => sel === '2026-10-11');
}
async function check(name, fn) {
  try { await fn(); console.log('✓ '+name); }
  catch (e) { failures++; console.log('✗ '+name+' → '+e.message); }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320,390]) {
      const ctx = await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',reducedMotion:'reduce'});
      await ctx.route('https://**/*', route => route.abort());
      await ctx.addInitScript(() => {
        const D = Date, base = new D('2026-10-10T12:00:00+10:00').valueOf(), mark = performance.now();
        window.testDayOffset = 0;
        window.Date = class extends D {
          constructor(...args) { super(...(args.length ? args : [base+window.testDayOffset+performance.now()-mark])); }
          static now() { return base+window.testDayOffset+performance.now()-mark; }
        };
      });
      try {
        const p = await ctx.newPage(); p.setDefaultTimeout(8000);
        const errors = []; p.on('pageerror', e => errors.push(e.message));
        await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p,'#setSkip');
        await check(width+' BUG-0001 reset preserves non-training data / derived stats / undo / reload', async () => {
          await seed(p); const before = await state(p);
          assert.equal(before.ton,2160); assert.equal(before.sets,6); assert.equal(before.total,2880); assert.equal(before.xp,172);
          await tap(p,'#rd'); await tap(p,'#askY'); const after = await state(p), r = after.rec['2026-10-10'];
          for (const key of ['ml','bw','note','sp','dt','dn','extraMeta']) assert.deepEqual(r?.[key],before.rec['2026-10-10'][key],key+' must survive');
          assert.deepEqual(r.log,{}); assert.equal(r.wo,0);
          for (const key of ['t0','t1','skip']) assert.equal(r[key],undefined,key+' must clear');
          assert.deepEqual(after.rec['2026-10-11'],before.rec['2026-10-11']);
          assert.equal(after.ton,0); assert.equal(after.sets,0); assert.equal(after.total,720); assert.equal(after.xp,88);
          assert.equal(after.pr,30); assert.equal(after.w,40); assert.equal(after.reps,'8');
          await tap(p,'[data-tab="food"]');
          assert.equal(await p.locator('#scr-food [data-mf="n"]').first().inputValue(),'Тестовый завтрак');
          assert.match(await p.locator('#scr-food').innerText(),/366 ккал/);
          await tap(p,'[data-tab="prog"]'); assert.equal((await state(p)).total,720);
          await tap(p,'#undoB'); assert.deepEqual(await state(p),before);
          await tap(p,'[data-tab="wo"]'); await tap(p,'#rd'); await tap(p,'#askY');
          await p.waitForFunction(() => JSON.parse(localStorage.getItem(KEY)).rec['2026-10-10'].wo === 0);
          const persisted = await state(p); await p.reload(); await p.waitForFunction(() => S && S.setup);
          assert.deepEqual(await state(p),persisted);
        });
        await check(width+' reset cancellation and repeated reset are non-destructive', async () => {
          await seed(p); const before = await state(p); await tap(p,'#rd'); await tap(p,'#askN'); assert.deepEqual(await state(p),before);
          await tap(p,'#rd'); await tap(p,'#askY'); const once = await state(p);
          await tap(p,'#rd'); await tap(p,'#askY'); assert.deepEqual(await state(p),once);
        });
        for (const reverse of [false,true]) await check(width+' reset unwinds chained progression regardless of completion index '+reverse, async () => {
          await seed(p);
          await p.evaluate(reverse => {
            const r=S.rec['2026-10-10'], di=dayIdx('2026-10-10');
            const first=r.log[reverse?1:0], last=r.log[reverse?0:1];
            first.bump=[[di,0,40,0,50]]; first.rbump=[[di,0,'8','9']];
            last.bump=[[di,0,50,1,55]]; last.rbump=[[di,0,'9','10']];
            save(); flush(); render();
          },reverse);
          const before=await state(p); await tap(p,'#rd'); await tap(p,'#askY');
          const after=await state(p); assert.equal(after.w,40); assert.equal(after.reps,'8'); assert.equal(after.pr,30);
          await tap(p,'#undoB'); assert.deepEqual(await state(p),before);
        });
        await check(width+' reset never overwrites later manual program edits', async () => {
          await seed(p); await p.evaluate(()=>{const e=dayOf('2026-10-10').ex[0];e.w=65;e.r='14';save();flush();render();});
          await tap(p,'#rd'); await tap(p,'#askY'); const after=await state(p);
          assert.equal(after.w,65); assert.equal(after.reps,'14');
        });
        await check(width+' BUG-0002 midnight reset stays on confirmed date; undo keeps intervening edit', async () => {
          await seed(p); const other = (await state(p)).rec['2026-10-11']; await tap(p,'#rd');
          assert.match(await p.locator('#askT').innerText(),/10/); await midnight(p);
          // Another action completed while the confirmation waited must survive undo.
          await p.evaluate(() => { S.rec['2026-10-11'].note = 'Поздняя запись'; save(); flush(); });
          const beforeApply = await state(p); await tap(p,'#askY'); const after = await state(p);
          assert.equal(after.rec['2026-10-10'].wo,0);
          assert.deepEqual(after.rec['2026-10-11'],{...other,note:'Поздняя запись'});
          assert.equal(after.ton,0); assert.equal(await p.evaluate(()=>sel),'2026-10-11');
          await tap(p,'#undoB'); assert.deepEqual(await state(p),beforeApply);
        });
        await check(width+' BUG-0005 catalogue detail uses displayed date / undo / reload', async () => {
          await seed(p); await tap(p,'[data-tab="ex"]'); await p.waitForFunction(()=>!!LIB);
          await tap(p,'[data-lscope="all"]'); await p.locator('#exs').fill('жим');
          const id = await p.evaluate(() => LIB.list.find(o=>libMatch(o)&&!exAlreadyInDay(sel,libExerciseName(o),o.id,true)).id);
          await tap(p,'#exgrid [data-lib="'+id+'"]');
          assert.equal(await p.locator('#sh [data-libadd]').isDisabled(),false);
          assert.match(await p.locator('#sh [data-libadd]').innerText(),/10/);
          const before = await p.evaluate(()=>JSON.stringify(S.days));
          const counts = await p.evaluate(()=>[dayOf('2026-10-10').ex.length,dayOf('2026-10-11').ex.length]);
          await midnight(p); await tap(p,'#sh [data-libadd]');
          assert.deepEqual(await p.evaluate(()=>[dayOf('2026-10-10').ex.length,dayOf('2026-10-11').ex.length]),[counts[0]+1,counts[1]]);
          await tap(p,'#undoB'); assert.equal(await p.evaluate(()=>JSON.stringify(S.days)),before);
          // Open again after returning to the displayed date, then repeat rollover.
          await p.evaluate(()=>{window.testDayOffset=0;document.dispatchEvent(new Event('visibilitychange'));});
          await tap(p,'#exgrid [data-lib="'+id+'"]'); await midnight(p); await tap(p,'#sh [data-libadd]');
          await p.waitForFunction(n=>JSON.parse(localStorage.getItem(KEY)).days[dayIdx('2026-10-10')].ex.length===n,counts[0]+1);
          await p.reload(); await p.waitForFunction(()=>S&&S.setup);
          assert.deepEqual(await p.evaluate(()=>[dayOf('2026-10-10').ex.length,dayOf('2026-10-11').ex.length]),[counts[0]+1,counts[1]]);
        });
        for (const detail of [false,true]) await check(width+' mapped picker '+(detail?'detail':'grid')+' retains date / shared template / undo / reload', async () => {
          await seed(p);
          await p.evaluate(()=>{S.map['2026-10-10']=1;save();flush();render();});
          await tap(p,'#addEx'); await tap(p,'[data-libpick]'); await p.waitForFunction(()=>!!LIB);
          await tap(p,'[data-lscope="all"]'); await p.locator('#exs').fill('жим');
          const id=await p.locator('#exgrid [data-libadd]:not([disabled])').first().getAttribute('data-libadd');
          if(detail) await tap(p,'#exgrid [data-lib="'+id+'"]');
          const before=await p.evaluate(()=>JSON.stringify(S));
          const counts=await p.evaluate(()=>S.days.map(d=>d.ex.length));
          const wanted=counts.map((n,i)=>n+(i===1?1:0));
          await midnight(p); await tap(p,(detail?'#sh':'#exgrid')+' [data-libadd="'+id+'"]');
          assert.deepEqual(await p.evaluate(()=>S.days.map(d=>d.ex.length)),wanted);
          assert.equal(await p.evaluate(()=>dayOf('2026-10-13').ex.length),wanted[1]);
          assert.equal(await p.evaluate(()=>dayOf('2026-10-17').ex.length),counts[5]);
          await tap(p,'#undoB'); assert.equal(await p.evaluate(()=>JSON.stringify(S)),before);
          // Add the same item again, then check the actual stored state after reload.
          await tap(p,'[data-tab="wo"]');
          if(await p.locator('#editPast').isVisible())await tap(p,'#editPast');
          await tap(p,'#addEx'); await tap(p,'[data-libpick]');
          await tap(p,'[data-lscope="all"]'); await p.locator('#exs').fill('жим');
          if(detail) await tap(p,'#exgrid [data-lib="'+id+'"]');
          await tap(p,(detail?'#sh':'#exgrid')+' [data-libadd="'+id+'"]');
          await p.waitForFunction(n=>JSON.parse(localStorage.getItem(KEY)).days[1].ex.length===n,wanted[1]);
          await p.reload(); await p.waitForFunction(()=>S&&S.setup);
          assert.deepEqual(await p.evaluate(()=>S.days.map(d=>d.ex.length)),wanted);
          assert.equal(await p.evaluate(()=>S.map['2026-10-10']),1);
        });
        await check(width+' stale catalogue card rechecks rest / duplicate name / duplicate id before saving', async () => {
          for(const conflict of ['rest','name','id']) {
            await seed(p); await tap(p,'[data-tab="ex"]'); await p.waitForFunction(()=>!!LIB);
            await tap(p,'[data-lscope="all"]'); await p.locator('#exs').fill('жим');
            const id=await p.evaluate(()=>LIB.list.find(o=>libMatch(o)&&!exAlreadyInDay(sel,libExerciseName(o),o.id,true)).id);
            await tap(p,'#exgrid [data-lib="'+id+'"]'); assert.equal(await p.locator('#sh [data-libadd]').isDisabled(),false);
            await p.evaluate(({id,conflict})=>{
              const d=dayOf('2026-10-10'), o=libResolve(id);
              if(conflict==='rest')d.t='rest';
              else {
                const name=conflict==='name'?libExerciseName(o):'Тестовый вариант с тем же id';
                if(conflict==='id'){S.myEx=S.myEx||{};S.myEx[name]=libGroup(o);S.libEx=S.libEx||{};S.libEx[name]=[id,libMuscle(o)];}
                d.ex.push({n:name,s:3,r:'8',w:10,g:libGroup(o)});
              }
              save();flush();render();
            },{id,conflict});
            await midnight(p); const before=await p.evaluate(()=>JSON.stringify(S));
            await tap(p,'#sh [data-libadd]'); assert.equal(await p.evaluate(()=>JSON.stringify(S)),before);
          }
        });
        await check(width+' no uncaught browser errors',async()=>assert.deepEqual(errors,[]));
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  process.exitCode = failures ? 1 : 0;
})().catch(e=>{console.error(e);process.exitCode=1;});
