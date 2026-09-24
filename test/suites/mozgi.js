/* «Мозги» карточки упражнения: блины на гриф, разминка к рабочему весу,
   подсказка веса по оценке максимума и застой. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const r=await p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    const o={};
    o.pl=[platesFor(57.5), platesFor(20), platesFor(140), platesTxt(57.5)];
    const bench={n:'Жим лёжа',g:'Грудь',r:'4-6',w:60}, fly={n:'Разводка гантелей',g:'Грудь',r:'8-10',w:12};
    const day={ex:[bench,fly]};
    o.wb=warmupFor(bench,60,day,0); o.wf=warmupFor(fly,12,day,1);
    o.wd=warmupFor({n:'Тяга верхнего блока',g:'Спина',r:'8-10',w:45},45,{ex:[{n:'Тяга верхнего блока',g:'Спина'}]},0);
    o.up=weightAdvice({n:'Присед со штангой',r:'4-6'},{w:30,rs:[10,10,10,10]},30);
    o.dn=weightAdvice({n:'Жим лёжа',r:'8-10'},{w:60,rs:[3,3,2]},60);
    o.none=weightAdvice({n:'Жим лёжа',r:'8-10'},{w:60,rs:[9,8,8]},60);
    o.e1=Math.round(e1rmOf({w:100,rs:[5,4]})); o.e1big=e1rmOf({w:100,rs:[20]});
    // застой: 4 записи одного веса и повторов — застой; растущие — нет
    const mk=(ws)=>{S.rec={}; ws.forEach((w,i)=>{const z=new Date(); z.setDate(z.getDate()-30+i*7); const ds=iso(z);
      const dd=dayOf(ds); const r=recRW(ds); r.wo=1; r.log={0:{done:1,n:'Жим лёжа',g:'Грудь',s:'3',r:'6',w,rs:[6,6,6],vol:1,xp:1}};}); entCache=null;};
    const st0=S.start; const fut=new Date(); fut.setFullYear(fut.getFullYear()+1); S.start=iso(fut);   // цикл не идёт — интенсивность 1
    mk([60,60,60,60]); o.plat=plateauOf('Жим лёжа');
    mk([55,57.5,60,62.5]); o.grow=plateauOf('Жим лёжа');
    // идеальная прогрессия по циклу: лёгкие недели ниже по плану — это не застой
    const past=new Date(); past.setDate(past.getDate()-35); S.start=iso(past);
    S.rec={}; [60,62.5,65,67.5].forEach((W,i)=>{ const z=new Date(); z.setDate(z.getDate()-30+i*7); const ds=iso(z);
      const w=roundW(W*intFactor(ds)); const r=recRW(ds); r.wo=1; r.log={0:{done:1,n:'Жим лёжа',g:'Грудь',s:'3',r:'6',w,rs:[6,6,6],vol:1,xp:1}}; });
    entCache=null; o.cyc=plateauOf('Жим лёжа'); S.start=st0;
    return o;
  });
  chk(JSON.stringify(r.pl[0])==='[15,2.5,1.25]' && r.pl[1].length===0 && JSON.stringify(r.pl[2])==='[25,25,10]',
      '1. блины на сторону: 57,5 → 15+2,5+1,25; 20 — пустой гриф; 140 → 25+25+10',JSON.stringify(r.pl.slice(0,3)));
  chk(/1,25/.test(r.pl[3]),'2. блин 1,25 подписан точно, не «1,3»',r.pl[3]);
  const wb=r.wb.sets;
  chk(wb.length===4 && wb[0][0]===20 && wb.every((x,i)=>x[0]<60&&(i===0||x[0]>wb[i-1][0])&&x[0]%2.5===0),
      '3. разминка штанги к 60×4–6: пустой гриф и лестница по 2,5 кг ниже рабочего',JSON.stringify(wb));
  chk(!!r.wf.skip && r.wf.sets.length===0,'4. грудь уже в работе после жима — разводку не разогреваем',r.wf.skip);
  chk(r.wd.sets.length===2 && r.wd.sets.every(x=>x[0]<45),'5. первое упражнение с блоком — два разминочных',JSON.stringify(r.wd.sets));
  chk(r.up && r.up.up && r.up.w===32.5,'6. 30×10 при цели 4–6 — вес лёгкий, по расчёту 32,5 на 6',JSON.stringify(r.up));
  chk(r.dn && !r.dn.up && r.dn.w<60,'7. 60×3/3/2 при цели 8–10 — вес тяжёлый, предлагает легче',JSON.stringify(r.dn));
  chk(r.none===null,'8. по диапазону — подсказки нет',String(r.none));
  chk(r.e1===117 && r.e1big===0,'9. ≈1ПМ по Эпли: 100×5 → 117; больше 12 повторов не оцениваем',r.e1+' / '+r.e1big);
  chk(r.plat===true && r.grow===false,'10. застой — три тренировки без роста; рост застоем не считается',r.plat+' / '+r.grow);
  chk(r.cyc===false,'10б. лёгкие недели, назначенные циклом, застоем не считаются',String(r.cyc));

  // 15-20. найдено агентом-«тренером»
  const t=await p.evaluate(()=>({
    far:weightAdvice({n:'Присед со штангой',r:'4-6',w:60},{w:60,rs:[13,13,13]},60),
    light:weightAdvice({n:'Присед со штангой',r:'4-6',w:40},{w:30,rs:[8,8,8]},36),
    p21:platesTxt(21), p23:platesTxt(23),
    mus:[muscleOf('Подъёмы на носки','Ноги'),muscleOf('Сгибание ног лёжа','Ноги'),muscleOf('Мёртвая тяга','Ноги'),muscleOf('Кикбэк','Руки')],
    ton:[tonTxt(999.96),tonTxt(0.04)] }));
  chk(t.far&&t.far.up,'15. 13/13/13 при цели 4–6 — тоже «вес лёгкий» (раньше тишина выше 12 повторов)',JSON.stringify(t.far));
  chk(!t.light,'16. «вес лёгкий» не спорит с облегчённой неделей: расчёт ниже рабочего — совета нет',JSON.stringify(t.light));
  chk(/ровно не собрать/.test(t.p21)&&/ровно не собрать/.test(t.p23),'17. 21 и 23 кг блинами не собрать — так и сказано',t.p21+' · '+t.p23);
  chk(t.mus.join()==='Икры,Бицепс бедра,Бицепс бедра,Трицепс','18. свои названия: носки → икры, сгибание ног и мёртвая → бицепс бедра, кикбэк → трицепс',t.mus.join());
  chk(t.ton[0]==='1,0 тыс. т'&&t.ton[1]==='40 кг','19. 999,96 т — «1,0 тыс. т», 40 кг — не «0,0 т»',t.ton.join(' · '));
  const rz=await p.evaluate(()=>{ S.rec={}; const z=new Date(); z.setDate(z.getDate()-1); const ds=iso(z); const d=dayOf(ds);
    d.t='up2'; d.ex=[{n:'Жим гантелей на наклонной',s:4,r:'6-8',w:12,g:'Грудь'}]; const r=recRW(ds); r.wo=1;
    r.log={0:{done:1,n:'Жим гантелей на наклонной',g:'Грудь',s:'4',r:'6-8',w:12,rs:[8,8,8,8],vol:1,xp:1}}; entCache=null; save();
    const f=analyze().find(x=>x.title==='РАСПРЕДЕЛЕНИЕ НАГРУЗКИ'); tab='prog'; pSec='load'; render(); paintRadar();
    return {raz:f?f.text.replace(/<[^>]+>/g,''):'', bal:document.getElementById('radn').textContent}; });
  chk(!/в норме/.test(rz.raz) && /Грудь/.test(rz.raz),'20. «Разбор» по мышцам: недобор груди видит, как и баланс',rz.raz.slice(0,120));

  // кнопка «Поставить» только вписывает вес, журнал не трогает
  const btn=await p.evaluate(()=>{
    S.rec={}; const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    const e=d.ex[0]; e.r='4-6'; e.w=30;
    const z=new Date(); z.setDate(z.getDate()-7); const past=iso(z);
    recRW(past).log[0]={done:1,n:e.n,g:e.g,s:'4',r:'4-6',w:30,rs:[10,10,10,10],vol:1,xp:1};
    const pd=dayOf(past); if(!pd.ex.some(x=>x.n===e.n)){pd.t=d.t;pd.ex=d.ex.map(x=>({...x}));}
    entCache=null; save(); tab='wo'; sel=today(); exOpen=0; render();
    const bt=document.querySelector('[data-setw]'); if(!bt) return {err:'кнопки нет'};
    const r0=bt.getBoundingClientRect(); bt.click();
    return {w:document.querySelector('.ex[data-j="0"] [data-f="w"]').value, log:JSON.stringify(recOf(today()).log),
      done:!!(recOf(today()).log[0]||{}).done, xp:S.xp,
      size:[Math.round(r0.width),Math.round(r0.height)], e1:!!document.querySelector('.pl .e1'),
      wu:!!document.querySelector('details.wu summary')};
  });
  chk(!btn.err && btn.w==='32,5' && !btn.done,'11. «Поставить» вписывает вес в поле, как рукой; подход не закрыт',JSON.stringify(btn));
  chk(!btn.err && btn.size[1]>=44,'12. кнопка подсказки не меньше 44 px по высоте',JSON.stringify(btn.size));
  chk(btn.e1 && btn.wu,'13. в карточке есть ≈1ПМ и свёрнутая разминка',JSON.stringify({e1:btn.e1,wu:btn.wu}));
  chk(errs.length===0,'14. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
