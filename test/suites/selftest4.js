/* Самопроверка: возвращаем старое поведение таймера и убеждаемся, что
   новая проверка его ловит. Иначе проверка ничего не стоит. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  await p.goto(APP); await p.waitForTimeout(1300);
  // старый tStart: без clearTimeout(tHide)
  await p.evaluate(()=>{
    window.__old=(sec)=>{
      window.__tEnd=Date.now()+sec*1000;
      document.getElementById('tmr').classList.add('on');
      document.getElementById('tmrV').textContent=Math.floor(sec/60)+':'+String(sec%60).padStart(2,'0');
      clearInterval(window.__i);
      window.__i=setInterval(()=>{
        const left=Math.max(0,Math.round((window.__tEnd-Date.now())/1000));
        document.getElementById('tmrV').textContent=Math.floor(left/60)+':'+String(left%60).padStart(2,'0');
        if(left<=0){clearInterval(window.__i);setTimeout(()=>document.getElementById('tmr').classList.remove('on'),1400);}
      },250);
    };
  });
  await p.evaluate(()=>window.__old(1));
  await p.waitForTimeout(1300);
  await p.evaluate(()=>window.__old(90));
  await p.waitForTimeout(900);
  const on=await p.evaluate(()=>document.getElementById('tmr').classList.contains('on'));
  console.log(on?'✗ самопроверка бесполезна: старый код тоже проходит':'✓ проверка ловит старое поведение (окно погасло)');
  await b.close();
  process.exit(on?1:0);
})();
