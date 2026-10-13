/* Independent audit probe. OBSERVED KNOWN/NEW are defects, exit 0 means only
   harness completed. Fresh contexts, native IDB, synthetic images only. */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright-core');
const { LAUNCH } = require('../../env');
const root = path.resolve(__dirname, '../../..');
let checks = 0;
function check(label, actual, expected) { assert.deepEqual(actual, expected, label); checks++; console.log('PASS '+label); }
function observation(label, result) { console.log('OBSERVED '+label+' '+JSON.stringify(result)); }
async function geometry(p, label, scope) {
  const g = await p.evaluate(scope => {
    const visible = e => { const r=e.getBoundingClientRect(),s=getComputedStyle(e); return r.width>0&&r.height>0&&s.visibility!=='hidden'&&s.display!=='none'; };
    const box = document.querySelector(scope);
    const small = [...box.querySelectorAll('button,select,input')].filter(visible).map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.dataset.hint||e.dataset.q||e.dataset.s||e.className,text:e.textContent.trim().slice(0,38),w:+r.width.toFixed(2),h:+r.height.toFixed(2)};}).filter(r=>r.w<43.9||r.h<43.9);
    const escaped = [...box.querySelectorAll('*')].filter(visible).filter(e=>{const r=e.getBoundingClientRect();if(r.left>=-.5&&r.right<=innerWidth+.5)return false;let a=e.parentElement;while(a&&a!==box){if(/auto|scroll|hidden|clip/.test(getComputedStyle(a).overflowX))return false;a=a.parentElement;}return true;}).map(e=>({tag:e.tagName,id:e.id,cls:typeof e.className==='string'?e.className:'',text:e.textContent.trim().slice(0,30)}));
    return {width:innerWidth,doc:document.documentElement.scrollWidth,small,escaped:escaped.slice(0,15)};
  },scope);
  observation(label,g);check(label+' document width',g.doc<=g.width,true);check(label+' no uncontained elements',g.escaped,[]);
}
async function upload(p,color) {
  const data=await p.evaluate(color=>{const c=document.createElement('canvas');c.width=30;c.height=40;c.getContext('2d').fillStyle=color;c.getContext('2d').fillRect(0,0,30,40);return c.toDataURL('image/png');},color);
  await p.locator('#phFile').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(data.split(',')[1],'base64')});
  await p.waitForFunction(() => !!undoRec && !document.getElementById('undo').hidden);
  await p.waitForFunction(() => !!document.querySelector('#phT img'));
  return p.evaluate(()=>phGet(sel));
}
async function settle(p) { await p.waitForFunction(()=>!document.body.classList.contains('rd-enter')); }
(async()=>{
  const server=http.createServer((req,res)=>{const rel=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(rel==='/'?'/index.html':rel));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,data)=>{if(err){res.writeHead(404);res.end();return;}res.setHeader('Content-Type',file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'application/octet-stream');res.end(data);});});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  let browser;
  try {
    browser=await chromium.launch(LAUNCH);
    for (const viewport of [{width:320,height:568},{width:390,height:844},{width:1280,height:900}]) {
      const ctx=await browser.newContext({viewport,timezoneId:'Asia/Vladivostok',serviceWorkers:'block',reducedMotion:'reduce'});
      try {
        const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
        await p.clock.install({time:new Date('2026-10-13T12:00:00+10:00')});
        await p.goto('http://127.0.0.1:'+server.address().port+'/');await p.click('#setSkip');
        await p.evaluate(()=>{S.bw='75';S.goal='80';S.start='2026-10-05';S.bkAsk=Date.now();S.tips={wo:1,ex:1,prog:1,food:1,photo:1};applyNutri();flush();render();undoDrop();});
        await p.waitForFunction(()=>today()==='2026-10-13');
        const width=viewport.width;
        for(const t of ['wo','ex','prog','food','photo']){
          await p.click('[data-tab="'+t+'"]');await settle(p);
          if(t==='ex')await p.waitForSelector('.lcard[data-lib]');
          if(t==='photo')await p.waitForFunction(()=>$('phDate').textContent==='снимок за '+fmt(sel));
          await geometry(p,width+' '+t,'#scr-'+t);
          const gearVisible=await p.locator('#gear').isVisible();observation(width+' KNOWN BUG-0012 '+t,{gearVisible});check(width+' gear '+t,gearVisible,['wo','food'].includes(t));
        }
        await geometry(p,width+' tabs','#tabs');
        await p.click('[data-tab="wo"]');await p.locator('.exrow[data-open]').first().click();await settle(p);
        await geometry(p,width+' open-workout','#scr-wo');
        if(width<500)await p.screenshot({path:path.join(__dirname,'mobile-current-'+width+'.png'),fullPage:true});
        observation(width+' finite reduced motion',await p.evaluate(()=>({skin:document.documentElement.dataset.skin,animation:[...document.getAnimations()].filter(a=>a.playState==='running').map(a=>({duration:a.effect.getTiming().duration,iterations:a.effect.getTiming().iterations})),palette:['--s0','--s1','--ink','--ink2','--ink3','--acc-2','--mon'].map(k=>[k,getComputedStyle(document.documentElement).getPropertyValue(k).trim()])})));
        await p.click('[data-tab="ex"]');await p.locator('.lcard[data-lib]').first().click();await p.waitForSelector('#sh.on');
        await geometry(p,width+' catalogue-sheet','#sh');
        check(width+' sheet initial focus',await p.evaluate(()=>document.activeElement.id),'shX');
        await p.evaluate(()=>modalStops(currentModal()).at(-1).focus());await p.keyboard.press('Tab');check(width+' sheet focus wraps forward',await p.evaluate(()=>document.activeElement===modalStops(currentModal())[0]),true);
        await p.keyboard.press('Shift+Tab');check(width+' sheet focus wraps backward',await p.evaluate(()=>document.activeElement===modalStops(currentModal()).at(-1)),true);
        await p.click('#shI');await p.waitForSelector('#hsh:not([hidden])');
        check(width+' nested hint top modal',await p.evaluate(()=>currentModal().id),'hsh');
        await p.keyboard.press('Escape');check(width+' Escape hint leaves base sheet',await p.evaluate(()=>[$('hsh').hidden,$('sh').classList.contains('on')]),[true,true]);
        await p.keyboard.press('Escape');check(width+' Escape closes base sheet',await p.evaluate(()=>[$('sh').classList.contains('on'),document.body.style.overflow]),[false,'']);
        await p.click('[data-tab="photo"]');const image=await upload(p,'#ff3300');
        check(width+' real photo IDB present',image.startsWith('data:image/jpeg'),true);
        await p.click('#phHist');await p.waitForSelector('#stripAll img');await geometry(p,width+' photo history','#sh');
        await p.keyboard.press('Escape');check(width+' photo history focus',await p.evaluate(()=>document.activeElement.id),'phHist');
        await p.click('#phCmp');await p.waitForSelector('#ov.on');await p.waitForSelector('#picA img');await geometry(p,width+' photo compare','#ov');
        check(width+' compare modal top',await p.evaluate(()=>currentModal().id),'ov');
        await p.keyboard.press('Escape');check(width+' compare focus and scroll',await p.evaluate(()=>[document.activeElement.id,document.body.style.overflow]),['phCmp','']);
        // Normal delete/undo/reload, using the real native transactional store.
        await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>!PH.includes(sel));
        check(width+' delete commit',await p.evaluate(()=>phGet(sel)),undefined);
        await p.click('#undoB');await p.waitForFunction(()=>PH.includes(sel));check(width+' undo exact image',await p.evaluate(()=>phGet(sel)),image);
        await p.reload();await p.click('[data-tab="photo"]');await p.waitForSelector('#phT img');check(width+' image reload',await p.evaluate(()=>phGet(sel)),image);
        await p.click('#phDel');await p.waitForSelector('#ask.on');await p.click('#askY');await p.waitForFunction(()=>!PH.includes(sel));
        // Delay only delivery of native RW completion, after its real commit.
        await p.evaluate(()=>{window.auditDescriptor=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete');window.auditRelease=null;Object.defineProperty(IDBTransaction.prototype,'oncomplete',{configurable:true,get:auditDescriptor.get,set(fn){const tx=this;auditDescriptor.set.call(tx,tx.mode==='readwrite'?function(e){window.auditRelease=()=>fn.call(tx,e);}:fn);}});});
        await p.click('#undoB');await p.waitForFunction(()=>!!auditRelease);
        await p.click('[data-tab="prog"]');await p.click('[data-meas="1"]');await p.waitForSelector('#sh.on');
        await p.fill('[data-mk="waist"]','85,5');
        const before=await p.evaluate(()=>({title:$('shT').textContent,on:$('sh').classList.contains('on'),raw:document.querySelector('[data-mk="waist"]').value,busy:!!undoRec?.busy}));
        await p.evaluate(()=>{Object.defineProperty(IDBTransaction.prototype,'oncomplete',auditDescriptor);auditRelease();});
        await p.waitForFunction(()=>!undoRec);
        const after=await p.evaluate(()=>({title:$('shT').textContent,on:$('sh').classList.contains('on'),raw:document.querySelector('[data-mk="waist"]').value,notice:$('noteT').textContent}));
        observation(width+' KNOWN BUG-0020',{before,after});
        check(width+' BUG-0020 still reproduces',after.on,false);check(width+' BUG-0020 no immediate raw loss',after.raw,'85,5');
        await p.clock.runFor(300);await p.click('[data-meas="1"]');await p.waitForSelector('#sh.on');observation(width+' BUG-0020 after reopen',{raw:await p.locator('[data-mk="waist"]').inputValue()});
        check(width+' BUG-0020 photo restore correct',await p.evaluate(()=>phGet('2026-10-13')),image);
        check(width+' no uncaught runtime errors',errors,[]);
      } finally {await ctx.close();}
    }
    console.log('AUDIT COMPLETED '+checks+' assertions. OBSERVED entries require interpretation; exit 0 is not release acceptance.');
  } finally {if(browser)await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error('AUDIT HARNESS FAILURE',e);process.exitCode=1;});
