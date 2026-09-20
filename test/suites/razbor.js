/* Разбор говорит числами: «за 14 дней закрыто 4 из 8», «недобор
   подходов: Плечи 7/12», «вес не растёт три тренировки подряд».
   Каждое такое утверждение пересчитываю сам и сверяю. */
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
  await p.goto(APP); await p.waitForTimeout(1400);

  const seed=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    S.setup=1; document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60}; S.bw='75'; S.bw0='70'; S.goal='95'; S.height=177; S.age=30;
    deriveWeights();
    const st=new Date(); st.setDate(st.getDate()-28); S.start=iso(st);
    // закрываем часть тренировок за последние 14 дней
    let done14=0, planned14=0;
    for(let k=13;k>=0;k--){
      const d=new Date(); d.setDate(d.getDate()-k);
      const ds=iso(d), day=dayOf(ds);
      if(!day||day.t==='rest') continue;
      planned14++;
      if(k%3===0){ const r=recRW(ds); r.wo=1;
        (day.ex||[]).forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,
          rs:new Array(num(e.s)||3).fill('8'),vol:(num(e.s)||3)*8*num(e.w),xp:12}; });
        done14++; }
    }
    // вес отмечали 8 дней назад
    const wd=new Date(); wd.setDate(wd.getDate()-8); recRW(iso(wd)).bw='74.6';
    save(); recomputeStats(1); entCache=null;
    return { planned14, done14 };
  });

  const txt=await p.evaluate(async ()=>{ openAnalysis(); await new Promise(r=>setTimeout(r,250));
    const t=document.getElementById('sh').innerText; return t; });

  // 1. посещаемость: числа в тексте совпадают с журналом
  const att=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    let done=0, planned=0;
    for(let k=13;k>=0;k--){
      const d=new Date(); d.setDate(d.getDate()-k);
      const ds=iso(d), day=dayOf(ds);
      if(!day||day.t==='rest') continue;
      planned++; if((S.rec[ds]||{}).wo) done++;
    }
    return { done, planned };
  });
  const mAtt=txt.match(/За 14 дней закрыто\s+(\d+)\s+из\s+(\d+)/);
  chk(mAtt && +mAtt[1]===att.done && +mAtt[2]===att.planned,
      '1. посещаемость за 14 дней совпадает с журналом',
      mAtt?('в разборе '+mAtt[1]+'/'+mAtt[2]+', по журналу '+att.done+'/'+att.planned):'строки нет');

  // 2. недобор подходов: пары «группа сделано/норма» совпадают с vol7()
  const vol=await p.evaluate(()=>{ const a=vol7(); const o={}; GROUPS.forEach(([n])=>o[n]=a[n]||0); return o; });
  const targets=await p.evaluate(()=>VOL_TARGET);
  const pairs=[...txt.matchAll(/([А-Яа-яЁё]+)\s+(\d+)\/(\d+)/g)]
    .filter(m=>targets[m[1]]!==undefined);
  const wrong=pairs.filter(m=>+m[2]!==vol[m[1]]||+m[3]!==targets[m[1]]);
  chk(pairs.length>0 && wrong.length===0, '2. подходы по группам в разборе равны недельному счёту',
      pairs.length?('пар '+pairs.length+', расходится '+wrong.length+(wrong.length?': '+wrong[0][0]:'')):'пар нет');

  // 3. давность взвешивания
  const stale=await p.evaluate(()=>{
    const ws=Object.keys(S.rec).filter(d=>num(S.rec[d].bw)).sort();
    if(!ws.length) return null;
    const last=ws[ws.length-1];
    return Math.round((new Date(today()+'T00:00:00')-new Date(last+'T00:00:00'))/864e5);
  });
  const mSt=txt.match(/Последнее измерение\s+(\d+)\s+дн/);
  chk(!stale || (mSt && Math.abs(+mSt[1]-stale)<=1),
      '3. давность взвешивания посчитана верно',
      mSt?('в разборе '+mSt[1]+', по журналу '+stale):'строки нет (вес свежий)');

  // 4. в разборе нет пустых чисел и мусора
  chk(!/NaN|undefined|Infinity|null/.test(txt), '4. в разборе нет NaN и undefined');

  // 5. у каждого замечания есть задача
  const cards=await p.evaluate(()=>{
    const list=[...document.querySelectorAll('#sh .sysmsg')];
    const noTask=list.filter(c=>!c.classList.contains('ok')&&!c.querySelector('.systask'));
    return { total:list.length, noTask:noTask.length,
             bad:list.filter(c=>!c.classList.contains('ok')).length };
  });
  chk(cards.noTask===0, '5. у каждого замечания написано, что делать',
      'карточек '+cards.total+', без задачи '+cards.noTask);

  // 6. счётчик замечаний совпадает с числом карточек
  const mCnt=txt.match(/Замечаний:\s*(\d+)/);
  chk(mCnt && +mCnt[1]===cards.bad, '6. счётчик замечаний равен числу карточек-замечаний',
      mCnt?('счётчик '+mCnt[1]+', карточек '+cards.bad+' из '+cards.total):'нет счётчика');

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
