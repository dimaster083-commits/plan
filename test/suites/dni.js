/* Переходы по дням: прошлое открывается историей, будущее — планом,
   кнопка возврата к сегодня, правка прошедшего дня. */
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
  const past=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    S.setup=1;document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60};deriveWeights();
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    // закрытая тренировка неделю назад
    const pd=new Date(); pd.setDate(pd.getDate()-7); const ds=iso(pd);
    const day=dayOf(ds), r=recRW(ds); r.wo=1;
    (day.ex||[]).forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:'3',r:'8',w:'30',rs:['8','8','8'],vol:720,xp:12}; });
    save(); recomputeStats(1); tab='wo'; sel=today(); render();
    return ds;
  });

  // 1. прошедший день открывается историей, без полей ввода
  const hist=await p.evaluate(ds=>{
    sel=ds; editPast=false; exOpen=null; render();
    return { inputs:document.querySelectorAll('#exl input').length,
             txt:document.getElementById('scr-wo').innerText.slice(0,120).replace(/\n/g,' | '),
             back:!document.getElementById('toToday').hidden };
  }, past);
  chk(hist.inputs===0, '1. прошедший день показан историей, без полей ввода', 'полей '+hist.inputs);
  chk(hist.back, '2. появилась кнопка возврата к сегодня');

  // 3. кнопка возврата работает
  const back=await p.evaluate(()=>{ document.getElementById('toToday').click(); return sel===today(); });
  chk(back, '3. возврат к сегодня возвращает');

  // 4. «Править этот день» включает поля
  const edit=await p.evaluate(ds=>{
    sel=ds; editPast=false; exOpen=null; render();
    const btn=document.getElementById('editPast');
    if(!btn||btn.hidden) return {err:'кнопки правки нет'};
    btn.click();
    return { inputs:document.querySelectorAll('#exl input,#exl [data-open]').length, editPast };
  }, past);
  chk(!edit.err && edit.editPast, '4. прошедший день открывается на правку', edit.err||JSON.stringify(edit));

  // 5. будущий день — это план: отметить подход нельзя
  const fut=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    const d=new Date(); d.setDate(d.getDate()+3); sel=iso(d); editPast=false; exOpen=null; render();
    const xp0=S.xp;
    toggleSet(0);
    const done=!!((recOf(sel).log||{})[0]||{}).done;
    return { sel, done, xp:S.xp-xp0, finHidden:document.getElementById('fin').hidden,
             note:(document.getElementById('noteT')||{}).textContent||'' };
  });
  chk(!fut.done && fut.xp===0 && fut.finHidden,
      '5. в будущем дне подход не закрывается и опыт не идёт',
      JSON.stringify(fut));

  // 6. переход по чипам недели не теряет выбранную дату
  const chips=await p.evaluate(()=>{
    sel=today(); render();
    // список перерисовывается после каждого нажатия, поэтому элемент
    // берём заново — иначе жмём по выброшенным узлам
    const dates=[...document.querySelectorAll('#chips [data-d]')].map(c=>c.dataset.d);
    const out=[];
    dates.forEach(ds=>{
      const c=document.querySelector('#chips [data-d="'+ds+'"]');
      if(!c){ out.push(false); return; }
      c.click(); out.push(sel===ds);
    });
    return out;
  });
  chk(chips.every(Boolean), '6. каждый чип недели открывает свой день',
      chips.filter(Boolean).length+' из '+chips.length);

  // 7. день из календаря с записями открывается разбором
  const cal=await p.evaluate(async ds=>{
    tab='prog'; pSec='log'; calView='month'; mo=ds.slice(0,7); render(); cal();
    const cell=document.querySelector('#cgrid [data-cd="'+ds+'"]');
    if(!cell) return {err:'клетки нет'};
    cell.click();
    await new Promise(r=>setTimeout(r,250));
    const on=document.getElementById('sh').classList.contains('on');
    const t=document.getElementById('sh').innerText;
    sheetClose();
    return { on, has:/ПОДХОД|тонн|кг/i.test(t) };
  }, past);
  chk(!cal.err && cal.on && cal.has, '7. день с записями открывается разбором из журнала',
      cal.err||JSON.stringify(cal));

  // 8. пустой прошедший день из календаря просто открывается
  const empty=await p.evaluate(async ()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    const d=new Date(); d.setDate(d.getDate()-30); const ds=iso(d);
    tab='prog'; pSec='log'; calView='month'; mo=ds.slice(0,7); render(); cal();
    const cell=document.querySelector('#cgrid [data-cd="'+ds+'"]');
    if(!cell) return {err:'клетки нет'};
    cell.click();
    await new Promise(r=>setTimeout(r,250));
    return { tab, sel, sheet:document.getElementById('sh').classList.contains('on') };
  });
  chk(!empty.err && empty.tab==='wo' && !empty.sheet,
      '8. пустой день из журнала открывается как день, а не разбором', JSON.stringify(empty));

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
