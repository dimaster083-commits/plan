/* Кнопки «набор / похудение» двигают цель. Нажатие на уже выбранную
   сторону не должно переписывать вписанную руками цель. */
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
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s;S.sound=0;
      S.bw='72'; S.goal='95'; save(); tab='prog'; pSec='goal'; render(); paintSections();},skin);
    await p.waitForTimeout(300);

    const вид=await p.evaluate(()=>({
      набор:document.querySelector('#wdir [data-dir="up"]').classList.contains('on'),
      похуд:document.querySelector('#wdir [data-dir="down"]').classList.contains('on'),
      цель:S.goal}));
    chk(вид.набор&&!вид.похуд,'1. при цели выше веса подсвечен «набор»',JSON.stringify(вид));

    await p.evaluate(()=>document.querySelector('#wdir [data-dir="up"]').click());
    await p.waitForTimeout(250);
    const после=await p.evaluate(()=>S.goal);
    chk(после==='95','2. повторное нажатие «набор» не трогает цель','цель '+после);

    await p.evaluate(()=>document.querySelector('#wdir [data-dir="down"]').click());
    await p.waitForTimeout(250);
    const вниз=await p.evaluate(()=>({цель:S.goal, dir:goalDir(),
      похуд:document.querySelector('#wdir [data-dir="down"]').classList.contains('on')}));
    chk(вниз.цель==='62','3. «похудение» ставит цель ниже веса','цель '+вниз.цель);
    chk(вниз.dir<0,'4. направление расчёта калорий сменилось','goalDir '+вниз.dir);
    chk(вниз.похуд,'5. подсветка переехала на «похудение»',String(вниз.похуд));

    await p.evaluate(()=>document.querySelector('#wdir [data-dir="down"]').click());
    await p.waitForTimeout(250);
    const ещё=await p.evaluate(()=>S.goal);
    chk(ещё==='62','6. повторное «похудение» тоже не двигает цель','цель '+ещё);

    // цель равна весу — направление не задано, кнопка обязана сработать
    await p.evaluate(()=>{S.goal='72'; save(); paintGoal();});
    await p.waitForTimeout(200);
    await p.evaluate(()=>document.querySelector('#wdir [data-dir="up"]').click());
    await p.waitForTimeout(250);
    const ровно=await p.evaluate(()=>S.goal);
    chk(ровно==='87','7. при цели вровень с весом кнопка всё же ставит цель','цель '+ровно);

    chk(errs.length===0,'8. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
