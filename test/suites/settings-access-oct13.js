/* BUG-0012: each tab must expose the same settings through a trusted 44px
   button. Synthetic contexts, no owner profile. This is deliberately RED on
   1.4.8.8.5; absence is a recorded failure, not a locator timeout. */
const assert=require('node:assert/strict');
const {chromium}=require('playwright-core');
const {APP,LAUNCH}=require('../env');
let checks=0,failures=0;
function check(name,a,e){checks++;try{assert.deepEqual(a,e);console.log('  ✓ '+name);}catch{failures++;console.log('  ✗ '+name+' expected='+JSON.stringify(e)+' actual='+JSON.stringify(a));}}
(async()=>{const browser=await chromium.launch(LAUNCH);try{
  for(const width of [320,390]){const context=await browser.newContext({viewport:{width,height:width===320?568:844},timezoneId:'Asia/Vladivostok',serviceWorkers:'block'});try{
    const p=await context.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(APP);await p.click('#setSkip');
    await p.evaluate(()=>{S.bw='75';S.sound=0;S.bkAsk=Date.now();save();flush();undoDrop();});
    let contents;
    for(const tabName of ['wo','ex','prog','food','photo']){
      await p.click('[data-tab="'+tabName+'"]');
      await p.waitForFunction(()=>!document.body.classList.contains('rd-enter'));
      const before=await p.evaluate(()=>({tab,sel,state:snapS()}));
      const button=p.locator('button[aria-label="Настройки"]:visible');
      const count=await button.count();check(width+' '+tabName+' exposes exactly one settings action',count,1);
      if(!count)continue;
      const rect=await button.boundingBox();check(width+' '+tabName+' settings target >=44x44',rect.width>=44&&rect.height>=44,true);
      await button.click();await p.waitForSelector('#sh.on');
      check(width+' '+tabName+' opens settings title',await p.locator('#shT').innerText(),'НАСТРОЙКИ');
      const html=await p.locator('#shB').innerHTML();if(contents===undefined)contents=html;check(width+' '+tabName+' same settings contents',html,contents);
      check(width+' '+tabName+' contains backup/CSV/week actions',await p.locator('#shB [data-bk="exp"],#shB [data-bk="imp"],#shB [data-bk="csv"],#shB [data-dayset]').count(),4);
      await p.keyboard.press('Escape');
      check(width+' '+tabName+' returns focus to trigger',await button.evaluate(e=>e===document.activeElement),true);
      check(width+' '+tabName+' preserves tab date and journal',await p.evaluate(()=>({tab,sel,state:snapS()})),before);
      check(width+' '+tabName+' unlocks scrolling',await p.evaluate(()=>document.body.style.overflow),'');
    }
    check(width+' no uncaught errors',errors,[]);
  }finally{await context.close();}}
}finally{await browser.close();}console.log('Settings access: '+checks+' checks, '+failures+' failures');process.exitCode=failures?1:0;})().catch(e=>{console.error('FATAL',e);process.exitCode=1;});
