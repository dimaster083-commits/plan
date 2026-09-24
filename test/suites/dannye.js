/* Данные и копии — ошибки, найденные агентом-тестировщиком данных. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs=require('fs'), path=require('path'), os=require('os');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const TMP=fs.mkdtempSync(path.join(os.tmpdir(),'dannye-'));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const base=await p.evaluate(()=>{ S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    const z=new Date(); z.setDate(z.getDate()-3); const ds=iso(z); recRW(ds).bw='80'; recRW(ds).wo=1; flush();
    return {ds, state:JSON.parse(JSON.stringify(S))}; });
  const restore=async (obj)=>{ const f=path.join(TMP,'c'+Math.random()+'.json'); fs.writeFileSync(f,JSON.stringify(obj));
    await p.setInputFiles('#impFile',f); await p.waitForTimeout(300);
    if(await p.evaluate(()=>document.getElementById('ask').classList.contains('on'))) await p.click('#askY');
    await p.waitForTimeout(500); return p.evaluate(()=>document.getElementById('noteT').textContent); };

  // 1. копия, на которой падает ремонт, не подменяет журнал (ремонт роняем нарочно)
  const other=JSON.parse(JSON.stringify(base.state)); other.rec={}; other.bw='60';
  await p.evaluate(()=>{ window.__mig=migrate; migrate=()=>{ throw new Error('ремонт упал'); }; });
  const n1=await restore({v:3,state:other,photos:{}});
  const r1=await p.evaluate(ds=>{ migrate=window.__mig; return {kept:!!(S.rec[ds]&&S.rec[ds].wo), bw:S.bw,
    stored:!!(JSON.parse(localStorage.getItem('sys-gym-v3')).rec[ds]||{}).wo}; }, base.ds);
  chk(r1.kept && r1.stored && r1.bw!=='60','1. упал ремонт копии — журнал и хранилище прежние',JSON.stringify(r1)+' · '+n1);

  // 2-3. правленая руками копия: rs строкой, null в приёмах пищи и упражнениях, мусор в map
  const hand=JSON.parse(JSON.stringify(base.state));
  hand.rec[base.ds].log={0:{done:1,n:'Жим лёжа',g:'Грудь',s:'4',r:'8',w:'50',rs:'8,8,8,8',vol:1600,xp:12}};
  hand.rec[base.ds].ml=[null,{n:'Обед',items:[null]}]; hand.days[1].ex.push(null); hand.map={[base.ds]:1.5};
  await restore({v:3,state:hand,photos:{}});
  const r2=await p.evaluate(ds=>{ const out={rs:(S.rec[ds].log[0]||{}).rs};
    try{ for(const t of ['prog','food','wo']){ tab=t; pSec='log'; sel=ds; render(); } exOpen=0; tab='wo'; sel=today(); render(); out.ok=true; }catch(e){ out.ok=e.message; }
    return out; }, base.ds);
  chk(Array.isArray(r2.rs)&&r2.rs.join('/')==='8/8/8/8','2. повторы строкой «8,8,8,8» становятся массивом',JSON.stringify(r2.rs));
  chk(r2.ok===true,'3. null в журнале, еде и программе не роняет экраны',String(r2.ok));

  // 4. фото из файла — только картинки: строка с кодом в разметку не попадает
  const evil=JSON.parse(JSON.stringify(base.state));
  await restore({v:3,state:evil,photos:{[base.ds]:'x" onerror="window.__pwned=1'}});
  const pw=await p.evaluate(async ds=>{ try{ openDayReport(ds); }catch(e){} await new Promise(r=>setTimeout(r,300)); return !!window.__pwned || !!PHCACHE.get(ds); }, base.ds);
  chk(!pw,'4. фото из копии, которое не картинка, отбрасывается',String(pw));

  // 5. несуществующая дата 2026-09-31 выбрасывается
  const r5=await p.evaluate(()=>{ S.rec['2026-09-31']={log:{},wo:1}; scrubKeys(); return !!S.rec['2026-09-31']; });
  chk(!r5,'5. дата 2026-09-31 выбрасывается как несуществующая',String(r5));

  // 6. '[]' в хранилище — приложение работает и сохраняет
  await p.evaluate(()=>localStorage.setItem('sys-gym-v3','[]'));
  await p.reload(); await p.waitForTimeout(1500);
  const r6=await p.evaluate(()=>{ S.setup=1; S.bw='77'; flush(); return JSON.parse(localStorage.getItem('sys-gym-v3')).bw; });
  chk(r6==='77','6. «[]» в хранилище не мешает сохранять',String(r6));

  // 7. одна неудачная запись не выключает сохранение навсегда
  const r7=await p.evaluate(()=>{ const set=Storage.prototype.setItem; let n=0;
    Storage.prototype.setItem=function(k,v){ if(n++===0) throw new DOMException('quota','QuotaExceededError'); return set.call(this,k,v); };
    S.bw='78'; const a=flush(); S.bw='79'; const b2=flush(); Storage.prototype.setItem=set;
    return {a,b:b2,stored:JSON.parse(localStorage.getItem('sys-gym-v3')).bw}; });
  chk(!r7.a && r7.b && r7.stored==='79','7. после сбоя записи следующее сохранение проходит',JSON.stringify(r7));

  // 8. копия создаётся и без IndexedDB
  const r8=await p.evaluate(async()=>{ const o=window.phKeys; let blobbed=false;
    const cu=URL.createObjectURL; URL.createObjectURL=()=>{blobbed=true; return 'blob:x';};
    window.indexedDB.open=()=>{ throw new Error('нет'); };
    try{ document.getElementById('exp').click(); await new Promise(r=>setTimeout(r,600)); }catch(e){}
    URL.createObjectURL=cu; return {blobbed, note:document.getElementById('noteT').textContent}; });
  chk(r8.blobbed,'8. без IndexedDB копия журнала всё равно создаётся',JSON.stringify(r8));

  // 9. посещаемость не считает дни до старта плана и незакрытую сегодняшнюю тренировку
  const r9=await p.evaluate(()=>{ S.rec={}; const z=new Date(); z.setDate(z.getDate()-2); S.start=iso(z);
    const a=attendance(14); const d=dayOf(today()); const todayPlanned=d.t!=='rest';
    let exp=0; for(let k=2;k>=1;k--){const q=new Date(); q.setDate(q.getDate()-k); if(dayOf(iso(q)).t!=='rest') exp++;}
    return {a, exp}; });
  chk(r9.a.planned===r9.exp,'9. «запланировано» — только с даты старта и до вчера',JSON.stringify(r9));
  chk(errs.length===0,'10. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
