/* Замена упражнения аналогом. Раньше: стёртый сегодняшний подход не
   откатывался (вес в других днях и рекорд оставались поднятыми), а прошлые
   даты этого дня показывали и переписывали запись на новое движение. */
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
  p.on('dialog',d=>d.accept());
  await p.goto(APP); await p.waitForTimeout(1300);
  const r=await p.evaluate(async()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on'); S.rec={}; S.pr={};
    const t=today(), z=new Date(); z.setDate(z.getDate()-7); const past=iso(z);
    const d=dayOf(t); d.t='lo1'; d.s='тест'; d.ex=[{n:'Сгибания ног',s:3,r:'8-10',w:20,g:'Ноги'}];
    const other=S.days.find(x=>x!==d&&x.t!=='rest'); other.ex.push({n:'Сгибания ног',s:3,r:'8-10',w:20,g:'Ноги'});
    // прошлая неделя: «Сгибания ног» на 20 закрыты
    recRW(past).log[0]={done:1,n:'Сгибания ног',g:'Ноги',s:'3',r:'8-10',w:'20',rs:[8,8,8],vol:480,xp:12};
    S.pr['Сгибания ног']=20;
    // сегодня: закрыт подход на 25 — вес в другом дне поднялся до 25, рекорд 25
    sel=t; tab='wo'; exOpen=0; render();
    const c=document.querySelector('.ex[data-j="0"]'); c.querySelector('[data-f="w"]').value='25';
    [...c.querySelectorAll('[data-rs]')].forEach(x=>x.value='9'); toggleSet(0);
    const before={other:num(other.ex[other.ex.length-1].w), pr:S.pr['Сгибания ног']};
    // замена через шторку «Техника» → аналог
    const btn=document.createElement('button'); btn.dataset.alt='Сгибания ног сидя'; btn.dataset.altj='0';
    document.getElementById('shB').appendChild(btn); btn.click();
    await new Promise(res=>setTimeout(res,120)); document.getElementById('askY').click();
    await new Promise(res=>setTimeout(res,250));
    const pastLog=recOf(past).log, pastDay=dayOf(past).ex;
    return {before, other:num(other.ex[other.ex.length-1].w), pr:S.pr['Сгибания ног'],
      now:d.ex[0].n, pastName:(Object.values(pastLog)[0]||{}).n,
      pastRowShows:pastDay[Object.keys(pastLog)[0]] ? pastDay[Object.keys(pastLog)[0]].n : '(нет строки — запись в журнале)'};
  });
  chk(r.now==='Сгибания ног сидя','1. упражнение заменено',r.now);
  chk(r.before.other===25 && r.other===20,'2. стёртый подход откатан: вес в другом дне вернулся к 20',r.before.other+' → '+r.other);
  chk(r.pr===20,'3. рекорд — из оставшегося журнала (20), а не 25 стёртого подхода',String(r.pr));
  chk(r.pastName==='Сгибания ног' && r.pastRowShows!=='Сгибания ног сидя','4. прошлая дата осталась про старое движение',
      r.pastName+' / строка: '+r.pastRowShows);
  chk(errs.length===0,'5. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
