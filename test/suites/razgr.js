/* Неделя разгрузки по плану идёт на 60% весов. Таблица «Прогрессия» и
   разбор не должны из-за этого показывать откат: рекорд-то вырос. */
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

  // история жима: 80 → 85 → 90 → и разгрузка 55
  const seed=await p.evaluate(()=>{
    S.setup=1; document.getElementById('setup').classList.remove('on'); S.sound=0;
    S.rec={};
    const день=S.days.find(d=>(d.ex||[]).some(e=>e.n==='Жим лёжа'));
    const j=день.ex.findIndex(e=>e.n==='Жим лёжа');
    const веса=[80,85,90,55];
    веса.forEach((w,i)=>{
      const d=new Date(); d.setDate(d.getDate()-(веса.length-i)*5);
      const ds=iso(d), r=recRW(ds);
      r.wo=1; r.log={}; r.log[j]={done:1,n:'Жим лёжа',g:'Грудь',s:'4',r:'8',w:w,rs:[8,8,8,8],vol:32*w,xp:12};
    });
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    return bestByDate('Жим лёжа').map(x=>x[1]);
  });
  chk(JSON.stringify(seed)==='[80,85,90,55]','1. история засеяна',seed.join(' → '));

  const r=await p.evaluate(()=>{
    const sh=strengthShift('Жим лёжа',30);
    const row=progressionRows().find(x=>x.n==='Жим лёжа');
    return {sh:sh, месяц:row.diff, всего:row.total, лучший:row.best};
  });
  chk(r.месяц>0,'2. «за месяц» не уходит в минус из-за разгрузки','за месяц '+r.месяц);
  chk(r.месяц===10,'3. и равен росту лучшего веса (80 → 90)',String(r.месяц));
  chk(r.всего===10,'4. «всего» тоже считает по лучшему',String(r.всего));
  chk(r.sh&&r.sh.to===90,'5. разбор берёт лучший вес, а не последний',JSON.stringify(r.sh));

  const текст=await p.evaluate(()=>{
    const f=analyze().find(x=>x.title==='СИЛА ЗА МЕСЯЦ');
    return f?f.text.replace(/<[^>]+>/g,''):'';
  });
  chk(/Жим лёжа \+10/.test(текст),'6. разбор пишет рост, а не застой',текст||'блока нет');

  // самопроверка: старая формула давала бы минус
  const старое=await p.evaluate(()=>{
    const h=bestByDate('Жим лёжа');
    return h[h.length-1][1]-h[0][1];
  });
  chk(старое<0,'7. самопроверка: старая формула показывала откат','старая давала '+старое);

  chk(errs.length===0,'8. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
