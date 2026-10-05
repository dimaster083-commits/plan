/* Сверка логики «Зала» со свежими функциями: план недели (S.map, обмен дней
   шаблона, пауза), подходы строками, каталог. Каждая проверка — на ошибку,
   найденную при сверке, и падает на коде до правки. */
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

  // сегодня — тренировка из одного жима; план ещё не начат, чтобы вес недели был рабочим
  const день=()=>p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.map={}; S.pr={}; delete S.pause; S.days=build().days;
    S.start=addDays(today(),60);
    S.days.forEach(d=>{ d.ex=d.ex.filter(e=>e.n!=='Жим лёжа'); });
    const d=dayOf(today()); d.t='up1'; d.s='тест';
    d.ex=[{n:'Жим лёжа',s:3,r:'6-8',w:60,g:'Грудь'}];
    entCache=null; save(); tab='wo'; sel=today(); exOpen=0; render();
    return wdOf(today());
  });
  const заполнить=(w,r,rs)=>p.evaluate(([w,r,rs])=>{
    const c=document.querySelector('.ex[data-j="0"]');
    const f=(k,v)=>{ const x=c.querySelector('[data-f="'+k+'"]'); x.value=v; x.dispatchEvent(new Event('input',{bubbles:true})); };
    if(w!==null) f('w',w);
    if(r!==null) f('r',r);
    const cells=[...document.querySelector('.ex[data-j="0"]').querySelectorAll('[data-rs]')];
    cells.forEach((x,i)=>{ x.value=String(rs[i]); x.dispatchEvent(new Event('input',{bubbles:true})); });
  },[w,r,rs]);

  // 1. двойной тап по последней галочке: подход закрылся и тут же снимался
  await день();
  await заполнить(null,null,[7,7,7]);
  const тап=await p.evaluate(()=>{
    const ticks=()=>[...document.querySelectorAll('.ex[data-j="0"] [data-tick]')];
    ticks().forEach(t=>t.click());                       // все строки — упражнение закрылось
    const закрыт=!!(recOf(today()).log[0]||{}).done;
    const t2=ticks(); if(t2.length) t2[t2.length-1].click();   // второй приход того же тапа
    return {закрыт, после:!!(recOf(today()).log[0]||{}).done};
  });
  await p.waitForTimeout(400);
  const снятие=await p.evaluate(()=>{
    const t=[...document.querySelectorAll('.ex[data-j="0"] [data-tick]')];
    if(t.length) t[0].click();
    return !!(recOf(today()).log[0]||{}).done;
  });
  chk(тап.закрыт&&тап.после&&снятие===false,
    '1. двойной тап по галочке не снимает только что закрытое, обычный тап позже — снимает', JSON.stringify({...тап,снятие}));

  // 2. «Каждую неделю» после закрытия: снятая отметка возвращает вес и цель тренировке, уехавшей в другой день
  const wd=await день();
  await p.waitForTimeout(300);
  await заполнить('62.5','5-6',[5,5,5]);
  const откат=await p.evaluate(wd=>{
    toggleSet(0);
    const подня=dayOf(today()).ex[0].w, цель=dayOf(today()).ex[0].r;
    const k=S.days.findIndex((d,i)=>i!==wd&&d.t==='rest');
    swapWeekdays(wd,k); save(); render();
    return {k, подня, цель, где:S.days[k].ex.map(e=>e.n).join(',')};
  },wd);
  await p.waitForTimeout(300);
  const назад=await p.evaluate(k=>{
    exOpen=0; render();
    toggleSet(0);
    const e=S.days[k].ex[0];
    return {снят:!(recOf(today()).log[0]||{}).done, w:e.w, r:e.r, сегодня:dayOf(today()).ex[0].n};
  },откат.k);
  chk(num62(откат.подня)&&откат.цель==='5-6'&&откат.где==='Жим лёжа'&&назад.снят&&+назад.w===60&&назад.r==='6-8'&&назад.сегодня==='Жим лёжа',
    '2. после обмена дней шаблона снятая отметка возвращает вес и цель', JSON.stringify({откат,назад}));
  function num62(v){ return Math.abs(parseFloat(String(v).replace(',','.'))-62.5)<1e-6; }

  // 3. смена типа дня во всех неделях: прошлые тренировки остаются тренировками
  //    и в посещаемости, и в плане месяца, и в интенсивности для застоя (dayLook, а не шаблон)
  await p.waitForTimeout(300);
  const был=await p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.map={}; S.pr={}; delete S.pause; S.days=build().days;
    S.start=addDays(mondayOf(today()),-56);
    const t=today(); let last=null;
    for(let k=13;k>=1;k--){ const ds=addDays(t,-k);
      if(dayOf(ds).t==='rest') continue;
      S.rec[ds]={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'60',s:'3',r:'8',rs:[8,8,8],vol:1440,sd:1}},sp:{}};
      last=ds; }
    entCache=null; save(); tab='wo'; sel=last; edit=true; render();
    const rd=rangeData(addDays(t,-13),13);
    return {ds:last, a:attendance(14), план:rd.days.filter(x=>x.tr).length, инт:intFactor(last)};
  });
  // тип дня во всех неделях — в шторке «Неделя» («Каждую неделю», выбранный день)
  await p.evaluate(()=>{ wkMode='all'; openWeekPlan(sel); wkPick=wdOf(sel); openWeekPlan();
    document.querySelector('#shB [data-wpt="rest"]').click(); });
  await p.waitForTimeout(300); await p.click('#askY'); await p.waitForTimeout(300);
  const стал=await p.evaluate(ds=>{ edit=false; sel=today(); render();
    const rd=rangeData(addDays(today(),-13),13);
    return {шаблон:S.days[wdOf(ds)].t, a:attendance(14), план:rd.days.filter(x=>x.tr).length, инт:intFactor(ds)}; },был.ds);
  chk(стал.шаблон==='rest'&&стал.a.planned===был.a.planned&&стал.a.done===был.a.done&&стал.a.done<=стал.a.planned
      &&стал.план===был.план&&Math.abs(стал.инт-был.инт)<1e-9,
    '3. смена типа дня не делает прошлые тренировки отдыхом: посещаемость, план месяца, интенсивность', JSON.stringify({был,стал}));

  // 4. вес по подходам: 100/100/110 — в тоннаж, рекорд веса, ≈1ПМ, ленту рекордов и в график упражнения
  await день();
  const прошлый=await p.evaluate(()=>{
    const ds=addDays(today(),-3);
    S.rec[ds]={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'100',s:'3',r:'8',rs:[8,8,8],vol:2400,sd:1}},sp:{}};
    S.pr['Жим лёжа']=100; dayOf(today()).ex[0].w=100; entCache=null; save(); exOpen=0; render(); return ds;
  });
  await p.waitForTimeout(300);
  const строки=await p.evaluate(()=>{
    const c=document.querySelector('.ex[data-j="0"]');
    const f=c.querySelector('[data-f="w"]'); f.value='100'; f.dispatchEvent(new Event('input',{bubbles:true}));
    const ws=[...c.querySelectorAll('[data-ws]')], rs=[...c.querySelectorAll('[data-rs]')];
    [100,100,110].forEach((v,i)=>{ ws[i].value=String(v); ws[i].dispatchEvent(new Event('input',{bubbles:true})); });
    rs.forEach(x=>{ x.value='8'; x.dispatchEvent(new Event('input',{bubbles:true})); });
    toggleSet(0);
    entCache=null;
    const b=recordsOf(exSessions('Жим лёжа'));
    return {тонн:dayTon(today()), вес:b.w&&b.w.w, днём:b.w&&b.w.ds===today(), e1:b.e1&&Math.round(b.e1.e1*10)/10,
      pr:S.pr['Жим лёжа'], график:(exHistory('Жим лёжа').find(x=>x[0]===today())||[])[1], лента:recFeed(6).filter(x=>x.ds===today()).map(x=>x.t).join(' | ')};
  });
  await p.waitForTimeout(300);
  const снял=await p.evaluate(()=>{ toggleSet(0); return S.pr['Жим лёжа']; });
  chk(строки.тонн===8*310&&строки.вес===110&&строки.днём&&строки.e1===Math.round(110*(1+8/30)*10)/10&&строки.pr===110&&строки.график===110
      &&/вес 110/.test(строки.лента)&&снял===100,
    '4. самый тяжёлый подход строкой — рекорд веса, ≈1ПМ и график; снятая отметка возвращает прежний', JSON.stringify({...строки,снял}));

  // 5. RPE 10 после закрытия галочками: верх взят на отказе — прибавка снимается, снятый RPE её возвращает
  await день();
  await p.waitForTimeout(300);
  await заполнить('60',null,[8,8,8]);
  const rpe=await p.evaluate(()=>{
    const W=()=>dayOf(today()).ex[0].w;
    [...document.querySelectorAll('.ex[data-j="0"] [data-tick]')].forEach(t=>t.click());
    const закрыт=!!(recOf(today()).log[0]||{}).done, прибавка=W();
    const q=()=>document.querySelector('.ex[data-j="0"] [data-rpe="10"]');
    if(!q()) return {закрыт, прибавка, кнопки:false};
    q().click(); const отказ=W();
    q().click(); const снова=W();
    q().click(); const ещё=W();
    return {закрыт, прибавка, отказ, снова, ещё};
  });
  await p.waitForTimeout(300);
  const сброс5=await p.evaluate(()=>{ toggleSet(0); return dayOf(today()).ex[0].w; });
  chk(rpe.закрыт&&+rpe.прибавка===62.5&&+rpe.отказ===60&&+rpe.снова===62.5&&+rpe.ещё===60&&+сброс5===60,
    '5. RPE 10 после закрытия держит вес, снятый RPE возвращает прибавку, отмена — всё назад', JSON.stringify({...rpe,сброс5}));

  // 6. итоги недели: план — тренировки этих дат (как у месяца), а не шаблона; выпавшая при сдвиге не в плане
  const план6=await p.evaluate(()=>{
    S.rec={}; S.map={}; delete S.pause; S.days=build().days;
    const mon=mondayOf(today()), sun=addDays(mon,6);
    const r=pushDay(sun); save(); render();
    openWeek(mon);
    const t=document.querySelector('#shB .wksum .win small');
    const дат=weekData(mon).days.filter(x=>x.tr).length;
    sheetClose && sheetClose();
    return {выпала:!!(r&&r.lost), плитка:t?t.textContent:null, дат};
  });
  chk(план6.выпала&&план6.дат===3&&план6.плитка==='/3',
    '6. итоги недели: план по датам недели — сдвинутая за край тренировка не числится', JSON.stringify(план6));

  chk(errs.length===0,'без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
