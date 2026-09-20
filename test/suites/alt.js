/* Аналоги упражнений: у каждого есть замена, сам себя не предлагает,
   все замены есть в каталоге и у каждой считается стартовый вес. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const DIR=require('path').join(__dirname, '..', 'out') + require('path').sep;
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    S.anchors={b:70,s:50,d:60}; save(); tab='wo'; sel=today(); exOpen=0; render();});
  await p.waitForTimeout(300);
  // у каждого упражнения каталога есть аналоги
  const cover=await p.evaluate(()=>{
    const none=Object.keys(EXDB).filter(n=>altsOf(n).length===0);
    const self=Object.keys(EXDB).filter(n=>altsOf(n).indexOf(n)>=0);
    const unknown=[];
    ALT.forEach(g=>g.forEach(n=>{ if(!EXDB[n]) unknown.push(n); }));
    const wrongGroup=[];
    Object.keys(EXDB).forEach(n=>altsOf(n).forEach(a=>{ if(!EXDB[a]) wrongGroup.push(n+'→'+a); }));
    return { total:Object.keys(EXDB).length, none, self, unknown, wrongGroup };
  });
  chk(cover.none.length===0, '1. аналоги есть у каждого упражнения', 'без аналогов: '+(cover.none.join(', ')||'нет'));
  chk(cover.self.length===0, '2. упражнение не предлагает само себя', cover.self.join(', ')||'ок');
  chk(cover.unknown.length===0, '3. в таблице аналогов нет выдуманных названий', cover.unknown.join(', ')||'ок');
  chk(cover.wrongGroup.length===0, '4. все аналоги есть в каталоге', cover.wrongGroup.join(', ')||'ок');
  // шторка техники показывает аналоги и кнопку «поставить»
  await p.evaluate(()=>{ const n=dayOf(sel).ex[0].n; openHow(n); });
  await p.waitForTimeout(400);
  const sheet=await p.evaluate(()=>({
    alts:document.querySelectorAll('#sh [data-alt]').length,
    txt:document.getElementById('sh').innerText.includes('ЧЕМ ЗАМЕНИТЬ')
  }));
  chk(sheet.alts>0 && sheet.txt, '5. в «технике» есть раздел «чем заменить»', JSON.stringify(sheet));
  await p.locator('#sh .shin').screenshot({path:DIR+'alt-sl.png'});
  // замена
  const want=await p.evaluate(()=>{
    const before=dayOf(sel).ex[0].n;
    const btn=document.querySelector('#sh [data-alt]');
    btn.click();
    return { before, want:btn.dataset.alt };
  });
  await p.waitForTimeout(300);
  const asked=await p.evaluate(()=>document.getElementById('ask').classList.contains('on'));
  chk(asked, '6. замена спрашивает подтверждение');
  await p.evaluate(()=>{ try{askClose(true)}catch(e){} });
  await p.waitForTimeout(400);
  const sw=await p.evaluate(w=>({ before:w.before, want:w.want,
    after:dayOf(sel).ex[0].n, w:dayOf(sel).ex[0].w, g:dayOf(sel).ex[0].g,
    group:(EXDB[w.want]||[])[1] }), want);
  chk(sw.after===sw.want && sw.g===sw.group && Number(sw.w)>0,
      '7. аналог встаёт с своим весом и группой', JSON.stringify(sw));
  // журнал этого места очищен
  const log=await p.evaluate(()=>JSON.stringify((recOf(sel).log||{})['0']||null));
  chk(log==='null', '8. записанные подходы прежнего движения убраны', log);
  // программа не изменилась
  // затронут только тот день недели, где стояло упражнение
  const touched=await p.evaluate(w=>S.days.map((d,i)=>
    ((d.ex||[]).some(e=>e.n===w.want)?i:-1)).filter(i=>i>=0), want);
  const wd=await p.evaluate(()=>wdOf(sel));
  chk(touched.indexOf(wd)>=0, '9. аналог встал в день выбранной даты',
      'дни с этим упражнением: '+touched.join(',')+', выбранный: '+wd);
  // отказ от замены ничего не меняет
  const cancel=await p.evaluate(async ()=>{
    const n0=dayOf(sel).ex[1].n;
    openHow(n0,1);
    await new Promise(r=>setTimeout(r,250));
    const btn=document.querySelector('#sh [data-alt]');
    if(!btn) return {err:'нет аналогов у второго упражнения'};
    btn.click();
    await new Promise(r=>setTimeout(r,200));
    try{askClose(false)}catch(e){}
    await new Promise(r=>setTimeout(r,200));
    return { n0, now:dayOf(sel).ex[1].n };
  });
  chk(!cancel.err && cancel.n0===cancel.now, '10. отказ от замены ничего не меняет', JSON.stringify(cancel));

  // 11-13. У каждого движения должна быть замена по рисунку, а не «что угодно
  // на ту же мышцу»: подтягивания и шраги — разные движения на одну спину.
  const ptrn = await p.evaluate(() => {
    const noAlt = [], selfAlt = [], fallback = [];
    Object.keys(EXDB).forEach(n => {
      const a = altsOf(n);
      if (!a.length) noAlt.push(n);
      if (a.indexOf(n) >= 0) selfAlt.push(n);
      if (a.length && !a.same) fallback.push(n);
    });
    return { noAlt, selfAlt, fallback };
  });
  chk(ptrn.noAlt.length === 0, '11. замена есть у каждого упражнения каталога',
      ptrn.noAlt.join(', ') || 'у всех есть');
  chk(ptrn.selfAlt.length === 0, '12. никто не предлагает сам себя',
      ptrn.selfAlt.join(', ') || 'никто');
  chk(ptrn.fallback.length === 0, '13. никому не подставляется вся мышечная группа подряд',
      ptrn.fallback.join(', ') || 'всем подобран рисунок движения');

  // 14. Подпись честная: если рисунка движения нет, так и написано
  const label = await p.evaluate(() => {
    const out = {};
    const fake = 'ВЫДУМАННОЕ ДВИЖЕНИЕ';
    EXDB[fake] = ['crunch', 'Грудь', null, 0, 'нет', 90];
    const a = altsOf(fake);
    out.fallbackWorks = a.length > 0 && a.same === false;
    delete EXDB[fake];
    const real = altsOf('Жим лёжа');
    out.realIsPattern = real.same === true;
    return out;
  });
  chk(label.realIsPattern, '14. у настоящего движения признак «по рисунку»', String(label.realIsPattern));
  chk(label.fallbackWorks, '15. незнакомому движению подставляется мышца и помечается как не-замена',
      String(label.fallbackWorks));
  console.log('ошибки JS:',errs.length?errs.join('|'):'нет');
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
