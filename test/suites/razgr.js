/* Последняя облегчённая тренировка не должна скрывать рост лучшего веса.
   Здесь нормировка нейтральная; 60% разгрузки цикла проверяет cikl.js. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  // Keep the fixture inside its 30-day window in future CI runs as well.
  await p.clock.setFixedTime(new Date('2026-10-10T02:00:00Z'));
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // история жима: 80 → 85 → 90 → и облегчённая тренировка 55
  const seed=await p.evaluate(()=>{
    S.setup=1; document.getElementById('setup').classList.remove('on'); S.sound=0;
    S.rec={}; S.start='2026-10-05'; S.returning=0;
    const день=S.days.find(d=>(d.ex||[]).some(e=>e.n==='Жим лёжа'));
    const j=день.ex.findIndex(e=>e.n==='Жим лёжа');
    const веса=[80,85,90,55];
    const даты=['2026-09-19','2026-09-24','2026-09-29','2026-10-04'];
    веса.forEach((w,i)=>{
      const ds=даты[i], r=recRW(ds);
      r.dt='up1';
      r.wo=1; r.log={}; r.log[j]={done:1,n:'Жим лёжа',g:'Грудь',s:'4',r:'8',w:w,rs:[8,8,8,8],vol:32*w,xp:12};
    });
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    return bestByDate('Жим лёжа').map(x=>x[1]);
  });
  chk(JSON.stringify(seed)==='[80,85,90,55]','1. история засеяна',seed.join(' → '));
  const factors=await p.evaluate(()=>Object.keys(S.rec).sort().map(ds=>intFactor(ds)));
  chk(factors.length===4&&factors.every(k=>k===1),'нормировка фиксированной истории нейтральная',factors.join(', '));

  /* История до старта плана имеет интенсивность 1. Проверяем независимо
     от календаря: конец берётся по лучшему весу, а не последнему облегчённому. */
  const r=await p.evaluate(()=>{
    const sh=strengthShift('Жим лёжа',30);
    const row=progressionRows().find(x=>x.n==='Жим лёжа');
    const norm=bestByDate('Жим лёжа',true);
    const порядок=norm.map(x=>x[0]);
    return {sh:sh, месяц:row.diff, всего:row.total, лучший:row.best,
      первый:roundW(norm[0][1]),
      лучшийНорм:roundW(Math.max(...norm.map(x=>x[1]))),
      последний:roundW(norm[norm.length-1][1]),
      дат:порядок.length};
  });
  chk(r.месяц>0,'2. «за месяц» не уходит в минус из-за облегчённой тренировки','за месяц '+r.месяц);
  chk(r.месяц===r.лучшийНорм-r.первый,'3. и равен росту лучшего веса, а не последнего',r.первый+' → '+r.лучшийНорм);
  chk(r.всего===10,'4. «всего» тоже считает по лучшему',String(r.всего));
  chk(r.sh&&r.sh.to===r.лучшийНорм&&r.sh.to>r.последний,
    '5. разбор берёт лучший вес, а не последний',JSON.stringify(r.sh)+' последний '+r.последний);

  const текст=await p.evaluate(()=>{
    const f=analyze().find(x=>x.title==='СИЛА ЗА МЕСЯЦ');
    return f?f.text.replace(/<[^>]+>/g,''):'';
  });
  chk(/Жим лёжа \+[\d,]+/.test(текст),'6. разбор пишет рост, а не застой',текст||'блока нет');

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
