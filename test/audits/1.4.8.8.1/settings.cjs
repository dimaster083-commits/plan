/* Audit probe, NOT a green-health suite. DEFECT means user contract failed.
   Real controls, isolated state. Fault injection is separately labelled. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {chromium} = require('playwright-core');
const {APP, LAUNCH} = require('../../env');
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const checks=[];
function check(name,actual,expected) {
  assert.deepEqual(actual,expected,name); checks.push(name); console.log('PASS '+name);
}
async function snapshot(p) { return p.evaluate(()=>JSON.parse(JSON.stringify(S))); }
async function selectCopy(p,copy) {
  await p.click('#gear');
  const chooser=p.waitForEvent('filechooser');
  await p.click('[data-bk="imp"]');
  await (await chooser).setFiles({name:'isolated-audit.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(copy))});
}
async function fresh(browser,width) {
  const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',acceptDownloads:true});
  const p=await ctx.newPage();
  await p.clock.install({time:new Date('2026-10-10T12:00:00+10:00')});
  await p.goto(APP); await p.waitForSelector('#setup.on'); await p.click('#setSkip');
  await p.evaluate(()=>{S.bw='70';S.goal='80';S.start='2026-10-05';S.bkAsk=Date.now();applyNutri();flush();render();});
  return {ctx,p};
}
(async()=>{
  const browser=await chromium.launch(LAUNCH);
  try {
    for(const width of [320,390]) {
      const {ctx,p}=await fresh(browser,width);
      try {
        const errors=[];p.on('pageerror',e=>errors.push(e.message));
        for(const tabName of ['wo','ex','prog','food','photo']) {
          await p.click('[data-tab="'+tabName+'"]');
          if(!await p.locator('#gear').isVisible()) {
            console.log('DEFECT SETTINGS-03 '+width+' settings inaccessible directly from '+tabName);
            continue;
          }
          await p.click('#gear');
          check(width+' gear from '+tabName,await p.locator('#shT').innerText(),'НАСТРОЙКИ');
          await p.click('#shX');
        }
        await p.click('[data-tab="wo"]');
        await p.click('#gear'); await p.click('[data-snd]');
        check(width+' sound state/label',await p.evaluate(()=>[S.sound,document.querySelector('[data-snd]').textContent]),[0,'Звук: выкл']);
        await p.click('[data-hints]');
        check(width+' hints disabled',await p.evaluate(()=>[S.hints,document.querySelector('[data-hints]').getAttribute('aria-pressed')]),[0,'false']);
        await p.waitForTimeout(280);
        await p.click('[data-hints]'); await p.click('#shX');
        await p.reload();
        check(width+' settings survive reload',await p.evaluate(()=>[S.sound,hintsOn()]),[0,true]);
        // Copy really downloaded by the settings button, then read for comparison.
        await p.click('#gear');const dl=p.waitForEvent('download');await p.click('[data-bk="exp"]');
        const download=await dl;const copy=JSON.parse(fs.readFileSync(await download.path(),'utf8'));
        check(width+' download shape',[copy.v,copy.state.bw,copy.state.goal],[3,'70','80']);
        await p.waitForFunction(()=>!!S.bkAt);
        const before=await snapshot(p);
        await selectCopy(p,{state:{days:[],rec:[]},photos:{}});
        await p.waitForFunction(()=>document.getElementById('noteT').textContent==='Файл не подошёл');
        check(width+' invalid copy atomic',await snapshot(p),before);
        const next=JSON.parse(JSON.stringify(copy));next.state.bw='82';next.state.goal='90';
        await selectCopy(p,next);await p.waitForSelector('#ask.on');await p.click('#askN');
        check(width+' restore cancel unchanged',await snapshot(p),before);
        await selectCopy(p,next);await p.waitForSelector('#ask.on');await p.click('#askY');
        await p.waitForFunction(()=>document.getElementById('noteT').textContent==='Прогресс восстановлен');
        check(width+' restored profile/disk',await p.evaluate(()=>[S.bw,S.goal,JSON.parse(localStorage.getItem(KEY)).bw]),['82','90','82']);
        await p.reload();check(width+' restored survives reload',await p.evaluate(()=>S.bw),'82');
        await p.click('#gear');const csv=p.waitForEvent('download');await p.click('[data-bk="csv"]');
        check(width+' CSV filename',(await csv).suggestedFilename(),'sistema-journal-2026-10-10.csv');
        // Anchors have no bounds check, unlike the body-weight fields.
        await p.click('#gear');await p.click('[data-recalc]');
        await p.fill('#an-b','999999');await p.fill('#an-s','50');await p.fill('#an-d','60');await p.click('#setOk');
        await p.waitForFunction(()=>!document.getElementById('setup').classList.contains('on'));
        const absurd=await p.evaluate(()=>({anchor:S.anchors.b,weights:S.days.flatMap(d=>d.ex).filter(e=>EXDB[e.n]?.[2]==='b').map(e=>[e.n,e.w])}));
        assert.equal(absurd.anchor,999999);assert(absurd.weights.some(([,w])=>w>10000));
        console.log('DEFECT SETTINGS-01 '+width+' unbounded anchors '+JSON.stringify(absurd));
        // Controlled IDB quota failure during an otherwise valid restore.
        // Only native storage is faulted; file reader, validation, buttons and handler stay real.
        await p.evaluate(()=>{window.auditPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...args){if(this.name==='ph')throw new DOMException('audit quota','QuotaExceededError');return auditPut.apply(this,args);};});
        const failing=JSON.parse(JSON.stringify(next));failing.state.bw='91';failing.photos={'2026-10-01':PNG};
        await selectCopy(p,failing);await p.waitForSelector('#ask.on');await p.click('#askY');
        await p.waitForFunction(()=>document.getElementById('noteT').textContent==='Файл не подошёл');
        const partial=await p.evaluate(()=>({message:document.getElementById('noteT').textContent,memory:S.bw,disk:JSON.parse(localStorage.getItem(KEY)).bw}));
        assert.equal(partial.memory,'91');assert.equal(partial.disk,'91');
        console.log('DEFECT SETTINGS-02 '+width+' injected IDB quota valid copy already committed '+JSON.stringify(partial));
        await p.evaluate(()=>{IDBObjectStore.prototype.put=auditPut;});
        await p.reload();check(width+' partial restore persists',await p.evaluate(()=>S.bw),'91');
        check(width+' no uncaught UI errors',errors,[]);
      } finally {await ctx.close();}
    }
    console.log('AUDIT COMPLETE '+checks.length+' positive checks; 3 reproduced findings at each width; NOT APP HEALTH PASS');
  } finally {await browser.close();}
})().catch(e=>{console.error('AUDIT HARNESS FAILURE',e);process.exitCode=1;});
