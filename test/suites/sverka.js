/* Сверка вкладок: вес в таблице «План» должен совпадать с тем, что зал
   подставляет в упражнение. Таблица считала по своей сетке 2,5 кг. */
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
  await p.goto(APP); await p.waitForTimeout(1300);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');S.sound=0;save();});

  // Самопроверка: старая формула таблицы (своя сетка 2,5 кг) на лёгких
  // упражнениях обязана разойтись с залом — иначе сверка ниже ничего не стоит.
  const res=await p.evaluate(()=>{
    const r25=v=>Math.round(v/2.5)*2.5, out=[];
    for(let wk=0; wk<6; wk++){
      const d=new Date(); d.setDate(d.getDate()-wk*7);
      S.start=mondayOf(iso(d)); save();
      const seen={};
      S.days.forEach(day=>{
        if(day.t==='rest') return;
        const IN=intOf(today(), day.t);
        day.ex.forEach(e=>{
          if(seen[e.n]) return; seen[e.n]=1;
          const zal=weightFor(e, IN, today());
          const old=num(e.w)?Math.max(2.5, r25(num(e.w)*(IN?IN[0]:1)*rampOf(today()))):0;
          if(zal!==old) out.push('неделя '+(wk+1)+' '+e.n+': зал '+zal+' старая таблица '+old);
        });
      });
    }
    return out;
  });
  chk(res.length>0,'1. самопроверка: старая сетка таблицы расходилась с залом',
      res.length?('расхождений '+res.length+', например: '+res[0]):'НЕ РАСХОДИТСЯ — сверка бесполезна');

  // таблица «План» рисуется из разметки — сверяем с числом из зала построчно
  const tab=await p.evaluate(()=>{
    S.start=mondayOf(today()); save();
    tab='prog'; pSec='prog'; render(); paintSections();
    const rows=[...document.querySelectorAll('#wtab tr')].map(tr=>
      [...tr.children].map(td=>td.textContent.trim()));
    const zal={}; const seen={};
    S.days.forEach(day=>{ if(day.t==='rest') return;
      const IN=intOf(today(), day.t);
      day.ex.forEach(e=>{ if(seen[e.n]) return; seen[e.n]=1; zal[e.n]=weightFor(e,IN,today()); }); });
    const bad=[];
    rows.forEach(r=>{
      if(r.length<4) return;
      const n=r[0], shown=r[3].replace(',', '.').replace(/[^0-9.]/g,'');
      if(zal[n]===undefined) return;
      if(!zal[n]) return;
      if(Math.abs(parseFloat(shown)-zal[n])>0.01) bad.push(n+': в таблице '+shown+', в зале '+zal[n]);
    });
    return {rows:rows.length, bad:bad};
  });
  chk(tab.rows>5,'2. таблица плана не пустая','строк '+tab.rows);
  chk(tab.bad.length===0,'3. каждая строка таблицы совпадает с залом',tab.bad.join('; ')||'совпадает');

  // стартовые веса лёгких упражнений ложатся на килограммовую сетку
  const st=await p.evaluate(()=>{
    const bad=[];
    Object.keys(EXDB).forEach(n=>{
      const w=startWeight(n);
      if(!w) return;
      const g=granOf(w);
      if(Math.abs(w/g-Math.round(w/g))>1e-9) bad.push(n+'='+w);
    });
    return bad;
  });
  chk(st.length===0,'4. стартовые веса лежат на своей сетке',st.join(', ')||'все на сетке');

  // и прибавка от стартового веса не проваливается
  const step=await p.evaluate(()=>{
    const bad=[];
    Object.keys(EXDB).forEach(n=>{
      const w=startWeight(n); if(!w) return;
      const s=stepFor({w:String(w), g:'Руки'});
      if(s<=0) bad.push(n+' вес '+w+' шаг '+s);
    });
    return bad;
  });
  chk(step.length===0,'5. от стартового веса прибавка не нулевая',step.join(', ')||'везде растёт');

  chk(errs.length===0,'6. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
