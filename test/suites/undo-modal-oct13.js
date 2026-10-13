/* BUG-0020: pending native photo Undo must not close a sheet opened later.
   Only delivery of native RW completion is held, the transaction really commits.
   Synthetic image, localStorage and IDB in isolated contexts. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
const PHOTO='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
let checks=0,failures=0;
function check(name,a,e){checks++;try{assert.deepEqual(a,e);console.log('  ✓ '+name);}catch{failures++;console.log('  ✗ '+name+' expected='+JSON.stringify(e)+' actual='+JSON.stringify(a));}}
async function fresh(browser,width){const context=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',serviceWorkers:'block'});const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-13T12:00:00+10:00')});await p.goto(APP);await p.click('#setSkip');await p.evaluate(async photo=>{S.bw='75';S.sound=0;S.bkAsk=Date.now();S.exNote={fixture:'original'};save();flush();undoDrop();await phPut(today(),photo);PHCACHE.clear();await phSync();},PHOTO);await p.clock.runFor(300);await p.evaluate(()=>undoDrop());await p.click('[data-tab="photo"]');await p.waitForSelector('#phT img');await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>!!undoRec&&!PH.includes(today()));return {context,p,errors};}
async function hold(p){await p.evaluate(()=>{window.auditTx=IDBDatabase.prototype.transaction;window.auditGate=null;window.auditPuts=0;const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(...a){if(this.name==='ph')auditPuts++;return put.apply(this,a);};window.auditPut=put;let held=false;const setter=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete').set;IDBDatabase.prototype.transaction=function(...a){const tx=auditTx.apply(this,a);if(a[1]==='readwrite'&&!held){held=true;Object.defineProperty(tx,'oncomplete',{configurable:true,set(fn){setter.call(tx,function(e){window.auditGate=()=>fn.call(tx,e);});}});}return tx;};});}
async function release(p){await p.evaluate(()=>{IDBDatabase.prototype.transaction=auditTx;IDBObjectStore.prototype.put=auditPut;auditGate();});await p.waitForFunction(()=>!undoRec?.busy&&($('noteT').textContent==='Отменено'||/Действие с фото отменено/.test($('noteT').textContent)));}
(async()=>{const browser=await chromium.launch(LAUNCH);try{
  for(const width of [320,390]){
    for(const scenario of ['new-sheet','existing-sheet','replaced-sheet','new-save']){const{context,p,errors}=await fresh(browser,width);try{
      if(scenario==='existing-sheet'||scenario==='replaced-sheet'){await p.click('[data-tab="wo"]');await p.click('#gear');await p.waitForSelector('#sh.on');}
      await hold(p);await p.click('#undoB');await p.waitForFunction(()=>!!auditGate);
      check(width+' '+scenario+' native transaction really committed',await p.evaluate(()=>phGet(today())),PHOTO);
      await p.clock.runFor(300);if(await p.locator('#undoB').isVisible())await p.click('#undoB');
      check(width+' '+scenario+' repeated Undo writes once',await p.evaluate(()=>auditPuts),1);
      if(scenario==='new-sheet'){await p.click('[data-tab="prog"]');await p.click('[data-meas="1"]');await p.fill('[data-mk="waist"]','85,5');}
      if(scenario==='replaced-sheet'){await p.click('#shB [data-dayset="1"]');check(width+' replacement actually opens another sheet',await p.locator('#shT').innerText()!=='НАСТРОЙКИ',true);}
      if(scenario==='new-save'){await p.evaluate(()=>{S.exNote.later='saved while awaiting photo';save();flush();});}
      await release(p);
      check(width+' '+scenario+' exact image remains stored',await p.evaluate(()=>phGet(today())),PHOTO);
      if(scenario==='new-sheet'){
        check(width+' pending Undo leaves newer sheet open',await p.locator('#sh').evaluate(e=>e.classList.contains('on')),true);
        check(width+' pending Undo preserves raw measurement',await p.locator('[data-mk="waist"]').inputValue(),'85,5');
        check(width+' pending Undo retains input focus',await p.evaluate(()=>document.activeElement.matches('[data-mk="waist"]')),true);
        check(width+' pending Undo retains modal scroll lock',await p.evaluate(()=>document.body.style.overflow),'hidden');
        // Closing dirty form should still require an explicit decision.
        if(await p.locator('#sh').evaluate(e=>e.classList.contains('on'))){await p.keyboard.press('Escape');await p.waitForSelector('#ask.on');await p.click('#askN');check(width+' cancel close retains newer raw input',await p.locator('[data-mk="waist"]').inputValue(),'85,5');}
      }
      if(scenario==='existing-sheet')check(width+' existing sheet still closes as prior Undo behavior',await p.locator('#sh').evaluate(e=>e.classList.contains('on')),false);
      if(scenario==='replaced-sheet')check(width+' pending Undo leaves replacement sheet open',await p.locator('#sh').evaluate(e=>e.classList.contains('on')),true);
      if(scenario==='new-save')check(width+' later saved journal survives Undo',await p.evaluate(()=>[S.exNote.later,JSON.parse(localStorage.getItem(KEY)).exNote.later]),['saved while awaiting photo','saved while awaiting photo']);
      check(width+' '+scenario+' no uncaught errors',errors,[]);
      await p.reload();check(width+' '+scenario+' image survives reload',await p.evaluate(()=>phGet('2026-10-13')),PHOTO);
    }finally{await context.close();}}
  }
}finally{await browser.close();}console.log('Undo modal: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;})().catch(e=>{console.error('FATAL',e);process.exitCode=1;});
