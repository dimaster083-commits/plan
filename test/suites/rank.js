/* Шапка на разных ступенях: ноль опыта и девять тысяч —
   номер и звание не разъезжаются. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const D=require('path').join(__dirname, '..', 'out') + require('path').sep;
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const [sk,xp] of [['sl',0],['sl',9000]]){
    const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
    await p.goto(APP);await p.waitForTimeout(1700);
    await p.evaluate(([s2,x])=>{S.setup=1;S.xpBase=x;document.getElementById('setup').classList.remove('on');
      void s2;recomputeStats();tab='wo';render();},[sk,xp]);
    await p.waitForTimeout(400);
    const t=await p.evaluate(()=>({lv:document.getElementById('st8n').textContent,
      rank:document.getElementById('st8rank').textContent, xp:document.getElementById('st8xpv').textContent}));
    console.log(sk, 'ур '+t.lv, '·', t.rank, '·', t.xp);
    const el=await p.$('.st8'); await el.screenshot({path:D+`rank-${sk}-${xp}.png`});
    await p.close();
  }
  await b.close();
})();
