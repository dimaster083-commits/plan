/* Серия недель: растёт только за полные недели, рвётся на пропуске,
   текущая неделя считается только когда закрыта. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const SET=(p,weeks)=>p.evaluate(ws=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  S.rec={};
  const mon=mondayOf(today());
  ws.forEach((cnt,i)=>{               // i=0 — текущая неделя, дальше в прошлое
    const m=new Date(mon+'T00:00:00'); m.setDate(m.getDate()-i*7);
    for(let k=0;k<cnt;k++){ const d=new Date(m); d.setDate(d.getDate()+k); recRW(iso(d)).wo=1; }
  });
  save();
  return streak();
}, weeks);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');save();});

  chk(await SET(p,[0,0,0])===0, '1. без тренировок серии нет');
  chk(await SET(p,[4])===1, '2. четыре за текущую неделю дают серию 1');
  chk(await SET(p,[3])===0, '3. три за текущую неделю серию не дают');
  chk(await SET(p,[0,4,4,4])===3, '4. три полные прошлые недели — серия 3 даже без текущей');
  chk(await SET(p,[4,4,4])===3, '5. три полные недели подряд — серия 3');
  chk(await SET(p,[4,4,0,4,4])===2, '6. пропуск рвёт серию', '');
  chk(await SET(p,[2,4,4])===2, '7. незакрытая текущая неделя не рвёт прошлую серию');
  chk(await SET(p,[7,7,7])===3, '8. лишние тренировки не удваивают серию');
  const big=await SET(p,new Array(30).fill(4));
  chk(big===30, '9. тридцать недель подряд — серия 30', String(big));
  chk(await p.evaluate(()=>{ S.rec={}; save(); return streak(); })===0, '10. очищенный журнал обнуляет серию');
  chk(await p.evaluate(()=>{ S.rec={'не дата':{wo:1}}; save(); const s=streak(); S.rec={}; save(); return isFinite(s)&&s>=0; }),
      '11. мусорный ключ не ломает подсчёт серии');
  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
