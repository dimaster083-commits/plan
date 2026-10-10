/* Audit observations, not a release-health test. Uses synthetic PNG buffers,
   fresh browser contexts and real HTTP/IndexedDB. DEFECT is explicit even at exit 0. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const { LAUNCH } = require('../../env');
const root = path.resolve(__dirname, '../../..');
let positive = 0, defects = 0;
function check(name, actual, expected) {
  assert.deepEqual(actual, expected, name); positive++; console.log('PASS '+name);
}
function defect(id, width, evidence) { defects++; console.log('DEFECT '+id+' '+width+' '+JSON.stringify(evidence)); }
async function image(p, color) {
  return Buffer.from((await p.evaluate(color=>{const c=document.createElement('canvas');c.width=16;c.height=24;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,16,24);return c.toDataURL('image/png');},color)).split(',')[1],'base64');
}
async function upload(p, buffer, selector='#phAdd') {
  const fc=p.waitForEvent('filechooser'); await p.click(selector);
  await (await fc).setFiles({name:'synthetic.png',mimeType:'image/png',buffer});
}
async function keys(p) {return p.evaluate(()=>phKeys());}
async function present(p,day) {await p.waitForFunction(day=>PH.includes(day)&&!!PHCACHE.get(day),day);}
async function selectDay(p,day) {
  await p.click('[data-tab="wo"]'); await p.click('[data-d="'+day+'"]');
  await p.click('[data-tab="photo"]'); await p.waitForFunction(day=>document.getElementById('phDate').textContent==='снимок за '+fmt(day),day);
}
async function debounce(p) {await p.waitForTimeout(280);}
(async()=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch(LAUNCH);
  try {
    for(const width of [320,390]) {
      const ctx=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',serviceWorkers:'block'});
      try {
        const p=await ctx.newPage(), errors=[];p.on('pageerror',e=>errors.push(e.message));
        await p.clock.install({time:new Date('2026-10-10T12:00:00+10:00')});
        await p.goto('http://127.0.0.1:'+server.address().port+'/'); await p.click('#setSkip');
        await p.evaluate(()=>{S.bw='70';S.goal='80';S.start='2026-10-05';S.bkAsk=Date.now();applyNutri();flush();render();});
        await p.click('[data-tab="photo"]'); await p.waitForSelector('#phT span');
        check(width+' empty photo database',await keys(p),[]);
        await p.click('#phHist'); check(width+' empty history notice',await p.locator('#noteT').innerText(),'Снимков пока нет');
        await p.click('#phCmp'); await p.waitForFunction(()=>document.getElementById('noteT').textContent==='Сначала загрузи хотя бы одно фото');
        check(width+' compare remains closed on empty',await p.locator('#ov').getAttribute('class'),'ov');
        const red=await image(p,'#ff0000'), blue=await image(p,'#0000ff'), green=await image(p,'#00ff00');
        await upload(p,red); await present(p,'2026-10-10');await p.waitForSelector('#phT img');
        check(width+' upload same day weight link',await p.evaluate(()=>[S.bw,recOf(sel).bw,PH.length]),['70','70',1]);
        const original=await p.evaluate(()=>phGet(sel));
        check(width+' stored compressed JPEG',original.slice(0,23),'data:image/jpeg;base64,');
        await p.click('#undoB');await p.waitForFunction(()=>PH.length===0);
        check(width+' initial upload undo storage and journal',await p.evaluate(()=>[PH.length,recOf(sel).bw||null,S.bw]),[0,null,'70']);
        await upload(p,red);await present(p,'2026-10-10'); await debounce(p);
        // Cancelling a native chooser produces no change event in Chromium. Empty
        // setFiles exercises an explicit empty change through the real control.
        const fc=p.waitForEvent('filechooser');await p.click('#phT');await (await fc).setFiles([]);
        check(width+' empty file selection unchanged',await p.evaluate(()=>phGet(sel)),original);
        await upload(p,blue);await p.waitForFunction(original=>PHCACHE.get(sel)!==original,original);
        await p.click('#undoB');await p.waitForFunction(original=>PHCACHE.get(sel)===original,original);
        check(width+' replacement undo restores exact IDB image',await p.evaluate(()=>phGet(sel)),original);
        await p.fill('#phW','78,5');await p.locator('#phW').blur();
        check(width+' current weight profile journal nutrition link',await p.evaluate(()=>[S.bw,recOf(today()).bw,S.days.every(d=>d.kc===nutriFor(d.t).kc&&d.pr===nutriFor(d.t).pr)]),['78,5','78,5',true]);
        await selectDay(p,'2026-10-09');await p.fill('#phW','74');await p.locator('#phW').blur();
        check(width+' past weight retains current profile',await p.evaluate(()=>[S.bw,recOf(sel).bw]),['78,5','74']);
        await upload(p,blue);await present(p,'2026-10-09');await debounce(p);
        // Compare controls and history use these real uploads.
        await p.click('#phCmp');await p.waitForSelector('#ov.on');await p.waitForSelector('#picB img');
        check(width+' compare dates and historical weights',await p.evaluate(()=>[A,B,$('wA').textContent,$('wB').textContent,$('dlt').textContent]),['2026-10-09','2026-10-10','74,0 кг','78,5 кг','+4,5 кг']);
        await p.selectOption('#selA','2026-10-10');await p.waitForFunction(()=>document.getElementById('dlt').textContent==='0,0 кг');
        await p.selectOption('#selB','2026-10-09');await p.waitForFunction(()=>document.getElementById('dlt').textContent==='-4,5 кг');
        check(width+' comparison reverse selectors',await p.evaluate(()=>[A,B,$('dltS').textContent]),['2026-10-10','2026-10-09','ЗА 1 ДН.']);
        await p.click('[data-q="first"]');await p.waitForFunction(()=>A==='2026-10-09'&&B==='2026-10-10');
        await p.click('[data-s="2026-10-09"]');await p.waitForFunction(()=>B==='2026-10-09');
        await p.click('[data-q="sel"]');check(width+' selected day quick comparison',await p.evaluate(()=>B),'2026-10-09');
        await p.click('[data-q="month"]');check(width+' month shortcut chooses nearest available',await p.evaluate(()=>A),'2026-10-09');
        const sizes=await p.locator('#ov.on button,#ov.on select').evaluateAll(es=>es.map(e=>({id:e.id||e.dataset.q||e.dataset.s,w:e.getBoundingClientRect().width,h:e.getBoundingClientRect().height})).filter(x=>x.w<44||x.h<44));
        if(sizes.length) defect('PHOTO-04',width,sizes);
        check(width+' comparison viewport no horizontal page overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
        await p.keyboard.press('Escape');check(width+' Escape closes compare restores trigger/scroll',await p.evaluate(()=>[$('ov').classList.contains('on'),document.activeElement.id,document.body.style.overflow]),[false,'phCmp','']);
        await debounce(p);await p.click('#phCmp');await p.waitForSelector('#ov.on');await p.click('#ovX');
        check(width+' close button restores focus',await p.evaluate(()=>document.activeElement.id),'phCmp');
        await p.click('#phHist');await p.waitForSelector('#stripAll');await p.click('[data-open="2026-10-10"]');await p.waitForFunction(()=>sel==='2026-10-10');
        check(width+' history date navigation keeps photo tab',await p.evaluate(()=>[tab,sel,$('sh').classList.contains('on')]),['photo','2026-10-10',false]);
        await p.click('#phDel');await p.waitForSelector('#ask.on');await p.keyboard.press('Escape');check(width+' delete Escape cancels',await p.evaluate(()=>phGet(sel)),original);
        await debounce(p);await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askN');check(width+' delete Cancel unchanged',await p.evaluate(()=>phGet(sel)),original);
        await debounce(p);await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>!PH.includes(sel));
        check(width+' delete only photo leaves weighing record',await p.evaluate(()=>[PH.length,recOf(sel).bw]),[1,'78,5']);
        await p.click('#undoB');await present(p,'2026-10-10');check(width+' delete undo storage',await p.evaluate(()=>phGet(sel)),original);
        await p.reload();await p.click('[data-tab="photo"]');await p.waitForSelector('#phT img');
        check(width+' real IDB survives reload',await p.evaluate(()=>[PH,recOf(today()).bw]),[['2026-10-09','2026-10-10'],'78,5']);
        // Controlled compression delay; all app functions and IDB operations stay real.
        await p.evaluate(()=>{window.auditRead=FileReader.prototype.readAsDataURL;FileReader.prototype.readAsDataURL=function(f){window.auditReader=this;window.auditFile=f;};});
        await upload(p,blue);await p.waitForFunction(()=>!!window.auditReader);
        await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>!PH.includes('2026-10-10'));
        await p.evaluate(()=>{FileReader.prototype.readAsDataURL=auditRead;auditRead.call(auditReader,auditFile);});
        await p.waitForFunction(()=>auditReader.readyState===2);await p.waitForTimeout(120);
        check(width+' deletion invalidates late compression',await keys(p),['2026-10-09']);
        await p.click('#undoB');await present(p,'2026-10-10');
        // Slow compression captures its original day even after actual tab/date change.
        const oldPast=await p.evaluate(()=>phGet('2026-10-09'));
        await p.evaluate(()=>{window.auditReader=null;FileReader.prototype.readAsDataURL=function(f){window.auditReader=this;window.auditFile=f;};});
        await upload(p,green);await p.waitForFunction(()=>!!auditReader);await selectDay(p,'2026-10-09');
        await p.evaluate(()=>{FileReader.prototype.readAsDataURL=auditRead;auditRead.call(auditReader,auditFile);});
        await p.waitForFunction(original=>PHCACHE.get('2026-10-10')!==original,original);
        check(width+' upload late completion sticks to captured day',await p.evaluate(oldPast=>[sel,PHCACHE.get(sel)===oldPast,recOf(sel).bw],oldPast),['2026-10-09',true,'74']);
        await p.click('#undoB');await p.waitForFunction(original=>PHCACHE.get('2026-10-10')===original,original);
        // Hold delivery of a real IDB open success. No replacement PH/app reads.
        await p.evaluate(()=>{window.auditOpen=IDBFactory.prototype.open;window.auditGate=null;IDBFactory.prototype.open=function(...args){const r=auditOpen.apply(this,args);Object.defineProperty(r,'onsuccess',{set(fn){Object.getOwnPropertyDescriptor(IDBRequest.prototype,'onsuccess').set.call(r,function(e){window.auditGate=()=>fn.call(r,e);});}});return r;};});
        await p.click('#phCmp');await p.waitForFunction(()=>!!auditGate);await p.click('[data-tab="wo"]');
        await p.evaluate(()=>{IDBFactory.prototype.open=auditOpen;auditGate();});await p.waitForTimeout(100);
        check(width+' late comparison open suppressed after leaving tab',await p.evaluate(()=>[tab,$('ov').classList.contains('on')]),['wo',false]);
        await p.click('[data-tab="photo"]');await p.waitForSelector('#phT img');
        // Record malformed image handling from a real chooser, with no existing photo changed.
        await upload(p,Buffer.from('not an image'));await p.waitForFunction(()=>$('noteT').textContent==='Не удалось сохранить фото');
        check(width+' malformed image does not replace existing',await p.evaluate(()=>phGet('2026-10-09')),await p.evaluate(()=>PHCACHE.get('2026-10-09')));
        check(width+' no uncaught errors in normal controls',errors,[]);
        // Native IDB failure injection: delete handler has no catch or failure note.
        await p.evaluate(()=>{window.auditDelete=IDBObjectStore.prototype.delete;IDBObjectStore.prototype.delete=function(k){throw new DOMException('synthetic denied delete','UnknownError');};});
        await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>!$('ask').classList.contains('on'));await p.waitForTimeout(100);
        assert(errors.some(e=>e.includes('synthetic denied delete')));defect('PHOTO-01',width,{uncaught:errors.at(-1),stored:!!await p.evaluate(()=>phGet(sel)),notice:await p.locator('#noteT').innerText()});
        await p.evaluate(()=>{IDBObjectStore.prototype.delete=auditDelete;});
        // Undo write failure is swallowed and still reported as successful.
        await debounce(p);await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>!PH.includes(sel));
        await p.evaluate(()=>{window.auditPut=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(){throw new DOMException('synthetic undo quota','QuotaExceededError');};});
        await p.click('#undoB');await p.waitForFunction(()=>$('noteT').textContent==='Отменено');
        assert.equal(await p.evaluate(()=>phGet(sel)),undefined);defect('PHOTO-02',width,{notice:await p.locator('#noteT').innerText(),stored:false});
        await p.evaluate(()=>{IDBObjectStore.prototype.put=auditPut;});
        // Real import: independent photo with no weighing record and bad date key.
        // Payload comes from this context's synthetic state, never an owner backup.
        const copy=await p.evaluate(()=>({v:3,state:JSON.parse(JSON.stringify(S)),photos:{}}));
        copy.photos['2026-09-01']='data:image/png;base64,'+red.toString('base64');
        copy.photos['broken-day']='data:image/png;base64,'+blue.toString('base64');
        await p.click('[data-tab="wo"]');await p.click('#gear');const imp=p.waitForEvent('filechooser');await p.click('[data-bk="imp"]');
        await (await imp).setFiles({name:'synthetic-photo-copy.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(copy))});
        await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>$('noteT').textContent==='Прогресс восстановлен');
        assert.equal(await p.evaluate(()=>phGet('2026-10-10')),original);
        check(width+' import preserves own image and orphan remains independent',await p.evaluate(()=>[PH.includes('2026-09-01'),!!S.rec['2026-09-01']]),[true,false]);
        await p.click('[data-tab="photo"]');await p.waitForSelector('#phT img');await p.click('#phCmp');await p.waitForSelector('#ov.on');
        await p.selectOption('#selB','2026-09-01');await p.waitForFunction(()=>$('wB').textContent==='—');
        check(width+' orphan image comparison missing weight',await p.evaluate(()=>[$('wB').textContent,$('dltS').textContent]),['—','ВПИШИ ВЕС В ЭТИ ДНИ']);
        await p.selectOption('#selB','broken-day');await p.waitForFunction(()=>$('dtB').textContent==='broken-day');
        defect('PHOTO-03',width,{key:'broken-day',date:await p.locator('#dtB').innerText(),stored:!!await p.evaluate(()=>phGet('broken-day'))});
        await p.keyboard.press('Escape');await p.click('#phHist');await p.waitForSelector('#stripAll');
        const beforeErrors=errors.length;await p.click('[data-open="broken-day"]');await p.waitForTimeout(100);
        console.log('EVIDENCE '+width+' invalid archive day '+JSON.stringify(await p.evaluate(()=>({selected:sel,photoLabel:$('phDate').textContent,errorNotice:$('noteT').textContent})))+' errors='+JSON.stringify(errors.slice(beforeErrors)));
      } finally {await ctx.close();}
    }
    console.log('AUDIT OBSERVATIONS COMPLETE: '+positive+' positive checks, '+defects+' finding occurrences. Exit 0 is probe completion, NOT APP HEALTH PASS.');
  } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('AUDIT HARNESS FAILURE',e);process.exitCode=1;});
