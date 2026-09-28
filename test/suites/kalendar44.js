/* Ячейка дня в календаре месяца — не меньше 44 px на узких экранах, без прокрутки вбок. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const chk=(c,n,d)=>{ if(!c) fails++; console.log('  '+(c?'✓':'✗')+' '+n+(d?'   → '+d:'')); };
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for (const W of [320,375,390,430]) {
    const p=await(await b.newContext({viewport:{width:W,height:800}})).newPage(); await p.goto(APP); await p.waitForTimeout(1200);
    const r=await p.evaluate(()=>{ S.setup=1; document.getElementById('setup').classList.remove('on'); tab='prog'; pSec='log'; calView='month'; render(); cal();
      const c=document.querySelector('.cd.in').getBoundingClientRect(); return {w:Math.round(c.width),h:Math.round(c.height),sw:document.documentElement.scrollWidth}; });
    chk(r.w>=44&&r.h>=44&&r.sw<=W, W+' px: ячейка '+r.w+'×'+r.h+', без прокрутки вбок');
    await p.close();
  }
  await b.close(); process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
