/* Рекорды по видам и график упражнения (фишки из Lyfta).
   Вес тот же, а повторов больше — это рекорд по ≈1ПМ, подходу и объёму:
   бонус опыта при закрытии, откат при снятой отметке. График с
   переключателем ≈1ПМ / Вес / Объём не растягивает подписи. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  // Record XP is tested independently of month quests; both sessions stay in October.
  await p.addInitScript(() => {
    const RealDate = Date, offset = new RealDate(2026, 9, 15, 12).getTime() - RealDate.now();
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset])); }
      static now() { return RealDate.now() + offset; }
    };
  });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const prep=(past)=>p.evaluate((past)=>{ S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on'); S.rec={}; S.pr={};
    window._notes=[]; if(!window._noteWrapped){ const o=note; note=t=>{_notes.push(String(t)); return o(t);}; window._noteWrapped=1; }
    const z=new Date(); z.setDate(z.getDate()-5); const ds=iso(z);
    if(past){ S.rec[ds]={log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'80',s:'3',r:'8',rs:[8,8,8],vol:1920,sd:1}}}; S.pr['Жим лёжа']=80; }
    const d=dayOf(today()); d.t='up1'; d.s='тест'; d.ex=[{n:'Жим лёжа',s:3,r:'8-10',w:80,g:'Грудь'}];
    checkQuests=()=>{};   // квест месяца даёт свой опыт и снятой отметкой не снимается — здесь считаем только рекорды
    entCache=null; save(); tab='wo'; sel=today(); exOpen=0; render(); },past);
  const fill=vals=>p.evaluate(vals=>{
    const c=document.querySelector('.ex[data-j="0"]'); c.querySelector('[data-f="w"]').value='80';
    c.querySelector('[data-f="s"]').value=String(vals.length); c.querySelector('[data-f="s"]').dispatchEvent(new Event('input',{bubbles:true}));
    [...c.querySelectorAll('[data-rs]')].forEach((x,i)=>{ x.value=String(vals[i]); });
  },vals);

  // 1–3. тот же вес, больше повторов
  await prep(true);
  await fill([10,10,8]);
  const r1=await p.evaluate(()=>{ const xp0=S.xp; toggleSet(0); const l=recOf(today()).log[0];
    return {recs:(l.recs||[]).map(x=>x.k).join(','), xp:l.xp, dxp:S.xp-xp0, notes:_notes.join(' | '), pr:S.pr['Жим лёжа'],
      flag:dayEntries(today())[0].pr, xp0}; });
  chk(r1.recs==='e1,set,vol','1. вес прежний, повторов больше — рекорд по ≈1ПМ, подходу и объёму',r1.recs||'нет');
  chk(r1.xp===XP_PR_TEST(r1)&&/РЕКОРД/.test(r1.notes)&&/≈1ПМ/.test(r1.notes),'2. бонус опыта и сообщение о рекорде',r1.xp+' · '+r1.notes);
  chk(r1.pr===80&&r1.flag,'3. рекорд веса не тронут, запись помечена рекордом',JSON.stringify({pr:r1.pr,flag:r1.flag}));
  const sum=await p.evaluate(()=>{ workoutSummary(today()); const t=document.getElementById('sh').textContent; sheetClose(); return t; });
  chk(/НОВЫЕ РЕКОРДЫ/.test(sum)&&/≈1ПМ/.test(sum)&&/80×10/.test(sum),'4. итог тренировки перечисляет рекорды по видам',sum.replace(/\s+/g,' ').slice(0,160));
  const r5=await p.evaluate(()=>{ toggleSet(0); const l=recOf(today()).log[0]; return {recs:l.recs, xp:S.xp}; });
  chk(r5.recs===undefined&&r5.xp===r1.xp0,'5. снятая отметка убирает рекорды и опыт',JSON.stringify(r5));

  // 6. первая запись упражнения — не рекорд
  await prep(false);
  await fill([8,8,8]);
  const r6=await p.evaluate(()=>{ toggleSet(0); const l=recOf(today()).log[0]; return {recs:l.recs, xp:l.xp}; });
  chk(r6.recs===undefined&&r6.xp!==30,'6. первая запись — не рекорд, сравнивать не с чем',JSON.stringify(r6));

  // 7–10. карточка: полоса рекордов и график с переключателем
  await prep(true);
  await fill([10,10,8]);
  const r7=await p.evaluate(()=>{ toggleSet(0); exOpen=0; render(); const c=document.querySelector('.ex[data-j="0"]');
    const cells=[...c.querySelectorAll('.recg > div')].map(x=>x.textContent.replace(/\s+/g,' ').trim());
    const svg=c.querySelector('.exfhist svg');
    return {cells, btn:[...c.querySelectorAll('[data-exch]')].map(x=>x.textContent+(x.classList.contains('on')?'*':'')).join(' '),
      par:svg&&svg.getAttribute('preserveAspectRatio'), ar:svg?(svg.getBoundingClientRect().width/svg.getBoundingClientRect().height):0}; });
  chk(r7.cells.length===4&&/80×10/.test(r7.cells.join('|')),'7. в карточке — четыре рекорда: вес, ≈1ПМ, подход, объём',r7.cells.join(' | '));
  chk(r7.btn==='≈1ПМ* Вес Объём','8. график с переключателем, по умолчанию ≈1ПМ',r7.btn);
  chk(r7.par!=='none'&&Math.abs(r7.ar-300/110)<0.15,'9. график не растянут: подписи и точки не сплющены',r7.par+' · '+r7.ar.toFixed(2));
  const r10=await p.evaluate(()=>{ document.querySelector('[data-exch="vol"]').click(); const c=document.querySelector('.ex[data-j="0"]');
    return {on:c.querySelector('[data-exch].on').dataset.exch, txt:c.querySelector('.exfhist svg').textContent.replace(/\s+/g,' '),
      h:[...c.querySelectorAll('[data-exch]')].map(x=>Math.round(x.getBoundingClientRect().height)),
      wide:document.documentElement.scrollWidth<=320}; });
  chk(r10.on==='vol'&&/т|кг/.test(r10.txt),'10. «Объём» переключает график',r10.on+' · '+r10.txt.trim());
  chk(r10.h.every(x=>x>=44)&&r10.wide,'11. кнопки графика не ниже 44 px, на 320 без прокрутки вбок',JSON.stringify(r10.h));
  const r12=await p.evaluate(()=>{ openHistory('Жим лёжа'); const t=document.getElementById('sh').textContent; sheetClose(); return /≈1ПМ/.test(t); });
  chk(r12,'12. в истории упражнения — те же рекорды','');
  chk(errs.length===0,'13. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
function XP_PR_TEST(){ return 30; }
