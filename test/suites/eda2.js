/* Рацион, шаблоны, добавки по датам и выгрузка в таблицу. */
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
    S.anchors={b:70,s:50,d:60};S.sound=0;save();tab='food';sel=today();render();});
  await p.waitForTimeout(250);

  // готовим вчерашний рацион
  const prep=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    const d=new Date(); d.setDate(d.getDate()-1); const y=iso(d);
    const m=mealsRW(y); m.length=0;
    m.push({n:'Завтрак',note:'',items:[{p:'Рис белый отварной',g:'200'},{p:'Творог 5%',g:'150'}]});
    save();
    return { y, k:Math.round(sumMeals(mealsOf(y)).k) };
  });
  chk(prep.k>0, '1. вчерашний рацион записан', prep.y+' — '+prep.k+' ккал');

  // 2. копирование из прошедшего дня
  const cp=await p.evaluate(async ()=>{
    const before=Math.round(sumMeals(mealsOf(sel)).k);
    openRation();
    await new Promise(r=>setTimeout(r,300));
    const btn=document.querySelector('#sh [data-from]');
    if(!btn) return {err:'нет дней для копирования'};
    const from=btn.dataset.from;
    btn.click();
    await new Promise(r=>setTimeout(r,350));
    if(document.getElementById('ask').classList.contains('on')){ try{askClose(true)}catch(e){} }
    await new Promise(r=>setTimeout(r,300));
    return { before, from, after:Math.round(sumMeals(mealsOf(sel)).k),
             items:mealsOf(sel).map(m=>(m.items||[]).map(i=>i.p).join(',')).join(' | ') };
  });
  if(cp.err) bad('2. копирование рациона', cp.err);
  else chk(cp.after>cp.before && /Рис|Творог/.test(cp.items),
           '2. рацион скопировался в текущий день', cp.before+' → '+cp.after+' ккал');

  // 3. копия не стёрла источник
  const src=await p.evaluate(y=>Math.round(sumMeals(mealsOf(y)).k), prep.y);
  chk(src===prep.k, '3. день-источник не тронут', src+' ккал');

  // 4. шаблон сохраняется и применяется
  const tpl=await p.evaluate(async ()=>{
    openRation(); await new Promise(r=>setTimeout(r,250));
    const save1=document.querySelector('#sh [data-save]');
    if(!save1) return {err:'нет кнопки сохранения шаблона'};
    save1.click();
    await new Promise(r=>setTimeout(r,250));
    if(document.getElementById('ask').classList.contains('on')){ try{askClose(true)}catch(e){} }
    await new Promise(r=>setTimeout(r,300));
    const n=(S.tpl||[]).length;
    // применяем на другой день
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    const d2=new Date(); d2.setDate(d2.getDate()-3); sel=iso(d2);
    mealsRW(sel).length=0; save(); render();
    openRation(); await new Promise(r=>setTimeout(r,250));
    const t=document.querySelector('#sh [data-tpl]');
    if(!t) return {err:'шаблон не появился в списке', n};
    t.click();
    await new Promise(r=>setTimeout(r,300));
    if(document.getElementById('ask').classList.contains('on')){ try{askClose(true)}catch(e){} }
    await new Promise(r=>setTimeout(r,300));
    return { n, k:Math.round(sumMeals(mealsOf(sel)).k), day:sel };
  });
  if(tpl.err) bad('4. шаблоны рациона', tpl.err+(tpl.n!==undefined?(' (шаблонов '+tpl.n+')'):''));
  else chk(tpl.n>0 && tpl.k>0, '4. шаблон сохраняется и применяется к другому дню',
           'шаблонов '+tpl.n+', в дне '+tpl.k+' ккал');

  // 5. добавки отмечаются по дате, а не на все дни
  const sp=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    const a=iso(new Date()), d2=new Date(); d2.setDate(d2.getDate()-5); const bday=iso(d2);
    sel=a; tab='food'; render();
    const box=document.querySelector('#spl [data-tog]');
    if(!box) return {err:'списка добавок нет'};
    box.click();
    const onA=(recOf(a).sp||{})[box.dataset.tog];
    const onB=(recOf(bday).sp||{})[box.dataset.tog];
    return { onA:!!onA, onB:!!onB };
  });
  if(sp.err) bad('5. добавки', sp.err);
  else chk(sp.onA && !sp.onB, '5. отметка добавки принадлежит дате', JSON.stringify(sp));

  // 6. выгрузка в таблицу собирается и содержит журнал
  const csv=await p.evaluate(()=>{
    try{
      const t=buildCsv();
      const lines=t.split('\n');
      return { ok:true, lines:lines.length, head:lines[0].slice(0,60),
               semis:lines.slice(1).every(l=>!l||l.split(';').length===lines[0].split(';').length),
               hasDate:/\d{4}-\d{2}-\d{2}/.test(t) };
    }catch(e){ return { ok:false, err:e.message }; }
  });
  chk(csv.ok && csv.lines>1 && csv.semis, '6. таблица собирается, столбцы не разъезжаются',
      csv.ok?('строк '+csv.lines+', столбцы ровные: '+csv.semis):csv.err);

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
