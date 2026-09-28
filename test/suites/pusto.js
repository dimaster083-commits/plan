/* Пустая клетка повторов — «не записал»: тоннаж берёт записанное, пустое — по низу диапазона. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const chk=(c,n,d)=>{ if(!c) fails++; console.log('  '+(c?'✓':'✗')+' '+n+(d?'   → '+d:'')); };
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const r=await p.evaluate(()=>{ S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on'); S.rec={};
    const d=dayOf(today()); d.t='up1'; d.ex=[{n:'Жим лёжа',s:3,r:'8-10',w:50,g:'Грудь'}]; save(); tab='wo'; sel=today(); exOpen=0; render();
    const c=document.querySelector('.ex[data-j="0"]'); c.querySelector('[data-f="w"]').value='50';
    const cells=[...c.querySelectorAll('[data-rs]')]; cells[0].value='12'; cells[1].value='12'; cells[2].value='';
    toggleSet(0); return {vol:recOf(today()).log[0].vol, ton:dayTon(today())}; });
  chk(r.vol===1600,'1. 12/12/пусто при 8–10 на 50 кг — (12+12+8)×50 = 1600, а не 3×8×50',JSON.stringify(r));
  chk(errs.length===0,'2. без ошибок',errs.join(' | ')||'чисто');
  await b.close(); process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
