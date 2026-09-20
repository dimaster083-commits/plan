/* Перенос дня и журнал: отметки после переноса и после отмены должны
   стоять на тех упражнениях, к которым относятся. */
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
  const st=await p.evaluate(()=>{
    S.setup=1;document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60};deriveWeights();
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    save(); tab='wo'; sel=today(); render();
    const wd=wdOf(sel);
    const other=S.days.findIndex((x,i)=>i!==wd && x.t!=='rest' && (x.ex||[]).length &&
      (x.ex||[]).map(e=>e.n).join()!==((S.days[wd].ex||[]).map(e=>e.n).join()));
    return { wd, other, own:(S.days[wd].ex||[]).map(e=>e.n),
             oth:other>=0?(S.days[other].ex||[]).map(e=>e.n):[] };
  });
  chk(st.other>=0, '1. есть другой день с другим набором', st.oth.slice(0,2).join(', '));

  // 2. переносим и закрываем два подхода — отметки на упражнениях переноса
  const moved=await p.evaluate(k=>{
    S.map[sel]=k; save(); render();
    const d=dayOf(sel), r=recRW(sel);
    [0,1].forEach(j=>{ r.log[j]={done:1,n:d.ex[j].n,g:d.ex[j].g,s:'3',r:'8',w:'25',rs:['8','8','8'],vol:600,xp:12}; });
    save(); recomputeStats(1); entCache=null; render();
    return { names:d.ex.map(e=>e.n), log:Object.keys(r.log).map(j=>r.log[j].n),
             ent:dayEntries(sel).map(e=>e.n), ton:Math.round(dayTon(sel)) };
  }, st.other);
  chk(moved.log[0]===moved.names[0] && moved.log[1]===moved.names[1],
      '2. отметки стоят на упражнениях перенесённого дня', moved.log.join(', '));
  chk(moved.ent.join()===moved.log.join(), '3. разбор дня показывает те же упражнения',
      moved.ent.join(', '));

  // 4. отменяем перенос — записанное остаётся тем, чем было
  const back=await p.evaluate(()=>{
    delete S.map[sel]; save(); recomputeStats(1); entCache=null; render();
    const d=dayOf(sel), r=recOf(sel);
    return { names:d.ex.map(e=>e.n), log:Object.keys(r.log).map(j=>r.log[j].n),
             ent:dayEntries(sel).map(e=>e.n), ton:Math.round(dayTon(sel)) };
  });
  chk(back.log[0]===moved.log[0] && back.log[1]===moved.log[1],
      '4. журнал помнит, что именно было сделано', back.log.join(', '));
  chk(back.ent.join()===moved.ent.join(),
      '5. разбор дня не подменил упражнения после отмены переноса', back.ent.join(', '));
  chk(back.ton===moved.ton, '6. тоннаж дня не изменился от отмены переноса',
      moved.ton+' и '+back.ton);

  // 7. общий тоннаж по группам сходится
  const tot=await p.evaluate(()=>{
    recomputeStats(1); entCache=null;
    let mine=0; Object.keys(S.rec).forEach(ds=>dayEntries(ds).forEach(e=>{mine+=e.vol;}));
    return { mine:Math.round(mine), app:Math.round(GROUPS.reduce((a,[n])=>a+num(S.vol[n]),0)) };
  });
  chk(Math.abs(tot.mine-tot.app)<2, '7. тоннаж по группам сходится', JSON.stringify(tot));

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
