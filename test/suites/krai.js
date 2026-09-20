/* Крайние состояния программы: день без упражнений, вся неделя
   отдыхом, один единственный день, нулевые и отрицательные веса. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const ALL=async(p)=>p.evaluate(async()=>{
  const out={err:null,texts:{}};
  for(const t of ['wo','prog','food','photo']){
    try{ tab=t; exOpen=null; sel=today(); render(); await new Promise(r=>setTimeout(r,50));
      out.texts[t]=document.body.innerText.length; }
    catch(e){ out.err=(out.err||'')+t+': '+e.message+'; '; }
  }
  for(const sec of ['log','load','goal','prog']){
    try{ tab='prog'; pSec=sec; render(); }catch(e){ out.err=(out.err||'')+sec+': '+e.message+'; '; }
  }
  try{ openAnalysis(); sheetClose(); }catch(e){ out.err=(out.err||'')+'разбор: '+e.message+'; '; }
  try{ monthReport(today().slice(0,7)); sheetClose(); }catch(e){ out.err=(out.err||'')+'месяц: '+e.message+'; '; }
  try{ openProgression(); sheetClose(); }catch(e){ out.err=(out.err||'')+'прогрессия: '+e.message+'; '; }
  out.json=JSON.stringify(S);
  out.nan=/NaN|Infinity/.test(out.json);
  out.wide=document.documentElement.scrollWidth;
  return out;
});
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60};deriveWeights();save();});

  const cases=[
    ['день без упражнений', ()=>{ const d=dayOf(today()); d.t='up1'; d.ex=[]; save(); }],
    ['вся неделя отдыхом', ()=>{ S.days.forEach(d=>{ d.t='rest'; d.ex=[]; }); save(); }],
    ['один тренировочный день', ()=>{ const w=wdOf(today());
        S.days.forEach((d,i)=>{ if(i===w){ d.t='up1'; d.ex=[{n:'Жим лёжа',s:'3',r:'6-8',w:'70',g:'Грудь'}]; } else { d.t='rest'; d.ex=[]; } }); save(); }],
    ['нулевые веса', ()=>{ S.days.forEach(d=>(d.ex||[]).forEach(e=>{ e.w='0'; })); save(); }],
    ['отрицательные веса', ()=>{ S.days.forEach(d=>(d.ex||[]).forEach(e=>{ e.w='-50'; })); save(); }],
    ['повторы одним числом', ()=>{ S.days.forEach(d=>(d.ex||[]).forEach(e=>{ e.r='10'; })); save(); }],
    ['повторы буквами', ()=>{ S.days.forEach(d=>(d.ex||[]).forEach(e=>{ e.r='до отказа'; })); save(); }],
    ['ноль подходов', ()=>{ S.days.forEach(d=>(d.ex||[]).forEach(e=>{ e.s='0'; })); save(); }],
    ['сорок упражнений в дне', ()=>{ const d=dayOf(today());
        d.t='up1'; d.ex=[]; for(let i=0;i<40;i++) d.ex.push({n:'Жим лёжа',s:'3',r:'6-8',w:'70',g:'Грудь'}); save(); }],
    ['старт плана в будущем', ()=>{ const d=new Date(); d.setDate(d.getDate()+90);
        const z=new Date(d); z.setMinutes(z.getMinutes()-z.getTimezoneOffset());
        S.start=z.toISOString().slice(0,10); save(); }],
    ['старт плана десять лет назад', ()=>{ const d=new Date(); d.setFullYear(d.getFullYear()-10);
        const z=new Date(d); z.setMinutes(z.getMinutes()-z.getTimezoneOffset());
        S.start=z.toISOString().slice(0,10); save(); }]
  ];
  for(const [name,fn] of cases){
    await p.evaluate(()=>{ const d=dayOf(today());
      if(d.t==='rest'){ const x=S.days.find(y=>(y.ex||[]).length); if(x){ d.t=x.t; d.s=x.s; d.ex=x.ex.map(e=>({...e})); } }
      save(); });
    await p.evaluate(f=>{ (0,eval)('('+f+')()'); }, fn.toString());
    const r=await ALL(p);
    const probs=[];
    if(r.err) probs.push(r.err);
    if(r.nan) probs.push('в состоянии NaN');
    if(r.wide>391) probs.push('шире экрана: '+r.wide);
    if(errs.length) probs.push('ошибки JS: '+[...new Set(errs)].slice(0,2).join(' | '));
    errs.length=0;
    probs.length ? bad(name, probs.join(' · ')) : ok(name, 'зал '+r.texts.wo+' знаков');
    // восстанавливаем расписание между случаями
    await p.evaluate(()=>{ S.days=build().days; deriveWeights(); save(); });
  }
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
