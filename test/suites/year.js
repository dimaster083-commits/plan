/* Год журнала в календаре: двенадцать месяцев, подписи, выравнивание
   сетки. Со снимками. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const D=require('path').join(__dirname, '..', 'out') + require('path').sep;
const SEED=()=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  const y=new Date().getFullYear();
  for(let m=1;m<=12;m++)for(let d=1;d<=28;d++){
    const ds=`${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    const day=dayOf(ds); if(!(day.ex||[]).length) continue;
    if(Math.random()<0.35) continue;
    const r=recRW(ds); r.wo=1;
    day.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,
      rs:[8,8,8],vol:Math.round((20+Math.random()*180)*(+e.w||1)),xp:12};});
  }
  save();recomputeStats();render();
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const sk of ['sl']){
    const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
    p.on('pageerror',e=>console.log('PAGEERROR',e.message));
    await p.goto(APP);await p.waitForTimeout(2000);
    await p.evaluate(SEED);
    await p.evaluate(s2=>{void s2;S.setup=1;document.getElementById('setup').classList.remove('on');
      tab='prog';calView='year';render();},sk);
    await p.waitForTimeout(600);
    const cal=await p.$('.cal'); await cal.screenshot({path:D+'year-'+sk+'.png'});
    const y1=await p.evaluate(()=>({months:document.querySelectorAll('#cyear [data-mo]').length,
      cells:document.querySelectorAll('#cyear .mc').length}));
    await p.click('#cyear [data-mo="9"]'); await p.waitForTimeout(400);
    const cal2=await p.$('.cal'); await cal2.screenshot({path:D+'month-'+sk+'.png'});
    const y2=await p.evaluate(()=>({view:calView,mo:mo,days:document.querySelectorAll('#cgrid [data-cd]').length,
      back:!document.getElementById('calBack').hidden}));
    console.log(sk,'год:',JSON.stringify(y1),'месяц:',JSON.stringify(y2));
    await p.close();
  }
  await b.close();console.log('готово');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
