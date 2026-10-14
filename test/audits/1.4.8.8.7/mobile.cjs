/* Scoped read-only audit of release 1.4.8.8.6 for 1.4.8.8.7.
   Synthetic browser storage only. No release claim and no full-suite run. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const { LAUNCH } = require('../../env');
const root = path.resolve(__dirname, '../../..');
let checks = 0;
const defects = [];
function check(label, value, expected) { assert.deepEqual(value, expected, label); checks++; console.log('PASS ' + label); }
function observed(label, value) { console.log('OBSERVED ' + label + ' ' + JSON.stringify(value)); }
function contract(label,value,expected) { checks++; try {assert.deepEqual(value,expected);console.log('PASS '+label);}catch(e){defects.push({label,value,expected});console.log('DEFECT '+label+' '+JSON.stringify({actual:value,expected}));} }
async function tap(page, selector) { await page.locator(selector).first().click(); await page.waitForTimeout(290); }
async function settle(page) { await page.waitForFunction(() => !document.body.classList.contains('rd-enter')); }
async function inspect(page, scope) {
  return page.evaluate(scope => {
    const visible = e => { const r = e.getBoundingClientRect(), s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden'; };
    const box = document.querySelector(scope);
    const controls = [...box.querySelectorAll('button,input:not([type=file]),select,textarea,[role=button]')].filter(visible).map(e => {
      const r = e.getBoundingClientRect();
      const label = e.id || e.getAttribute('aria-label') || e.textContent.trim().slice(0,45) || e.outerHTML.slice(0,100);
      const center = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
      return { label, w: +r.width.toFixed(2), h: +r.height.toFixed(2), y: +r.y.toFixed(2), font: getComputedStyle(e).fontSize,
        hit: r.top >= 0 && r.bottom <= innerHeight ? !!center && (center === e || e.contains(center)) : null };
    });
    const overflow = [...box.querySelectorAll('*')].filter(visible).filter(e => {
      const r = e.getBoundingClientRect(); if(r.left >= -.5 && r.right <= innerWidth + .5) return false;
      let a=e.parentElement; while(a && a!==box) { if(/auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowX)) return false; a=a.parentElement; } return true;
    }).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'',text:e.textContent.trim().slice(0,30)}));
    return {width:innerWidth,doc:document.documentElement.scrollWidth,small:controls.filter(r=>r.w<43.9||r.h<43.9),blocked:controls.filter(r=>r.hit===false),overflow:overflow.slice(0,15)};
  }, scope);
}
async function auditGeometry(page,label,scope) { const g=await inspect(page,scope); observed(label,g); check(label+' document width',g.doc<=g.width,true); check(label+' no uncontained overflow',g.overflow,[]); }
async function seed(page) {
  await page.evaluate(()=>{
    S=build(); migrate(); S.setup=1; S.bw='75'; S.goal='80'; S.sound=0; S.start='2026-10-05'; S.bkAsk=Date.now(); S.tips={wo:1,ex:1,prog:1,food:1,photo:1};
    S.rec={}; S.map={}; S.pause={}; S.myFood=[{n:'Audit product',k:100,p:10,f:2,c:15}];
    const todayDay=dayOf(today()), ex=todayDay.ex[0];
    const prev='2026-10-06'; const r=recRW(prev); r.wo=1; r.log={0:{done:1,n:ex.n,g:ex.g,w:40,s:3,r:'8-10',rs:[8,9,10],ws:[40,42.5,45],vol:1152.5}}; r.dt=dayOf(prev).t;
    recRW(today()).ml=[{n:'Synthetic meal',items:[{p:'Audit product',g:'125'}]}];
    sel=today(); tab='wo'; exOpen=null; entCache=null;wkCache=null; invalidateFood(); applyNutri(); undoDrop(); save();flush();render();
  });
}
async function modalTrap(page,label,id) {
  check(label+' top modal',await page.evaluate(()=>currentModal()?.id),id);
  await page.evaluate(()=>modalStops(currentModal()).at(-1).focus()); await page.keyboard.press('Tab');
  check(label+' forward focus trap',await page.evaluate(()=>document.activeElement===modalStops(currentModal())[0]),true);
  await page.keyboard.press('Shift+Tab'); check(label+' backward focus trap',await page.evaluate(()=>document.activeElement===modalStops(currentModal()).at(-1)),true);
}
async function upload(page,color) {
  const data=await page.evaluate(color=>{const c=document.createElement('canvas');c.width=30;c.height=40;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,30,40);return c.toDataURL('image/png');},color);
  const chooserReady=page.waitForEvent('filechooser'); await tap(page,'#phAdd'); const chooser=await chooserReady;
  await chooser.setFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});
  await page.waitForFunction(()=>!!undoRec&&!$('undo').hidden&&!!document.querySelector('#phT img'));
  return page.evaluate(()=>phGet(sel));
}
(async()=>{
  const server=http.createServer((req,res)=>{
    const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));
    if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
    fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;} res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(data);});
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve)); let browser;
  try {
    browser=await chromium.launch(LAUNCH);
    for(const viewport of [{width:320,height:568},{width:390,height:844}]){
      const context=await browser.newContext({viewport,timezoneId:'Asia/Vladivostok',serviceWorkers:'block',reducedMotion:'reduce',isMobile:true,hasTouch:true});
      try{
        const page=await context.newPage(),errors=[]; page.on('pageerror',e=>errors.push(e.message));
        await page.clock.install({time:new Date('2026-10-13T12:00:00+10:00')}); await page.clock.resume();
        await page.goto('http://127.0.0.1:'+server.address().port+'/'); await tap(page,'#setSkip'); await seed(page);
        const width=viewport.width;
        for(const tab of ['wo','ex','prog','food','photo']){
          await tap(page,'[data-tab="'+tab+'"]'); await settle(page);
          if(tab==='ex')await page.waitForSelector('.lcard[data-lib]');
          await auditGeometry(page,width+' '+tab,'#scr-'+tab);
          const before=await page.evaluate(()=>[tab,sel,snapS()]);
          const gear=page.locator('button[aria-label="Настройки"]:visible');
          check(width+' '+tab+' one settings button',await gear.count(),1);
          await gear.click(); await modalTrap(page,width+' '+tab+' settings','sh'); await auditGeometry(page,width+' settings','#sh');
          await page.keyboard.press('Escape');
          check(width+' '+tab+' settings preserves state',await page.evaluate(()=>[tab,sel,snapS()]),before);
          check(width+' '+tab+' settings returns focus',await gear.evaluate(e=>document.activeElement===e),true);
          check(width+' '+tab+' settings unlocks scroll',await page.evaluate(()=>document.body.style.overflow),'');
        }
        await auditGeometry(page,width+' tabs','#tabs');
        // Open actual workout controls; repeat one previous-result row.
        await tap(page,'[data-tab="wo"]'); await tap(page,'.exrow[data-open]'); await settle(page);
        await auditGeometry(page,width+' open workout','#scr-wo');
        const repeatBefore=await page.evaluate(()=>({s:snapS(),w:document.querySelector('[data-ws="0"]').value,r:document.querySelector('[data-rs="0"]').value}));
        await tap(page,'[data-copy-prev="0"]');
        check(width+' repeat actual first row',await page.evaluate(()=>({w:document.querySelector('[data-ws="0"]').value,r:document.querySelector('[data-rs="0"]').value})),{w:'40',r:'8'});
        check(width+' repeat does not complete',await page.evaluate(()=>!!S.rec[sel]?.log?.[0]?.done),false);
        await tap(page,'#undoB');
        check(width+' repeat Undo exact state/raw',await page.evaluate(()=>({s:snapS(),w:document.querySelector('[data-ws="0"]').value,r:document.querySelector('[data-rs="0"]').value})),repeatBefore);
        await tap(page,'[data-copy-prev="0"]'); await tap(page,'[data-complete="0"]');
        check(width+' exercise completes',await page.evaluate(()=>!!S.rec[sel]?.log?.[0]?.done),true);
        await tap(page,'[data-close="1"]');
        // Cancel reset, confirm reset, Undo, then repeat while Undo is shown.
        const beforeReset=await page.evaluate(()=>snapS());
        await tap(page,'#rd'); await modalTrap(page,width+' reset confirm','ask'); await auditGeometry(page,width+' reset confirm','#ask');
        observed(width+' reset initial scroll',await page.evaluate(()=>({scrollY,lock:document.body.style.overflow,undo:!$('undo').hidden,focus:document.activeElement.id,askY:$('askY').getBoundingClientRect().toJSON()})));
        const askScroll=await page.evaluate(()=>scrollY); await page.mouse.wheel(0,-450); await page.waitForTimeout(150);
        observed(width+' reset background wheel',{before:askScroll,after:await page.evaluate(()=>scrollY)});
        await tap(page,'#askN'); check(width+' reset cancel data',await page.evaluate(()=>snapS()),beforeReset);
        check(width+' reset cancel focus',await page.evaluate(()=>document.activeElement.id),'rd');
        await tap(page,'#rd'); await tap(page,'#askY'); await page.waitForFunction(()=>!!undoRec);
        const resetState=await page.evaluate(()=>snapS());
        await tap(page,'#rd'); check(width+' repeated reset visible yes',await page.locator('#askY').isVisible(),true);
        await tap(page,'#askN'); check(width+' repeated reset cancel data',await page.evaluate(()=>snapS()),resetState);
        await tap(page,'#undoB'); await page.waitForFunction(()=>!undoRec); check(width+' reset Undo exact state',await page.evaluate(()=>snapS()),beforeReset);
        // Catalogue: nested hint and filter close, focus and scroll lock.
        await tap(page,'[data-tab="ex"]'); await tap(page,'.lcard[data-lib]'); await page.waitForSelector('#sh.on');
        await auditGeometry(page,width+' catalogue sheet','#sh'); await modalTrap(page,width+' catalogue sheet','sh');
        await tap(page,'#shI'); await modalTrap(page,width+' nested hint','hsh'); await page.keyboard.press('Escape');
        check(width+' hint leaves sheet',await page.evaluate(()=>[$('hsh').hidden,$('sh').classList.contains('on'),document.body.style.overflow]),[true,true,'hidden']);
        await page.keyboard.press('Escape'); check(width+' catalogue focus returns',await page.evaluate(()=>document.activeElement.matches('.lcard[data-lib]')),true);
        await tap(page,'#exf'); await auditGeometry(page,width+' filters','#sh'); await page.keyboard.press('Escape');
        check(width+' filters focus returns',await page.evaluate(()=>document.activeElement.id),'exf');
        // Unsaved measurements must survive cancel; confirmed close may discard.
        await tap(page,'[data-tab="prog"]'); await tap(page,'[data-meas="1"]'); await auditGeometry(page,width+' measurements','#sh');
        await page.fill('[data-mk="waist"]','85,5'); await tap(page,'#shX'); await modalTrap(page,width+' dirty measurement confirm','ask');
        await tap(page,'#askN'); check(width+' measurement cancel raw',await page.locator('[data-mk="waist"]').inputValue(),'85,5');
        check(width+' measurement cancel lock',await page.evaluate(()=>document.body.style.overflow),'hidden');
        await tap(page,'#shX'); await tap(page,'#askY'); check(width+' confirmed measurement close',await page.evaluate(()=>[$('sh').classList.contains('on'),document.body.style.overflow]),[false,'']);
        // A new unsaved form opened before Undo is pressed must retain its draft.
        await seed(page); await tap(page,'[data-tab="wo"]'); const beforeStart=await page.evaluate(()=>snapS()); await tap(page,'#fin');
        if(await page.locator('#sh.on').count())await tap(page,'#shX'); // workout-summary sheet from finishing
        await tap(page,'[data-tab="prog"]'); await tap(page,'[data-meas="1"]'); await page.fill('[data-mk="waist"]','87,5');
        const measurementBeforeUndo=await page.evaluate(()=>({on:$('sh').classList.contains('on'),raw:document.querySelector('[data-mk="waist"]').value,focus:document.activeElement.dataset.mk,lock:document.body.style.overflow}));
        await tap(page,'#undoB');
        const measurementAfterUndo=await page.evaluate(()=>({on:$('sh').classList.contains('on'),raw:document.querySelector('[data-mk="waist"]').value,focus:document.activeElement.dataset.mk||document.activeElement.id,lock:document.body.style.overflow,ask:$('ask').classList.contains('on')}));
        check(width+' earlier workout Undo restores journal',await page.evaluate(()=>snapS()),beforeStart);
        observed(width+' newer measurement after earlier Undo',{before:measurementBeforeUndo,after:measurementAfterUndo});
        contract(width+' newer dirty measurement remains open after earlier Undo',measurementAfterUndo.on,true);
        if(!measurementAfterUndo.on){await tap(page,'[data-meas="1"]');contract(width+' new measurement raw retained on reopen',await page.locator('[data-mk="waist"]').inputValue(),'87,5');}
        else { await tap(page,'#shX');await tap(page,'#askY'); }
        if(await page.locator('#sh.on').count())await page.keyboard.press('Escape');
        // Food grams: inspect and actually touch both the center and missed 44px zone.
        await tap(page,'[data-tab="food"]'); const grams=page.locator('#mll input[data-g]').first(); await grams.scrollIntoViewIfNeeded();
        // The viewport includes a fixed tab bar. Move the input into its middle,
        // so the audit measures the field rather than a legitimate fixed bar.
        const firstGramBox=await grams.boundingBox(); await page.mouse.wheel(0,firstGramBox.y-viewport.height/2);await page.waitForTimeout(150);
        await page.evaluate(()=>document.activeElement.blur()); const gramBox=await grams.boundingBox();
        observed(width+' grams point hit',await page.evaluate(r=>({innerHeight,scrollY,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.outerHTML.slice(0,250)}),gramBox));
        await page.touchscreen.tap(gramBox.x+gramBox.width/2,gramBox.y+gramBox.height/2);
        await page.waitForTimeout(70);check(width+' grams center touch focus',await grams.evaluate(e=>document.activeElement===e),true);
        await page.evaluate(()=>document.activeElement.blur()); await page.touchscreen.tap(gramBox.x+gramBox.width/2,gramBox.y-4);
        observed(width+' grams touch zone',{box:gramBox,aboveFourFocused:await grams.evaluate(e=>document.activeElement===e)});
        contract(width+' grams touch target height at least44',gramBox.height>=44,true);
        await grams.fill('125abc'); await tap(page,'#addMl');
        check(width+' invalid grams preserve valid125',await page.evaluate(()=>mealsOf(sel)[0].items[0].g),'125');
        await tap(page,'#undoB');
        await tap(page,'[data-pick="0"]'); await modalTrap(page,width+' food picker','fp'); await page.fill('#fq','Audit product');await page.waitForSelector('#nfK'); await auditGeometry(page,width+' food product form','#fp');
        await page.fill('#nfK','175,5'); await tap(page,'#fpX'); await tap(page,'#askN');
        check(width+' product form cancel retains raw',await page.locator('#nfK').inputValue(),'175,5');
        await page.keyboard.press('Escape');await tap(page,'#askY'); check(width+' product picker unlocks',await page.evaluate(()=>document.body.style.overflow),'');
        await tap(page,'[data-tab="photo"]'); await tap(page,'#phHist'); await auditGeometry(page,width+' empty photo history','#sh'); await page.keyboard.press('Escape');
        check(width+' photo history focus',await page.evaluate(()=>document.activeElement.id),'phHist');
        const image=await upload(page,'#ff3300');check(width+' upload native IDB',image.startsWith('data:image/jpeg'),true);
        await tap(page,'#phCmp'); await page.waitForSelector('#picA img'); await auditGeometry(page,width+' photo compare','#ov');await modalTrap(page,width+' photo compare','ov');await page.keyboard.press('Escape');
        check(width+' photo compare focus/scroll',await page.evaluate(()=>[document.activeElement.id,document.body.style.overflow]),['phCmp','']);
        await tap(page,'#phDel');await tap(page,'#askN');check(width+' photo delete cancel',await page.evaluate(()=>phGet(sel)),image);
        await tap(page,'#phDel');await tap(page,'#askY');await page.waitForFunction(()=>!PH.includes(sel)); await tap(page,'#undoB');await page.waitForFunction(()=>PH.includes(sel));
        check(width+' photo delete Undo exact',await page.evaluate(()=>phGet(sel)),image);
        check(width+' no runtime errors',errors,[]);
      }finally{await context.close();}
    }
    console.log('AUDIT COMPLETED '+checks+' checks; '+defects.length+' contract failures. OBSERVED entries are diagnostic output, not acceptance.');
    if(defects.length)process.exitCode=2;
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error('AUDIT HARNESS FAILURE',e.stack);process.exitCode=1;});
