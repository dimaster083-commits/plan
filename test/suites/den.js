/* Экран дня: счётчик «сделано из», галочки на чипах недели, опыт за
   подход и итог тренировки — всё сверяется с журналом. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s2=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s2;
      S.anchors={b:70,s:50,d:60};S.sound=0;deriveWeights();
      const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
      save();recomputeStats(1);tab='wo';sel=today();exOpen=null;render();},skin);
    await p.waitForTimeout(300);

    // 1. «0 из N» совпадает с числом упражнений дня
    const q0=await p.evaluate(()=>{
      const t=document.querySelector('.qbox')?document.querySelector('.qbox').innerText:'';
      const m=t.match(/(\d+)\s+из\s+(\d+)/);
      return { m:m?[+m[1],+m[2]]:null, n:(dayOf(sel).ex||[]).length,
               done:Object.keys(recOf(sel).log||{}).filter(k=>recOf(sel).log[k].done).length };
    });
    chk(q0.m && q0.m[0]===q0.done && q0.m[1]===q0.n,
        '1. счётчик «сделано из» совпадает с журналом',
        q0.m?(q0.m.join(' из ')+' при '+q0.done+'/'+q0.n):'строки нет');

    // 2. закрыли два подхода — счётчик и шкала поехали
    const q1=await p.evaluate(()=>{
      const d=dayOf(sel), r=recRW(sel);
      [0,1].forEach(j=>{ r.log[j]={done:1,n:d.ex[j].n,g:d.ex[j].g,s:'3',r:'8',w:'20',rs:['8','8','8'],vol:480,xp:12}; });
      save(); recomputeStats(1); render();
      const t=document.querySelector('.qbox').innerText;
      const m=t.match(/(\d+)\s+из\s+(\d+)/);
      const bar=document.querySelector('.qprog i');
      return { m:m?[+m[1],+m[2]]:null, w:bar?bar.style.width:'нет' };
    });
    chk(q1.m && q1.m[0]===2, '2. счётчик вырос после двух закрытых подходов', q1.m.join(' из '));
    chk(q1.w!=='нет' && parseFloat(q1.w)>0, '3. шкала дня заполнилась', q1.w);

    // 4. галочка на чипе недели совпадает с отметкой тренировки
    const chips=await p.evaluate(()=>{
      const r=recRW(sel); r.wo=1; save(); render();
      const out=[];
      document.querySelectorAll('#chips [data-d]').forEach(c=>{
        const ds=c.dataset.d;
        out.push({ ds, tick:!!c.querySelector('.tk'), wo:!!(S.rec[ds]||{}).wo });
      });
      return out;
    });
    const wrong=chips.filter(c=>c.tick!==c.wo);
    chk(wrong.length===0, '4. галочки на чипах недели совпадают с журналом',
        wrong.length?JSON.stringify(wrong[0]):'все семь совпадают');

    // 5. опыт начисляется и снимается вместе с подходом
    const xp=await p.evaluate(()=>{
      const before=S.xp;
      exOpen=2; render();
      document.querySelectorAll('#exl [data-rs]').forEach(i2=>{ i2.value='8';
        i2.dispatchEvent(new Event('input',{bubbles:true})); });
      document.querySelector('#exl [data-go]').click();
      return { before, after:S.xp };
    });
    // отмена — отдельным касанием, не двойным тапом (двойной тап защищён 200 мс)
    await p.waitForTimeout(260);
    xp.back=await p.evaluate(()=>{ exOpen=2; render();
      document.querySelector('#exl [data-go]').click(); return S.xp; });
    chk(xp.after>xp.before && xp.back===xp.before,
        '5. опыт начисляется за подход и снимается при отмене', JSON.stringify(xp));

    // 6. итог тренировки совпадает с журналом дня
    const fin=await p.evaluate(async ()=>{
      const r=recRW(sel); r.wo=1; r.t0=Date.now()-3.6e6; r.t1=Date.now(); save();
      recomputeStats(1); entCache=null;
      const ton=Math.round(dayTon(sel)), sets=daySets(sel);
      workoutSummary(sel);
      await new Promise(x=>setTimeout(x,300));
      const t=document.getElementById('sh').innerText;
      sheetClose();
      const mSets=t.match(/(\d+)\s*\n?\s*ПОДХОДОВ/i);
      // до тонны приложение пишет килограммами, выше — тоннами
      const mT=t.match(/([\d,]+)\s*т(?![а-яё])/i);
      const mK=t.match(/([\d,]+)\s*кг(?![а-яё])/i);
      const mTon=mT?{v:parseFloat(mT[1].replace(',','.'))*1000,u:'т'}
                  :(mK?{v:parseFloat(mK[1].replace(',','.')),u:'кг'}:null);
      return { ton, sets, mSets:mSets?+mSets[1]:null, mTon,
               raw:t.replace(/\n/g,' | ').slice(0,120) };
    });
    chk(fin.mSets===fin.sets, '6. подходы в итогах равны подходам дня',
        fin.mSets+' и '+fin.sets);
    chk(fin.mTon && Math.abs(fin.mTon.v-fin.ton)<Math.max(1,fin.ton*0.02),
        '7. поднятое в итогах равно тоннажу дня',
        fin.mTon?(fin.mTon.v+' ('+fin.mTon.u+') при '+fin.ton+' кг'):('не нашёл: '+fin.raw));

    if(errs.length) bad('ошибки JS',[...new Set(errs)].join(' | '));
    await p.close();
  }
  await b.close();
  console.log('\nпровалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
