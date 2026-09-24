/* Настройки: звук, пересчёт весов и то, что пересчёт не стирает
   поднятое прогрессией. */
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
    S.anchors={b:70,s:50,d:60};deriveWeights();save();tab='wo';sel=today();render();});

  // 1. звук выключается и держится
  const snd=await p.evaluate(async ()=>{
    openSettings(); await new Promise(r=>setTimeout(r,250));
    const btn=document.querySelector('#shB [data-snd]');
    if(!btn) return {err:'кнопки звука нет'};
    const was=S.sound===0?0:1;
    btn.click(); await new Promise(r=>setTimeout(r,250));
    const now=S.sound===0?0:1;
    const btn2=document.querySelector('#shB [data-snd]');
    return { was, now, label:btn2?btn2.textContent.trim():'' };
  });
  chk(!snd.err && snd.was!==snd.now, '1. звук переключается', snd.err||(snd.was+' → '+snd.now+' · '+snd.label));

  const kept=await p.evaluate(async ()=>{ flush(); return S.sound; });
  await p.reload(); await p.waitForTimeout(1300);
  const after=await p.evaluate(()=>S.sound);
  chk(String(after)===String(kept), '2. выбор звука переживает перезагрузку', kept+' → '+after);

  // 3. пересчёт весов не стирает поднятое прогрессией
  const rec=await p.evaluate(()=>{
    S.setup=1; document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60}; deriveWeights(); save();
    const name=S.days.flatMap(d=>(d.ex||[])).map(e=>e.n)[0];
    const before=S.days.flatMap(d=>(d.ex||[])).filter(e=>e.n===name).map(e=>num(e.w))[0];
    bumpWorking(name, before+10, []);
    const raised=S.days.flatMap(d=>(d.ex||[])).filter(e=>e.n===name).map(e=>num(e.w))[0];
    // «пересчитать веса» с теми же опорными
    deriveWeights(); save();
    const afterCalc=S.days.flatMap(d=>(d.ex||[])).filter(e=>e.n===name).map(e=>num(e.w))[0];
    // и с другими опорными
    S.anchors={b:90,s:70,d:80}; deriveWeights(); save();
    const other=S.days.flatMap(d=>(d.ex||[])).filter(e=>e.n===name).map(e=>num(e.w))[0];
    const notFixed=S.days.flatMap(d=>(d.ex||[])).filter(e=>!e.fixed&&e.n!==name).map(e=>num(e.w));
    return { name, before, raised, afterCalc, other, notFixedChanged:notFixed.length>0 };
  });
  chk(rec.raised>rec.before, '3. вес поднялся прогрессией', rec.before+' → '+rec.raised);
  chk(rec.afterCalc===rec.raised, '4. пересчёт с теми же опорными не сбрасывает поднятое',
      rec.raised+' → '+rec.afterCalc);
  chk(rec.other===rec.raised, '5. пересчёт с новыми опорными тоже не трогает поднятое руками',
      rec.raised+' → '+rec.other);

  // 6. остальные веса от новых опорных всё-таки изменились
  const moved=await p.evaluate(()=>{
    S.anchors={b:70,s:50,d:60}; deriveWeights(); save();
    const a=S.days.flatMap(d=>(d.ex||[])).filter(e=>!e.fixed).map(e=>num(e.w));
    S.anchors={b:100,s:80,d:90}; deriveWeights(); save();
    const b2=S.days.flatMap(d=>(d.ex||[])).filter(e=>!e.fixed).map(e=>num(e.w));
    return { changed:a.some((v,i)=>v!==b2[i]), n:a.length };
  });
  chk(moved.changed, '6. незакреплённые веса идут за опорными', 'упражнений '+moved.n);

  // 7. «настроить тренировку этого дня» из настроек открывает правку
  const dayset=await p.evaluate(async ()=>{
    openSettings(); await new Promise(r=>setTimeout(r,250));
    const btn=document.querySelector('#shB [data-dayset]');
    if(!btn) return {err:'кнопки нет'};
    btn.click(); await new Promise(r=>setTimeout(r,300));
    return { tab, edit, sheet:document.getElementById('sh').classList.contains('on') };
  });
  chk(!dayset.err && dayset.tab==='wo' && dayset.edit && !dayset.sheet,
      '7. настройка дня открывается из настроек', dayset.err||JSON.stringify(dayset));

  // 8. «пересчитать» честно спрашивает про поднятые веса и умеет их сбросить
  const full=await p.evaluate(async ()=>{
    S.anchors={b:70,s:50,d:60}; S.days.forEach(d=>(d.ex||[]).forEach(e=>{delete e.fixed;}));
    deriveWeights(); save();
    const name=S.days.flatMap(d=>(d.ex||[])).map(e=>e.n)[0];
    const base=S.days.flatMap(d=>(d.ex||[])).filter(e=>e.n===name).map(e=>num(e.w))[0];
    bumpWorking(name, base+10, []); save();
    const raised=S.days.flatMap(d=>(d.ex||[])).filter(e=>e.n===name).map(e=>num(e.w))[0];
    S.bw='75'; openSetup(); await new Promise(r=>setTimeout(r,250));   // у человека есть свой вес: без него настройка не проходит
    document.getElementById('setOk').click();
    await new Promise(r=>setTimeout(r,250));
    const asked=document.getElementById('ask').classList.contains('on');
    const txt=document.getElementById('ask').innerText;
    try{askClose(true)}catch(e){}
    await new Promise(r=>setTimeout(r,350));
    const afterReset=S.days.flatMap(d=>(d.ex||[])).filter(e=>e.n===name).map(e=>num(e.w))[0];
    return { base, raised, asked, afterReset, mentions:/поднят/i.test(txt) };
  });
  chk(full.asked && full.mentions, '8. пересчёт спрашивает про поднятые веса',
      full.asked?'спросил':'не спросил');
  chk(full.afterReset===full.base, '9. согласие сбрасывает поднятое к расчётному',
      full.raised+' → '+full.afterReset+' (расчётный '+full.base+')');

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
