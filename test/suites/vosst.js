/* Восстановление из копии: битая копия не должна ронять приложение,
   а нормальная — восстанавливаться полностью. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs=require('fs'), os=require('os'), path=require('path');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'vosst-'));
const write=(name,obj)=>{const f=path.join(tmp,name); fs.writeFileSync(f,typeof obj==='string'?obj:JSON.stringify(obj)); return f;};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60};
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    const r=recRW(today()); r.wo=1;
    d.ex.forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:'3',r:'8',w:'25',rs:['8','8','8'],vol:600,xp:12}; });
    S.bw='73.5'; S.goal='95'; save(); recomputeStats(1); tab='prog'; pSec='prog'; render();});
  await p.waitForTimeout(300);

  const good=await p.evaluate(()=>{flush();return {state:S,photos:{}};});
  const goodFile=write('good.json',{v:3,saved:new Date().toISOString(),state:good.state,photos:{}});
  const dirty=JSON.parse(JSON.stringify(good.state));
  dirty.rec['не дата']={wo:1};
  dirty.rec['2026-13-45']={wo:1,log:{0:{done:1,w:'x'}}};
  dirty.map={'мусор':3};
  const dirtyFile=write('dirty.json',{v:3,state:dirty,photos:{}});
  const brokenFile=write('broken.json','{это не json');
  const emptyFile=write('empty.json',{v:3,state:{},photos:{}});

  const restore=async (file)=>{
    await p.evaluate(()=>{ S.rec={}; S.bw=''; save(); render(); });
    const [chooser]=await Promise.all([
      p.waitForEvent('filechooser'),
      p.evaluate(()=>document.getElementById('imp').click())
    ]);
    await chooser.setFiles(file);
    await p.waitForTimeout(400);
    if(await p.evaluate(()=>document.getElementById('ask').classList.contains('on')))
      await p.evaluate(()=>{try{askClose(true)}catch(e){}});
    await p.waitForTimeout(700);
    return p.evaluate(()=>{
      let err=null;
      try{ tab='prog'; pSec='log'; render(); tab='prog'; pSec='prog'; render();
           tab='wo'; sel=today(); render(); openAnalysis(); sheetClose(); }
      catch(e){ err=e.message; }
      return { err, days:Object.keys(S.rec||{}).length, bw:S.bw,
               note:(document.getElementById('noteT')||{}).textContent||'' };
    });
  };

  const r1=await restore(goodFile);
  chk(!r1.err && r1.days>0 && String(r1.bw)==='73.5', '1. нормальная копия восстанавливается',
      JSON.stringify(r1));
  const r2=await restore(dirtyFile);
  chk(!r2.err && r2.days>0, '2. копия с мусорными ключами не роняет приложение',
      r2.err||('дней '+r2.days));
  const r2keys=await p.evaluate(()=>Object.keys(S.rec).filter(k=>!/^\d{4}-\d{2}-\d{2}$/.test(k)));
  chk(r2keys.length===0, '3. мусорные ключи выброшены при восстановлении', r2keys.join(', ')||'нет');
  const r3=await restore(brokenFile);
  chk(/не подошёл/i.test(r3.note)||!r3.err, '4. битый файл отвергается с понятным ответом', r3.note);
  const r4=await restore(emptyFile);
  chk(!r4.err, '5. пустое состояние в копии не ломает экраны', r4.err||'ок');

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
