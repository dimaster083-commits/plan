/* Объём программы против её же нормы. Раньше план каждую неделю проваливал
   собственные цифры: плечи 7 из 12, пресс 3 из 9 — и разбор честно ругался
   на человека, который всё сделал. Предупреждение, которое горит всегда,
   перестают замечать. */
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

  const v=await p.evaluate(()=>{
    const acc={}; GROUPS.forEach(([n])=>acc[n]=0);
    TPL.forEach(d=>(d.e||[]).forEach(e=>{ if(acc[e[4]]!==undefined) acc[e[4]]+=e[1]; }));
    const дни=TPL.filter(d=>d.e).map(d=>({k:d.k, упр:d.e.length, подх:d.e.reduce((a,e)=>a+e[1],0)}));
    return {acc, VT:VOL_TARGET, дни, группы:GROUPS.map(g=>g[0])};
  });
  const мало=v.группы.filter(g=>(v.acc[g]||0) < v.VT[g]);
  chk(мало.length===0,'1. программа добирает собственную норму по каждой группе',
      мало.map(g=>g+' '+v.acc[g]+'/'+v.VT[g]).join(', ')||'по всем добирает');
  const ругань=v.группы.filter(g=>(v.acc[g]||0) < v.VT[g]*0.6);
  chk(ругань.length===0,'2. разбор не ругается на человека, выполнившего неделю целиком',
      ругань.join(', ')||'не на что ругаться');

  // нормы должны лежать в рабочем коридоре, а не быть подогнаны вниз
  const коридор={'Спина':[12,20],'Грудь':[12,20],'Плечи':[12,20],'Ноги':[24,40],'Руки':[10,20],'Пресс':[6,12]};
  const вне=v.группы.filter(g=>v.VT[g]<коридор[g][0]||v.VT[g]>коридор[g][1]);
  chk(вне.length===0,'3. нормы лежат в рабочем коридоре подходов',
      вне.map(g=>g+'='+v.VT[g]).join(', ')||'все в коридоре');

  // задняя дельта — была дырой: четыре дня жимов и ни одного движения назад
  const зад=await p.evaluate(()=>{
    const назад=['Махи в наклоне','Тяга каната к лицу','Обратная бабочка'];
    return TPL.filter(d=>d.e).map(d=>({k:d.k, есть:d.e.some(e=>назад.indexOf(e[0])>=0),
      верх:d.t==='up1'||d.t==='up2'}));
  });
  const верхБезЗада=зад.filter(d=>d.верх&&!d.есть).map(d=>d.k);
  chk(верхБезЗада.length===0,'4. на каждом верхнем дне есть работа на заднюю дельту',
      верхБезЗада.join(', ')||'есть везде');

  // пресс не только в один день
  const прессДни=await p.evaluate(()=>TPL.filter(d=>d.e&&d.e.some(e=>e[4]==='Пресс')).map(d=>d.k));
  chk(прессДни.length>=2,'5. пресс стоит не в одном дне',прессДни.join(', '));

  // сессии не раздуты
  const длинные=v.дни.filter(d=>d.подх>30).map(d=>d.k+' '+d.подх);
  chk(длинные.length===0,'6. ни одна тренировка не раздута сверх 30 подходов',
      длинные.join(', ')||v.дни.map(d=>d.k+':'+d.подх).join(' '));

  chk(errs.length===0,'7. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
