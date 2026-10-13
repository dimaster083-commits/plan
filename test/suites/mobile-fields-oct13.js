/* Regressions for actual touchable date/supplement editors. A CSS regression
   that shrinks an editor must fail. Uses real rendered inputs and trusted taps. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
let checks=0,failures=0;
function check(name,a,e){checks++;try{assert.deepEqual(a,e);console.log('  ✓ '+name);}catch{failures++;console.log('  ✗ '+name+' expected='+JSON.stringify(e)+' actual='+JSON.stringify(a));}}
(async()=>{const browser=await chromium.launch(LAUNCH);try{
  for(const width of [320,390]){const context=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',serviceWorkers:'block',reducedMotion:'reduce'});try{
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.clock.install({time:new Date('2026-10-13T12:00:00+10:00')});await p.goto(APP);await p.click('#setSkip');await p.evaluate(()=>{S.bw='75';S.bkAsk=Date.now();S.start='2026-10-05';S.tips={wo:1,food:1,prog:1};save();flush();undoDrop();render();});
    await p.click('[data-tab="prog"]');await p.locator('#startIn').scrollIntoViewIfNeeded();
    const dateRect=await p.locator('#startIn').boundingBox();check(width+' start date touch area >=44x44',dateRect.width>=43.9&&dateRect.height>=43.9,true);
    check(width+' date input fits viewport',dateRect.x>=0&&dateRect.x+dateRect.width<=width+.5,true);
    await p.click('[data-tab="food"]');const inputs=p.locator('#spl input');const sizes=await inputs.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height};}));
    check(width+' all real supplement editors >=44x44',sizes.length>0&&sizes.every(r=>r.w>=43.9&&r.h>=43.9),true);
    for(const sf of ['n','h']){
      const input=p.locator('#spl input[data-sf="'+sf+'"]').first();await input.scrollIntoViewIfNeeded();const r=await input.boundingBox();await p.mouse.click(r.x+r.width/2,r.y+r.height/2);
      check(width+' tap focuses supplement '+sf,await input.evaluate(e=>e===document.activeElement),true);
      await input.fill(sf==='n'?'Проверка добавки':'Синтетическая инструкция');await input.blur();
      check(width+' supplement edit '+sf+' reaches real journal/template',await p.evaluate(sf=>dayOf(sel).sp[0][sf],sf),sf==='n'?'Проверка добавки':'Синтетическая инструкция');
    }
    await p.click('[data-tab="wo"]');await p.clock.runFor(1100);const geom=await p.evaluate(()=>{const card=document.querySelector('.exrow[data-open]').getBoundingClientRect(),tabs=document.querySelector('.tabbar').getBoundingClientRect();return{top:card.top,bottom:card.bottom,tabs:tabs.top};});
    check(width+' first Gym card fully visible above bottom navigation',geom.top>=0&&geom.bottom<=geom.tabs,true);
    check(width+' no horizontal overflow',await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    check(width+' no uncaught errors',errors,[]);
  }finally{await context.close();}}
}finally{await browser.close();}console.log('Mobile fields: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;})().catch(e=>{console.error('FATAL',e);process.exitCode=1;});
