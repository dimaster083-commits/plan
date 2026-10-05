/* Экран «Зал»: крупная цифра тренировки дня и постоянная кнопка
   «Начать / Завершить» с часами. До этой правки цифры дня не было вовсе,
   кнопка называлась «Завершить тренировку» с первой секунды и пропадала,
   как только упражнение раскрыто; отсчёт времени начинался молча с первым
   закрытым подходом, и разминка в него не попадала. */
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
    d.ex=[{n:'Жим ногами',s:3,r:'8-10',w:100,g:'Ноги'},
          {n:'Сгибания ног',s:3,r:'10-12',w:40,g:'Ноги'}];
    entCache=null; save(); tab='wo'; sel=today(); exOpen=null; render();
  });

  // 1. до начала кнопка зовёт начать, часы молчат
  await prep();
  const старт=await p.evaluate(()=>({
    текст:document.getElementById('fin').textContent.trim(),
    видна:!document.getElementById('wobar').hidden,
    время:document.getElementById('woTime').textContent.trim()
  }));
  chk(/Начать/i.test(старт.текст)&&старт.видна&&старт.время==='—',
    '1. до начала — «Начать тренировку», часов нет', JSON.stringify(старт));

  // 2. крупная цифра дня есть и показывает ноль до первого подхода
  const цифра=await p.evaluate(()=>{
    const el=document.getElementById('woBig');
    return {есть:!!el, число:el?el.textContent.trim():'', упр:document.getElementById('woEx').textContent.trim(),
      кегль:el?Math.round(parseFloat(getComputedStyle(el).fontSize)):0};
  });
  chk(цифра.есть&&цифра.число==='0'&&цифра.упр==='0/2'&&цифра.кегль>=30,
    '2. крупная цифра дня: 0 кг, 0/2 упражнений', JSON.stringify(цифра));

  // 3. нажал «Начать» — пошли часы, кнопка стала «Завершить»
  await p.click('#fin'); await p.waitForTimeout(1200);
  const идёт=await p.evaluate(()=>({
    текст:document.getElementById('fin').textContent.trim(),
    t0:!!recOf(today()).t0, закрыта:!!recOf(today()).wo
  }));
  chk(/Завершить/.test(идёт.текст)&&/\d+:\d\d/.test(идёт.текст)&&идёт.t0&&!идёт.закрыта,
    '3. «Начать» запускает часы, тренировка не закрыта', JSON.stringify(идёт));

  // 4. кнопка остаётся на раскрытом упражнении
  const враскрытом=await p.evaluate(()=>{
    exOpen=0; render();
    const bar=document.getElementById('wobar');
    return {видна:!bar.hidden&&bar.getBoundingClientRect().height>0,
      кнопка:Math.round(document.getElementById('fin').getBoundingClientRect().height)};
  });
  chk(враскрытом.видна&&враскрытом.кнопка>=44,
    '4. кнопка держится на раскрытом упражнении, не меньше 44', JSON.stringify(враскрытом));

  // 5. цифра дня считает тоннаж закрытого подхода
  const после=await p.evaluate(()=>{
    const c=document.querySelector('.ex[data-j="0"]');
    [...c.querySelectorAll('[data-rs]')].forEach(x=>{
      x.value='10'; x.dispatchEvent(new Event('input',{bubbles:true}));
    });
    const w=parseFloat(String(c.querySelector('[data-f="w"]').value).replace(',','.'));
    toggleSet(0);
    entCache=null; exOpen=null; render();
    return {цифра:document.getElementById('woBig').textContent.trim(),
      подходы:document.getElementById('woSets').textContent.trim(),
      упр:document.getElementById('woEx').textContent.trim(),
      ждём:Math.round(dayTon(today())), вес:w};
  });
  chk(parseFloat(после.цифра.replace(',','.'))>0&&после.подходы==='3'&&после.упр==='1/2',
    '5. цифра дня и счётчики считают закрытый подход', JSON.stringify(после));

  // 6. завершение останавливает часы и запирает кнопку
  await p.waitForTimeout(300);
  const конец=await p.evaluate(()=>{
    document.querySelectorAll('.ov.on,.sheet.on,#sh.on').forEach(e=>e.classList.remove('on'));
    document.getElementById('fin').click();
    document.querySelectorAll('.ov.on,.sheet.on,#sh.on').forEach(e=>e.classList.remove('on'));
    const r=recOf(today());
    return {текст:document.getElementById('fin').textContent.trim(),
      заперта:document.getElementById('fin').disabled, wo:!!r.wo, t1:!!r.t1};
  });
  chk(конец.wo&&конец.t1&&конец.заперта&&/закрыта/i.test(конец.текст),
    '6. «Завершить» закрывает тренировку и запирает кнопку', JSON.stringify(конец));

  // 7. ничего не вылезает за 320
  const влез=await p.evaluate(()=>{
    exOpen=null; render();
    const el=document.querySelector('.whead');
    return {шапка:el?el.scrollWidth-el.clientWidth:-1,
      тело:document.documentElement.scrollWidth};
  });
  chk(влез.шапка<=1&&влез.тело<=320, '7. шапка и экран влезают в 320', JSON.stringify(влез));

  chk(errs.length===0,'8. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
