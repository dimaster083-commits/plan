/* Добавки: отметки по дням, перенос между днями, подсчёт принятого. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const D=require('path').join(__dirname, '..', 'out') + require('path').sep;
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const sk of ['sl']){
    const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
    p.on('pageerror',e=>console.log('PAGEERROR',e.message));
    await p.goto(APP);await p.waitForTimeout(1800);
    await p.evaluate(s2=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s2;
      const m=mealsRW(today()); m[0].items=[{p:'Овсянка на воде готовая',g:'250'}];
      m[1]&&(m[1].items=[{p:'Рис отварной',g:'200'}]); save();
      tab='food';sel=today();render();},sk);
    await p.waitForTimeout(500);
    const r=await p.evaluate(()=>({
      inGym:document.querySelectorAll('#scr-wo #spl').length,
      inFood:document.querySelectorAll('#scr-food #spl [data-sp]').length,
      title:document.querySelector('.supph b').textContent}));
    console.log(sk, JSON.stringify(r));
    const box=await p.$('#suppBox'); await box.screenshot({path:D+'supp-'+sk+'.png'});
    // отметка добавки не должна перерисовывать всё
    await p.click('#spl [data-tog="0"]'); await p.waitForTimeout(250);
    const on=await p.evaluate(()=>!!recOf(sel).sp[0]);
    console.log('   отметка ставится:', on);
    await p.close();
  }
  await b.close();console.log('готово');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
