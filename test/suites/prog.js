/* Прогрессия на двух месяцах журнала: веса растут, рекорды пишутся,
   отмена подхода возвращает всё назад. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const D=require('path').join(__dirname, '..', 'out') + require('path').sep;
const SEED=()=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  for(let k=1;k<=60;k++){const ds=back(k),d=dayOf(ds),r=recRW(ds);
    if((d.ex||[]).length && Math.random()<0.75){r.wo=1;r.t0=Date.now()-4e6;r.t1=Date.now()-3.6e6;
      d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,rs:[8,8,8],
        vol:Math.round((40+Math.random()*160)*(+e.w||1)),xp:12};});}
    if(k%7===0) r.bw=String(70+k*0.04);}
  S.pr={'Жим лёжа':60,'Присед со штангой':80};save();recomputeStats();render();
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const sk of ['sl']){
    const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
    p.on('pageerror',e=>console.log('PAGEERROR',e.message));
    await p.goto(APP);await p.waitForTimeout(1900);
    await p.evaluate(SEED);
    await p.evaluate(s2=>{void s2;S.setup=1;document.getElementById('setup').classList.remove('on');
      tab='prog';pSec='log';render();},sk);
    await p.waitForTimeout(600);
    await p.screenshot({path:D+'prog-'+sk+'-log.png'});
    for (const sec of ['load','goal','prog']) {
      await p.click(`#pseg [data-sec="${sec}"]`); await p.waitForTimeout(400);
      if (sec==='load'||sec==='prog') await p.screenshot({path:D+'prog-'+sk+'-'+sec+'.png'});
    }
    const r=await p.evaluate(()=>{
      const vis=[...document.querySelectorAll('#scr-prog .psec')].filter(e=>!e.hidden).map(e=>e.dataset.s);
      return {active:pSec, visible:vis};
    });
    console.log(sk, JSON.stringify(r));
    await p.close();
  }
  await b.close();console.log('готово');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
