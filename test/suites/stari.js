/* Смена типа дня во всех неделях не переписывает прошлые тренировки:
   журнал, история и календарь показывают, что было в тот день. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const chk=(c,n,d)=>{ if(!c) fails++; console.log('  '+(c?'✓':'✗')+' '+n+(d?'   → '+d:'')); };
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const past=await p.evaluate(()=>{ S.setup=1; document.getElementById('setup').classList.remove('on'); S.rec={};
    const z=new Date(); z.setDate(z.getDate()-7); const ds=iso(z); const d=dayOf(today()); d.t='lo1'; d.s='Низ тела · силовой'; delete S.map[ds]; delete S.map[today()];
    S.rec[ds]={wo:1,log:{0:{done:1,n:'Присед со штангой',g:'Ноги',w:'60',s:'3',r:'8',rs:[8,8,8],vol:1440,sd:1}}};
    save(); tab='wo'; sel=today(); edit=true; render(); return ds; });
  await p.evaluate(()=>{ const bt=document.querySelector('#types [data-t="up2"]'); bt.click(); });
  await p.waitForTimeout(300); await p.click('#askY'); await p.waitForTimeout(300);
  const r=await p.evaluate(ds=>{ const now=dayOf(today()).t; sel=ds; editPast=false; render(); const q=document.getElementById('qType').textContent;
    const lk=dayLook(ds); S.rec[ds].dt='мусор'; scrubKeys(); return {now, q, lk, scrub:S.rec[ds].dt===undefined}; },past);
  chk(r.now==='up2','1. шаблон поменялся',r.now);
  chk(r.lk.t==='lo1'&&/НИЗ/.test(r.q),'2. прошлая тренировка осталась «Низ тела»',r.q+' · '+JSON.stringify(r.lk));
  chk(r.scrub,'3. битый снимок в копии чинится','');
  chk(errs.length===0,'4. без ошибок',errs.join(' | ')||'чисто');
  await b.close(); process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
