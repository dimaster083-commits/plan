/* Перенос дня на другой шаблон. Отметки подходов лежат под номерами
   упражнений: если в дне уже что-то закрыто, а день переставили на другую
   тренировку, номера начинают указывать на чужие упражнения. */
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

  const r=await p.evaluate(()=>{
    S.setup=1; document.getElementById('setup').classList.remove('on'); S.sound=0;
    S.rec={}; S.map={};
    // берём тренировочный день и закрываем в нём два подхода
    const верх=S.days.findIndex(d=>d.t==='up1');
    const низ=S.days.findIndex(d=>d.t==='lo1');
    let ds=today();
    for(let k=0;k<7;k++){ const d=new Date(); d.setDate(d.getDate()-k);
      if(wdOf(iso(d))===верх){ ds=iso(d); break; } }
    S.map[ds]=верх;
    const day=S.days[верх], rec=recRW(ds); rec.log={};
    [0,1].forEach(j=>{ rec.log[j]={done:1,n:day.ex[j].n,g:day.ex[j].g,s:'3',r:'8',
      w:num(day.ex[j].w),rs:[8,8,8],vol:100,xp:12}; });
    entCache=null; statsDirty=true; save();
    const былиИмена=[0,1].map(j=>rec.log[j].n);
    entCache=null; const тоннажДо=Math.round(dayTon(ds));
    // переносим день на низ тела
    sel=ds; S.map[ds]=низ; remapLog(ds); save(); render();
    entCache=null; const тоннажПосле=Math.round(dayTon(ds));
    const новый=dayOf(ds);
    return {
      ds, былиИмена, тоннажДо, тоннажПосле,
      новыеУпр:новый.ex.slice(0,2).map(e=>e.n),
      отметки:Object.keys(recOf(ds).log).map(j=>({j:+j, имя:recOf(ds).log[j].n,
        подНомером:(новый.ex[+j]||{}).n})),
      тип:новый.t
    };
  });

  chk(r.тип==='lo1','1. день переставлен на другую тренировку',r.тип);
  // Запись либо стоит под своим упражнением, либо уезжает за край списка —
  // чужим упражнением она прикинуться не должна ни при каком раскладе.
  const чужие=r.отметки.filter(x=>x.подНомером!==undefined && x.имя!==x.подНомером);
  chk(чужие.length===0,'2. отметка не оказывается на чужом упражнении',
      чужие.map(x=>'№'+x.j+': закрыт «'+x.имя+'», под номером «'+x.подНомером+'»').join('; ')||'ни одной чужой');
  const заКраем=r.отметки.filter(x=>x.подНомером===undefined);
  chk(заКраем.length===r.былиИмена.length,'2б. записи ушедших упражнений сохранились за краем списка',
      заКраем.map(x=>x.имя).join(', ')||'ни одной');
  chk(r.тоннажДо===r.тоннажПосле,'2в. тоннаж дня от переноса не изменился',
      r.тоннажДо+' → '+r.тоннажПосле);

  // 3. и в самой карточке чужое упражнение не помечено закрытым
  const вид=await p.evaluate(([ds])=>{
    sel=ds; tab='wo'; edit=true; editPast=true; exOpen=0; render();
    const карт=document.querySelector('.exf');
    if(!карт) return {нет:1};
    const имя=карт.querySelector('.exname').textContent.trim();
    const кнопка=карт.querySelector('[data-go]').textContent.trim();
    return {имя, кнопка};
  },[r.ds]);
  chk(!вид.нет,'3. карточка раскрылась',вид.нет?'нет карточки':вид.имя);
  if(!вид.нет) chk(!/Отменить/.test(вид.кнопка),
    '4. первое упражнение нового дня не показано закрытым',вид.имя+' → «'+вид.кнопка+'»');

  chk(errs.length===0,'5. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
