/* План недели: переставить дни, сдвинуть тренировку, поставить неделю на
   паузу. До этой правки неделю переиграть было нечем: перенос жил по одной
   дате в скрытой панели, болезнь рвала серию, а чипы дней после переноса
   уезжали на чужие даты. */
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

  // чистое состояние: шаблон вт/чт/сб/вс, журнал пуст, выбран понедельник следующей недели
  const сброс=()=>p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.map={}; delete S.pause; S.days=build().days;
    const nx=addDays(mondayOf(today()),7);
    sel=nx; tab='wo'; save(); render();
    return nx;
  });
  const mon=await сброс();
  const [tue,wed,thu,sat,sun]=await p.evaluate(m=>[1,2,3,5,6].map(k=>addDays(m,k)),mon);
  const шаблон=await p.evaluate(()=>build().days.map(d=>d.t).join(','));

  // 1. кнопка «Неделя» есть, 44 px, шторка — семь дней и влезает в 320
  const шт=await p.evaluate(()=>{
    const bt=document.getElementById('wkPlan');
    if(!bt) return null;
    const r=bt.getBoundingClientRect(); bt.click();
    const rows=[...document.querySelectorAll('#shB [data-wpd]')];
    const bs=[...document.querySelectorAll('#shB button')];
    return {h:Math.round(r.height), w:Math.round(r.width), дней:rows.length, заголовок:$('shT').textContent,
      экран:document.documentElement.scrollWidth, шторка:$('shB').scrollWidth-$('shB').clientWidth,
      мин:Math.min(...bs.map(x=>Math.round(x.getBoundingClientRect().height)))};
  });
  chk(шт&&шт.h>=44&&шт.w>=44&&шт.дней===7&&шт.заголовок==='НЕДЕЛЯ'&&шт.экран<=320&&шт.шторка<=0&&шт.мин>=44,
    '1. «Неделя»: кнопка 44 px, семь дней, влезает в 320', JSON.stringify(шт));

  // 2. тап по вторнику, тап по понедельнику — поменялись только на этой неделе
  const обмен=await p.evaluate(([mon,tue])=>{
    const q=d=>document.querySelector(`#shB [data-wpd="${d}"]`);
    if(!q(tue)) return null;
    q(tue).click(); q(mon).click();
    const nx=addDays(mon,7);
    return {пн:dayOf(mon).t, вт:dayOf(tue).t, пнДальше:dayOf(nx).t, втДальше:dayOf(addDays(nx,1)).t,
      шаблон:S.days.map(d=>d.t).join(',')};
  },[mon,tue]);
  chk(обмен&&обмен.пн==='up1'&&обмен.вт==='rest'&&обмен.пнДальше==='rest'&&обмен.втДальше==='up1'&&обмен.шаблон===шаблон,
    '2. тап-тап меняет два дня только этой недели', JSON.stringify(обмен));

  // 3. чипы после переноса стоят на своих датах, цвет — от тренировки даты
  const чипы=await p.evaluate(([mon,tue])=>{
    sel=tue; render();
    const cs=[...document.querySelectorAll('#chips .chip')];
    return {даты:cs.map(c=>c.dataset.d), вкл:cs.filter(c=>c.classList.contains('on')).map(c=>c.dataset.d),
      цветПн:cs[0].querySelector('u').style.background, имя:$('dnm').value};
  },[mon,tue]);
  const надо=await p.evaluate(m=>[0,1,2,3,4,5,6].map(k=>addDays(m,k)),mon);
  chk(JSON.stringify(чипы.даты)===JSON.stringify(надо)&&чипы.вкл.length===1&&чипы.вкл[0]===tue&&/up1/.test(чипы.цветПн)&&чипы.имя==='Вторник',
    '3. чипы — на своих датах, цвет по тренировке, имя дня по дате', JSON.stringify(чипы));

  // 4. «сдвинуть на день»: тренировка четверга уезжает на пятницу, отдых пятницы — сдвигается и гасит цепочку
  const сдвиг=await p.evaluate(([thu])=>{
    wkMode='this'; openWeekPlan(thu);
    const bt=document.querySelector('#shB [data-wppush]');
    if(!bt) return null;
    const was=dayOf(addDays(thu,2)).t;
    bt.click();
    return {кнопка:bt.dataset.wppush, чт:dayOf(thu).t, пт:dayOf(addDays(thu,1)).t, сб:dayOf(addDays(thu,2)).t, сбБыло:was};
  },[thu]);
  chk(сдвиг&&сдвиг.кнопка===thu&&сдвиг.чт==='rest'&&сдвиг.пт==='lo1'&&сдвиг.сб===сдвиг.сбБыло,
    '4. «Не могу — сдвинуть на день» переносит на завтра, дальше отдых гасит цепочку', JSON.stringify(сдвиг));

  // 5. цепочка без отдыха до воскресенья: последняя тренировка честно названа потерянной
  const хвост=await p.evaluate(([sat])=>{
    const r=pushDay(sat); save(); render();
    return {сб:dayOf(sat).t, вс:dayOf(addDays(sat,1)).t, потеряна:r&&r.lost?r.lost.t:null};
  },[sat]);
  chk(хвост.сб==='rest'&&хвост.вс==='up2'&&хвост.потеряна==='lo2',
    '5. сдвиг субботы: воскресенье получает субботнюю, воскресная названа выпавшей', JSON.stringify(хвост));

  // 6. записанный день не двигается ни тапом, ни сдвигом
  await сброс();
  const замок=await p.evaluate(([tue,wed])=>{
    S.rec[tue]={wo:0,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'60',s:'3',r:'6',rs:[6,6,6]}},sp:{}};
    save(); wkMode='this'; openWeekPlan(tue);
    const row=document.querySelector(`#shB [data-wpd="${tue}"]`);
    const sw=swapDates(tue,wed), ps=pushDay(tue);
    return {выкл:row.disabled, обмен:sw, сдвиг:ps, вт:dayOf(tue).t, жим:dayEntries(tue).map(e=>e.n).join(',')};
  },[tue,wed]);
  chk(замок.выкл&&замок.обмен===false&&замок.сдвиг===null&&замок.вт==='up1'&&замок.жим==='Жим лёжа',
    '6. день с записанными подходами не двигается', JSON.stringify(замок));

  // 7. «каждую неделю»: шаблон меняется, прошлые тренировки остаются своими
  await сброс();
  const шабл=await p.evaluate(()=>{
    const prevTue=addDays(mondayOf(today()),-6), nx=addDays(mondayOf(today()),14);
    S.rec[prevTue]={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'60',s:'3',r:'6',rs:[6,6,6]}},sp:{}};
    save(); wkMode='all'; openWeekPlan(sel);
    const q=k=>document.querySelector(`#shB [data-wpd="${k}"]`);
    if(!q(0)) return null;
    q(1).click(); q(0).click();
    return {прошлыйВт:dayLook(prevTue).t, запись:dayEntries(prevTue).map(e=>e.n).join(','),
      пн:dayOf(nx).t, вт:dayOf(addDays(nx,1)).t, имя0:S.days[0].n, имя1:S.days[1].n, ключ0:S.days[0].k};
  });
  chk(шабл&&шабл.прошлыйВт==='up1'&&шабл.запись==='Жим лёжа'&&шабл.пн==='up1'&&шабл.вт==='rest'&&шабл.имя0==='Понедельник'&&шабл.имя1==='Вторник'&&шабл.ключ0==='Пн',
    '7. «Каждую неделю» меняет шаблон, прошлый вторник остаётся жимом', JSON.stringify(шабл));

  // 8. пауза недели: серия перешагивает неделю болезни, посещаемость не считает пропуском
  await сброс();
  const пауза=await p.evaluate(()=>{
    const m0=mondayOf(today()), w1=addDays(m0,-7), w2=addDays(m0,-14), w3=addDays(m0,-21);
    [w2,w3].forEach(w=>[1,3,5].forEach(k=>{ S.rec[addDays(w,k)]={wo:1,log:{},sp:{}}; }));
    save();
    const до=streak();
    wkMode='this'; openWeekPlan(w1);
    const bt=document.querySelector('#shB [data-wppause]');
    if(!bt) return {до};
    bt.click();
    return {до, после:streak(), ключ:Object.keys(S.pause||{}).join(','), w1};
  });
  chk(пауза.после===2&&пауза.до===0&&пауза.ключ===пауза.w1,
    '8. «Болею — пауза недели»: серия 2 недели, неделя болезни не рвёт', JSON.stringify(пауза));

  // 9. пауза на этой неделе: день без «жду тренировку», чип приглушён, посещаемость без пропусков
  const сейчас=await p.evaluate(()=>{
    const m0=mondayOf(today()); S.pause={}; S.pause[m0]=1;
    // тренировочный день этой недели
    let d=m0; for(let k=0;k<7;k++){ const x=addDays(m0,k); if(dayOf(x).t!=='rest'){ d=x; break; } }
    sel=d; save(); render();
    const chip=document.querySelector(`#chips [data-d="${d}"]`);
    return {pen:$('qPen').textContent, pz:chip.classList.contains('pz'), знак:$('bdg-wo').hidden};
  });
  chk(/пауз/i.test(сейчас.pen)&&сейчас.pz&&сейчас.знак,
    '9. день недели на паузе: подпись паузы, чип приглушён, точки «не закрыто» нет', JSON.stringify(сейчас));

  // 10. пауза переживает перезагрузку, мусор в ней вычищается
  await p.evaluate(()=>{ const m0=mondayOf(today()); S.pause={'x':1}; S.pause[m0]=1; S.pause[addDays(m0,1)]=1; S.pause[addDays(m0,-7)]='да'; flush(); });
  await p.reload(); await p.waitForTimeout(1300);
  const жив=await p.evaluate(()=>({ключи:Object.keys(S.pause||{}), m0:mondayOf(today()), серия:typeof streak()}));
  chk(жив.ключи.length===1&&жив.ключи[0]===жив.m0&&жив.серия==='number',
    '10. пауза переживает перезагрузку, мусорные ключи вычищены', JSON.stringify(жив));

  // 11. «вернуть неделю как в программе» снимает переносы будущих дней
  const назад=await p.evaluate(()=>{
    S.setup=1; document.getElementById('setup').classList.remove('on');
    const nx=addDays(mondayOf(today()),7); S.map={}; delete S.pause;
    swapDates(nx,addDays(nx,1)); save();
    wkMode='this'; openWeekPlan(nx);
    const bt=document.querySelector('#shB [data-wpreset]');
    if(!bt) return null;
    bt.click();
    return {карта:JSON.stringify(S.map), пн:dayOf(nx).t, вт:dayOf(addDays(nx,1)).t};
  });
  chk(назад&&назад.карта==='{}'&&назад.пн==='rest'&&назад.вт==='up1',
    '11. «Вернуть неделю как в программе» снимает переносы', JSON.stringify(назад));

  chk(errs.length===0,'12. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
