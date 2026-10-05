/* Типы подходов, RPE и заметка к упражнению (фишки из Lyfta).
   Разминочный и дроп-подход не идут в тоннаж и прогрессию, отказ — рабочий
   подход с пометкой; RPE 10 на верхе диапазона вес не поднимает. */
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
  const prep=()=>p.evaluate(()=>{ S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on'); S.rec={}; S.pr={};
    const d=dayOf(today()); d.t='lo1'; d.s='тест'; d.ex=[{n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'}];
    entCache=null; save(); tab='wo'; sel=today(); exOpen=0; render(); });
  // клетки: 5 штук — Р, рабочий, рабочий(О), рабочий, Д
  const fill=(vals,kinds,rpe)=>p.evaluate(([vals,kinds,rpe])=>{
    const c=document.querySelector('.ex[data-j="0"]'); c.querySelector('[data-f="w"]').value='100'; c.querySelector('[data-f="s"]').value=String(vals.length);
    c.querySelector('[data-f="s"]').dispatchEvent(new Event('input',{bubbles:true}));
    const cells=[...c.querySelectorAll('[data-kindcyc]')];   // номер подхода — его тип
    kinds.forEach((k,i)=>{ const steps={'':0,w:1,f:2,d:3}[k]; for(let t=0;t<steps;t++) cells[i].click(); });
    [...c.querySelectorAll('[data-rs]')].forEach((x,i)=>{ x.value=String(vals[i]); });
    if(rpe) c.querySelector('[data-rpe="'+rpe+'"]').click();
  },[vals,kinds,rpe]);

  await prep();
  await fill([10,10,10,10,8],['w','','f','','d']);
  const k1=await p.evaluate(()=>{ const c=document.querySelector('.ex[data-j="0"]');
    return [...c.querySelectorAll('[data-kindcyc]')].map(x=>x.textContent).join(''); });
  chk(k1==='Р2О4Д','1. касание номера подхода меняет тип: Р, О, Д',k1);
  const r2=await p.evaluate(()=>{ toggleSet(0); const l=recOf(today()).log[0];
    return {wu:l.wu, rs:l.rs, dr:l.dr, fl:l.fl, s:l.s, vol:l.vol, sets:daySets(today()), line:entryLine(dayEntries(today())[0]),
      w:num(dayOf(today()).ex[0].w)}; });
  chk(JSON.stringify(r2.wu)==='[10]'&&JSON.stringify(r2.rs)==='[10,10,10]'&&JSON.stringify(r2.dr)==='[8]'&&JSON.stringify(r2.fl)==='[1]',
    '2. разминка и дроп — отдельно, отказ помечен среди рабочих',JSON.stringify({wu:r2.wu,rs:r2.rs,dr:r2.dr,fl:r2.fl}));
  chk(r2.vol===3000&&r2.sets===3&&r2.s==='3','3. тоннаж и подходы — только рабочие: 3×10×100',r2.vol+' кг · '+r2.sets+' подх.');
  chk(/разм\. 10/.test(r2.line)&&/10О/.test(r2.line)&&/дроп 8/.test(r2.line),'4. журнал показывает разминку, отказ и дроп',r2.line);
  chk(r2.w>100,'5. рабочие подходы по верху — вес растёт, разминка его не держит',String(r2.w));
  const r6=await p.evaluate(()=>{ toggleSet(0); exOpen=0; render();
    return [...document.querySelectorAll('.ex[data-j="0"] [data-kindcyc]')].map(x=>x.textContent).join(''); });
  chk(r6==='Р2О4Д','6. снятая отметка возвращает клетки с типами',r6);

  // RPE 10 на верхе — вес держим
  await prep();
  await fill([10,10,10],['','',''],10);
  const r7=await p.evaluate(()=>{ toggleSet(0); return {w:num(dayOf(today()).ex[0].w), rpe:recOf(today()).log[0].rpe, line:entryLine(dayEntries(today())[0])}; });
  chk(r7.w===100&&r7.rpe===10,'7. верх взят на RPE 10 — вес не поднимается',JSON.stringify(r7));
  chk(/RPE 10/.test(r7.line),'8. RPE видно в журнале',r7.line);
  const sz=await p.evaluate(()=>{ exOpen=0; render(); const h=el=>Math.round(el.getBoundingClientRect().height);
    const c=document.querySelector('.ex[data-j="0"]'); return [...c.querySelectorAll('[data-rpe]')].map(h).concat([h(c.querySelector('.exnote summary'))]); });
  chk(sz.every(x=>x>=44),'9. кнопки RPE и заметки не ниже 44 px на 320',JSON.stringify(sz));

  // заметка к упражнению переживает перезагрузку и видна в другой день
  await p.evaluate(()=>{ const t=document.querySelector('[data-exnote]'); t.value='Сиденье на 4'; t.dispatchEvent(new Event('input',{bubbles:true})); flush(); });
  await p.reload(); await p.waitForTimeout(1300);
  const r10=await p.evaluate(()=>{ const z=new Date(); z.setDate(z.getDate()+7); sel=iso(z); const d=dayOf(sel);
    d.t='lo1'; d.ex=[{n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'}]; tab='wo'; exOpen=0; render();
    const t=document.querySelector('[data-exnote]'); return {v:t&&t.value, open:t&&t.closest('details').open}; });
  chk(r10.v==='Сиденье на 4'&&r10.open,'10. заметка видна в следующей тренировке и раскрыта',JSON.stringify(r10));
  chk(errs.length===0,'11. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
