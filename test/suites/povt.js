/* Графа ПОВТ, клетки повторов и кнопка ○ в списке — одна цель.
   Решение владельца: графа подставляет повторы прошлой тренировки, но
   программа меняется, только если человек сам исправил графу. Раньше
   подставленное «10» при закрытии разносилось во все дни и делало силовой
   день объёмным; клетки при этом брали цель из плана (6), а ○ в списке
   записывал рабочий вес программы вместо показанного и без повторов. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const PREP=()=>{
  S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
  const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
  const e=d.ex[0]; e.r='4-6'; e.w=60;
  // то же упражнение в другом дне программы — там своя цель 6-8
  const other=S.days.find(x=>x!==d&&(x.ex||[]).length); other.ex.push({n:e.n,s:3,r:'6-8',w:60,g:e.g});
  const z=new Date(); z.setDate(z.getDate()-7); const past=iso(z);
  S.rec={}; recRW(past).log[0]={done:1,n:e.n,g:e.g,s:'4',r:'10',w:60,rs:[10,10,10,10],vol:1,xp:1};
  const pd=dayOf(past); if(!pd.ex.some(x=>x.n===e.n)){pd.t=d.t;pd.ex=d.ex.map(x=>({...x}));}
  entCache=null; save(); tab='wo'; sel=today(); exOpen=0; render();
  return e.n;
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:360,height:780}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // 1-4. подставлено и закрыто как есть — программа не меняется
  const a=await p.evaluate(PREP=>{ const n=eval('('+PREP+')')();
    const c=document.querySelector('.ex[data-j="0"]');
    const out={field:c.querySelector('[data-f="r"]').value, cells:[...c.querySelectorAll('[data-rs]')].map(x=>x.value).join('/'),
      fill:(c.querySelector('[data-fill]')||{}).textContent};
    toggleSet(0);
    out.plan=S.days.flatMap(x=>x.ex||[]).filter(x=>x.n===n).map(x=>x.r);
    out.rs=(recOf(today()).log[0]||{}).rs; return out; }, PREP.toString());
  chk(a.field==='10','1. в графе ПОВТ — повторы прошлой тренировки',a.field);
  chk(a.cells==='10/10/10/10' && /10/.test(a.fill),'2. клетки и «Все по N» — та же цель, что в графе',a.cells+' · '+a.fill);
  chk(a.plan.slice().sort().join()==='4-6,6-8','3. закрыл как есть — цели программы на месте в обоих днях',JSON.stringify(a.plan));
  chk(Array.isArray(a.rs)&&a.rs.join('/')==='10/10/10/10','4. записаны повторы из клеток',JSON.stringify(a.rs));

  // 5. сам исправил графу — цель уходит во все дни
  const b2=await p.evaluate(PREP=>{ const n=eval('('+PREP+')')();
    const c=document.querySelector('.ex[data-j="0"]'); c.querySelector('[data-f="r"]').value='12';
    toggleSet(0); return S.days.flatMap(x=>x.ex||[]).filter(x=>x.n===n).map(x=>x.r); }, PREP.toString());
  chk(b2.every(x=>x==='12'),'5. исправил графу на 12 — цель ушла во все дни',JSON.stringify(b2));

  // 6-7. кнопка ○ в строке списка записывает то, что показано в строке
  const c3=await p.evaluate(PREP=>{ eval('('+PREP+')')(); exOpen=null; render();
    const row=document.querySelector('.exrow[data-j="0"]'); const shown=row.querySelector('.kg').textContent;
    row.querySelector('[data-go="0"]').click(); const l=recOf(today()).log[0]||{};
    return {shown, w:kg(num(l.w)), rs:l.rs, done:l.done}; }, PREP.toString());
  chk(c3.done && c3.w===c3.shown,'6. ○ в списке пишет вес из строки',c3.shown+' → '+c3.w);
  chk(Array.isArray(c3.rs)&&c3.rs.length>0,'7. ○ в списке пишет повторы по подходам',JSON.stringify(c3.rs));

  // 8. вес с прошлого раза вырос — клетки начинают с низа, а не с верха
  const d4=await p.evaluate(PREP=>{ eval('('+PREP+')')();
    const e=dayOf(today()).ex[0]; e.r='8-10'; const z=new Date(); z.setDate(z.getDate()-7);
    recRW(iso(z)).log[0]=Object.assign(recRW(iso(z)).log[0],{r:'8-10',w:50,rs:[10,10,10]});
    entCache=null; exOpen=0; render();
    return [...document.querySelectorAll('.ex[data-j="0"] [data-rs]')].map(x=>x.value).join('/'); }, PREP.toString());
  chk(/^8(\/8)*$/.test(d4),'8. вес поднят с 50 до 60 — клетки по низу диапазона',d4);
  chk(errs.length===0,'9. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
