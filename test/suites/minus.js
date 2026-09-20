/* Минус в любом числовом поле не должен доезжать до счёта. */
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
    S.anchors={b:70,s:50,d:60};deriveWeights();
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    save();});
  chk(await p.evaluate(()=>[-5,'-5','-5,5','-0.1',-1e9].every(v=>num(v)===0)),
      '1. отрицательное число превращается в ноль');
  chk(await p.evaluate(()=>{
    const d=dayOf(today()), r=recRW(today());
    d.ex.forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:'-3',r:'-8',w:'-100',rs:['-8','-8'],xp:12}; });
    delete r.log[0].vol; save(); recomputeStats(1); entCache=null;
    const t=dayTon(today());
    return t>=0 && isFinite(t);
  }), '2. тоннаж с минусами не уходит ниже нуля');
  chk(await p.evaluate(()=>{
    S.bw='-80'; S.goal='-95'; S.height='-177'; applyNutri(); save();
    const n=nutriFor('up1');
    return num(n.kc)>=0 && num(n.pr)>=0 && isFinite(num(n.kc));
  }), '3. нормы питания при минусовом весе остаются числом');
  chk(await p.evaluate(()=>{
    let nan=false;
    try{ tab='prog'; pSec='load'; render(); tab='prog'; pSec='goal'; render();
         tab='wo'; sel=today(); render(); }catch(e){ nan=true; }
    return !nan && !/NaN|Infinity/.test(JSON.stringify(S));
  }), '4. экраны рисуются, в состоянии нет NaN');
  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
