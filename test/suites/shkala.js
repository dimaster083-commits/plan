/* Шкала диаграммы. Граница фигуры — недельная норма. Раньше шкала шла до
   двух норм: полностью закрытая группа рисовалась ровно на середине радиуса,
   цифры говорили «14 из 14», а картинка — «сделана половина». И внутри не
   должно быть никаких линий: ни колец, ни спиц, ни пунктира. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);

// закрываем неделю целиком или частью нормы
const seed = доля => (доля) => {};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);

    const засеять = доля => p.evaluate(([s,доля])=>{
      S.setup=1; document.getElementById('setup').classList.remove('on'); void s; S.sound=0;
      S.rec={};
      for(let k=0;k<=6;k++){ const d=new Date(); d.setDate(d.getDate()-k); const ds=iso(d);
        const dd=dayOf(ds); if(dd.t==='rest') continue;
        const r=recRW(ds); r.wo=1; r.log={};
        dd.ex.forEach((e,j)=>{
          const подх=Math.max(1, Math.round(num(e.s)*доля));
          r.log[j]={done:1,n:e.n,g:e.g,s:String(подх),r:String(e.r),w:num(e.w),
                    rs:[8,8,8,8].slice(0,подх),vol:100,xp:12};
        });
      }
      entCache=null; statsDirty=true; save(); recomputeStats(1);
      tab='prog'; pSec='load'; render(); paintSections(); paintRadar();
      // радиус каждой вершины фигуры в долях радиуса границы
      const sv=document.getElementById('rad');
      const гр=sv.querySelector('polygon.rgrid').getAttribute('points').trim().split(/\s+/)
        .map(x=>x.split(',').map(Number));
      const ф=sv.querySelector('polygon.rfill');
      const фиг=ф?ф.getAttribute('points').trim().split(/\s+/).map(x=>x.split(',').map(Number)):[];
      const cx=150, cy=114;
      const rad=q=>Math.hypot(q[0]-cx,q[1]-cy);
      const acc=vol7();
      return {
        доли: фиг.map((q,i)=>+(rad(q)/rad(гр[i])).toFixed(3)),
        факт: GROUPS.map(([n])=>+((acc[n]||0)/VOL_TARGET[n]).toFixed(3)),
        подписи: [...sv.querySelectorAll('.rnum')].map(t=>t.textContent),
        полных: [...sv.querySelectorAll('.rdot.full')].length,
        спиц: sv.querySelectorAll('line, .rspoke').length,
        границ: sv.querySelectorAll('polygon.rgrid').length,
        колец: [...sv.querySelectorAll('polygon.rstep')].map(g2=>{
          const q=g2.getAttribute('points').trim().split(/\s+/)[0].split(',').map(Number);
          return +(Math.hypot(q[0]-150,q[1]-114)/78).toFixed(2);
        }).sort((a,c)=>a-c),
        половинаВыделена: sv.querySelectorAll('polygon.rstep.half').length,
        текст: sv.parentNode.querySelector('.radn').textContent
      };
    },[skin,доля]);

    // 1-4. неделя закрыта целиком: фигура ровно по границе
    const полная = await засеять(1);
    const наКраю = полная.доли.every(v=>Math.abs(v-1)<0.02);
    chk(наКраю,'1. добранная группа стоит на границе, а не на половине',
        'доли радиуса: '+полная.доли.join(', '));
    chk(полная.подписи.every(t=>{const[a,c]=t.split('/');return +a>=+c;}),
        '2. и в цифрах норма добрана',полная.подписи.join(' '));
    chk(полная.полных===GROUPS_LEN(полная),'3. каждая добранная точка помечена',
        полная.полных+' из '+полная.доли.length);
    chk(/Все группы добраны/.test(полная.текст),'4. подпись говорит о закрытой неделе',полная.текст);

    // 5-7. половина нормы — половина радиуса
    const половина = await засеять(0.5);
    const парами = половина.доли.map((v,i)=>[v, половина.факт[i]]);
    const сошлось = парами.every(([v,f])=>Math.abs(v-Math.min(1,f))<0.03);
    chk(сошлось,'5. доля радиуса равна доле нормы',
        парами.map(([v,f])=>v+'≈'+f.toFixed(2)).join(' '));
    chk(половина.доли.every(v=>v<0.85),'6. недобранная неделя не дотягивает до границы',
        половина.доли.join(', '));
    chk(!/Все группы добраны/.test(половина.текст),'7. подпись не врёт про закрытую неделю',половина.текст);

    // 8-9. внутри пусто
    chk(половина.спиц===0,'8. спиц внутри нет — они ничего не меряют',
        'лишних линий: '+половина.спиц);
    chk(половина.границ===1,'9. граница ровно одна',String(половина.границ));
    chk(половина.колец.length===9,'9б. внутри девять колец — по десятой доле нормы',
        'колец '+половина.колец.length+': '+половина.колец.join(', '));
    chk(половина.колец.join(',')==='0.1,0.2,0.3,0.4,0.5,0.6,0.7,0.8,0.9',
        '9г. кольца стоят ровно по десятым',половина.колец.join(', '));
    chk(половина.половинаВыделена===1,'9д. кольцо половины выделено — от него считать',
        String(половина.половинаВыделена));
    // фигура на половине нормы обязана лечь ровно на среднее кольцо
    const наКольце=половина.доли.filter((v,i)=>Math.abs(половина.факт[i]-0.5)<0.03)
      .every(v=>Math.abs(v-0.5)<0.03);
    chk(наКольце,'9в. значение в половину нормы ложится на среднее кольцо',
        половина.доли.join(', '));

    chk(errs.length===0,'10. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
function GROUPS_LEN(o){ return o.доли.length; }
