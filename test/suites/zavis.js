/* Негодная дата старта плана. mondayOf на такой дате отдаёт пустую строку,
   и цикл в planWeek крутится вечно — приложение не падает, а зависает. */
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
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');S.sound=0;save();});

  for(const мусор of ['2026-13-45','позавчера','','2026-02-30','0000-00-00']){
    let ответ='ЗАВИС';
    try{
      ответ=await Promise.race([
        p.evaluate(v=>{ S.start=v; save();
          const w=planWeek(); const c=cycIdx(); render();
          return 'неделя '+w+', цикл '+(c+1); },мусор),
        new Promise(r=>setTimeout(()=>r('ЗАВИС'),4000))
      ]);
    }catch(e){ ответ='ОШИБКА: '+e.message.split('\n')[0]; }
    chk(ответ!=='ЗАВИС'&&!/ОШИБКА/.test(ответ),'старт «'+мусор+'» не вешает приложение',ответ);
    if(ответ==='ЗАВИС') break;     // страница больше не отвечает
  }
  if(!fails){
    const жив=await p.evaluate(()=>({tab:tab, экран:!!document.getElementById('exl')})).catch(()=>null);
    chk(!!жив,'страница жива после всего мусора',JSON.stringify(жив));
    chk(errs.length===0,'без ошибок в консоли',errs.join(' | ')||'чисто');
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
