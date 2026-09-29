/* Отмена случайных действий. Хозяин нажал «Начать тренировку» мимо и не
   смог вернуть: часы тикали, убрать их было нечем, кроме как закрыть пустую
   тренировку. До этой правки ни «Начать», ни «Завершить», ни «Пропуск»,
   ни удаления, ни перестановки недели отменить было нельзя. Теперь после
   действия внизу полоска «Отменить», и она возвращает состояние целиком —
   тем же JSON, что был до нажатия: опыт, рекорды, журнал откатов, веса. */
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
  // на старом коде нужных элементов нет — evaluate бросает; ловим, чтобы проверка упала, а не набор
  const E=async(fn,arg)=>{ try{ return await p.evaluate(fn,arg); }catch(e){ return {err:String(e.message).slice(0,160)}; } };
  const J=x=>JSON.stringify(x);
  const yes=async()=>{ await p.waitForTimeout(120); await E(()=>{ const a=document.getElementById('ask'); if(a.classList.contains('on')) document.getElementById('askY').click(); }); await p.waitForTimeout(250); };
  // нажать «Отменить» и сравнить состояние с запомненным до действия
  const undo=async()=>{ await E(()=>{ const u=document.getElementById('undoB'); if(u) u.click(); }); await p.waitForTimeout(350);
    return E(()=>({same:JSON.stringify(S)===window.__b, polo:!document.getElementById('undo').hidden})); };
  const polo=()=>E(()=>{ const u=document.getElementById('undo');
    return {on:!!u&&!u.hidden, t:u?document.getElementById('undoT').textContent:''}; });
  const remember=()=>E(()=>{ window.__b=JSON.stringify(S); return S.xp; });

  const prep=()=>E(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.pr={}; S.map={}; delete S.pause; S.days=build().days; S.xp=500; S.meas={}; S.tpl=[];
    const d=dayOf(today()); d.t='lo1'; d.s='тест';
    d.ex=[{n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'},{n:'Сгибания ног',s:3,r:'10-12',w:40,g:'Ноги'}];
    d.sp=[{n:'Креатин',h:'',w:''},{n:'Омега',h:'',w:''}];
    entCache=null; tab='wo'; sel=today(); exOpen=null; editPast=false;
    if(typeof undoDrop==='function') undoDrop();
    document.querySelectorAll('.sheet.on,#sh.on').forEach(e=>e.classList.remove('on'));
    save(); flush(); render();
  });

  // 1. «Начать тренировку» — полоска «Отменить»: 44 px, в 320, не на кнопке и не на вкладках; отмена — как не нажимал
  await prep(); await remember();
  await p.click('#fin'); await p.waitForTimeout(300);
  const t1=await E(()=>{
    const u=document.getElementById('undo'), bt=document.getElementById('undoB');
    const ub=u.getBoundingClientRect(), bb=bt.getBoundingClientRect();
    const fb=document.getElementById('fin').getBoundingClientRect(), tb=document.querySelector('.tabbar').getBoundingClientRect();
    const cross=(a,c)=>a.bottom>c.top+1&&a.top<c.bottom-1;
    return {on:!u.hidden, t0:!!recOf(today()).t0, h:Math.round(bb.height), w:Math.round(bb.width), l:ub.left, r:ub.right,
      наКнопке:cross(ub,fb), наВкладках:cross(ub,tb), экран:document.documentElement.scrollWidth, текст:document.getElementById('undoT').textContent};
  });
  chk(t1.on&&t1.t0&&t1.h>=44&&t1.w>=44&&t1.l>=0&&t1.r<=320&&!t1.наКнопке&&!t1.наВкладках&&t1.экран<=320,
    '1. после «Начать» — полоска «Отменить» 44 px, влезает в 320, не закрывает кнопку и вкладки', J(t1));
  // настоящий тап пальцем: полоску ничто не перекрывает
  await p.click('#undoB',{timeout:3000}).catch(()=>{}); await p.waitForTimeout(350);
  const t1b=await E(()=>({same:JSON.stringify(S)===window.__b, t0:!!recOf(today()).t0, fin:document.getElementById('fin').textContent, polo:!document.getElementById('undo').hidden, int:woInt}));
  chk(t1b.same&&!t1b.t0&&/Начать/.test(t1b.fin)&&!t1b.polo&&t1b.int===null,
    '1б. «Отменить» возвращает состояние до нажатия, часы стоят', J(t1b));

  // 2. «Отменить начало» есть всегда, пока тренировка начата и пуста
  await prep(); await remember();
  await p.click('#fin'); await p.waitForTimeout(200);
  await E(()=>{ if(typeof undoDrop==='function') undoDrop(); });
  const t2=await E(()=>{ const c=document.getElementById('woCx'); if(!c) return {нет:1};
    const r=c.getBoundingClientRect(); return {видна:!c.hidden&&r.height>0, h:Math.round(r.height), right:r.right}; });
  await E(()=>document.getElementById('woCx')&&document.getElementById('woCx').click()); await p.waitForTimeout(300);
  const t2b=await E(()=>({rec:S.rec[today()]===undefined, same:JSON.stringify(S)===window.__b, fin:document.getElementById('fin').textContent,
    скрыта:document.getElementById('woCx').hidden, polo:!document.getElementById('undo').hidden}));
  chk(t2.видна&&t2.h>=44&&t2.right<=320&&t2b.rec&&t2b.same&&/Начать/.test(t2b.fin)&&t2b.скрыта&&t2b.polo,
    '2. «Отменить начало» у пустой начатой тренировки: часы сняты, запись дня ушла', J([t2,t2b]));
  const t2c=await E(()=>{ document.getElementById('fin').click(); toggleSet(0); render();
    return {скрыта:document.getElementById('woCx').hidden, t0:!!recOf(today()).t0}; });
  chk(t2c.скрыта&&t2c.t0, '2б. после первого закрытого подхода «Отменить начало» не показывается', J(t2c));

  // 3. «Завершить»: отмена возвращает опыт, итоги закрываются, тренировка снова идёт
  await prep();
  await E(()=>{ document.getElementById('fin').click(); toggleSet(0); toggleSet(1); render(); if(typeof undoDrop==='function') undoDrop(); });
  const xp3=await remember();
  await E(()=>document.getElementById('fin').click()); await p.waitForTimeout(300);
  const t3=await E(()=>({wo:!!recOf(today()).wo, xp:S.xp, sheet:document.getElementById('sh').classList.contains('on')}));
  const p3=await polo(); const u3=await undo();
  const t3b=await E(()=>({wo:!!recOf(today()).wo, xp:S.xp, sheet:document.getElementById('sh').classList.contains('on'), fin:document.getElementById('fin').textContent}));
  chk(t3.wo&&t3.xp>xp3&&p3.on&&u3.same&&!t3b.wo&&t3b.xp===xp3&&!t3b.sheet&&/Завершить/.test(t3b.fin),
    '3. закрытие тренировки отменяется: опыт назад, итоги закрыты, часы идут', J([t3,p3,u3,t3b]));

  // 4. «Пропуск»
  await prep(); await remember();
  await E(()=>document.getElementById('skipDay').click()); await p.waitForTimeout(250);
  const p4=await polo(); const u4=await undo(); const s4=await E(()=>!!recOf(today()).skip);
  chk(p4.on&&u4.same&&!s4, '4. «Пропуск» отменяется', J([p4,u4]));

  // 5. «СБРОС ДНЯ»: вес, рекорд, опыт и журнал откатов приходят ровно прежними
  await prep();
  await E(()=>{ document.getElementById('fin').click(); toggleSet(0); toggleSet(1); render(); if(typeof undoDrop==='function') undoDrop(); });
  const xp5=await remember();
  await E(()=>document.getElementById('rd').click()); await yes();
  const t5=await E(()=>({log:Object.keys(recOf(today()).log||{}).length, xp:S.xp}));
  const p5=await polo(); const u5=await undo();
  const t5b=await E(()=>({done:Object.values(recOf(today()).log||{}).filter(l=>l.done).length, xp:S.xp}));
  chk(t5.log===0&&t5.xp<xp5&&p5.on&&u5.same&&t5b.done===2&&t5b.xp===xp5,
    '5. «Сброс дня» отменяется: подходы, опыт, веса и рекорды — байт в байт', J([t5,p5,u5,t5b]));

  // 6. «Убрать упражнение» вместе со стиранием прошлых записей — одна отмена возвращает всё
  await prep();
  await E(()=>{ const past=addDays(today(),-7);
    S.rec[past]={wo:1,log:{0:{done:1,n:'Жим ногами',g:'Ноги',w:'100',s:'3',r:'8-10',rs:[8,8,8]}},sp:{}};
    toggleSet(0); exOpen=0; save(); render(); if(typeof undoDrop==='function') undoDrop(); });
  await remember();
  await E(()=>document.querySelector('[data-del="0"]').click()); await yes(); await yes();
  const t6=await E(()=>({ex:dayOf(today()).ex.map(e=>e.n).join(','), past:exHistory('Жим ногами').length}));
  const p6=await polo();
  const s6=await E(()=>{ const u=document.getElementById('undo').getBoundingClientRect(); return {r:u.right, экран:document.documentElement.scrollWidth}; });
  const u6=await undo();
  chk(t6.ex==='Сгибания ног'&&t6.past===0&&p6.on&&s6.r<=320&&s6.экран<=320&&u6.same,
    '6. удаление упражнения и стирание его записей отменяются одной кнопкой', J([t6,p6,s6,u6]));

  // 7. добавки: «Убрать» и «Принял всё»
  await prep(); await E(()=>{ tab='food'; render(); }); await remember();
  await E(()=>document.querySelector('#spl [data-spd="0"]').click()); await yes();
  const p7=await polo(); const u7=await undo();
  const t7=await E(()=>dayOf(today()).sp.map(x=>x.n).join(','));
  await remember();
  await E(()=>document.getElementById('spAll').click()); await p.waitForTimeout(200);
  const p7b=await polo(); const u7b=await undo();
  chk(p7.on&&u7.same&&t7==='Креатин,Омега'&&p7b.on&&u7b.same,
    '7. удаление добавки и «Принял всё» отменяются (опыт тоже)', J([p7,u7,t7,p7b,u7b]));

  // 8. еда: продукт и приём пищи
  await prep();
  await E(()=>{ recRW(today()).ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка',g:80},{p:'Банан',g:120}]},{n:'Обед',note:'',items:[]}];
    tab='food'; save(); render(); });
  await remember();
  await E(()=>document.querySelector('#mll [data-rm="0"]').click()); await p.waitForTimeout(200);
  const p8=await polo(); const u8=await undo();
  await remember();
  await E(()=>document.querySelector('#mll [data-mld="0"]').click()); await yes();
  const t8=await E(()=>mealsOf(today()).map(m=>m.n).join(','));
  const p8b=await polo(); const u8b=await undo();
  chk(p8.on&&u8.same&&t8==='Обед'&&p8b.on&&u8b.same, '8. удаление продукта и приёма пищи отменяется', J([p8,u8,t8,p8b,u8b]));

  // 9. фото: снимок из IndexedDB возвращается
  await prep();
  const IMG='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  await E(async img=>{ await phPut(today(), img); PHCACHE.clear(); await phSync(); tab='photo'; sel=today(); render(); }, IMG);
  await p.waitForTimeout(400);
  await E(()=>document.getElementById('phDel').click()); await yes(); await p.waitForTimeout(300);
  const t9=await E(async()=>({gone:!(await phGet(today())), n:PH.length}));
  const p9=await polo();
  await E(()=>{ const u=document.getElementById('undoB'); if(u) u.click(); }); await p.waitForTimeout(500);
  const t9b=await E(async img=>({back:(await phGet(today()))===img, n:PH.length}), IMG);
  chk(t9.gone&&p9.on&&t9b.back&&t9b.n===1, '9. удалённое фото возвращается отменой', J([t9,p9,t9b]));
  await E(async()=>{ await phDelete(today()); PHCACHE.clear(); await phSync(); });

  // 10. замеры: стереть сегодняшние и перезаписать — оба отменяются
  await prep();
  await E(()=>{ S.meas={}; S.meas[addDays(today(),-20)]={waist:84}; S.meas[today()]={waist:80}; save(); tab='prog'; render(); openMeas(); });
  await remember();
  const has10=await E(()=>!!document.querySelector('#shB [data-measdel]'));
  await E(()=>{ const b2=document.querySelector('#shB [data-measdel]'); if(b2) b2.click(); }); await p.waitForTimeout(200);
  const t10=await E(()=>measAll()[today()]===undefined);
  const p10=await polo(); const u10=await undo();
  await E(()=>{ openMeas(); const i=document.querySelector('#shB [data-mk="waist"]'); i.value='70'; document.querySelector('#shB [data-measave]').click(); });
  await p.waitForTimeout(200);
  const p10b=await polo(); const u10b=await undo(); const w10=await E(()=>measAll()[today()].waist);
  chk(has10&&t10&&p10.on&&u10.same&&p10b.on&&u10b.same&&w10===80, '10. стёртый и перезаписанный замер возвращается', J([has10,t10,p10,u10,p10b,u10b,w10]));

  // 11. смена типа дня во всех неделях
  await prep();
  await E(()=>{ const past=addDays(today(),-7); S.rec[past]={wo:1,log:{0:{done:1,n:'Жим ногами',g:'Ноги',w:'100',s:'3',r:'8-10',rs:[8,8,8]}},sp:{}}; save(); render(); });
  await remember();
  await E(()=>{ wkMode='all'; openWeekPlan(sel); wkPick=wdOf(sel); openWeekPlan(); document.querySelector('#shB [data-wpt="up1"]').click(); }); await yes();
  const t11=await E(()=>({t:dayOf(today()).t, dt:(S.rec[addDays(today(),-7)]||{}).dt}));
  const p11=await polo(); const u11=await undo();
  chk(t11.t==='up1'&&t11.dt==='lo1'&&p11.on&&u11.same, '11. смена типа дня во всех неделях отменяется вместе с закреплением прошлого', J([t11,p11,u11]));

  // 12. шторка «Неделя»: обмен дат, шаблон, сдвиг, пауза, «вернуть как в программе»
  await prep();
  const w12=await E(()=>{
    const nx=addDays(mondayOf(today()),7); sel=nx; render();
    const R={};
    const shOn=()=>document.getElementById('sh').classList.contains('on')&&document.getElementById('shT').textContent==='НЕДЕЛЯ';
    const step=(name,act)=>{ window.__b=JSON.stringify(S); act();
      const on=!document.getElementById('undo').hidden;
      const changed=JSON.stringify(S)!==window.__b;
      return new Promise(res=>setTimeout(async()=>{ document.getElementById('undoB').click();
        await new Promise(r=>setTimeout(r,250));
        R[name]={on, changed, same:JSON.stringify(S)===window.__b, sheet:shOn()}; res(); },30)); };
    const q=k=>document.querySelector(`#shB [data-wpd="${k}"]`);
    return (async()=>{
      await step('даты',()=>{ wkMode='this'; openWeekPlan(nx); q(addDays(nx,1)).click(); q(nx).click(); });
      await step('шаблон',()=>{ wkMode='all'; openWeekPlan(nx); q(1).click(); q(0).click(); });
      await step('сдвиг',()=>{ wkMode='this'; openWeekPlan(addDays(nx,1)); document.querySelector('#shB [data-wppush]').click(); });
      await step('пауза',()=>{ wkMode='this'; openWeekPlan(nx); document.querySelector('#shB [data-wppause]').click(); });
      swapDates(nx,addDays(nx,1)); save();
      await step('сброс',()=>{ wkMode='this'; openWeekPlan(nx); document.querySelector('#shB [data-wpreset]').click(); });
      return R;
    })();
  });
  const ok12=w12&&!w12.err&&['даты','шаблон','сдвиг','пауза','сброс'].every(k=>w12[k]&&w12[k].on&&w12[k].changed&&w12[k].same&&w12[k].sheet);
  chk(ok12, '12. «Неделя»: обмен, шаблон, сдвиг, пауза и сброс отменяются, шторка открыта заново', J(w12));

  // 13. упражнение из каталога
  await prep();
  const t13=await E(async()=>{ await loadLib(); const o=LIB.list.find(x=>!EXDB[x.n]); window.__b=JSON.stringify(S);
    libAdd(o.id, today()); await new Promise(r=>setTimeout(r,200));
    return {n:o.n, в_дне:dayOf(today()).ex.some(e=>e.n===o.n), свои:!!(S.myEx||{})[o.n]}; });
  const p13=await polo(); const u13=await undo();
  const t13b=await E(n=>({в_дне:dayOf(today()).ex.some(e=>e.n===n), свои:!!(S.myEx||{})[n]}), t13.n);
  chk(t13.в_дне&&t13.свои&&p13.on&&u13.same&&!t13b.в_дне&&!t13b.свои, '13. добавленное из каталога убирается отменой вместе с записью в своих', J([t13,p13,u13,t13b]));

  // 14. «Все по N» — клетки возвращаются как были
  await prep();
  const t14=await E(()=>{ exOpen=0; render();
    const box=document.querySelector('.ex[data-j="0"] .setr'), cells=[...box.querySelectorAll('[data-rs]')];
    cells[0].value='3'; cells[0].dispatchEvent(new Event('input',{bubbles:true}));
    const was=cells.map(c=>c.value);
    box.querySelector('[data-fill]').click();
    const filled=cells.map(c=>c.value);
    const on=!document.getElementById('undo').hidden;
    document.getElementById('undoB').click();
    return {was, filled, back:cells.map(c=>c.value), on}; });
  chk(t14&&!t14.err&&t14.on&&t14.filled.every(v=>v==='10')&&J(t14.back)===J(t14.was)&&t14.was[0]==='3',
    '14. «Все по N» отменяется: набранные руками клетки на месте', J(t14));

  // 15. записал что-то после — полоска гаснет, отмена не сотрёт новое
  await prep();
  await E(()=>document.getElementById('skipDay').click()); await p.waitForTimeout(120);
  await E(()=>{ const i=document.getElementById('dnm'); i.value='Мой день'; i.dispatchEvent(new Event('input',{bubbles:true})); });
  const p15=await polo(); const n15=await E(()=>dayOf(today()).n);
  chk(p15.err===undefined&&!p15.on&&n15==='Мой день'&&(await E(()=>typeof undoRec!=='undefined'&&undoRec===null))===true,
    '15. новая запись после действия гасит «Отменить» — написанное не пропадёт', J([p15,n15]));

  // 16. полоска уходит сама через несколько секунд
  await prep(); await p.waitForTimeout(300);        // «Пропуск» защищён от двойного тапа
  await E(()=>document.getElementById('skipDay').click()); await p.waitForTimeout(300);
  const a16=await polo(); await p.waitForTimeout(7600); const b16=await polo();
  chk(a16.on&&!b16.on, '16. «Отменить» висит несколько секунд и уходит сам', J([a16,b16]));

  // 17. отмена переживает перезагрузку
  await prep();
  await E(()=>document.getElementById('fin').click()); await p.waitForTimeout(200);
  await undo(); await p.reload(); await p.waitForTimeout(1300);
  const t17=await E(()=>({t0:!!recOf(today()).t0, rec:S.rec[today()]===undefined}));
  chk(!t17.t0&&t17.rec, '17. отменённое начало не возвращается после перезагрузки', J(t17));

  // 18. «Начать заново» по-прежнему спрашивает: это отменить нечем
  const t18=await E(()=>{ tab='photo'; render(); document.getElementById('wipe').click();
    return new Promise(r=>setTimeout(()=>{ const on=document.getElementById('ask').classList.contains('on');
      document.getElementById('askN').click(); r({спросил:on, данные:!!S&&!!S.days.length}); },150)); });
  chk(t18.спросил&&t18.данные, '18. стирание всего по-прежнему идёт через вопрос', J(t18));

  chk(errs.length===0,'19. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
