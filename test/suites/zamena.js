/* Замена упражнения — как «Replace exercise» у Lyfta, но аналоги по книге
   «Фитнес для умных»: тот же тип движения и мышца, потом тот же тип, потом
   другое на ту же мышцу. «Только сегодня» не трогает программу, «во всех
   днях» меняет её, журнал остаётся под старым именем, записанные даты
   закрепляются за старым движением. Раньше замена была одна — «во все
   недели» через вопрос, а закрытый подход дня стирался. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:320,height:700}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('dialog',d=>d.accept());
  await p.goto(APP); await p.waitForTimeout(1300);

  // день сегодня: присед, жим лёжа (в суперсете с тягой), тяга; жим лёжа есть и в другом дне
  const PREP=()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.map={}; S.pr={}; delete S.pause; delete S.once; S.days=build().days;
    const t=today(), d=dayOf(t);
    d.t='lo1'; d.s='тест';
    d.ex=[{n:'Присед со штангой',s:4,r:'4-6',w:100,g:'Ноги'},
          {n:'Жим лёжа',s:3,r:'6-8',w:80,g:'Грудь',ss:1},
          {n:'Тяга штанги в наклоне',s:3,r:'8-10',w:60,g:'Спина'}];
    const other=S.days.find(x=>x!==d&&x.t!=='rest');
    other.ex=[{n:'Жим лёжа',s:5,r:'3-5',w:80,g:'Грудь'}];
    sel=t; tab='wo'; exOpen=null; save(); render();
    return S.days.indexOf(other);
  };
  const OTHER=await p.evaluate(PREP);

  // 1. ранжирование по книге
  const rk=await p.evaluate(async()=>{
    if (typeof swapCands!=='function') return null;
    await loadLib();
    const c=swapCands('Жим лёжа', today());
    const oo=libByName('Жим лёжа');
    const tiers=c.map(x=>x.tier);
    const t0=c.filter(x=>x.tier===0), t1=c.filter(x=>x.tier===1), t2=c.filter(x=>x.tier===2);
    const pos=n=>c.findIndex(x=>x.o.n===n);
    return {n:c.length, sorted:tiers.every((v,i)=>!i||tiers[i-1]<=v),
      t0ok:t0.length>0&&t0.every(x=>x.o.pl===oo.pl&&(libMuscle(x.o)==='Грудь'||x.o.pm[0]===oo.pm[0])),
      t1ok:t1.every(x=>x.o.pl===oo.pl), t2ok:t2.every(x=>x.o.pl!==oo.pl&&libMuscle(x.o)==='Грудь'),
      noSelf:pos('Жим лёжа')<0 && pos('Присед со штангой')<0,
      db:pos('Жим гантелей лёжа'), fly:pos('Разводка гантелей'),
      harmLast:t0.findIndex(x=>x.o.harm)<0 || t0.slice(t0.findIndex(x=>x.o.harm)).every(x=>x.o.harm),
      noCardio:c.every(x=>'slog'.indexOf(x.o.c)>=0)};
  });
  chk(rk&&rk.n>5&&rk.sorted&&rk.t0ok&&rk.t1ok&&rk.t2ok,'1. аналоги: сначала тип движения и мышца, потом тип, потом мышца',JSON.stringify(rk));
  chk(rk&&rk.noSelf&&rk.noCardio,'2. без себя, без того, что уже в дне, без кардио и растяжки',JSON.stringify(rk&&{noSelf:rk.noSelf,noCardio:rk.noCardio}));
  chk(rk&&rk.db>=0&&rk.db<5&&rk.fly>rk.db&&rk.harmLast,'3. жим гантелей — в первой пятёрке, вредная по книге разводка — после',JSON.stringify(rk&&{db:rk.db,fly:rk.fly,harmLast:rk.harmLast}));

  // 4. кнопка в строке: 44×44, открывает «ЗАМЕНА», шторка влезает в 320
  const ui=await p.evaluate(async()=>{
    const bt=document.querySelector('.exrow [data-swap="1"]'); if(!bt) return null;
    const r=bt.getBoundingClientRect(); bt.click(); await new Promise(res=>setTimeout(res,400));
    const bs=[...document.querySelectorAll('#shB button')].filter(x=>x.offsetParent);
    const small=bs.filter(x=>x.getBoundingClientRect().height<44).map(x=>x.textContent.trim().slice(0,20));
    const rows=[...document.querySelectorAll('#shB .swrow')];
    const out={w:Math.round(r.width),h:Math.round(r.height),title:$('shT').textContent,rows:rows.length,small,
      page:document.documentElement.scrollWidth, sh:$('shB').scrollWidth-$('shB').clientWidth,
      imgs:rows.slice(0,5).filter(x=>x.querySelector('.swph img')).length,
      step:(rows.find(x=>x.textContent.includes('Жим гантелей лёжа'))||{}).textContent||'', q:!!$('swQ')};
    // вредная разводка — в хвосте списка, находим поиском
    const q=$('swQ'); q.value='разводка'; q.dispatchEvent(new Event('input',{bubbles:true}));
    const fly=[...document.querySelectorAll('#shB .swrow')].find(x=>x.querySelector('b').textContent==='Разводка гантелей');
    out.harm=!!(fly&&fly.querySelector('.swharm'));
    q.value=''; q.dispatchEvent(new Event('input',{bubbles:true}));
    return out;
  });
  chk(ui&&ui.w>=44&&ui.h>=44&&ui.title==='ЗАМЕНА'&&ui.rows>5,'4. «Заменить» в строке — 44×44, открывает шторку ЗАМЕНА',JSON.stringify(ui&&{w:ui.w,h:ui.h,t:ui.title,rows:ui.rows}));
  chk(ui&&ui.page<=320&&ui.sh<=0&&!ui.small.length,'5. шторка влезает в 320 px, все кнопки ≥ 44 px',JSON.stringify(ui&&{page:ui.page,sh:ui.sh,small:ui.small}));
  chk(ui&&/ступень 3 · легче/.test(ui.step)&&ui.harm&&ui.imgs>=3&&ui.q,'6. ступень лесенки относительно жима лёжа, отметка «вредно», фото, поиск',JSON.stringify(ui&&{step:ui.step.replace(/\s+/g,' '),harm:ui.harm,imgs:ui.imgs}));

  // 7. фильтр оборудования и поиск
  const flt=await p.evaluate(async()=>{
    document.querySelector('#shB [data-sweq="d"]').click();
    const eqs=[...document.querySelectorAll('#shB .swrow')].map(x=>SW.cands[+x.dataset.swpick].o.eq);
    const q=$('swQ'); q.value='наклон'; q.dispatchEvent(new Event('input',{bubbles:true}));
    const shown=[...document.querySelectorAll('#shB .swrow')].map(x=>SW.cands[+x.dataset.swpick].o);
    return {eqs:[...new Set(eqs)], n:eqs.length, m:shown.length,
      ok:shown.every(o=>(o.eq==='d'||o.eq==='k')&&o.hay.indexOf('наклон')>=0), all:SW.cands.length};
  });
  chk(flt.n>0&&flt.eqs.every(e=>e==='d'||e==='k')&&flt.m>0&&flt.m<flt.n&&flt.ok,
    '7. фильтр «Гантели» и поиск сужают список',JSON.stringify(flt));

  // 8. выбор: вес на старт — осторожно от заменяемого по сетке
  const pk=await p.evaluate(async()=>{
    document.querySelector('#shB [data-sweq=""]').click();
    const q=$('swQ'); q.value=''; q.dispatchEvent(new Event('input',{bubbles:true}));
    const row=[...document.querySelectorAll('#shB .swrow')].find(x=>x.querySelector('b').textContent==='Жим гантелей лёжа');
    row.click();
    const btn=[...document.querySelectorAll('#shB [data-swm]')];
    return {w:num($('swW').value), why:document.querySelector('#shB .swwh').textContent,
      modes:btn.map(x=>x.textContent.trim()), on:btn.map(x=>x.getAttribute('aria-pressed'))};
  });
  chk(pk.w===27.5,'8. вес на старт: 80 × 0,35 = 28 → вниз по сетке 27,5',JSON.stringify(pk));
  chk(pk.modes.length===2&&/^Только/.test(pk.modes[0])&&pk.on[0]==='true','9. два режима, по умолчанию — только этот день',JSON.stringify(pk.modes));

  // 10. только сегодня: программа не тронута, связка суперсета и повторы на месте
  const once=await p.evaluate(async OTHER=>{
    $('swW').value='30'; $('swW').dispatchEvent(new Event('input',{bubbles:true}));
    document.querySelector('#shB [data-swgo]').click(); await new Promise(r=>setTimeout(r,100));
    const t=today(), e=dayOf(t).ex[1];
    return {n:e.n, w:num(e.w), s:e.s, r:e.r, ss:e.ss, tpl:S.days[dayIdx(t)].ex[1].n, other:S.days[OTHER].ex[0].n,
      next:dayOf(addDays(t,7)).ex[1].n, row:document.querySelector('.exrow[data-j="1"] .n').textContent,
      undo:!$('undo').hidden, sheet:$('sh').classList.contains('on')};
  },OTHER);
  chk(once.n==='Жим гантелей лёжа'&&once.row==='Жим гантелей лёжа'&&once.w===30,'10. «только сегодня»: в дне новое упражнение, вес — поправленный',JSON.stringify(once));
  chk(once.tpl==='Жим лёжа'&&once.other==='Жим лёжа'&&once.next==='Жим лёжа','11. программа и следующая неделя не тронуты',JSON.stringify(once));
  chk(once.s===3&&once.r==='6-8'&&once.ss===1,'12. подходы, повторы и суперсет перенесены',JSON.stringify(once));

  // 13. отмена возвращает ровно как было
  const un=await p.evaluate(async()=>{
    $('undoB').click(); await new Promise(r=>setTimeout(r,150));
    return {n:dayOf(today()).ex[1].n, once:S.once===undefined||!Object.keys(S.once||{}).length};
  });
  chk(un.n==='Жим лёжа'&&un.once,'13. «Отменить» возвращает жим лёжа',JSON.stringify(un));

  // 14–16. упражнение из базы на сегодня: закрыл — журнал, баланс по мышце, переживает перезагрузку
  const lib=await p.evaluate(async()=>{
    await loadLib();
    const x=swapCands('Жим лёжа',today()).find(c=>c.tier===0&&!EXDB[c.o.n]&&c.o.eq!=='w');
    const before=vol7m()['Грудь'];
    swapApply(today(),1,x.o.n,x.o,20,false);
    exOpen=null; render();
    toggleSet(1); await new Promise(r=>setTimeout(r,120));
    const en=dayEntries(today()).find(e=>e.j===1);
    return {name:x.o.n, en:en&&en.n, mu:muscleOf(x.o.n), lib:!!(S.libEx&&S.libEx[x.o.n]), after:vol7m()['Грудь'], before,
      l:recOf(today()).log[1].n};
  });
  chk(lib.en===lib.name&&lib.l===lib.name,'14. закрытая замена пишется в журнал под своим именем',JSON.stringify(lib));
  chk(lib.lib&&lib.mu==='Грудь'&&lib.after===lib.before+3,'15. баланс: 3 подхода ушли в грудь (S.libEx)',JSON.stringify(lib));
  await p.reload(); await p.waitForTimeout(1300);
  const rel=await p.evaluate(n=>{ document.getElementById('setup').classList.remove('on'); sel=today(); tab='wo'; exOpen=null; render();
    return {n:dayOf(today()).ex[1].n, row:(document.querySelector('.exrow[data-j="1"] .n')||{}).textContent,
      done:!!recOf(today()).log[1].done, tpl:S.days[dayIdx(today())].ex[1].n}; }, lib.name);
  chk(rel.n===lib.name&&rel.row===lib.name&&rel.done&&rel.tpl==='Жим лёжа','16. после перезагрузки замена и отметка на месте, программа прежняя',JSON.stringify(rel));

  // 17. закрытое место даты «только сегодня» не заменяется
  const lock=await p.evaluate(()=>{
    const snap=JSON.stringify(S.once);
    const r=swapApply(today(),1,'Жим гантелей лёжа',null,30,false);
    return {r, same:JSON.stringify(S.once)===snap};
  });
  chk(lock.r===false&&lock.same,'17. закрытое упражнение «только сегодня» не меняется — журнал не портится',JSON.stringify(lock));

  // 18–21. во всех днях: прошлое закреплено, история жима лёжа цела
  await p.evaluate(PREP);
  const all=await p.evaluate(async OTHER=>{
    const t=today(), past=addDays(t,-7);
    // прошлая неделя: жим лёжа 80 закрыт
    recRW(past).log[1]={done:1,n:'Жим лёжа',g:'Грудь',s:'3',r:'6-8',w:'80',rs:[8,8,7],vol:1840,xp:12};
    S.pr['Жим лёжа']=80;
    // сегодня: жим лёжа закрыт через кнопку
    exOpen=null; render(); toggleSet(1); await new Promise(r=>setTimeout(r,120));
    const ton0=dayTon(t), sess0=exSessions('Жим лёжа').length, pr0=prOf('Жим лёжа');
    // шторка: «только сегодня» закрыто, по умолчанию — во всех днях
    openSwap(1,'Жим гантелей лёжа'); await new Promise(r=>setTimeout(r,500));
    const m=[...document.querySelectorAll('#shB [data-swm]')];
    const modes={onceDis:m[0].disabled, allOn:m[1].getAttribute('aria-pressed')};
    document.querySelector('#shB [data-swgo]').click(); await new Promise(r=>setTimeout(r,100));
    const nx=addDays(t,7);
    return {modes, tplToday:S.days[dayIdx(t)].ex[1].n, other:S.days[OTHER].ex[0], next:dayOf(nx).ex[1],
      today:dayOf(t).ex[1].n, todayDone:!!recOf(t).log[1].done, past:dayOf(past).ex[1].n,
      pastEn:(dayEntries(past).find(e=>e.j===1)||{}).n, ton:[ton0,dayTon(t)], sess:[sess0,exSessions('Жим лёжа').length],
      pr:[pr0,prOf('Жим лёжа')], hist:exHistory('Жим лёжа').length};
  },OTHER);
  chk(all.modes.onceDis&&all.modes.allOn==='true','18. закрыто сегодня — «только сегодня» недоступно, выбран «во всех днях»',JSON.stringify(all.modes));
  chk(all.tplToday==='Жим гантелей лёжа'&&all.other.n==='Жим гантелей лёжа'&&all.next.n==='Жим гантелей лёжа'&&all.other.r==='3-5'&&all.other.s===5,
    '19. «во всех днях»: программа везде, подходы и повторы каждого дня свои',JSON.stringify({o:all.other,n:all.next}));
  chk(all.today==='Жим лёжа'&&all.todayDone&&all.past==='Жим лёжа'&&all.pastEn==='Жим лёжа','20. записанные даты остались за жимом лёжа',JSON.stringify(all));
  chk(all.ton[0]===all.ton[1]&&all.sess[0]===all.sess[1]&&all.sess[0]===2&&all.pr[0]===all.pr[1]&&all.hist>=2,'21. тоннаж, рекорд и история жима лёжа не тронуты',JSON.stringify({ton:all.ton,sess:all.sess,pr:all.pr}));

  // 22. свой прошлый результат важнее оценки
  const own=await p.evaluate(()=>{
    const e={n:'Присед со штангой',s:4,r:'4-6',w:100,g:'Ноги'};
    recRW(addDays(today(),-3)).log[0]={done:1,n:'Фронтальный присед',g:'Ноги',s:'3',r:'5',w:'62.5',rs:[5,5,5],vol:937.5};
    S.days.forEach(d=>d.ex.forEach(x=>{ if(x.n==='Фронтальный присед') x.w=0; }));
    entCache=null;
    return swapGuess(e,'Фронтальный присед',libByName('Фронтальный присед'));
  });
  chk(own.w===62.5&&/прошлый раз/.test(own.why),'22. вес на старт — свой прошлый результат',JSON.stringify(own));

  // 23. «Техника» → аналог ведёт в ту же замену, без вопроса и без стирания
  const how=await p.evaluate(async()=>{
    exOpen=0; render();
    openHow('Присед со штангой',0); await new Promise(r=>setTimeout(r,200));
    const alt=document.querySelector('#shB [data-alt]'); if(!alt) return {alt:false};
    const nm=alt.dataset.alt; alt.click(); await new Promise(r=>setTimeout(r,500));
    return {alt:true, nm, title:$('shT').textContent, pick:SW.pick&&SW.pick.o.n, ask:$('ask')?$('ask').classList.contains('on'):false,
      still:dayOf(today()).ex[0].n};
  });
  chk(how.alt&&how.title==='ЗАМЕНА'&&how.pick===how.nm&&!how.ask&&how.still==='Присед со штангой','23. аналог из «Техники» открывает замену с выбранным',JSON.stringify(how));

  // 24. карточка упражнения: «Заменить» ≥ 44 px и не рядом с удалением
  const card=await p.evaluate(()=>{
    sheetClose(); exOpen=0; render();
    const bt=document.querySelector('.exf [data-swap]'); if(!bt) return null;
    const r=bt.getBoundingClientRect(), del=document.querySelector('.exfdel').getBoundingClientRect();
    return {h:Math.round(r.height), w:Math.round(r.width), gap:Math.round(del.top-r.bottom), page:document.documentElement.scrollWidth};
  });
  chk(card&&card.h>=44&&card.w>=44&&card.gap>200&&card.page<=320,'24. «Заменить» в карточке — 44 px, далеко от «Убрать»',JSON.stringify(card));

  // 25. кривая копия: мусор в S.once выбрасывается, приложение живо
  const scr=await p.evaluate(()=>{
    S.once={'bad':{x:1}, '2026-02-30':{}, [today()]:{'Жим лёжа':'строка', '__proto__':{n:'x'}, 'Присед со штангой':{n:''}}, '2026-01-05':[1]};
    scrubKeys(); render();
    return {once:JSON.stringify(S.once||null), n:dayOf(today()).ex[0].n};
  });
  chk((scr.once==='null'||scr.once==='{}')&&scr.n==='Присед со штангой','25. scrubKeys чинит S.once',JSON.stringify(scr));

  chk(errs.length===0,'26. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
