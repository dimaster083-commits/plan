/* Аудит «Еды», веса, темпа, «Разбора», добавок и посещаемости против плана
   недели (перенос дней, сдвиг, пауза «болею»). Каждый пункт — найденная
   ошибка: на старом коде проверка падает. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // чистое состояние: шаблон вт/чт/сб/вс, журнал пуст, свой вес 80
  const сброс=()=>p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.map={}; delete S.pause; S.days=build().days; S.kcManual=0;
    S.bw='80'; S.bw0='80'; S.goal=''; S.height=180; S.age=30; S.sex='m'; S.act='sit';
    applyNutri(); sel=today(); tab='wo'; save(); render();
  });
  await сброс();

  // 1. выгрузка для чата: без своих роста и цели не подставляет чужие 177 см и 95 кг
  const выгр=await p.evaluate(()=>{
    S.height=''; S.goal=''; save();
    return buildSummary().split('\n')[1];
  });
  chk(!/177|95/.test(выгр)&&/держать/.test(выгр)&&/80 кг/.test(выгр),
    '1. выгрузка: пустые рост и цель — без чужих 177 см и 95 кг, цель «держать»', выгр);

  // 2. расчёт обещает темп ровно тогда, когда его считает paceOf: 3 взвешивания за 7+ дней
  await сброс();
  const расчёт=await p.evaluate(()=>{
    const t=today();
    S.rec[addDays(t,-8)]={log:{},sp:{},wo:0,bw:'80'};
    S.rec[t]={log:{},sp:{},wo:0,bw:'80.4'};
    tab='prog'; save(); render(); paintCalc();
    const row=[...document.querySelectorAll('#calcBox .clr')].find(r=>/Сейчас/.test(r.textContent));
    const bx=row?row.querySelector('b').getBoundingClientRect():null;
    return {темп:paceOf(wlog()), текст:row?row.querySelector('b').textContent:null, край:bx?Math.round(bx.right):null};
  });
  chk(расчёт.темп===null&&/3/.test(расчёт.текст||'')&&!/2 взвеш/.test(расчёт.текст||'')&&расчёт.край!==null&&расчёт.край<=320,
    '2. «Сейчас» в расчёте: при двух взвешиваниях просит три за 7 дней, как paceOf, и влезает в 320', JSON.stringify(расчёт));

  chk(errs.length===0,'99. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
