/* Откаты и прогрессия, найденные агентом-тестировщиком «Зала».
   Каждая проверка падает на коде до исправления. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
// закрыть упражнение j в дне ds с весом w, повторами rs и графой ПОВТ r
const CLOSE=([ds,j,w,rs,r])=>{ sel=ds; tab='wo'; editPast=ds<today(); exOpen=j; render();
  const c=document.querySelector('.ex[data-j="'+j+'"]');
  c.querySelector('[data-f="w"]').value=String(w).replace('.',',');
  if(r) c.querySelector('[data-f="r"]').value=r;
  c.querySelector('[data-f="s"]').value=String(rs.length);
  c.dispatchEvent(new Event('input',{bubbles:true}));
  [...c.querySelectorAll('[data-rs]')].forEach((x,i)=>{x.value=String(rs[i]||'');});
  toggleSet(j); };
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  await p.evaluate(()=>{S.setup=1;S.sound=0;document.getElementById('setup').classList.remove('on');});
  // два дня с одним упражнением: 7 и 3 дня назад
  const prep=()=>p.evaluate(()=>{ S.rec={}; S.pr={};
    const ds=[7,3].map(k=>{const z=new Date(); z.setDate(z.getDate()-k); return iso(z);});
    ds.forEach(d=>{ const dd=dayOf(d); dd.t='up1'; dd.s='тест'; dd.ex=[{n:'Сгибания ног',s:3,r:'8-10',w:20,g:'Ноги'},
      {n:'Икры стоя',s:3,r:'8-10',w:30,g:'Ноги'},{n:'Подъём ног в висе',s:3,r:'10-15',w:0,g:'Пресс'}]; });
    entCache=null; save(); return ds; });

  // 1-2. снятая отметка старого дня не затирает рекорд и вес, поставленные позже
  let ds=await prep();
  await p.evaluate(CLOSE,[ds[0],0,25,[8,8,8]]);
  await p.evaluate(CLOSE,[ds[1],0,30,[8,8,8]]);
  const r1=await p.evaluate(d=>{ sel=d; tab='wo'; exOpen=0; render(); toggleSet(0);
    return {pr:S.pr['Сгибания ног'], w:S.days.flatMap(x=>x.ex||[]).filter(x=>x.n==='Сгибания ног').map(x=>num(x.w))}; }, ds[0]);
  chk(r1.pr===30,'1. снял старый день — рекорд, поставленный позже, на месте',String(r1.pr));
  chk(r1.w.every(x=>x===30),'2. и рабочий вес, поднятый позже, на месте',JSON.stringify(r1.w));

  // 3. удалили упражнение из дня — откат не пишет вес в чужое упражнение
  ds=await prep();
  const r3=await p.evaluate(([d,C])=>{ const CLOSE=eval('('+C+')');
    CLOSE([d,1,35,[10,10,10],'12-15']);           // икры: 35 кг, цель 12-15
    const day=dayOf(d); day.ex.splice(0,1);           // убрали первое упражнение
    const lg=recOf(d).log; recRW(d).log={0:lg[1]}; entCache=null;
    sel=d; exOpen=0; render(); toggleSet(0);          // сняли отметку с икр
    const ex=dayOf(d).ex; return {calf:[num(ex[0].w),ex[0].r], abs:[num(ex[1].w),ex[1].r]}; }, [ds[1], CLOSE.toString()]);
  chk(r3.calf[0]===30 && r3.calf[1]==='8-10','3. откат вернул икрам 30 кг и 8-10',JSON.stringify(r3.calf));
  chk(r3.abs[0]===0 && r3.abs[1]==='10-15','4. упражнение без веса не получило чужой вес',JSON.stringify(r3.abs));

  // 5. сняли все отметки закрытой тренировки — день больше не тренировка, опыт вернулся
  ds=await prep();
  const r5=await p.evaluate(([d,C])=>{ const CLOSE=eval('('+C+')'); const x0=S.xp;
    CLOSE([d,0,20,[8,8,8]]); sel=d; $('fin').click();
    sel=d; exOpen=0; render(); toggleSet(0);
    return {wo:recOf(d).wo, xp:S.xp-x0}; }, [ds[1], CLOSE.toString()]);
  chk(!r5.wo && r5.xp===0,'5. сняли все отметки — «Завершить» отменено, опыт на месте',JSON.stringify(r5));

  // 6-7. сетка: снижение с 20 при шаге 1 кг — на сетку; прибавка с 13,5 — на сетку
  ds=await prep();
  const r6=await p.evaluate(([ds,C])=>{ const CLOSE=eval('('+C+')');
    CLOSE([ds[0],0,20,[5,5,5]]); CLOSE([ds[1],0,20,[5,5,5]]);
    const down=num(dayOf(ds[1]).ex[0].w);
    dayOf(ds[1]).ex[1].w=13.5; dayOf(ds[1]).ex[1].r='8-10';
    CLOSE([ds[1],1,13.5,[10,10,10]]); const up=num(dayOf(ds[1]).ex[1].w);
    return {down, up}; }, [ds, CLOSE.toString()]);
  chk(r6.down<20 && r6.down>=17 && r6.down===Math.round(r6.down),'6. два провала на 20 кг — снижение на сетку 1 кг (не 17,5)',String(r6.down));
  chk(r6.up===roundUp(r6.up),'7. прибавка с веса вне сетки (13,5) возвращает на сетку',String(r6.up));

  // 8. провал на пробном весе тяжелее рабочего рабочий вес не снижает
  ds=await prep();
  const r8=await p.evaluate(([ds,C])=>{ const CLOSE=eval('('+C+')');
    CLOSE([ds[0],1,50,[4,4,4]]); CLOSE([ds[1],1,50,[4,4,4]]);
    return num(dayOf(ds[1]).ex[1].w); }, [ds, CLOSE.toString()]);
  chk(r8===30,'8. два провала на 50 кг при рабочем 30 — рабочий не снижен',String(r8));

  // 9. закрытый подход не правится на месте (тоннаж и рекорд не расходятся)
  ds=await prep();
  const r9=await p.evaluate(([d,C])=>{ const CLOSE=eval('('+C+')');
    CLOSE([d,0,20,[8,8,8]]); sel=d; editPast=true; exOpen=0; render();
    const f=document.querySelector('.ex[data-j="0"] [data-f="w"]');
    return {ro:f.readOnly, fill:!!document.querySelector('.ex[data-j="0"] [data-fill]')}; }, [ds[1], CLOSE.toString()]);
  chk(r9.ro && !r9.fill,'9. поля закрытого подхода только для чтения, «Все по N» скрыта',JSON.stringify(r9));

  // 10. двойной тап по «Закрыть подход» закрывает, а не закрывает-и-снимает
  ds=await prep();
  const r10=await p.evaluate(d=>{ sel=d; tab='wo'; exOpen=0; render();
    const bt=document.querySelector('#exl [data-go]'); bt.click(); document.querySelector('#exl [data-go]').click();
    return !!(recOf(d).log[0]||{}).done; }, ds[1]);
  chk(r10,'10. двойной тап — подход закрыт',String(r10));
  chk(errs.length===0,'11. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
function roundUp(w){ const g=w>=20?2.5:1; return Math.round(w/g)*g; }
