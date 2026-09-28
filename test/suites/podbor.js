/* Подбор продуктов: «Добавить N позиций» кладёт их в тот приём, откуда
   открыт подбор, и не падает, если приёма уже нет (нашла обезьяна). */
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
  const r=await p.evaluate(()=>{ S.setup=1; document.getElementById('setup').classList.remove('on'); tab='food'; sel=today(); render();
    const ml=mealsRW(sel); const j=ml.length-1; openPick(j); picked=[{p:'Гречка',g:100}]; paintPickBar();
    // приём убран, пока открыт подбор
    ml.splice(j,1); save();
    let err=''; try{ document.getElementById('fpAdd').click(); }catch(e){ err=e.message; }
    return {err, open:document.getElementById('fp').classList.contains('on')}; });
  await p.waitForTimeout(100);
  chk(errs.length===0&&!r.err,'1. приёма нет — без ошибки, с сообщением',errs.join(' | ')||'чисто');
  chk(!r.open,'2. подбор закрывается','');
  const r3=await p.evaluate(()=>{ const z=new Date(); z.setDate(z.getDate()-1); const y=iso(z); sel=today(); render();
    const ml=mealsRW(sel); openPick(0); picked=[{p:'Гречка',g:120}]; sel=y;   // день сменился, пока выбирали
    document.getElementById('fpAdd').click(); const t=mealsOf(today())[0].items.slice(-1)[0];
    return t&&t.p+':'+t.g; });
  chk(r3==='Гречка:120','3. позиции уходят в день, откуда открыт подбор',r3);
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
