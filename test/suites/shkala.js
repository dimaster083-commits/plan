/* Баланс недели полосами. Шестиугольник дважды переделывали и он всё равно
   врал глазу, поэтому теперь у каждой мышцы своя строка: риска — недельная
   норма программы, полоса — сделанное за 7 дней по журналу, шкала строки —
   полторы нормы. «Руки» и «Ноги» разложены на мышцы: норма 12 подходов на
   «руки» означала по 6 на бицепс и трицепс. */
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
  await p.goto(APP); await p.waitForTimeout(1300);

  // закрываем прошедшие 7 дней целиком или частью подходов, сделанное — клетками rs
  const засеять = (доля, лишний) => p.evaluate(([доля, лишний])=>{
    S.setup=1; document.getElementById('setup').classList.remove('on'); S.sound=0;
    S.rec={};
    for(let k=0;k<=6;k++){ const d=new Date(); d.setDate(d.getDate()-k); const ds=iso(d);
      const dd=dayOf(ds); if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log={};
      dd.ex.forEach((e,j)=>{
        const подх=Math.max(1, Math.round(num(e.s)*доля)) + (лишний ? 1 : 0);
        r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),w:num(e.w),
                  rs:Array(подх).fill(8),vol:100,xp:12};
      });
    }
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    tab='prog'; pSec='load'; render(); paintSections(); paintRadar();
    const rows=[...document.querySelectorAll('#rad .br')].map(r=>({
      n:r.dataset.g, cls:r.className.replace('br','').trim(),
      w:parseFloat(r.querySelector('.bb i').style.width), mark:parseFloat(r.querySelector('.bb s').style.left),
      v:r.querySelector('.bv').textContent.trim()}));
    let sets=0; for(let k=0;k<=6;k++){const d=new Date(); d.setDate(d.getDate()-k); sets+=daySets(iso(d));}
    const m=vol7m(); const sum=Object.values(m).reduce((a,c)=>a+c,0);
    return {rows, текст:document.getElementById('radn').textContent, sets, sum,
      ждём:MUSCLES.filter(x=>volTargetM(x)>0).map(x=>x+' '+m[x]+'/'+volTargetM(x))};
  },[доля, лишний]);

  // 1-4. неделя закрыта целиком
  const полная = await засеять(1);
  chk(полная.rows.length>=8 && полная.rows.every(r=>r.cls==='full'),'1. закрытая неделя — все строки добраны',
      полная.rows.map(r=>r.n+':'+r.cls).join(' '));
  chk(полная.rows.every(r=>Math.abs(r.w-r.mark)<0.2),'2. полоса ровно доходит до риски нормы',
      полная.rows.map(r=>r.w+'/'+r.mark).join(' '));
  chk(/Все группы добраны/.test(полная.текст),'3. подпись говорит о закрытой неделе',полная.текст);
  chk(JSON.stringify(полная.rows.map(r=>r.n+' '+r.v.replace(' ✓','')))===JSON.stringify(полная.ждём),
      '4. числа в строках равны недельному счёту по мышцам',полная.rows.map(r=>r.v).join(' '));

  // 5-6. руки и ноги разложены на мышцы
  const имена=полная.rows.map(r=>r.n);
  chk(['Бицепс','Трицепс'].every(x=>имена.includes(x)) && !имена.includes('Руки'),
      '5. бицепс и трицепс — отдельные строки, не общие «Руки»',имена.join(', '));
  chk(['Квадрицепс','Бицепс бедра','Икры'].every(x=>имена.includes(x)) && !имена.includes('Ноги'),
      '6. ноги разложены на квадрицепс, бицепс бедра и икры',имена.join(', '));

  // 7-8. половина нормы — половина пути до риски, подпись говорит, что добрать
  const половина = await засеять(0.5);
  chk(половина.rows.every(r=>{const [a,c]=r.v.split('/').map(parseFloat);
      return Math.abs(r.w-Math.min(a/c,1.5)/1.5*100)<0.5;}),'7. длина полосы — доля нормы на шкале в полторы нормы',
      половина.rows.map(r=>r.n+' '+r.w).join(' '));
  chk(/Добрать подходов/.test(половина.текст) && !/Все группы добраны/.test(половина.текст),
      '8. подпись перечисляет, что добрать',половина.текст);

  // 9. подход сверх плана (5 клеток при плане 4) засчитывается — счёт по журналу, как daySets
  const лишний = await засеять(1, true);
  chk(лишний.sum===лишний.sets,'9. подходы за неделю сходятся с журналом (daySets)',
      'баланс '+лишний.sum+', журнал '+лишний.sets);

  chk(errs.length===0,'10. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
