/* Тоннаж считался в трёх местах по-разному: «Прогресс» — по записанным
   повторам, итоги тренировки и итоги месяца — по повторам из плана.
   10/10/9/8 уходило в итог как 4×10. */
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

  // день с недобранными повторами: план 4×10, сделано 10/10/9/8
  const seed=await p.evaluate(()=>{
    S.setup=1; document.getElementById('setup').classList.remove('on'); S.sound=0;
    const ds=today(), d=dayOf(ds);
    if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length); d.t=x.t; d.s=x.s; d.ex=x.ex.map(e=>({...e}));}
    const r=recRW(ds); r.log={}; r.wo=1;
    let ждём=0, подх=0;
    d.ex.forEach((e,j)=>{
      const w=num(e.w)||20, rs=[10,10,9,8];
      r.log[j]={done:1,n:e.n,g:e.g,s:'4',r:'10',w:w,rs:rs,
                vol:rs.reduce((a,c)=>a+c,0)*w, xp:12};
      ждём+=rs.reduce((a,c)=>a+c,0)*w; подх+=rs.length;
    });
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    return {ждём:Math.round(ждём), подх:подх, план:Math.round(d.ex.length*4*10*20)};
  });
  chk(seed.ждём>0,'1. день засеян','по журналу '+seed.ждём+' кг, подходов '+seed.подх);

  const wo=await p.evaluate(()=>{
    workoutSummary(today());                       // открывает шторку «ТРЕНИРОВКА ЗАКРЫТА»
    const box=document.getElementById('shB');
    const b=[...box.querySelectorAll('.sum .win')].map(w=>w.textContent.trim());
    return {подх:b[1], поднято:b[2], факт:Math.round(dayTon(today())), подхФакт:daySets(today())};
  });
  const т=(s)=>parseFloat(String(s).replace(',','.').replace(/[^0-9.]/g,''));
  const ожид = wo.факт>=1000 ? Math.round(wo.факт/100)/10 : wo.факт;
  chk(Math.abs(т(wo.поднято)-ожид)<0.15,'2. итог тренировки считает по записанным повторам',
      JSON.stringify(wo)+' ожидали '+ожид);
  chk(т(wo.подх)===wo.подхФакт,'3. подходы в итоге тренировки — записанные',wo.подх+' против '+wo.подхФакт);

  // итоги месяца: шапка обязана сходиться с разбивкой по группам под ней
  const mo=await p.evaluate(async()=>{
    await monthReport(today().slice(0,7));
    const box=document.getElementById('shB');
    const wins=[...box.querySelectorAll('.sum .win')].map(w=>w.textContent.trim());
    const rows=[...box.querySelectorAll('.ld .v b')].map(x=>x.textContent.trim());
    return {шапка:wins, группы:rows, факт:Math.round(dayTon(today()))};
  });
  const шапкаТ=т(mo.шапка[2]);
  const группыТ=mo.группы.reduce((a,x)=>a+т(x),0);
  chk(Math.abs(шапкаТ-группыТ)<0.15,'4. шапка итогов месяца сходится с разбивкой по группам',
      'шапка '+шапкаТ+' т, группы '+группыТ.toFixed(2)+' т');
  chk(Math.abs(шапкаТ-mo.факт/1000)<0.15,'5. и совпадает с журналом',
      'шапка '+шапкаТ+' т, журнал '+(mo.факт/1000).toFixed(2)+' т');
  chk(т(mo.шапка[1])===wo.подхФакт,'6. подходы месяца — записанные',mo.шапка[1]);

  // самопроверка: старая формула (повторы из плана) обязана дать другое число
  const старое=await p.evaluate(()=>{
    const ds=today(), d=dayOf(ds), r=recOf(ds);
    let t=0, st=0;
    d.ex.forEach((e,j)=>{ const l=r.log[j]; if(!l||!l.done) return;
      const s=num(pick(l.s,e.s)), rp=firstRep(pick(l.r,e.r)), w=num(pick(l.w,e.w));
      st+=s; t+=s*rp*w; });
    return {t:Math.round(t), st:st, факт:Math.round(dayTon(ds)), подх:daySets(ds)};
  });
  chk(старое.t!==старое.факт,'6б. самопроверка: старая формула давала другое число',
      'по плану '+старое.t+' кг, по журналу '+старое.факт+' кг');

  chk(errs.length===0,'7. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
