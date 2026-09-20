/* Правка дня: добавить упражнение из каталога, убрать, сдвинуть
   отметки следом, не потерять и не приписать лишнего тоннажа. */
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
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60};S.sound=0;
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    save();recomputeStats(1);tab='wo';sel=today();exOpen=null;edit=false;render();});
  await p.waitForTimeout(300);

  // 1. закрываем три подхода — тоннаж появился
  const t1=await p.evaluate(()=>{
    const d=dayOf(sel), r=recRW(sel);
    d.ex.slice(0,3).forEach((e,j)=>{
      r.log[j]={done:1,n:e.n,g:e.g,s:'3',r:String(e.r),w:'20',rs:['8','8','8'],vol:24*20,xp:12};
    });
    save(); recomputeStats(1); entCache=null;
    return { ton:Math.round(dayTon(sel)), n:d.ex.length };
  });
  chk(t1.ton===3*24*20, '1. тоннаж трёх закрытых подходов посчитан', t1.ton+'');

  // 2. убираем второе упражнение — отметки сдвигаются, чужой тоннаж цел
  const t2=await p.evaluate(async ()=>{
    const d=dayOf(sel);
    const names=d.ex.map(e=>e.n);
    exOpen=1; render();
    const btn=document.querySelector('#exl [data-del="1"]');
    if(!btn) return {err:'кнопки удаления нет в раскрытом упражнении'};
    btn.click();
    await new Promise(r=>setTimeout(r,180));
    try{askClose(true)}catch(e){}
    await new Promise(r=>setTimeout(r,250));
    // второй вопрос — про прошлые записи
    if(document.getElementById('ask').classList.contains('on')){ try{askClose(false)}catch(e){} }
    await new Promise(r=>setTimeout(r,250));
    const r=recOf(sel);
    return { was:names, now:dayOf(sel).ex.map(e=>e.n),
             log:Object.keys(r.log).map(k=>k+':'+(r.log[k].n||'')).join(' '),
             ton:Math.round(dayTon(sel)) };
  });
  if(t2.err){ bad('2. удаление упражнения', t2.err); }
  else {
    chk(t2.now.length===t2.was.length-1 && t2.now[1]===t2.was[2],
        '2. упражнение убрано, порядок остальных сохранён', t2.now.slice(0,3).join(', '));
    chk(/0:/.test(t2.log) && /1:/.test(t2.log) && !/2:/.test(t2.log),
        '3. отметки сдвинулись следом за упражнениями', t2.log);
    chk(t2.ton===2*24*20, '4. тоннаж уменьшился ровно на убранное', t2.ton+'');
  }

  // 5. добавляем упражнение из каталога
  const t3=await p.evaluate(async ()=>{
    const before=dayOf(sel).ex.length;
    edit=false; exOpen=null; tab='wo'; render();
    openExPicker();
    await new Promise(r=>setTimeout(r,300));
    const btn=document.querySelector('#sh [data-addex]');
    if(!btn) return {err:'каталог не открылся'};
    const name=btn.dataset.addex;
    btn.click();
    await new Promise(r=>setTimeout(r,300));
    const d=dayOf(sel), last=d.ex[d.ex.length-1];
    return { before, after:d.ex.length, name, added:last.n, w:num(last.w), g:last.g,
             group:(EXDB[name]||[])[1] };
  });
  if(t3.err) bad('5. добавление из каталога', t3.err);
  else {
    chk(t3.after===t3.before+1 && t3.added===t3.name, '5. упражнение добавилось в конец', t3.added);
    chk(t3.w>0 && t3.g===t3.group, '6. у нового упражнения свой вес и группа',
        t3.w+' кг · '+t3.g);
  }

  // 7. тоннаж по группам по-прежнему сходится
  const t4=await p.evaluate(()=>{
    recomputeStats(1); entCache=null;
    let mine=0; Object.keys(S.rec).forEach(ds=>dayEntries(ds).forEach(e=>{mine+=e.vol;}));
    return { mine:Math.round(mine), app:Math.round(GROUPS.reduce((a,[n])=>a+num(S.vol[n]),0)) };
  });
  chk(Math.abs(t4.mine-t4.app)<2, '7. тоннаж по группам сходится после правок', JSON.stringify(t4));

  // 8. состояние переживает перезагрузку
  const before=await p.evaluate(()=>{flush();return JSON.stringify(S);});
  await p.reload(); await p.waitForTimeout(1300);
  const after=await p.evaluate(()=>JSON.stringify(S));
  chk(before===after, '8. правки переживают перезагрузку', before.length+' vs '+after.length);

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
