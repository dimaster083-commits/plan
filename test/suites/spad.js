/* Обратная сторона двойной прогрессии. Вес умел только расти: после болезни
   или перерыва человек оставался на весе, который больше не тянет, и каждая
   тренировка превращалась в провал. Плюс значок «закреплено» на облегчённой
   неделе обещал прибавку, которой по плану быть не может. */
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
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');S.sound=0;save();});

  // готовим упражнение с диапазоном 6-8 и рабочим весом 50
  const prep=await p.evaluate(()=>{
    S.rec={};
    const день=S.days.find(d=>(d.ex||[]).length);
    const e=день.ex[0];
    e.r='6-8'; e.s=3; e.w=50; delete e.fixed;
    // дата этого дня недели в прошлом
    const даты=[];
    for(let k=1;k<40&&даты.length<3;k++){ const d=new Date(); d.setDate(d.getDate()-k);
      if(S.days[wdOf(iso(d))]===день) даты.push(iso(d)); }
    save();
    return {имя:e.n, группа:e.g, даты:даты.reverse(), вес:num(e.w)};
  });
  chk(prep.даты.length>=2,'0. нашлось два прошлых дня этого упражнения',prep.даты.join(', '));

  const провал=(ds,rs)=>p.evaluate(([ds,rs,имя,гр])=>{
    const r=recRW(ds); r.wo=1; r.log=r.log||{};
    const день=S.days[wdOf(ds)], j=день.ex.findIndex(x=>x.n===имя);
    r.log[j]={done:1,n:имя,g:гр,s:'3',r:'6-8',w:num(день.ex[j].w),rs:rs,
              vol:rs.reduce((a,c)=>a+c,0)*num(день.ex[j].w),xp:12};
    entCache=null; statsDirty=true; save();
    return {серия:failStreak(имя,num(день.ex[j].w),ds), вес:num(день.ex[j].w)};
  },[ds,rs,prep.имя,prep.группа]);

  // 1. один провал — вес на месте
  const f1=await провал(prep.даты[0],[5,5,4]);
  chk(f1.серия===1,'1. один недобор — это ещё не серия','серия '+f1.серия);
  chk(f1.вес===50,'2. после одного провала вес не падает',f1.вес+' кг');

  // 2. второй провал подряд — вес опускается на шаг
  const f2=await провал(prep.даты[1],[5,4,4]);
  chk(f2.серия===2,'3. второй недобор подряд виден как серия','серия '+f2.серия);

  // прогоняем через настоящий путь закрытия подхода
  const res=await p.evaluate(([имя,ds])=>{
    sel=ds; tab='wo'; exOpen=0; render();
    const день=S.days[wdOf(ds)], j=день.ex.findIndex(x=>x.n===имя);
    const r=recRW(ds); delete r.log[j];
    render();
    const card=document.querySelector('.ex[data-j="'+j+'"]');
    if(!card) return {err:'карточки нет'};
    card.querySelector('[data-f="w"]').value='50';
    card.querySelector('[data-f="s"]').value='3';
    card.querySelector('[data-f="r"]').value='6-8';
    [...card.querySelectorAll('[data-rs]')].slice(0,3).forEach((x,i)=>{x.value=[5,4,4][i];});
    toggleSet(j);
    const e=S.days[wdOf(ds)].ex[j];
    return {вес:num(e.w), сниж:!!recOf(ds).log[j].down, текст:document.getElementById('noteT').textContent};
  },[prep.имя, prep.даты[2]||prep.даты[1]]);
  chk(!res.err,'4. карточка открылась',res.err||'открылась');
  chk(res.вес===47.5,'5. рабочий вес снижен на шаг сетки','стало '+res.вес+' кг из 50');
  chk(/снижен/.test(res.текст||''),'6. человеку сказали, почему вес упал',res.текст);

  // 7. снятая отметка возвращает вес обратно
  const undo=await p.evaluate(([имя,ds])=>{
    const j=S.days[wdOf(ds)].ex.findIndex(x=>x.n===имя);
    toggleSet(j);
    return {вес:num(S.days[wdOf(ds)].ex[j].w), down:!!(recOf(ds).log[j]||{}).down};
  },[prep.имя, prep.даты[2]||prep.даты[1]]);
  chk(undo.вес===50&&!undo.down,'7. снятая отметка возвращает вес назад',JSON.stringify(undo));

  // 8. успешный заход обрывает серию
  const good=await p.evaluate(([имя,ds])=>{
    const r=recRW(ds), день=S.days[wdOf(ds)], j=день.ex.findIndex(x=>x.n===имя);
    r.log[j]={done:1,n:имя,g:день.ex[j].g,s:'3',r:'6-8',w:50,rs:[7,7,6],vol:1000,xp:12};
    save();
    return failStreak(имя,50,ds);
  },[prep.имя, prep.даты[1]]);
  chk(good===0,'8. добранный низ обрывает серию провалов','серия '+good);

  // 9-10. значок на облегчённой неделе честен
  const badge=await p.evaluate(()=>{
    const e={n:'X', r:'6-8', s:3, w:50, g:'Грудь'};
    const полегче=holdBadge(e,{s:'3',r:'6-8',w:'40',rs:[8,8,8]});
    const рабочий=holdBadge(e,{s:'3',r:'6-8',w:'50',rs:[8,8,8]});
    return {полегче, рабочий};
  });
  chk(/полегче/.test(badge.полегче),'9. на облегчённой неделе значок не обещает прибавку',
      badge.полегче.replace(/<[^>]+>/g,''));
  chk(/закреплено</.test(badge.рабочий)&&!/полегче/.test(badge.рабочий),
      '10. на рабочем весе значок прежний',badge.рабочий.replace(/<[^>]+>/g,''));

  /* 12-15. Рабочий вес — это вес, с которым сделан весь диапазон.
     Разовый подход на трёх повторах при цели 6-8 идёт в рекорды, но
     рабочим весом не становится: иначе программа дальше требует
     шесть повторов с весом, который взят на три. */
  const single=await p.evaluate(([имя])=>{
    S.rec={}; S.pr={};
    const день=S.days.find(d=>(d.ex||[]).some(x=>x.n===имя));
    const j=день.ex.findIndex(x=>x.n===имя);
    день.ex[j].w=50; день.ex[j].r='6-8'; день.ex[j].s=3; delete день.ex[j].fixed;
    let ds=today();
    for(let k=0;k<7;k++){ const d=new Date(); d.setDate(d.getDate()-k);
      if(S.days[wdOf(iso(d))]===день){ ds=iso(d); break; } }
    recRW(ds).log={}; save();
    sel=ds; tab='wo'; exOpen=j; render();
    const card=document.querySelector('.ex[data-j="'+j+'"]');
    card.querySelector('[data-f="w"]').value='60';
    card.querySelector('[data-f="s"]').value='3';
    card.querySelector('[data-f="r"]').value='6-8';
    [...card.querySelectorAll('[data-rs]')].slice(0,3).forEach((x,i)=>{x.value=[3,3,2][i];});
    toggleSet(j);
    return {рабочий:num(S.days[wdOf(ds)].ex[j].w), рекорд:num(S.pr[имя]), ds:ds, j:j};
  },[prep.имя]);
  chk(single.рабочий===50,'12. разовый подход не становится рабочим весом',
      'рабочий '+single.рабочий+' кг после подхода 60×3');
  chk(single.рекорд===60,'13. но в рекорды он попадает','рекорд '+single.рекорд+' кг');

  const held=await p.evaluate(([имя,ds,j])=>{
    toggleSet(j);                       // снимаем прошлую отметку
    sel=ds; tab='wo'; exOpen=j; render();
    const card=document.querySelector('.ex[data-j="'+j+'"]');
    if(!card) return {err:'карточки нет'};
    card.querySelector('[data-f="w"]').value='55';
    card.querySelector('[data-f="s"]').value='3';
    card.querySelector('[data-f="r"]').value='6-8';
    [...card.querySelectorAll('[data-rs]')].slice(0,3).forEach((x,i)=>{x.value=[7,6,6][i];});
    toggleSet(j);
    return {рабочий:num(S.days[wdOf(ds)].ex[j].w)};
  },[prep.имя, single.ds, single.j]);
  chk(!held.err&&held.рабочий===55,'14. вес, отработанный по диапазону, рабочим становится',
      held.err||('рабочий '+held.рабочий+' кг после 55 на 7/6/6'));

  /* 16-17. Пустые клетки повторов — «не записал», а не «не смог».
     Человек, который просто закрыл подход не заполняя повторы, не должен
     ни терять прибавку, ни получать снижение веса. */
  const empty=await p.evaluate(([имя,ds,j])=>{
    toggleSet(j);
    sel=ds; tab='wo'; exOpen=j; render();
    const card=document.querySelector('.ex[data-j="'+j+'"]');
    if(!card) return {err:'карточки нет'};
    card.querySelector('[data-f="w"]').value='70';
    card.querySelector('[data-f="s"]').value='3';
    card.querySelector('[data-f="r"]').value='6-8';
    [...card.querySelectorAll('[data-rs]')].forEach(x=>{x.value='';});
    toggleSet(j);
    return {рабочий:num(S.days[wdOf(ds)].ex[j].w), сниж:!!(recOf(ds).log[j]||{}).down};
  },[prep.имя, single.ds, single.j]);
  chk(!empty.err&&empty.рабочий===70,'16. без записанных повторов вес поднимается как раньше',
      empty.err||('рабочий '+empty.рабочий+' кг'));
  chk(!empty.сниж,'17. и снижения от пустых клеток не бывает',String(empty.сниж));

  chk(errs.length===0,'11. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
