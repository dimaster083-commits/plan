/* Двойная прогрессия целиком, через интерфейс. На лёгкой неделе
   приложение нарочно предлагает вес ниже рабочего, и сделанное на нём
   рабочий не поднимает — это правильно. Поэтому в поле веса ставим
   рабочий вес и проверяем саму прогрессию. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);

// заполнить карточку и закрыть подход; reps — массив повторов
const CLOSE = ([w, reps]) => {
  exOpen = 0; render();
  const wf = document.querySelector('#exl [data-f="w"]');
  if (wf) { wf.value = String(w);
    wf.dispatchEvent(new Event('input', { bubbles:true }));
    wf.dispatchEvent(new Event('change', { bubbles:true })); }
  document.querySelectorAll('#exl [data-rs]').forEach((i2, k) => {
    i2.value = String(reps[Math.min(k, reps.length - 1)]);
    i2.dispatchEvent(new Event('input', { bubbles:true }));
  });
  document.querySelector('#exl [data-go]').click();
};
const TOGGLE = () => { exOpen = 0; render(); document.querySelector('#exl [data-go]').click(); };
const WS = n => S.days.flatMap(d => (d.ex || [])).filter(x => x.n === n).map(x => num(x.w));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  for (const skin of ['sl']) {
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1400);
    await p.evaluate(s2=>{ S.setup=1; document.getElementById('setup').classList.remove('on');
      void s2; S.anchors={b:70,s:50,d:60}; S.sound=0;
      const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
      S.start=today(); save(); recomputeStats(1); tab='wo'; sel=today(); exOpen=0; render(); }, skin);
    await p.waitForTimeout(350);

    const info=await p.evaluate(()=>{ const e=dayOf(sel).ex[0];
      return { n:e.n, w:num(e.w), top:topRep(e.r), sets:num(e.s),
               places:S.days.flatMap(d=>(d.ex||[])).filter(x=>x.n===e.n).length }; });
    chk(info.places>=1 && info.top>0, '1. упражнение с верхней границей найдено', JSON.stringify(info));

    // 2. недобор одного повтора
    const shortReps=[info.top-1].concat(new Array(info.sets-1).fill(info.top));
    await p.evaluate(CLOSE, [info.w, shortReps]);
    await p.waitForTimeout(250);
    const w2=await p.evaluate(WS, info.n);
    chk(w2.every(x=>x===info.w), '2. недобор одного повтора не поднимает вес', info.w+' → '+w2.join(','));
    await p.evaluate(TOGGLE); await p.waitForTimeout(250);

    // 3-6. все подходы по верхней границе
    await p.evaluate(CLOSE, [info.w, [info.top]]);
    await p.waitForTimeout(300);
    const after=await p.evaluate(n=>({ ws:S.days.flatMap(d=>(d.ex||[])).filter(x=>x.n===n).map(x=>num(x.w)),
      note:(document.getElementById('noteT')||{}).textContent||'' }), info.n);
    chk(after.ws[0]>info.w, '3. закреплённый верх поднимает рабочий вес', info.w+' → '+after.ws[0]);
    chk(after.ws.every(x=>x===after.ws[0]), '4. поднялось во всех днях программы', after.ws.join(','));
    chk(/подн/i.test(after.note), '5. про подъём сказано вслух', after.note.slice(0,80));
    chk(after.ws[0]-info.w>0 && after.ws[0]-info.w<=10, '6. шаг прибавки разумный', '+'+(after.ws[0]-info.w));

    // 7. снятая отметка возвращает как было
    await p.evaluate(TOGGLE); await p.waitForTimeout(300);
    const undo=await p.evaluate(n=>({ ws:S.days.flatMap(d=>(d.ex||[])).filter(x=>x.n===n).map(x=>num(x.w)),
      done:(recOf(sel).log[0]||{}).done||0 }), info.n);
    chk(undo.ws.every(x=>x===info.w) && !undo.done, '7. отмена возвращает вес в точности', undo.ws.join(','));

    // 8. снять и закрыть заново — прибавка одна
    await p.evaluate(CLOSE, [info.w, [info.top]]); await p.waitForTimeout(280);
    const a1=(await p.evaluate(WS, info.n))[0];
    await p.evaluate(TOGGLE); await p.waitForTimeout(250);
    await p.evaluate(CLOSE, [info.w, [info.top]]); await p.waitForTimeout(280);
    const a2=(await p.evaluate(WS, info.n))[0];
    chk(a1===a2, '8. повторное закрытие не удваивает прибавку', a1+' / '+a2);

    // 9. следующая тренировка на новом рабочем весе поднимает его снова
    await p.evaluate(TOGGLE); await p.waitForTimeout(250);   // снять прошлую отметку
    const newW=(await p.evaluate(WS, info.n))[0];
    await p.evaluate(CLOSE, [newW, [info.top]]); await p.waitForTimeout(300);
    const a3=(await p.evaluate(WS, info.n))[0];
    chk(a3>newW, '9. на новом рабочем весе прибавка идёт дальше', newW+' → '+a3);

    // 10. тоннаж по группам сходится с журналом
    const ton=await p.evaluate(()=>{ recomputeStats(1); entCache=null;
      if (!Object.keys(recOf(sel).log||{}).length) return { mine:-1, app:-1 };
      let mine=0; Object.keys(S.rec).forEach(ds=>dayEntries(ds).forEach(e=>{mine+=e.vol;}));
      return { mine:Math.round(mine), app:Math.round(GROUPS.reduce((a,[n])=>a+num(S.vol[n]),0)) }; });
    chk(Math.abs(ton.mine-ton.app)<2, '10. тоннаж по группам равен тоннажу по журналу', JSON.stringify(ton));

    // 11. рекорд не появляется из воздуха
    const pr=await p.evaluate(n=>({ pr:num((S.pr||{})[n]||0), w:num(S.days.flatMap(d=>(d.ex||[])).find(x=>x.n===n).w) }), info.n);
    chk(pr.pr<=pr.w+0.01, '11. личный рекорд не выше поднятого веса', JSON.stringify(pr));

    if(errs.length) bad('ошибки JS',[...new Set(errs)].join(' | '));
    await p.close();
  }
  await b.close();
  console.log('\nпровалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
