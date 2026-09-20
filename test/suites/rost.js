/* Выросли ли веса за год, если человек честно закрывает все подходы
   по верхней границе. Это главное обещание приложения. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  await p.goto(APP); await p.waitForTimeout(1400);
  console.log(await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    S.setup=1; document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60}; S.sound=0; deriveWeights();
    const startD=new Date(); startD.setDate(startD.getDate()-364); S.start=iso(startD); save();
    const before={}; S.days.forEach(d=>(d.ex||[]).forEach(e=>{ before[e.n]=num(e.w); }));
    let closed=0, bumped=0, skippedLight=0;
    const why={noInt:0,h:0,m:0,l:0,d:0};
    for(let k=364;k>=0;k--){
      const d=new Date(); d.setDate(d.getDate()-k);
      const ds=iso(d), day=dayOf(ds);
      if(!day||day.t==='rest'||!(day.ex||[]).length) continue;
      sel=ds; const r=recRW(ds);
      day.ex.forEach((e,j)=>{
        const top=topRep(e.r), sets=num(e.s)||3;
        const w=weightFor(e,intOf(ds,day.t));
        const IN=intOf(ds,day.t);
        why[IN?IN[2]:'noInt']++;
        if(w<num(e.w)) skippedLight++;
        const rs=new Array(sets).fill(String(top));
        const was=num(e.w);
        r.log[j]={done:1,n:e.n,g:e.g,s:String(sets),r:String(e.r),w:String(w),rs:rs,
                  vol:rs.reduce((a,c)=>a+num(c),0)*w,xp:12};
        maybeProgress(r.log[j], e, w);
        if(num(e.w)>was) bumped++;
        closed++;
      });
      r.wo=1;
      // Неделя плана считается по закрытым тренировкам, а счётчик недель
      // кэшируется до ближайшего save(). Без него план навсегда застревает
      // на первой неделе — и в прогоне это выглядело как баг приложения.
      save();
    }
    save();
    const after={}; S.days.forEach(d=>(d.ex||[]).forEach(e=>{ after[e.n]=num(e.w); }));
    const rows=Object.keys(before).map(n=>n+': '+before[n]+' → '+after[n]).slice(0,12);
    const grew=Object.keys(before).filter(n=>after[n]>before[n]).length;
    return 'интенсивности: '+JSON.stringify(why)+'\nподходов закрыто: '+closed+', прибавок: '+bumped+
      ', раз предложено меньше рабочего: '+skippedLight+
      '\nупражнений выросло: '+grew+' из '+Object.keys(before).length+
      '\n'+rows.join('\n');
  }));
  await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
