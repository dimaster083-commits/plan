/* Итоги месяца: тоннаж, подходы и тренировки за месяц, сравнение с прошлым, листание. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const chk=(c,n,d)=>{ if(!c) fails++; console.log('  '+(c?'✓':'✗')+' '+n+(d?'   → '+d:'')); };
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  // Mid-month fixture: the current week and both recorded workouts belong to October.
  await p.addInitScript(() => {
    const RealDate = Date, offset = new RealDate(2026, 9, 15, 12).getTime() - RealDate.now();
    window.Date = class extends RealDate {
      constructor(...args) { super(...(args.length ? args : [RealDate.now() + offset])); }
      static now() { return RealDate.now() + offset; }
    };
  });
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  const r=await p.evaluate(()=>{ if(typeof openMonth!=='function') return null;
    S.setup=1; document.getElementById('setup').classList.remove('on'); S.rec={};
    const ym=today().slice(0,7), pym=shiftMonth(ym,-1);
    S.rec[ym+'-02']={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'80',s:'3',r:'10',rs:[10,10,10],vol:2400,sd:1}}};
    S.rec[ym+'-03']={wo:1,log:{0:{done:1,n:'Присед со штангой',g:'Ноги',w:'100',s:'4',r:'10',rs:[10,10,10,10],vol:4000,sd:1}}};
    S.rec[pym+'-10']={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'80',s:'3',r:'10',rs:[10,10,10],vol:2400,sd:1}}};
    entCache=null; save(); openWeek(); const bt=document.querySelector('#shB [data-mon]'); if(!bt) return null; bt.click();
    const t1=document.getElementById('shB').textContent.replace(/\s+/g,' ');
    const nxt=document.querySelector('#shB .wknav [data-mon]:last-of-type').disabled;
    document.querySelector('#shB .wknav [data-mon]').click(); const t2=document.getElementById('shB').textContent.replace(/\s+/g,' ');
    return {t1,t2,nxt,wide:document.documentElement.scrollWidth<=320}; });
  chk(r&&/ИТОГИ МЕСЯЦА|6,4 т/.test(r.t1)&&/6,4 т/.test(r.t1)&&/\+167 %/.test(r.t1),'1. месяц: 6,4 т и +167 % к прошлому',r&&r.t1.slice(0,120));
  chk(r&&/\b7\b/.test(r.t1),'2. подходы месяца: 7','');
  chk(r&&r.nxt,'3. в будущий месяц не листается','');
  chk(r&&/2,4 т/.test(r.t2)&&!/6,4 т/.test(r.t2),'4. «‹» — прошлый месяц: 2,4 т',r&&r.t2.slice(0,80));
  chk(r&&r.wide,'5. на 320 без прокрутки вбок','');
  chk(errs.length===0,'6. без ошибок',errs.join(' | ')||'чисто');
  await b.close(); process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
