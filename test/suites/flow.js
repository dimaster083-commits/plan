/* Проход по приложению как человек: список упражнений, раскрытие,
   закрытие подхода, возврат к списку. Со снимками экрана. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const D=require('path').join(__dirname, '..', 'out') + require('path').sep;
const SEED=()=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  const d0=dayOf(iso(new Date()));
  if(d0.t==='rest'){const src=S.days.find(x=>(x.ex||[]).length);d0.t=src.t;d0.s=src.s;d0.ex=src.ex.map(e=>({...e}));}
  for(let k=1;k<=30;k++){const ds=back(k),d=dayOf(ds),r=recRW(ds);
    if((d.ex||[]).length){r.wo=1;r.t0=Date.now()-4e6;r.t1=Date.now()-3.6e6;
      d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:(+e.w||0)+Math.round(k/6),rs:[8,8,8],vol:24*(+e.w||0),xp:12};});}
    r.bw=String(70+k*0.05);}
  const rt=recRW(iso(new Date())); rt.log[0]={done:1,n:d0.ex[0].n,g:d0.ex[0].g,s:d0.ex[0].s,r:String(d0.ex[0].r),w:d0.ex[0].w,rs:[8,8,8],vol:100,xp:12};
  save();recomputeStats();render();
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const sk of ['sl','ber']){
    const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
    p.on('pageerror',e=>console.log('PAGEERROR',e.message));
    await p.goto(APP);await p.waitForTimeout(2200);
    await p.evaluate(SEED);
    await p.evaluate(s=>{applyTheme(s);S.setup=1;document.getElementById('setup').classList.remove('on');},sk);
    await p.evaluate(()=>{tab='wo';sel=today();editPast=false;exOpen=null;render();window.scrollTo(0,0);});
    await p.waitForTimeout(500);
    await p.screenshot({path:D+'flow-'+sk+'-list.png'});
    await p.click('#exl [data-open="2"]');await p.waitForTimeout(500);
    await p.screenshot({path:D+'flow-'+sk+'-open.png'});
    const ok=await p.evaluate(()=>({open:exOpen, dots:document.querySelectorAll('.exfdots .dot').length,
      kg:!!document.querySelector('.exfkg')}));
    console.log(sk, JSON.stringify(ok));
    await p.close();
  }
  await b.close();console.log('готово');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
