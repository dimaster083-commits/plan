/* Шестинедельный цикл: что каждая неделя обещает и что в самом деле
   подставляется в карточку. Интенсивность, число подходов, разгрузка,
   переход недели и вкатывание после перерыва. */
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

  // ставим план на нужную неделю цикла, честно закрывая предыдущие
  const наНеделю = wk => p.evaluate(w=>{
    S.rec={}; S.returning=0;
    const d=new Date(); d.setDate(d.getDate()-(w-1)*7);
    S.start=mondayOf(iso(d));
    // закрываем по четыре тренировки в каждой прошедшей неделе
    for(let i=0;i<(w-1)*7;i++){
      const day=new Date(S.start); day.setDate(day.getDate()+i);
      const ds=iso(day), dd=dayOf(ds);
      if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log={};
      dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),w:num(e.w),rs:[8,8,8],vol:1,xp:1};});
    }
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    return {неделя:planWeek(), вЦикле:cycIdx()+1, фаза:cycOf(today()).ph};
  },wk);

  // 1. шесть недель проходятся по порядку и шестая — разгрузка
  const ряд=[];
  for(let w=1;w<=6;w++){ const r=await наНеделю(w); ряд.push(r.вЦикле+':'+r.фаза); }
  chk(ряд.map(x=>+x.split(':')[0]).join(',')==='1,2,3,4,5,6','1. цикл идёт по порядку недель',ряд.join(' · '));
  chk(/РАЗГРУЗКА/.test(ряд[5]),'2. шестая неделя — разгрузка',ряд[5]);
  chk(!ряд.slice(0,5).some(x=>/РАЗГРУЗКА/.test(x)),'3. до неё разгрузки нет',ряд.slice(0,5).join(' · '));

  // 4-6. вес в карточке равен рабочему × интенсивности недели, по сетке
  const проверка = await p.evaluate(()=>{
    const плохо=[], доли=new Set();
    for(let w=1;w<=6;w++){
      const d=new Date(); d.setDate(d.getDate()-(w-1)*7);
      S.start=mondayOf(iso(d));
      S.days.forEach(day=>{
        if(day.t==='rest') return;
        const IN=intOf(today(), day.t);
        if(IN) доли.add(IN[0]);
        day.ex.forEach(e=>{
          const база=num(e.w); if(!база) return;
          const пок=weightFor(e, IN, today());
          const k=IN?IN[0]:1;
          const g=granOf(база);
          const ждём = k===1 ? база : Math.max(g, Math.round(база*k/g)*g);
          if(пок!==ждём) плохо.push('неделя '+w+' '+e.n+': '+пок+' вместо '+ждём);
          if(пок>база+0.001) плохо.push('неделя '+w+' '+e.n+': выше рабочего '+пок+'>'+база);
        });
      });
    }
    return {плохо:плохо.slice(0,4), доли:[...доли].sort()};
  });
  chk(проверка.плохо.length===0,'4. показанный вес равен рабочему × интенсивность, по сетке',
      проверка.плохо.join('; ')||'везде сходится');
  chk(проверка.доли.join(',')==='0.6,0.8,0.9,1','5. за цикл встречаются все четыре интенсивности',
      проверка.доли.join(', '));

  // 6-7. разгрузочная неделя легче любой другой и подходов на базе меньше
  const разгр = await p.evaluate(()=>{
    const вес=w=>{
      const d=new Date(); d.setDate(d.getDate()-(w-1)*7);
      S.start=mondayOf(iso(d));
      const day=S.days.find(x=>x.t==='lo1');
      const IN=intOf(today(), day.t);
      return {вес:weightFor(day.ex[0], IN, today()), подх:setsOf(today(), num(day.ex[0].s), 0), ds:cycOf(today()).ds};
    };
    return {пик:вес(5), разгрузка:вес(6), первая:вес(1)};
  });
  chk(разгр.разгрузка.вес<разгр.пик.вес,'6. на разгрузке вес ниже, чем на пике',
      разгр.разгрузка.вес+' против '+разгр.пик.вес);
  chk(разгр.разгрузка.подх<разгр.пик.подх,'7. и подходов на базе меньше',
      разгр.разгрузка.подх+' против '+разгр.пик.подх);
  chk(разгр.пик.подх>разгр.первая.подх,'8. на пике подходов больше, чем на первой неделе',
      разгр.пик.подх+' против '+разгр.первая.подх);

  // 9-10. посещаемость не переключает календарную неделю, но остаётся фактом
  const переход = await p.evaluate(()=>{
    S.rec={};
    const d=new Date(); d.setDate(d.getDate()-7);
    S.start=mondayOf(iso(d));
    // закрываем всего две тренировки на прошлой неделе
    let закрыто=0;
    for(let i=0;i<7 && закрыто<2;i++){
      const day=new Date(S.start); day.setDate(day.getDate()+i);
      const ds=iso(day), dd=dayOf(ds);
      if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log={};
      dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),w:num(e.w),rs:[8,8,8],vol:1,xp:1};});
      закрыто++;
    }
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    const было=planWeek();
    // добираем оставшиеся тренировки: фаза от этого не должна поменяться
    for(let i=0;i<7;i++){
      const day=new Date(S.start); day.setDate(day.getDate()+i);
      const ds=iso(day), dd=dayOf(ds);
      if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log=r.log||{};
      dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),w:num(e.w),rs:[8,8,8],vol:1,xp:1};});
    }
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    return {мало:было, норма:planWeek(), закрыто:weekCounts()[mondayOf(S.start)] || 0};
  });
  chk(переход.мало===2&&переход.норма===2,'9. неделя меняется по календарю, а не по числу тренировок',
      'до/после: '+переход.мало+'/'+переход.норма);
  chk(переход.закрыто===4,'10. посещаемость сохраняется отдельно от фазы','закрыто '+переход.закрыто+' из 4');

  // 11-12. вкатывание после перерыва действует только первые недели
  const вкат = await p.evaluate(()=>{
    S.returning=1; S.rec={};
    const выход=[];
    for(let w=1;w<=4;w++){
      const d=new Date(); d.setDate(d.getDate()-(w-1)*7);
      S.start=mondayOf(iso(d));
      // чтобы план дошёл до недели w, закрываем предыдущие
      for(let i=0;i<(w-1)*7;i++){
        const day=new Date(S.start); day.setDate(day.getDate()+i);
        const ds=iso(day), dd=dayOf(ds);
        if(dd.t==='rest') continue;
        const r=recRW(ds); r.wo=1; r.log={};
        dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),w:num(e.w),rs:[8,8,8],vol:1,xp:1};});
      }
      entCache=null; statsDirty=true; save(); recomputeStats(1);
      выход.push(rampOf(today()));
      S.rec={};
    }
    S.returning=0;
    return выход;
  });
  chk(вкат[0]<1&&вкат[1]<1,'11. после перерыва первые недели идут с понижением',вкат.join(', '));
  chk(вкат[2]===1&&вкат[3]===1,'12. дальше вкатывание выключается',вкат.join(', '));

  chk(errs.length===0,'13. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
