/* Графа ПОВТ подставляет повторы прошлой тренировки (решение владельца,
   сентябрь 2026): там человек сам задаёт свою рабочую цель. Закрытый подход
   уводит эту цель во все дни через setReps — так программа и учится. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:360,height:780}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const r=await p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    // сегодня — день с тем же упражнением, неделю назад — запись с 10 повторами
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    const e=d.ex[0]; e.r='4-6';
    const z=new Date(); z.setDate(z.getDate()-7); const past=iso(z);
    recRW(past).log[0]={done:1,n:e.n,g:e.g,s:'4',r:'10',w:num(e.w),rs:[10,10,10,10],vol:1,xp:1};
    const pd=dayOf(past); if(!pd.ex.some(x=>x.n===e.n)){pd.t=d.t;pd.ex=d.ex.map(x=>({...x}));}
    save(); tab='wo'; sel=today(); exOpen=0; render();
    const field=document.querySelector('.ex[data-j="0"] [data-f="r"]').value;
    toggleSet(0);
    const plan=S.days.flatMap(x=>x.ex||[]).filter(x=>x.n===e.n).map(x=>x.r);
    return {field, plan, name:e.n};
  });
  chk(r.field==='10','1. в графе ПОВТ — повторы прошлой тренировки',r.name+': '+r.field);
  chk(r.plan.every(x=>x==='10'),'2. закрытый подход уводит эту цель во все дни',JSON.stringify(r.plan));
  chk(errs.length===0,'3. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
