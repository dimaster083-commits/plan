/* Итоги недели (из Lyfta): тренировки, подходы, тоннаж, рекорды по журналу,
   сравнение с прошлой неделей, карта мышц по норме программы, листание
   недель и картинка PNG для отправки. */
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
  const r1=await p.evaluate(()=>{
    if(typeof openWeek!=='function') return null;
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on'); S.rec={}; S.pr={};
    const mon=mondayOf(today()), add=(ds,n)=>{const x=at(ds); x.setDate(x.getDate()+n); return iso(x);};
    // эта неделя: понедельник — жим 3×10×80 (2400) и присед 4×10 по 100 (4000), тренировка закрыта
    S.rec[mon]={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'80',s:'3',r:'10',rs:[10,10,10],vol:2400,sd:1,prevPr:70},
                          1:{done:1,n:'Присед со штангой',g:'Ноги',w:'100',s:'4',r:'10',rs:[10,10,10,10],vol:4000,sd:1}}};
    // прошлая неделя: только жим 3×10×80
    S.rec[add(mon,-7)]={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'80',s:'3',r:'10',rs:[10,10,10],vol:2400,sd:1}}};
    entCache=null; save(); openWeek();
    const sh=document.getElementById('shB'), t=sh.textContent.replace(/\s+/g,' ');
    const cls=[...sh.querySelectorAll('.bmap ellipse, .bmap rect, .bmap path')].map(x=>x.getAttribute('class')).filter(c=>/^mm/.test(c||''));
    return {t, lv:{ch:mmLevel('Грудь',3), q:mmLevel('Квадрицепс',4), back:mmLevel('Спина',0)}, lit:cls.filter(c=>c!=='mm0').length,
      next:sh.querySelector('[data-wk]:last-of-type').disabled, wide:document.documentElement.scrollWidth<=320,
      h:[...sh.querySelectorAll('[data-wk],[data-wkshare]')].map(x=>Math.round(x.getBoundingClientRect().height))};
  });
  chk(r1&&/7 подход|ПОДХОДОВ/.test(r1.t)&&/\b7\b/.test(r1.t),'1. подходы недели по журналу: 3 + 4 = 7',r1&&r1.t.slice(0,140));
  chk(r1&&/6,4 т/.test(r1.t)&&/\+167 %/.test(r1.t),'2. тоннаж 6,4 т и +167 % к прошлой неделе',r1&&(r1.t.match(/[\d,]+ т[^Р]*/)||[''])[0]);
  chk(r1&&/РЕКОРДОВ/.test(r1.t)&&/1 РЕКОРДОВ|1РЕКОРДОВ/.test(r1.t.replace(/ /g,'').replace('1РЕКОРДОВ','1 РЕКОРДОВ')),'3. рекорд недели посчитан','');
  chk(r1&&r1.lv.back===0&&r1.lit>0,'4. карта мышц: сработавшие мышцы залиты, спина пустая',r1&&JSON.stringify(r1.lv)+' залито '+r1.lit);
  chk(r1&&r1.next===true,'5. в будущее не листается','');
  chk(r1&&r1.wide&&r1.h.every(x=>x>=44),'6. на 320 без прокрутки вбок, кнопки ≥ 44 px',r1&&JSON.stringify(r1.h));
  const r7=await p.evaluate(()=>{ if(typeof openWeek!=='function') return null; document.querySelector('#shB [data-wk]').click();
    return document.getElementById('shB').textContent.replace(/\s+/g,' '); });
  chk(r7&&/2,4 т/.test(r7)&&!/6,4 т/.test(r7),'7. «‹» — прошлая неделя: 2,4 т',r7&&r7.slice(0,120));
  const r8=await p.evaluate(async()=>{ if(typeof wkPng!=='function') return null; const bl=await wkPng(mondayOf(today())); return bl?{t:bl.type,n:bl.size}:null; });
  chk(r8&&r8.t==='image/png'&&r8.n>5000,'8. картинка итогов — PNG 1080×1350',JSON.stringify(r8));
  const r9=await p.evaluate(()=>{ sheetClose(); tab='prog'; pSec='prog'; render(); const bt=document.getElementById('wkBtn'); if(!bt) return false; bt.click();
    return /ИТОГИ НЕДЕЛИ/.test(document.getElementById('sh').textContent); });
  chk(r9,'9. кнопка «Итоги недели» во вкладке «Прогресс»','');
  chk(errs.length===0,'10. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
