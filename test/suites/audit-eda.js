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

  // 3. «Слабое звено недели»: неделя на паузе — не пропуск (тем же счётом, что посещаемость)
  await сброс();
  const звено=await p.evaluate(()=>{
    const t=today(), m0=mondayOf(t), w1=addDays(m0,-7), w2=addDays(m0,-14);
    S.start=addDays(m0,-42); S.pause={}; S.pause[w1]=1; S.pause[w2]=1;
    for(let i=1;i<28;i++){ const ds=addDays(t,-i);
      if(dayOf(ds).t!=='rest'&&!paused(ds)) S.rec[ds]={log:{},sp:{},wo:1}; }
    save();
    const r=regularity(28);
    return {худший:r.worst||null, раз:r.worstN, карточка:analyze().some(x=>x.title==='СЛАБОЕ ЗВЕНО НЕДЕЛИ')};
  });
  chk(звено.раз<2&&!звено.карточка,
    '3. две недели на паузе не делают «слабым звеном» дни, пропущенные по болезни', JSON.stringify(звено));

  // 4. итоги недели на паузе: плана нет — не «0/4»
  await сброс();
  const итоги=await p.evaluate(()=>{
    const w1=addDays(mondayOf(today()),-7); S.pause={}; S.pause[w1]=1; save();
    openWeek(w1);
    const tile=document.querySelector('#shB .wksum .win b').textContent;
    return {плитка:tile, пауза:/пауз/i.test($('shB').textContent), план:weekData(w1).days.filter(x=>x.tr).length};
  });
  chk(итоги.плитка==='0'&&итоги.пауза&&итоги.план===0,
    '4. итоги недели на паузе: плитка без «/4», сказано про паузу', JSON.stringify(итоги));

  // 5. месяц и квест: неделя на паузе не идёт ни в план месяца, ни в норму квеста
  await сброс();
  const месяц=await p.evaluate(()=>{
    const ym=today().slice(0,7), mid=mondayOf(ym+'-15'), dim=new Date(+ym.slice(0,4),+ym.slice(5,7),0).getDate();
    S.pause={}; S.pause[mid]=1; save();
    let пз=0, план=0;
    for(let i=1;i<=dim;i++){ const ds=ym+'-'+String(i).padStart(2,'0');
      if(paused(ds)) пз++; else if(dayLook(ds).t!=='rest') план++; }
    const q=questsOf(ym)[0];
    return {пз, план, вИтогах:rangeData(ym+'-01',dim).days.filter(x=>x.tr).length,
      норма:q.need, надо:Math.max(1,Math.round(weekNeed()*(dim-пз)/7)), текст:q.t};
  });
  chk(месяц.вИтогах===месяц.план&&месяц.норма===месяц.надо&&месяц.пз>=7,
    '5. месяц: план и квест «Закрыть N» без дней паузы', JSON.stringify(месяц));

  // 6. неделя на паузе: день тренировки ест по норме отдыха, «Еда» и выгрузка говорят одно
  await сброс();
  const еда=await p.evaluate(()=>{
    const nx=addDays(mondayOf(today()),7); let tr=nx;
    for(let k=0;k<7;k++){ const x=addDays(nx,k); if(dayOf(x).t!=='rest'){ tr=x; break; } }
    const отдых=nutriFor('rest').kc, трен=nutriFor('up1').kc;
    S.pause={}; S.pause[nx]=1;
    // прошлая неделя тоже на паузе, во вторник что-то съедено
    const w1=addDays(mondayOf(today()),-7); S.pause[w1]=1;
    let past=w1; for(let k=0;k<7;k++){ const x=addDays(w1,k); if(dayOf(x).t!=='rest'){ past=x; break; } }
    allFood(); const prod=[...FOODMAP.keys()][0];
    S.rec[past]={log:{},sp:{},wo:0,ml:[{n:'Обед',note:'',items:[{p:prod,g:'300'}]}]};
    sel=tr; tab='food'; save(); render();
    const line=buildSummary().split('\n').find(l=>l.indexOf(fmt(past))===2)||'';
    return {отдых, трен, поле:$('kc').value, итог:$('tKc').textContent, выгрузка:line};
  });
  chk(еда.отдых!==еда.трен&&еда.поле===еда.отдых&&еда.итог.indexOf(еда.отдых)>=0&&еда.выгрузка.indexOf('цели '+еда.отдых)>=0,
    '6. неделя на паузе: норма дня тренировки — как у отдыха, и в «Еде», и в выгрузке', JSON.stringify(еда));

  // 7. на паузе поправка нормы руками ложится в норму отдыха, а закрытая тренировка ест как тренировка
  const ручная=await p.evaluate(()=>{
    const el=$('kc'); el.value='2345'; el.dispatchEvent(new Event('input',{bubbles:true}));
    const rest=S.days.find(d=>d.t==='rest').kc, tr=dayOf(sel).kc;
    recRW(sel).wo=1; render();
    const после=$('kc').value; delete S.rec[sel].wo; S.kcManual=0; applyNutri(); save(); render();
    return {rest, tr, после};
  });
  chk(ручная.rest==='2345'&&ручная.tr!=='2345'&&ручная.после===ручная.tr,
    '7. правка нормы на паузе меняет норму отдыха; закрыл тренировку — норма тренировки', JSON.stringify(ручная));

  // 8. добавки: отметка — номер строки; перенос дня не должен переводить её на чужую добавку
  await сброс();
  const добавки=await p.evaluate(()=>{
    const nx=addDays(mondayOf(today()),7), tue=addDays(nx,1), thu=addDays(nx,3);
    const names=ds=>Object.keys(recOf(ds).sp).map(k=>(dayOf(ds).sp[+k]||{}).n||('#'+k)).sort().join('|');
    const tick=(ds,list)=>{ const r=recRW(ds); list.forEach(n=>{ r.sp[dayOf(ds).sp.findIndex(x=>x.n===n)]=1; }); };
    // «эта неделя»: вторник (тренировка) ↔ понедельник (отдых)
    tick(tue,['Креатин моногидрат 5 г','Цитруллина малат 8 г']); tick(nx,['Протеин 30 г']);
    swapDates(nx,tue);
    const обмен={вт:names(tue), пн:names(nx), лишних:Object.keys(recOf(tue).sp).filter(k=>+k>=dayOf(tue).sp.length).length};
    // «не могу — сдвинуть»: четверг уезжает на пятницу
    tick(thu,['Витамин D3 2000 МЕ','Кофеин 200 мг']);
    pushDay(thu);
    const сдвиг=names(thu);
    // «каждую неделю»: шаблон пн ↔ вт, будущая дата с отметками без подходов
    S.map={}; S.rec={}; tick(tue,['Омега-3 1-2 г EPA+DHA','Кофеин 200 мг']);
    swapWeekdays(0,1);
    const шаблон=names(tue);
    return {обмен, сдвиг, шаблон};
  });
  chk(добавки.обмен.вт==='Креатин моногидрат 5 г'&&добавки.обмен.пн==='Протеин 30 г'&&добавки.обмен.лишних===0
    &&добавки.сдвиг==='Витамин D3 2000 МЕ'&&добавки.шаблон==='Омега-3 1-2 г EPA+DHA',
    '8. отметки добавок едут по названию при обмене, сдвиге и смене шаблона', JSON.stringify(добавки));

  chk(errs.length===0,'99. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
