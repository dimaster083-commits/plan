/* Активность вне зала в норме калорий. Раньше коэффициент 1,45 стоял для
   всех: у человека с физической работой поддержание выходило на сотни
   ккал ниже нужного. Теперь активность выбирается при настройке, и норма
   дня, калькулятор «Расчёт» и поддержание берут её из одного места. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:640}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const r=await p.evaluate(()=>{
    S.setup=1; S.bw='80'; S.height=180; S.age=30; S.sex='m'; save(); openSetup();
    const btn=k=>document.querySelector('#anAct [data-act="'+k+'"]');
    if(!btn('sit')) return {err:'выбора активности нет'};
    const sizes=[...document.querySelectorAll('#anAct button')].map(x=>{const q=x.getBoundingClientRect();return [Math.round(q.width),Math.round(q.height)];});
    btn('sit').click(); const m1=maintOf(80), kc1=dayOf(today()).kc, on1=btn('sit').classList.contains('on');
    btn('hard').click(); const m2=maintOf(80), kc2=dayOf(today()).kc, on2=btn('hard').classList.contains('on');
    S.act='мусор'; const m3=maintOf(80);
    S.act='sit'; save();
    return {m1,m2,m3,kc1,kc2,on1,on2,sizes,act:S.act};
  });
  chk(!r.err,'1. при настройке есть выбор активности',r.err||'');
  if(!r.err){
    chk(Math.abs(r.m2/r.m1-1.75/1.45)<0.001,'2. физический труд поднимает поддержание в 1,75/1,45 раза',Math.round(r.m1)+' → '+Math.round(r.m2));
    chk(r.kc2>r.kc1,'3. норма дня пересчитывается сразу',r.kc1+' → '+r.kc2);
    chk(r.on1&&r.on2,'4. выбранная кнопка подсвечена');
    chk(Math.abs(r.m3-r.m1)<0.001,'5. мусор в хранилище даёт сидячую норму, а не NaN',String(r.m3));
    chk(r.sizes.every(([w,h])=>w>=44&&h>=44),'6. кнопки не меньше 44×44 на 320 px',JSON.stringify(r.sizes));
  }
  chk(errs.length===0,'7. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
