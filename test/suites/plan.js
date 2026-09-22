/* Питание, ИМТ и календарная нумерация недели: величины, которые человек
   видит каждый день, но которых не трогал ни один прогон. */
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
    S.height=177;S.age=30;save();});

  // 1. норма калорий растёт с весом и не выходит за человеческие рамки
  chk(await p.evaluate(()=>{
    const bad2=[];
    let prev=0;
    for(let w=45;w<=140;w+=5){
      S.bw=String(w); S.goal=String(w+15);
      const n=nutriFor('up1'), k=num(n.kc), pr=num(n.pr);
      if(k<=prev) bad2.push('калории не растут на '+w);
      prev=k;
      if(k<1200||k>6000) bad2.push(w+' кг → '+k+' ккал');
      if(pr<w*1.2||pr>w*3) bad2.push(w+' кг → '+pr+' г белка');
    }
    return bad2.slice(0,4).join('; ')||true;
  })===true, '1. норма калорий и белка растёт с весом и остаётся в рамках');

  // 2. похудение всегда ниже набора, отдых ниже тренировки
  chk(await p.evaluate(()=>{
    const bad2=[];
    for(let w=50;w<=120;w+=10){
      S.bw=String(w);
      S.goal=String(w+15); const up=num(nutriFor('up1').kc), upRest=num(nutriFor('rest').kc);
      S.goal=String(w-10); const dn=num(nutriFor('up1').kc);
      S.goal=String(w);    const keep=num(nutriFor('up1').kc);
      if(!(dn<keep&&keep<up)) bad2.push(w+': '+[dn,keep,up].join('/'));
      if(!(upRest<up)) bad2.push(w+': день отдыха не ниже тренировочного');
    }
    return bad2.slice(0,4).join('; ')||true;
  })===true, '2. режимы разведены: похудение < удержание < набор');

  // 3. руками вписанная норма не перетирается
  chk(await p.evaluate(()=>{
    S.bw='80'; S.goal='95'; S.kcManual=0; applyNutri();
    const auto=S.days[0].kc;
    S.days.forEach(d=>{d.kc='3000';}); S.kcManual=1;
    applyNutri();
    const kept=S.days[0].kc==='3000';
    S.kcManual=0; applyNutri();
    const back=S.days[0].kc!=='3000';
    return (kept&&back&&auto)?true:JSON.stringify({auto,kept,back});
  })===true, '3. вписанная руками норма держится, «вернуть расчёт» её снимает');

  // 4. ИМТ считается по росту и весу
  chk(await p.evaluate(()=>{
    S.height=180; S.bw='81';
    const b2=bmiOf();
    if(!b2) return 'ИМТ не посчитался';
    const want=81/(1.8*1.8);
    return Math.abs(num(b2.v)-want)<0.1?true:JSON.stringify({got:b2.v,want});
  })===true, '4. ИМТ равен весу на квадрат роста');

  // 5. календарная неделя не зависит от закрытых тренировок
  chk(await p.evaluate(()=>{
    S.rec={}; S.start='2026-09-14';
    const idle=planWeek('2026-09-21');
    // отмечаем четыре тренировки первой недели
    const mon=mondayOf(S.start);
    let added=0;
    for(let i=0;i<7&&added<4;i++){
      const d=new Date(mon+'T00:00:00'); d.setDate(d.getDate()+i);
      const ds=iso(d), day=dayOf(ds);
      if(day&&day.t!=='rest'){ recRW(ds).wo=1; added++; }
    }
    wkCache=null;
    const after=planWeek('2026-09-21');
    return (idle===2&&after===2&&weekCounts()[mon]===4)?true:JSON.stringify({idle,after,added});
  })===true, '5. неделя меняется по календарю, посещаемость учитывается отдельно');

  // 6. разгрузочная неделя снимает и подходы по календарному циклу.
  chk(await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    S.rec={}; const st=new Date(); st.setDate(st.getDate()-7*7); S.start=iso(st); save();
    const mon=mondayOf(S.start);
    for(let wk=0;wk<7;wk++){
      let added=0;
      for(let i=0;i<7&&added<4;i++){
        const d=new Date(mon+'T00:00:00'); d.setDate(d.getDate()+wk*7+i);
        const ds=iso(d), day=dayOf(ds);
        if(day&&day.t!=='rest'){ recRW(ds).wo=1; added++; }
      }
      save();
    }
    const weeks=[];
    for(let wk=0;wk<6;wk++){
      const d=new Date(mon+'T00:00:00'); d.setDate(d.getDate()+wk*7+1);
      const ds=iso(d);
      weeks.push({ds, w:planWeek(ds), ph:cycOf(ds).ph, sets:setsOf(ds,4,0)});
    }
    const dl=weeks.find(x=>x.ph==='РАЗГРУЗКА');
    const hard=weeks.find(x=>x.ph==='ПИК');
    if(!dl) return 'разгрузка не встретилась: '+weeks.map(x=>x.w+':'+x.ph).join(', ');
    if(!hard) return 'пиковая неделя не встретилась';
    return dl.sets<hard.sets?true:JSON.stringify({dl,hard});
  })===true, '6. на разгрузке подходов меньше, чем на пике');

  // 7. отдых зависит от упражнения, а не один на всех
  chk(await p.evaluate(()=>{
    const vals=Object.keys(EXDB).map(n=>restFor(n));
    const uniq=[...new Set(vals)];
    const base=restFor('Присед со штангой'), iso2=restFor('Махи в стороны');
    if(uniq.length<2) return 'у всех упражнений один отдых: '+uniq.join(',');
    return base>iso2?true:JSON.stringify({base,iso:iso2,uniq});
  })===true, '7. отдых после базы дольше, чем после изоляции');

  // 8. добавленное из каталога упражнение получает вес и группу
  chk(await p.evaluate(()=>{
    S.anchors={b:70,s:50,d:60};
    const name='Тяга Т-грифа';
    const w=startWeight(name);
    const g=EXDB[name][1];
    return (w>0&&g)?true:JSON.stringify({w,g});
  })===true, '8. упражнение из каталога получает стартовый вес');

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
