/* Год жизни приложения. Проходим 52 недели, честно закрывая подходы
   через ту же функцию, что и кнопка, и смотрим, не разъезжается ли
   что-нибудь за длинную дистанцию: веса, опыт, ступени, журнал. */
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

  const res=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    S.setup=1; document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60}; S.sound=0; S.bw='70'; S.bw0='70'; S.goal='95';
    deriveWeights();
    const startD=new Date(); startD.setDate(startD.getDate()-364);
    S.start=iso(startD); save();

    const snap=[]; let maxW=0, prevXp=-1, xpDrops=0, lvlDrops=0, prevLvl=-1;
    for(let k=364;k>=0;k--){
      const d=new Date(); d.setDate(d.getDate()-k);
      const ds=iso(d), day=dayOf(ds);
      if(!day||day.t==='rest'||!(day.ex||[]).length) continue;
      sel=ds;
      const r=recRW(ds);
      day.ex.forEach((e,j)=>{
        const top=topRep(e.r), sets=num(e.s)||3;
        const w=weightFor(e,INT[(cycOf(ds).d||{})[day.t]||'m']);
        const rs=new Array(sets).fill(String(top));
        r.log[j]={done:1,n:e.n,g:e.g,s:String(sets),r:String(e.r),w:String(w),
                  rs:rs,vol:rs.reduce((a,c)=>a+num(c),0)*w,xp:12};
        // тот же путь, что и у кнопки: прогрессия решает сама
        maybeProgress(r.log[j], e, w);
        maxW=Math.max(maxW,num(e.w));
      });
      r.wo=1; r.t0=Date.now()-4e6; r.t1=Date.now()-3.5e6;
      if(k%7===0) r.bw=String(70+(364-k)/364*12);
      S.xp+=40;
      if(S.xp<prevXp) xpDrops++;
      prevXp=S.xp;
      const lv=levelOf();
      if(lv<prevLvl) lvlDrops++;
      prevLvl=lv;
      if(k%70===0) snap.push({ds,lv,xp:S.xp,maxW});
    }
    save(); recomputeStats(1); entCache=null;

    const json=JSON.stringify(S);
    const ws=S.days.flatMap(d=>(d.ex||[])).map(e=>({n:e.n,w:num(e.w)}));
    const crazy=ws.filter(x=>x.w>400||x.w<0||!isFinite(x.w));
    let ton=0; Object.keys(S.rec).forEach(ds=>dayEntries(ds).forEach(e=>{ton+=e.vol;}));
    const t0=performance.now(); tab='prog'; pSec='log'; render(); const tProg=performance.now()-t0;
    const t1=performance.now(); tab='wo'; sel=today(); exOpen=null; render(); const tWo=performance.now()-t1;
    return { days:Object.keys(S.rec).length, size:json.length, nan:/NaN|Infinity/.test(json),
             xpDrops, lvlDrops, lvl:levelOf(), rank:rankOf(levelOf()), crazy, maxW,
             ton:Math.round(ton), vol:Math.round(GROUPS.reduce((a,[n])=>a+num(S.vol[n]),0)),
             tProg:Math.round(tProg), tWo:Math.round(tWo), snap,
             streak:streak(), week:planWeek() };
  });

  chk(res.days>100, '1. год тренировок записался', res.days+' дней в журнале');
  chk(!res.nan, '2. в состоянии нет NaN и Infinity');
  chk(res.xpDrops===0, '3. опыт только растёт', 'падений: '+res.xpDrops);
  chk(res.lvlDrops===0, '4. ступень не откатывается', 'падений: '+res.lvlDrops);
  chk(res.crazy.length===0, '5. веса не улетают в бесконечность',
      res.crazy.length?JSON.stringify(res.crazy.slice(0,3)):'максимум '+res.maxW+' кг');
  chk(res.maxW>60 && res.maxW<400, '6. за год веса выросли, но по-человечески', 'максимум '+res.maxW+' кг');
  chk(Math.abs(res.ton-res.vol)<2, '7. тоннаж по группам равен тоннажу по журналу',
      res.ton+' vs '+res.vol);
  chk(res.tProg<400 && res.tWo<200, '8. с годовым журналом рисуется быстро',
      'прогресс '+res.tProg+' мс, зал '+res.tWo+' мс');
  chk(res.size<3_000_000, '9. состояние помещается в хранилище', Math.round(res.size/1024)+' КБ');
  chk(res.streak>=0 && res.streak<100, '10. серия недель осмысленная', res.streak+'');
  chk(res.week>=50 && res.week<=54, '11. номер недели плана сошёлся с календарём', res.week+'');
  console.log('  ступень к концу года: '+res.lvl+' ('+res.rank+')');
  console.log('  вехи: '+res.snap.map(x=>x.ds+' ур.'+x.lv+' '+x.maxW+'кг').join(' | '));
  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
