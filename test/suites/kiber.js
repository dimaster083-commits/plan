/* Слой «Кибер-Система»: линии прорисовываются штрихом, рамка окна
   вспыхивает под пальцем. Штрих начинается спрятанным (stroke-dashoffset 1),
   и при «Уменьшении движения» анимация не идёт — без отдельного правила
   кривая веса, шестигранник уровня и текст заставки остались бы невидимыми. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:640},reducedMotion:'reduce'})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(80);
  const boot=await p.evaluate(()=>{const m=document.querySelector('#boot .bt-m');return m?Math.round(m.getBoundingClientRect().width):-1;});
  chk(boot>50,'1. без движения текст заставки виден сразу','ширина '+boot);
  await p.waitForTimeout(1200);
  const r=await p.evaluate(()=>{
    S.setup=1; for(let n=1;n<10;n++){const d=new Date();d.setDate(d.getDate()-n);recRW(iso(d)).bw=String(70+n/10);} save();
    document.getElementById('setup').classList.remove('on'); tab='prog'; pSec='load'; render();
    const l=document.querySelector('.wline'), h=document.querySelector('.st8lv svg .hx');
    const t=document.querySelector('.wtscale'), tr=t.getBoundingClientRect();
    return {line:l&&parseFloat(getComputedStyle(l).strokeDashoffset), hex:parseFloat(getComputedStyle(h).strokeDashoffset),
      pre:getComputedStyle(t,'::before').content, h:Math.round(tr.height)};
  });
  chk(r.line===0,'2. кривая веса видна без анимации','dashoffset '+r.line);
  chk(r.hex===0,'3. шестигранник уровня виден без анимации','dashoffset '+r.hex);
  chk(/\/\//.test(r.pre)&&r.h<30,'4. «//» стоит в строке заголовка, заголовок не разъехался',r.pre+' · высота '+r.h);
  const box=await p.$('.radar'); const bb=await box.boundingBox();
  await p.mouse.move(bb.x+40,bb.y+20); await p.mouse.down();
  const lit=await p.evaluate(()=>document.querySelector('.radar').classList.contains('lit'));
  await p.mouse.up(); await p.waitForTimeout(30);
  const off=await p.evaluate(()=>document.querySelector('.radar').classList.contains('lit'));
  chk(lit&&!off,'5. рамка окна вспыхивает под пальцем и гаснет, когда палец убран',lit+' → '+off);
  chk(errs.length===0,'6. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
