/* Свои упражнения и суперсеты (из Lyfta).
   Чего нет в справочнике — заводится названием и группой и живёт как любое
   другое упражнение. Суперсет: закрыл первое — карточка переходит ко второму
   без таймера отдыха, отдых — после пары. */
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
  await p.evaluate(()=>{ S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on'); S.rec={}; delete S.myEx;
    const d=dayOf(today()); d.t='up1'; d.ex=[{n:'Жим лёжа',s:3,r:'8-10',w:60,g:'Грудь'},{n:'Тяга штанги в наклоне',s:3,r:'8-10',w:50,g:'Спина'}];
    save(); tab='wo'; sel=today(); exOpen=null; render(); });

  // 1–4. своё упражнение
  const r1=await p.evaluate(()=>{ document.getElementById('addEx').click(); const q=document.getElementById('exq');
    q.value='жим Арнольда'; q.dispatchEvent(new Event('input',{bubbles:true}));
    const blk=document.querySelector('#shB .myex'); const bt=document.querySelector('#shB [data-myex="Плечи"]');
    const h=bt?Math.round(bt.getBoundingClientRect().height):0; if(bt) bt.click();
    const d=dayOf(today()), last=d.ex[d.ex.length-1];
    return {blk:!!blk, h, last, mine:(S.myEx||{})['Жим Арнольда']}; });
  chk(r1.blk&&r1.last&&r1.last.n==='Жим Арнольда'&&r1.last.g==='Плечи'&&r1.mine==='Плечи','1. нет в справочнике — заводится своё, с группой',JSON.stringify(r1.last));
  chk(r1.h>=44,'2. кнопки групп не ниже 44 px',String(r1.h));
  const r3=await p.evaluate(()=>{ document.getElementById('addEx').click(); document.querySelector('#shB [data-exg="Плечи"]').click();
    const t=document.getElementById('exlist').textContent.replace(/\s+/g,' '); sheetClose(); return t; });
  chk(/Жим Арнольда.*своё/.test(r3),'3. своё упражнение — в списке своей группы',r3.slice(0,90));
  const r4=await p.evaluate(()=>{ exOpen=2; render(); const c=document.querySelector('.ex[data-j="2"]');
    c.querySelector('[data-f="w"]').value='14'; [...c.querySelectorAll('[data-rs]')].forEach(x=>{x.value='10';}); toggleSet(2);
    const e=dayEntries(today()).find(x=>x.n==='Жим Арнольда'); flush(); return {vol:e&&e.vol, m:muscleOf('Жим Арнольда','Плечи')}; });
  chk(r4.vol===420&&r4.m==='Плечи','4. журнал и мышцы: 3×10×14 = 420, мышца — плечи',JSON.stringify(r4));
  await p.reload(); await p.waitForTimeout(1300);
  const r5=await p.evaluate(()=>{ const a=(S.myEx||{})['Жим Арнольда']; S.myEx=['мусор']; scrubKeys(); const b1=JSON.stringify(S.myEx);
    S.myEx={'Жим Арнольда':'Плечи','Битое':'Космос'}; scrubKeys(); return {a, b1, b2:JSON.stringify(S.myEx)}; });
  chk(r5.a==='Плечи'&&r5.b1==='{}'&&r5.b2==='{"Жим Арнольда":"Плечи"}','5. переживает перезагрузку, битая копия чинится',JSON.stringify(r5));

  // 6–9. суперсет
  await p.evaluate(()=>{ S.rec={}; const d=dayOf(today()); d.ex=[{n:'Жим лёжа',s:3,r:'8-10',w:60,g:'Грудь'},{n:'Тяга штанги в наклоне',s:3,r:'8-10',w:50,g:'Спина'},{n:'Жим штанги стоя',s:3,r:'8-10',w:30,g:'Плечи'}];
    document.getElementById('tmr').classList.remove('on'); save(); exOpen=0; render(); });
  const r6=await p.evaluate(()=>{ const bt=document.querySelector('[data-ss="0"]'); const h=bt?Math.round(bt.getBoundingClientRect().height):0; if(bt) bt.click();
    exOpen=null; render(); const rows=[...document.querySelectorAll('.exrow')].map(x=>(x.classList.contains('ss')?'ss':'')+(x.classList.contains('ss2')?'ss2':''));
    return {ss:dayOf(today()).ex[0].ss, rows, h}; });
  chk(r6.ss===1&&r6.rows[0]==='ss'&&r6.rows[1]==='ss2'&&r6.rows[2]===''&&r6.h>=44,'6. «Суперсет со следующим» связывает пару, в списке видно',JSON.stringify(r6));
  const r7=await p.evaluate(()=>{ exOpen=0; render(); const c=document.querySelector('.ex[data-j="0"]'); [...c.querySelectorAll('[data-rs]')].forEach(x=>{x.value='10';});
    toggleSet(0); return {open:exOpen, tmr:document.getElementById('tmr').classList.contains('on')}; });
  chk(r7.open===1&&!r7.tmr,'7. закрыл первое — сразу второе, таймер отдыха не включился',JSON.stringify(r7));
  const r8=await p.evaluate(()=>{ const c=document.querySelector('.ex[data-j="1"]'); [...c.querySelectorAll('[data-rs]')].forEach(x=>{x.value='10';});
    toggleSet(1); return {open:exOpen, tmr:document.getElementById('tmr').classList.contains('on')}; });
  chk(r8.open===1&&r8.tmr,'8. после пары — отдых',JSON.stringify(r8));
  chk(errs.length===0,'9. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
