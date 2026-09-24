/* Под палец и под iPhone — найдено агентом-тестировщиком интерфейса.
   Поля мельче 16 px iPhone увеличивает вместе со страницей; поля ввода и
   кнопки ниже 44 px — мимо пальца. */
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
    S.setup=1; document.getElementById('setup').classList.remove('on'); setBw('75');
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    const h=el=>el?Math.round(el.getBoundingClientRect().height):0, fs=el=>el?parseFloat(getComputedStyle(el).fontSize):0;
    const o={};
    tab='wo'; sel=today(); exOpen=0; render();
    const fl=[...document.querySelectorAll('.exfsm .fl input')]; o.fl=fl.map(x=>[fs(x),h(x)]);
    tab='prog'; pSec='goal'; render(); paintSections(); o.goal=[h($('bw')),h($('goalIn'))];
    tab='food'; render(); o.food=[h($('kc')),h($('pr'))];
    const z=new Date(); z.setDate(z.getDate()-3); sel=iso(z); tab='wo'; exOpen=null; render(); o.tt=h($('toToday'));
    sel=today(); render(); openExPicker(); const gb=[...document.querySelectorAll('#exgs button')]; o.grp=Math.min(...gb.map(h)); o.gn=gb.map(x=>x.textContent); sheetClose();
    tab='prog'; pSec='prog'; render(); paintSections();
    const c=[...document.querySelectorAll('#wtab td:first-child')].find(x=>/горизонтального/.test(x.textContent.replace(/\u00AD/g,'')));
    o.hy=c?{soft:/\u00AD/.test(c.textContent), fits:c.scrollWidth<=c.clientWidth+1}:'нет строки';
    return o;
  });
  chk(r.fl.length===2&&r.fl.every(([f,hh])=>f>=16&&hh>=44),'1. поля ПОДХ и ПОВТ — шрифт от 16 px и высота от 44',JSON.stringify(r.fl));
  chk(r.goal.every(x=>x>=44)&&r.food.every(x=>x>=44),'2. поля веса, цели и норм — не ниже 44',JSON.stringify([r.goal,r.food]));
  chk(r.tt>=44,'3. «вернуться к сегодня» — не ниже 44',String(r.tt));
  chk(r.grp>=44&&r.grp<999,'4. фильтры в выборе упражнения — не ниже 44',String(r.grp));
  chk(r.gn.includes('Плечи')&&r.gn.includes('Пресс'),'4б. в фильтрах есть «Плечи» и «Пресс»',r.gn.join(', '));
  chk(r.hy.soft&&r.hy.fits,'5. название в таблице весов переносится по слогам, а не посреди слова',JSON.stringify(r.hy));
  chk(errs.length===0,'6. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
