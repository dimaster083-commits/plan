/* Сетка весов. Прибавка и показ обязаны считать по одной сетке.
   Пока они расходились, прибавка ставила 13,5 кг, показ округлял его
   до 12,5, и упражнение навсегда застревало ниже своего рабочего веса:
   автоматический подъём для всего лёгкого просто не работал. */
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
    S.anchors={b:70,s:50,d:60};S.returning=0;deriveWeights();save();sel=today();});

  // 1. на тяжёлой неделе показывается ровно рабочий вес
  chk(await p.evaluate(()=>{
    const bad2=[];
    for(let w=1;w<=200;w+=0.5){
      const e={w:String(w),g:'Грудь'};
      const got=weightFor(e,INT.h);
      if(Math.abs(got-w)>1e-9) bad2.push(w+' → '+got);
    }
    return bad2.slice(0,4).join('; ')||true;
  })===true, '1. тяжёлая неделя показывает рабочий вес без округления');

  // 2. поднятый вес воспроизводим показом — прогрессия не застревает
  chk(await p.evaluate(()=>{
    const bad2=[];
    ['Грудь','Ноги','Руки','Плечи','Спина'].forEach(g=>{
      for(let w=2;w<=200;w+=1){
        const e={w:String(w),g:g};
        const next=w+stepFor(e);
        const e2={w:String(next),g:g};
        if(Math.abs(weightFor(e2,INT.h)-next)>1e-9) bad2.push(g+' '+w+' → '+next+' показ '+weightFor(e2,INT.h));
      }
    });
    return bad2.slice(0,4).join('; ')||true;
  })===true, '2. после прибавки показ совпадает с новым рабочим весом');

  // 3. шаг всегда положительный и не абсурдный
  chk(await p.evaluate(()=>{
    const bad2=[];
    ['Грудь','Ноги'].forEach(g=>{ for(let w=1;w<=300;w+=1){
      const st=stepFor({w:String(w),g:g});
      if(!(st>0)||st>w*0.12+2.5) bad2.push(g+' '+w+' шаг '+st);
    }});
    return bad2.slice(0,4).join('; ')||true;
  })===true, '3. шаг прибавки положительный и соразмерный');

  // 4. облегчённые недели действительно легче и тоже на сетке
  chk(await p.evaluate(()=>{
    const bad2=[];
    for(let w=2.5;w<=200;w+=2.5){
      const e={w:String(w),g:'Грудь'};
      const h=weightFor(e,INT.h), m=weightFor(e,INT.m), l=weightFor(e,INT.l), d=weightFor(e,INT.d);
      if(!(d<=l&&l<=m&&m<=h)) bad2.push(w+': '+[h,m,l,d].join('/'));
      const gr=w>=20?2.5:1;
      [m,l,d].forEach(v=>{ if(Math.abs(v/gr-Math.round(v/gr))>1e-9) bad2.push(w+' вне сетки: '+v); });
    }
    return bad2.slice(0,4).join('; ')||true;
  })===true, '4. облегчённые недели идут по убыванию и по сетке');

  // 5. вся программа прогрессирует: каждое упражнение можно поднять
  chk(await p.evaluate(()=>{
    const stuck=[];
    S.days.forEach(d=>(d.ex||[]).forEach(e=>{
      if(!num(e.w)) return;
      const next=num(e.w)+stepFor(e);
      if(weightFor({w:String(next),g:e.g},INT.h)<next) stuck.push(e.n+' '+e.w+'→'+next);
    }));
    return stuck.slice(0,5).join('; ')||true;
  })===true, '5. ни одно упражнение программы не застревает');

  // 6. проверка самой проверки: со старой формулой эти условия обязаны падать
  chk(await p.evaluate(()=>{
    const oldWeightFor=(e,IN)=>Math.max(2.5, (Math.round(num(e.w)*(IN?IN[0]:1)/2.5)*2.5));
    let broken=0;
    ['Грудь','Плечи','Руки'].forEach(g=>{ for(let w=2;w<20;w+=1){
      const e={w:String(w),g:g};
      const next=w+stepFor(e);
      if(oldWeightFor({w:String(next),g:g},INT.h)<next) broken++;
    }});
    return broken;
  })>0, '6. со старой формулой лёгкие упражнения застревали — сторож это видит');

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
