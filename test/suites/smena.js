/* Смена темы на месте: подписи, которые считает код, обязаны
   поменяться без перерисовки. Раньше после переключения в «Клейме»
   оставался «РАНГ E» и «ЦИКЛ 1». */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
    S.xp=12*500+40; S.start=(()=>{const d=new Date();d.setDate(d.getDate()-40);
      const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);})();
    save(); recomputeStats(1); applyTheme('sl'); tab='prog'; pSec='goal'; render();});
  await p.waitForTimeout(300);
  const before=await p.evaluate(()=>({rank:document.getElementById('st8rank').textContent,
    cyc:document.getElementById('cycPh').textContent}));
  // переключаем как из настроек: без render()
  await p.evaluate(()=>applyTheme('ber'));
  await p.waitForTimeout(250);
  const after=await p.evaluate(()=>({rank:document.getElementById('st8rank').textContent,
    cyc:document.getElementById('cycPh').textContent}));
  chk(!/РАНГ/.test(after.rank) && after.rank!==before.rank,
      '1. ступень переписалась без перерисовки', before.rank+' → '+after.rank);
  chk(!/ЦИКЛ/.test(after.cyc), '2. круг переписался без перерисовки', before.cyc+' → '+after.cyc);
  // журнал: заголовок года
  await p.evaluate(()=>{pSec='log';calView='year';render();applyTheme('sl');});
  await p.waitForTimeout(250);
  const y1=await p.evaluate(()=>document.getElementById('cmo').textContent);
  await p.evaluate(()=>applyTheme('ber'));
  await p.waitForTimeout(250);
  const y2=await p.evaluate(()=>document.getElementById('cmo').textContent);
  chk(y1!==y2, '3. заголовок журнала переписался', y1+' → '+y2);
  // и обратно
  await p.evaluate(()=>applyTheme('sl'));
  await p.waitForTimeout(200);
  const back=await p.evaluate(()=>({rank:document.getElementById('st8rank').textContent,
    cyc:document.getElementById('cycPh').textContent, cmo:document.getElementById('cmo').textContent}));
  chk(/РАНГ/.test(back.rank), '4. обратно тоже', JSON.stringify(back));
  console.log('ошибки JS:',errs.length?errs.join('|'):'нет');
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
