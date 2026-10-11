/* BUG-0010: validate all anchors before committing a programme recalculation. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let failures = 0;
async function tap(p, s) { await p.click(s); await p.waitForTimeout(290); }
async function seed(p) {
  await p.evaluate(() => {
    S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0;
    S.bw = '80'; S.goal = '80'; S.height = 180; S.age = '30'; S.bkAsk = Date.now();
    S.anchors = {b:70,s:50,d:60};
    S.days.forEach(d => (d.ex || []).forEach(e => delete e.fixed));
    S.rec = {};
    Object.assign(recRW('2026-10-08'), {note:'Сохранить историю', ml:[{n:'Еда',items:[{p:'Рис сухой',g:100}]}]});
    sel = today(); tab = 'wo'; exOpen = null; closeSetup(); sheetClose(); undoDrop(); save(); flush(); render();
  });
  await tap(p, '#gear'); await tap(p, '[data-recalc]');
}
async function snapshot(p) { return p.evaluate(() => ({anchors:S.anchors,days:S.days,rec:S.rec})); }
async function check(name, fn) {
  try { await fn(); console.log('✓ '+name); }
  catch(e) { failures++; console.log('✗ '+name+' → '+e.message); }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320,390]) {
      const ctx = await browser.newContext({viewport:{width,height:844},timezoneId:'Asia/Vladivostok',reducedMotion:'reduce'});
      await ctx.route('https://**/*', r => r.abort());
      try {
        const p = await ctx.newPage(); p.setDefaultTimeout(8000);
        const errors=[]; p.on('pageerror', e=>errors.push(e.message));
        await p.goto(APP); await p.waitForSelector('#setup.on'); await tap(p,'#setSkip');
        for (const bad of ['999999','1000.1','-1','abc','55kg','Infinity','1e309']) {
          await check(width+' rejects anchor '+bad+' atomically', async()=>{
            await seed(p); const before=await snapshot(p);
            await p.fill('#an-b',bad); await p.fill('#an-s','77'); await tap(p,'#setOk');
            assert.deepEqual(await snapshot(p),before);
            assert.equal(await p.locator('#an-b').inputValue(),bad);
            assert.equal(await p.locator('#setup').evaluate(e=>e.classList.contains('on')),true);
            await p.evaluate(()=>flush()); await p.reload(); await p.waitForFunction(()=>S && S.setup);
            assert.deepEqual(await snapshot(p),before);
          });
        }
        for (const key of ['s','d']) await check(width+' rejects invalid '+key+' without committing other anchors',async()=>{
          await seed(p); const before=await snapshot(p);
          await p.fill('#an-b','77'); await p.fill('#an-'+key,'55kg'); await tap(p,'#setOk');
          assert.deepEqual(await snapshot(p),before);
          assert.equal(await p.locator('#an-'+key).inputValue(),'55kg');
          assert.equal(await p.locator('#setup').evaluate(e=>e.classList.contains('on')),true);
        });
        for (const [raw, expected] of [['70,5',70.5],['70.5',70.5],['1000',1000]]) {
          await check(width+' accepts anchor '+raw+' and preserves journal',async()=>{
            await seed(p); const before=await snapshot(p);
            await p.fill('#an-b',raw); await tap(p,'#setOk');
            const after=await snapshot(p);
            assert.equal(after.anchors.b,expected); assert.deepEqual(after.rec,before.rec);
            assert.ok(after.days.every(d=>(d.ex||[]).every(e=>Number.isFinite(Number(e.w)))));
            await tap(p,'#undoB'); assert.deepEqual(await snapshot(p),before);
          });
        }
        for (const raw of ['','0']) await check(width+' unknown anchors '+JSON.stringify(raw)+' use bodyweight defaults',async()=>{
          await seed(p); for(const k of ['b','s','d']) await p.fill('#an-'+k,raw);
          await tap(p,'#setOk'); assert.deepEqual((await snapshot(p)).anchors,{b:40,s:47.5,d:55});
        });
        await check(width+' no browser exceptions',()=>assert.deepEqual(errors,[]));
      } finally { await ctx.close(); }
    }
  } finally { await browser.close(); }
  if(failures) process.exitCode=1;
})();
