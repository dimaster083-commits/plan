/* Критическая целостность. Проходим каждый путь, который пишет или удаляет
   в журнале, и после каждого проверяем одни и те же неизменные правила:
     — ни одна отметка подхода не сидит под чужим упражнением;
     — нет галочек добавок на несуществующих строках;
     — опыт и тоннаж сходятся с пересчётом по журналу;
     — в журнале нет ни NaN, ни отрицательных чисел, ни мусорных дат;
     — рабочие веса лежат на своей сетке.
   Это тот класс ошибок, который молча портит данные: их не видно, пока
   человек не откроет журнал через месяц. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);

const ПРАВИЛА = () => {
  const бед=[];
  // 1. отметка подхода не должна стоять под чужим упражнением
  Object.keys(S.rec).forEach(ds=>{
    const ex=(dayOf(ds)||{}).ex||[], lg=(S.rec[ds]||{}).log||{};
    Object.keys(lg).forEach(k=>{
      const l=lg[k]; if(!l||!l.n) return;
      const под=ex[+k];
      if(под && под.n!==l.n) бед.push('отметка «'+l.n+'» стоит под «'+под.n+'» ('+ds+')');
    });
  });
  // 2. галочки добавок — только по живым строкам
  Object.keys(S.rec).forEach(ds=>{
    const sp=(dayOf(ds)||{}).sp||[], mk=(S.rec[ds]||{}).sp||{};
    Object.keys(mk).forEach(k=>{ if(!sp[+k]) бед.push('галочка добавки №'+k+' в пустоту ('+ds+')'); });
  });
  // 3. опыт и объём сходятся с пересчётом по журналу
  const былXp=num(S.xp), былVol=Object.assign({}, S.vol);
  statsDirty=true; recomputeStats(1);
  if(Math.abs(num(S.xp)-былXp)>0.5) бед.push('опыт разошёлся: было '+былXp+', пересчёт '+S.xp);
  GROUPS.forEach(([n])=>{
    if(Math.abs(num(S.vol[n])-num(былVol[n]))>1) бед.push('объём «'+n+'» разошёлся: '+былVol[n]+' → '+S.vol[n]);
  });
  // 4. ни NaN, ни минусов, ни мусорных дат
  Object.keys(S.rec).forEach(ds=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ds)) { бед.push('мусорная дата «'+ds+'»'); return; }
    const lg=(S.rec[ds]||{}).log||{};
    Object.keys(lg).forEach(k=>{
      const l=lg[k]||{};
      ['w','vol','xp'].forEach(f=>{
        const v=l[f];
        if(v!==undefined && (isNaN(num(v))||num(v)<0)) бед.push(ds+' №'+k+' '+f+'='+v);
      });
    });
  });
  GROUPS.forEach(([n])=>{ if(isNaN(num(S.vol[n]))||num(S.vol[n])<0) бед.push('объём «'+n+'» = '+S.vol[n]); });
  if(isNaN(num(S.xp))||num(S.xp)<0) бед.push('опыт = '+S.xp);
  // 5. рабочие веса на своей сетке
  S.days.forEach(d=>(d.ex||[]).forEach(e=>{
    const w=num(e.w); if(!w) return;
    const g=granOf(w);
    if(Math.abs(w/g-Math.round(w/g))>1e-9) бед.push('вес «'+e.n+'» = '+w+' мимо сетки '+g);
  }));
  return бед;
};

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  await p.evaluate(f=>{ window.ПРАВИЛА=eval('('+f+')'); },ПРАВИЛА.toString());

  // засеваем месяц настоящего журнала
  await p.evaluate(()=>{
    S.setup=1; document.getElementById('setup').classList.remove('on'); S.sound=0;
    S.rec={}; S.map={}; S.pr={};
    for(let k=1;k<=30;k++){
      const d=new Date(); d.setDate(d.getDate()-k); const ds=iso(d);
      const dd=dayOf(ds); if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log={};
      dd.ex.forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),
        w:num(e.w),rs:[8,8,8],vol:num(e.w)*24,xp:12}; });
      r.sp={0:1,2:1};
    }
    entCache=null; statsDirty=true; save(); recomputeStats(1);
  });

  const шаг = async (имя, код) => {
    const бед = await p.evaluate(async c=>{
      try { await eval('(async()=>{'+c+'})()'); } catch(e){ return ['УПАЛО: '+e.message]; }
      entCache=null;
      return window.ПРАВИЛА();
    }, код);
    chk(бед.length===0, имя, бед.slice(0,3).join(' · ')||'журнал цел');
  };

  await шаг('1. исходный журнал цел', 'void 0;');
  await шаг('2. добавили упражнение в день',
    `const d=S.days.find(x=>x.t!=='rest'); d.ex.push({n:'Молотки',s:3,r:'8-10',w:startWeight('Молотки'),g:'Руки'}); save();`);
  // Настоящий путь: открываем день, раскрываем упражнение и жмём «Убрать».
  // Замена логики обработчика в проверке проверяла бы саму проверку.
  const убрали = await p.evaluate(async()=>{
    const d=S.days.find(x=>x.t!=='rest');
    let ds=today();
    for(let k=0;k<14;k++){const x=new Date();x.setDate(x.getDate()-k); if(dayOf(iso(x))===d){ds=iso(x);break;}}
    sel=ds; tab='wo'; edit=true; editPast=true; exOpen=1; render();
    const кн=document.querySelector('#exl [data-del]');
    if(!кн) return {err:'кнопки «убрать» нет'};
    const имя=d.ex[1].n;
    кн.click();
    await new Promise(r=>setTimeout(r,250));
    const да=[...document.querySelectorAll('.askw button')].find(x=>!/отмен|нет/i.test(x.textContent));
    if(!да) return {err:'подтверждения нет'};
    да.click();
    await new Promise(r=>setTimeout(r,300));
    // на второй вопрос — про записи в журнале — отвечаем «оставить»
    const нет=[...document.querySelectorAll('.askw button')].find(x=>/отмен|нет/i.test(x.textContent));
    if(нет) нет.click();
    await new Promise(r=>setTimeout(r,300));
    return {убрано:!d.ex.some(e=>e.n===имя), имя};
  });
  chk(!убрали.err&&убрали.убрано,'3а. кнопка «убрать упражнение» сработала',
      убрали.err||('убрано «'+убрали.имя+'»'));
  await шаг('3. журнал цел после удаления упражнения из середины дня','void 0;');

  await шаг('4. добавили добавку',
    `const d=dayOf(today()); d.sp.push({w:'',n:'Новая',h:''}); save();`);
  await шаг('5. убрали добавку из середины',
    `const d=dayOf(today()); const j=0; const di=S.days.indexOf(d); d.sp.splice(j,1);
     Object.keys(S.rec).forEach(ds=>{ const rec=S.rec[ds]; if(!rec||!rec.sp||dayIdx(ds)!==di) return;
       const nx={}; Object.keys(rec.sp).forEach(k=>{const i=+k; if(i===j) return; nx[i>j?i-1:i]=rec.sp[k];}); rec.sp=nx; });
     save(); recomputeStats(1);`);
  await шаг('6. перенесли день на другую тренировку',
    `let ds=today(); for(let k=0;k<14;k++){const x=new Date();x.setDate(x.getDate()-k); if(dayOf(iso(x)).t!=='rest'){ds=iso(x);break;}}
     const низ=S.days.findIndex(d=>d.t==='lo1'); sel=ds; S.map[ds]=низ; remapLog(ds); save();`);
  await шаг('7. сняли перенос',
    `delete S.map[sel]; remapLog(sel); save();`);
  await шаг('8. стёрли упражнение из всего журнала',
    `const nm=(S.days.find(d=>d.t!=='rest').ex[0]||{}).n; purgeExercise(nm); save(); recomputeStats(1);`);
  await шаг('9. скопировали рацион поверх дня',
    `const y=iso(new Date(Date.now()-864e5));
     recRW(y).ml=[{n:'Обед',note:'',items:[{p:'Гречка отварная',g:'200'}]}];
     recRW(today()).ml=JSON.parse(JSON.stringify(mealsOf(y))); save();`);
  await шаг('10. пересчитали рабочие веса',
    `S.anchors={b:80,s:100,d:120}; deriveWeights(); save();`);
  await шаг('11. сменили тип дня недели',
    `const d=S.days.find(x=>x.t==='up2'); d.t='lo1'; const src=TPL.find(x=>x.t==='lo1'); d.s=src.s; save();`);
  await шаг('12. закрыли и отменили подход',
    `let ds=today(); for(let k=0;k<14;k++){const x=new Date();x.setDate(x.getDate()-k); if(dayOf(iso(x)).t!=='rest'){ds=iso(x);break;}}
     sel=ds; tab='wo'; edit=true; editPast=true; exOpen=0; render();
     toggleSet(0); toggleSet(0); save();`);

  // 14. перезагрузка: всё, что накопили, переживает уход со страницы
  await p.evaluate(()=>flush());
  await p.reload(); await p.waitForTimeout(1500);
  await p.evaluate(f=>{ window.ПРАВИЛА=eval('('+f+')'); },ПРАВИЛА.toString());
  const после=await p.evaluate(()=>{ entCache=null; return window.ПРАВИЛА(); });
  chk(после.length===0,'14. журнал цел и после перезагрузки',после.slice(0,3).join(' · ')||'цел');

  chk(errs.length===0,'15. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
