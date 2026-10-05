/* Подходы строками: вес × повторы и галочка справа.
   Вес может отличаться от подхода к подходу — 60/70/80 это не 3×80 и не
   3×60. До этой правки вес был один на упражнение, и тоннаж такой
   тренировки считался неверно; строк и галочек не было вовсе. */
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

  const prep=()=>p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.pr={};
    const d=dayOf(today()); d.t='lo1'; d.s='тест';
    d.ex=[{n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'}];
    entCache=null; save(); tab='wo'; sel=today(); exOpen=0; render();
  });

  // 1. подходы нарисованы строками, в строке вес, повторы и галочка
  await prep();
  const вид=await p.evaluate(()=>{
    const c=document.querySelector('.ex[data-j="0"]');
    const rows=[...c.querySelectorAll('.srow')];
    return {строк:rows.length,
      вес:rows.every(r=>r.querySelector('[data-ws]')),
      повт:rows.every(r=>r.querySelector('[data-rs]')),
      галка:rows.every(r=>r.querySelector('[data-tick]'))};
  });
  chk(вид.строк===3&&вид.вес&&вид.повт&&вид.галка,
    '1. подход — строка: вес × повторы и галочка', JSON.stringify(вид));

  // 2. строка влезает в 320 и кнопка не меньше 44
  const мера=await p.evaluate(()=>{
    const r=document.querySelector('.srow');
    const t=r.querySelector('[data-tick]').getBoundingClientRect();
    return {ширина:Math.round(r.getBoundingClientRect().width),
      кнопка:Math.round(Math.min(t.width,t.height)),
      вылез:r.scrollWidth-r.clientWidth};
  });
  chk(мера.ширина<=320&&мера.кнопка>=44&&мера.вылез<=1,
    '2. строка влезает в 320, галочка не меньше 44', JSON.stringify(мера));

  // 3. галочка отмечает подход и подставляет цель в пустые повторы
  const отмечено=await p.evaluate(()=>{
    const c=document.querySelector('.ex[data-j="0"]');
    const row=c.querySelectorAll('.srow')[0];
    row.querySelector('[data-rs]').value='';
    row.querySelector('[data-tick]').click();
    return {на:row.classList.contains('on'), повт:row.querySelector('[data-rs]').value};
  });
  chk(отмечено.на&&parseFloat(отмечено.повт)>0,
    '3. галочка отмечает подход и ставит цель в пустую клетку', JSON.stringify(отмечено));

  // 4. вес по подходам идёт в тоннаж: 100/110/120 по 10 повторов
  await prep();
  const тоннаж=await p.evaluate(()=>{
    const c=document.querySelector('.ex[data-j="0"]');
    const w=[100,110,120];
    [...c.querySelectorAll('[data-ws]')].forEach((x,i)=>{
      x.value=String(w[i]); x.dispatchEvent(new Event('input',{bubbles:true}));
    });
    [...c.querySelectorAll('[data-rs]')].forEach(x=>{
      x.value='10'; x.dispatchEvent(new Event('input',{bubbles:true}));
    });
    toggleSet(0);
    entCache=null;
    return {считано:dayTon(today()), ожидание:10*100+10*110+10*120};
  });
  chk(тоннаж.считано===тоннаж.ожидание,
    '4. тоннаж считает вес каждого подхода', тоннаж.считано+' из '+тоннаж.ожидание);

  // 5. сторож: со старым счётом — один вес на всё — вышло бы 3×10×100
  chk(тоннаж.ожидание!==10*3*100,
    '5. со старым счётом одним весом вышло бы другое число', '3×10×100 = '+(3*10*100));

  // 6. разные веса видны в строке журнала
  const строка=await p.evaluate(()=>{ entCache=null;
    const ent=dayEntries(today());
    return ent.length ? entryLine(ent[0]) : 'ЗАПИСЕЙ НЕТ, log='+JSON.stringify(recOf(today()).log);
  });
  chk(/100\/110\/120/.test(строка), '6. строка журнала показывает веса подходов', строка);

  // 7. один вес на все подходы пишется по-старому, без перечисления
  await p.waitForTimeout(300);            // защита от двойного тапа держит 200 мс
  const один=await p.evaluate(()=>{
    S.rec={}; entCache=null;
    const d=dayOf(today()); d.ex=[{n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'}];
    save(); exOpen=0; render();
    const c=document.querySelector('.ex[data-j="0"]');
    [...c.querySelectorAll('[data-rs]')].forEach(x=>{
      x.value='10'; x.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const wCard=parseFloat(String(c.querySelector('[data-f="w"]').value).replace(',','.'));
    toggleSet(0);
    entCache=null;
    return {строка:entryLine(dayEntries(today())[0]), тонн:dayTon(today()), вес:wCard};
  });
  chk(!/\//.test(один.строка.split('·').pop())&&один.тонн===30*один.вес,
    '7. один вес на всё — счёт и подпись как раньше', JSON.stringify(один));

  chk(errs.length===0,'8. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
