/* BUG-0014/0015: chart redraw must retain raw input and its dirty guard;
   one invalid nonempty measurement must reject the whole save, not drop history. */
const assert = require('node:assert/strict');
const {chromium} = require('playwright-core');
const {APP, LAUNCH} = require('../env');
let failures = 0, checks = 0;
async function tap(p, s) { await p.locator(s).first().click(); await p.waitForTimeout(290); }
async function seed(p) {
  await p.evaluate(() => {
    S = build(); migrate(); S.setup=1; S.hints=0; S.sound=0;
    S.bw='80'; S.goal='80'; S.start='2026-10-05'; S.bkAsk=Date.now();
    S.meas={'2026-10-08':{waist:80,chest:100},'2026-10-09':{waist:81,chest:101},'2026-10-10':{waist:82,chest:102}};
    const r=recRW('2026-10-10');
    r.note='Не менять историю'; r.ml=[{n:'Тестовая еда',items:[{p:'Овсяные хлопья сухие',g:100}]}];
    r.log={0:{n:'Жим лёжа',g:'Грудь',w:60,s:3,r:'8',rs:[8,8,8],ws:[60,60,60],done:1,vol:1440,sd:1}};
    recomputeStats(1); applyNutri(); sel='2026-10-10'; mo='2026-10'; tab='prog'; exOpen=null;
    closeSetup(); sheetClose(); undoDrop(); save(); flush(); render();
  });
  await tap(p,'[data-meas]');
}
async function state(p) {
  return p.evaluate(() => ({meas:S.meas,rec:S.rec,days:S.days,xp:S.xp,vol:S.vol,
    food:daySum('2026-10-10'),ton:dayTon('2026-10-10'),disk:JSON.parse(localStorage.getItem(KEY)).meas}));
}
async function check(name, fn) {
  checks++;
  try { await fn(); console.log('✓ '+name); }
  catch(e) { failures++; console.log('✗ '+name+' → '+e.message); }
}
(async()=>{
  const browser=await chromium.launch(LAUNCH);
  try {
    for(const width of [320,390]) {
      const context=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',reducedMotion:'reduce'});
      await context.route('https://**/*',r=>r.abort());
      await context.addInitScript(()=>{
        const D=Date, base=new D('2026-10-10T12:00:00+10:00').valueOf(), mark=performance.now();
        window.Date=class extends D {constructor(...a){super(...(a.length?a:[base+performance.now()-mark]));} static now(){return base+performance.now()-mark;}};
      });
      try {
        const p=await context.newPage(); p.setDefaultTimeout(8000);
        const errors=[];p.on('pageerror',e=>errors.push(e.message));
        await p.goto(APP);await p.waitForSelector('#setup.on');await tap(p,'#setSkip');
        for(const value of ['85','85,5','abc']) await check(width+' chart keeps raw '+value+' and dirty close guard',async()=>{
          await seed(p);const before=await state(p);
          await p.fill('[data-mk="waist"]',value);
          await tap(p,'[data-measch="chest"]');
          assert.equal(await p.locator('[data-mk="waist"]').inputValue(),value);
          await tap(p,'[data-measch="waist"]');
          assert.equal(await p.locator('[data-mk="waist"]').inputValue(),value);
          assert.deepEqual(await state(p),before);
          await tap(p,'#shX');assert.equal(await p.locator('#ask.on').count(),1);
          await tap(p,'#askN');assert.equal(await p.locator('[data-mk="waist"]').inputValue(),value);
          await tap(p,'#shX');await tap(p,'#askY');assert.equal(await p.locator('#sh.on').count(),0);
          await tap(p,'[data-meas]');assert.equal(await p.locator('[data-mk="waist"]').inputValue(),'82');
        });
        for(const bad of ['abc','82cm','-5','Infinity','1e309','9','301']) await check(width+' invalid '+bad+' cannot partially save',async()=>{
          await seed(p);const before=await state(p);
          await p.fill('[data-mk="waist"]',bad);await p.fill('[data-mk="chest"]','110');
          await tap(p,'[data-measave]');assert.deepEqual(await state(p),before);
          assert.equal(await p.locator('[data-mk="waist"]').inputValue(),bad);
          assert.equal(await p.locator('[data-mk="chest"]').inputValue(),'110');
        });
        for(const [raw,want] of [['85,5',85.5],['85.5',85.5],['10',10],['300',300]]) await check(width+' valid '+raw+' / undo / reload / connected data',async()=>{
          await seed(p);const before=await state(p);assert.equal(before.ton,1440);assert.equal(before.food.k,366);
          await p.fill('[data-mk="waist"]',raw);await p.fill('[data-mk="chest"]','110');
          await tap(p,'[data-measch="chest"]');await tap(p,'[data-measave]');
          const after=await state(p);
          assert.deepEqual(after.meas['2026-10-10'],{waist:want,chest:110});
          for(const k of ['rec','days','xp','vol','food','ton'])assert.deepEqual(after[k],before[k],k);
          assert.deepEqual(after.meas['2026-10-08'],{waist:80,chest:100});
          await tap(p,'#undoB');await p.evaluate(()=>flush());assert.deepEqual(await state(p),before);
          await p.reload();await p.waitForFunction(()=>S&&S.setup);assert.deepEqual(await state(p),before);
          await p.evaluate(()=>{tab='prog';render();});await tap(p,'[data-meas]');
          await p.fill('[data-mk="waist"]',raw);await p.fill('[data-mk="chest"]','110');await tap(p,'[data-measave]');
          await p.evaluate(()=>flush());await p.reload();await p.waitForFunction(()=>S&&S.setup);
          assert.deepEqual((await state(p)).meas['2026-10-10'],{waist:want,chest:110});
        });
        await check(width+' intentionally blank field omitted, all blank rejects, restored value clean',async()=>{
          await seed(p);
          await p.fill('[data-mk="waist"]','');await p.fill('[data-mk="chest"]','110');await tap(p,'[data-measave]');
          assert.deepEqual((await state(p)).meas['2026-10-10'],{chest:110});
          await tap(p,'#undoB');await tap(p,'[data-meas]');const before=await state(p);
          for(const input of await p.locator('[data-mk]').all())await input.fill('');
          await tap(p,'[data-measave]');assert.deepEqual(await state(p),before);
          await p.fill('[data-mk="waist"]','82');await p.fill('[data-mk="chest"]','102');
          await tap(p,'[data-measch="chest"]');await tap(p,'#shX');
          assert.equal(await p.locator('#ask.on').count(),0);assert.equal(await p.locator('#sh.on').count(),0);
        });
        await check(width+' no browser exceptions',()=>assert.deepEqual(errors,[]));
      } finally {await context.close();}
    }
  } finally {await browser.close();}
  console.log('MEASUREMENT DRAFT '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;
})().catch(e=>{console.error(e);process.exitCode=2;});
