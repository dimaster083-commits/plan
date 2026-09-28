/* Замеры тела и квесты месяца (из Lyfta), плюс «что добрать» в итогах недели.
   Замеры — по датам, сравнение с первым; битая копия чинится. Квест даёт
   опыт один раз за месяц. */
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
  await p.evaluate(()=>{ S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on'); S.rec={}; delete S.meas; delete S.quest;
    window._notes=[]; const o=note; note=t=>{_notes.push(String(t)); return o(t);};
    save(); tab='prog'; pSec='goal'; render(); });
  const r1=await p.evaluate(()=>{ const box=document.getElementById('measBox'); if(!box) return null; const bt=box.querySelector('[data-meas]'); bt.click();
    const sh=document.getElementById('shB'); const ins=[...sh.querySelectorAll('[data-mk]')];
    const h=ins.map(x=>Math.round(x.getBoundingClientRect().height));
    sh.querySelector('[data-mk="waist"]').value='84'; sh.querySelector('[data-mk="arm"]').value='38,5';
    sh.querySelector('[data-measave]').click();
    return {row:(S.meas||{})[today()], h, box:document.getElementById('measBox').textContent.replace(/\s+/g,' '), wide:document.documentElement.scrollWidth<=320}; });
  chk(r1&&JSON.stringify(r1.row)==='{"waist":84,"arm":38.5}','1. замеры записываются по сегодняшней дате',r1&&JSON.stringify(r1.row));
  chk(r1&&/84/.test(r1.box)&&/38,5/.test(r1.box),'2. окно «Замеры» показывает последние',r1&&r1.box.slice(0,90));
  chk(r1&&r1.h.length===7&&r1.h.every(x=>x>=44)&&r1.wide,'3. поля не ниже 44 px, на 320 без прокрутки вбок',r1&&JSON.stringify(r1.h));
  const r4=await p.evaluate(()=>{ if(typeof openMeas!=='function') return null; const z=new Date(); z.setDate(z.getDate()-30); S.meas[iso(z)]={waist:86};
    paintMeas(); const t=document.getElementById('measBox').textContent.replace(/\s+/g,' '); openMeas();
    const svg=!!document.querySelector('#shB svg.mch'); sheetClose(); return {t, svg}; });
  chk(r4&&/−2/.test(r4.t)&&r4.svg,'4. разница с первым замером и график',r4&&r4.t.slice(0,110));
  const r5=await p.evaluate(()=>{ S.meas={'мусор':{waist:80},'2026-01-01':{waist:'abc',arm:'35'},'2026-02-01':null}; scrubKeys(); return JSON.stringify(S.meas); });
  chk(r5==='{"2026-01-01":{"arm":35}}','5. битая копия замеров чинится',r5);

  // квесты месяца
  const r6=await p.evaluate(()=>{ if(typeof checkQuests!=='function') return null; const ym=today().slice(0,7); S.rec={};
    ['01','02','03','04'].forEach(d=>{ S.rec[ym+'-'+d]={log:{},bw:'80'}; }); entCache=null; _notes.length=0;
    const x0=S.xp; checkQuests(); const x1=S.xp; checkQuests(); const x2=S.xp; paintQuests();
    return {d1:x1-x0, d2:x2-x1, got:S.quest[ym], notes:_notes.join(' | '), rows:document.querySelectorAll('#questBox .qrow').length,
      ok:document.querySelectorAll('#questBox .qrow.ok').length}; });
  chk(r6&&r6.d1===100&&r6.d2===0&&JSON.stringify(r6.got)==='["bw"]','6. квест «взвеситься 4 раза» — +100 XP, один раз',r6&&JSON.stringify(r6));
  chk(r6&&r6.rows===4&&r6.ok===1&&/КВЕСТ ВЫПОЛНЕН/.test(r6.notes),'7. окно квестов: четыре квеста, выполненный отмечен',r6&&(r6.rows+' / '+r6.ok));
  const r7b=await p.evaluate(()=>{ const x=S.xp; recomputeStats(true); return {x, y:S.xp}; });
  chk(r7b.x===r7b.y,'7б. пересчёт опыта из журнала учитывает квесты',JSON.stringify(r7b));
  const r8=await p.evaluate(()=>{ S.quest=[1,2]; scrubKeys(); return JSON.stringify(S.quest); });
  chk(r8==='{}','8. битые квесты в копии чинятся',r8);
  const r9=await p.evaluate(()=>{ S.rec={}; entCache=null; openWeek(); const t=document.getElementById('shB').textContent; sheetClose(); return /Отстаёт/.test(t); });
  chk(r9,'9. в итогах текущей недели — что отстаёт','');
  chk(errs.length===0,'10. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
