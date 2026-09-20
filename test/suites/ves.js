/* Цель по весу: кнопки «набор / похудение», вехи, полоса до цели. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const DIR=require('path').join(__dirname, '..', 'out') + require('path').sep;
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const w of [320,390]){
    const p=await(await b.newContext({viewport:{width:w,height:844},deviceScaleFactor:3})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1400);
    await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
      S.bw='72';S.bw0='70';S.goal='95';save();tab='prog';pSec='goal';render();});
    await p.waitForTimeout(300);
    if(w===390){
      // режим отмечен верно
      const m0=await p.evaluate(()=>[...document.querySelectorAll('#wdir [data-dir]')]
        .filter(b2=>b2.classList.contains('on')).map(b2=>b2.dataset.dir));
      chk(m0.length===1&&m0[0]==='up','1. при цели выше веса отмечен «набор»',m0.join(','));
      // переключение на похудение
      await p.click('#wdir [data-dir="down"]'); await p.waitForTimeout(300);
      const d1=await p.evaluate(()=>({goal:S.goal,on:[...document.querySelectorAll('#wdir [data-dir]')]
        .filter(b2=>b2.classList.contains('on')).map(b2=>b2.dataset.dir).join(','),
        miles:[...document.querySelectorAll('#miles div')].map(x=>x.textContent).join(' ')}));
      chk(Number(d1.goal)<72&&d1.on==='down','2. «похудение» уводит цель вниз',JSON.stringify(d1));
      // и обратно
      await p.click('#wdir [data-dir="up"]'); await p.waitForTimeout(300);
      const d2=await p.evaluate(()=>({goal:S.goal,on:[...document.querySelectorAll('#wdir [data-dir]')]
        .filter(b2=>b2.classList.contains('on')).map(b2=>b2.dataset.dir).join(',')}));
      chk(Number(d2.goal)>72&&d2.on==='up','3. «набор» возвращает цель вверх',JSON.stringify(d2));
      // правка веса руками
      await p.fill('#bw','74,5'); await p.waitForTimeout(350);
      const d3=await p.evaluate(()=>({bw:S.bw,shown:document.getElementById('bw').value}));
      chk(String(d3.bw).replace('.',',')==='74,5','4. вес правится прямо в рамке',JSON.stringify(d3));
      // в первичной настройке тот же выбор
      await p.evaluate(()=>openSetup()); await p.waitForTimeout(300);
      const s1=await p.evaluate(()=>[...document.querySelectorAll('#anDir [data-dir]')]
        .filter(b2=>b2.classList.contains('on')).map(b2=>b2.dataset.dir).join(','));
      chk(s1==='up','5. в первичной настройке режим тоже отмечен',s1);
      await p.click('#anDir [data-dir="down"]'); await p.waitForTimeout(300);
      const s2=await p.evaluate(()=>({goal:document.getElementById('anGoal').value,
        on:[...document.querySelectorAll('#anDir [data-dir]')].filter(b2=>b2.classList.contains('on')).map(b2=>b2.dataset.dir).join(',')}));
      chk(Number(String(s2.goal).replace(',','.'))<74.5&&s2.on==='down','6. и переключается там же',JSON.stringify(s2));
      await p.locator('.setw').screenshot({path:DIR+'set-dir.png'});
      await p.evaluate(()=>closeSetup());
    }
    // ничего не вылезает
    await p.evaluate(()=>{tab='prog';pSec='goal';render();});
    await p.waitForTimeout(250);
    const wide=await p.evaluate(()=>document.documentElement.scrollWidth);
    chk(wide<=w+1,`7. ${w}px: по ширине чисто`,wide+'');
    if(w===390) await p.locator('.wbox').screenshot({path:DIR+'wbox.png'});
    if(errs.length) bad('ошибки JS',[...new Set(errs)].join('|'));
    await p.close();
  }
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
