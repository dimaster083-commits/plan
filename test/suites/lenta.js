/* «Прогресс» одной лентой, как у Lyfta. До этой правки разделы прятались
   за четырьмя вкладками: итоги недели, ранги и разбор лежали в четвёртой,
   рекордов лентой не было вовсе. Теперь всё видно разом, наверху итоги
   недели и рекорды, а вкладки — навигация, которая прокручивает к разделу. */
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

  // журнал: на этой неделе одна тренировка с рекордом веса и рекордом ≈1ПМ
  const seed=await p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.pr={};
    const mon=mondayOf(today()); const ds=mon<=today()?mon:today();
    S.rec[ds]={wo:1,log:{0:{done:1,n:'Жим лёжа',g:'Грудь',w:'80',s:'3',r:'8',rs:[8,8,8],sd:1,
      prevPr:75, recs:[{k:'e1',v:101.3,o:96}]}}};
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    tab='prog'; pSec='log'; render(); window.scrollTo(0,0);
    return ds;
  });
  await p.waitForTimeout(300);

  // 1. разделы видны разом, ни один не спрятан за вкладкой
  const видно=await p.evaluate(()=>{
    const all=[...document.querySelectorAll('#scr-prog .psec')];
    return {всего:all.length, скрыто:all.filter(x=>x.hidden||!x.offsetParent).map(x=>x.dataset.s)};
  });
  chk(видно.всего>=4&&видно.скрыто.length===0, '1. все разделы в одной ленте, ни один не спрятан', JSON.stringify(видно));

  // 2. итоги недели наверху — тем же счётом, что weekData
  const итоги=await p.evaluate(()=>{
    const w=weekData(mondayOf(today()));
    const t=document.getElementById('recapN').textContent.replace(/\s+/g,' ').trim();
    return {t, wo:w.wo, sets:w.sets, recs:w.recs};
  });
  chk(new RegExp('^'+итоги.wo+'\\s*тренировк').test(итоги.t)&&new RegExp(итоги.sets+'\\s*подход').test(итоги.t),
    '2. итоги недели равны weekData', итоги.t);

  // 3. падежи: 1 тренировка, 1 рекорд
  chk(/1\s*тренировка/.test(итоги.t)&&/1\s*рекорд(?!ов)/.test(итоги.t), '3. «1 тренировка», «1 рекорд» — без «1 тренировок»', итоги.t);

  // 4. рекорды лентой: вес и ≈1ПМ с датой и «было»
  const рек=await p.evaluate(()=>{
    const rows=[...document.querySelectorAll('#recList .rrow')];
    return {строк:rows.length, текст:rows.map(r=>r.textContent.replace(/\s+/g,' ').trim())};
  });
  chk(рек.строк===2&&/вес 80 кг \(было 75\)/.test(рек.текст.join('|'))&&/≈1ПМ 101,3 кг \(было 96 кг\)/.test(рек.текст.join('|')),
    '4. рекорды: вес и ≈1ПМ, с «было»', рек.текст.join(' | '));

  // 5. пустой журнал — понятная подсказка, а не пустота
  const пусто=await p.evaluate(()=>{
    const keep=JSON.stringify(S.rec); S.rec={}; entCache=null; render();
    const t=document.getElementById('recList').textContent.trim();
    S.rec=JSON.parse(keep); entCache=null; render(); return t;
  });
  chk(/Рекордов пока нет/.test(пусто), '5. без рекордов — подсказка, а не пустое окно', пусто.slice(0,60));

  // 6. итоги недели и месяца открываются из карточки итогов
  const открыть=async id=>{
    const t=await p.evaluate(id=>{ const b=document.querySelector('#recapB #'+id); if(!b) return null;
      b.click(); return document.getElementById('shT').textContent; },id);
    await p.evaluate(()=>sheetClose()); await p.waitForTimeout(260); return t;
  };
  const t1=await открыть('wkBtn'), t2=await открыть('moBtn');
  const вход={есть:t1!==null&&t2!==null, t1, t2};
  chk(вход.есть&&/НЕДЕЛ/.test(вход.t1)&&/^ИТОГИ/.test(вход.t2)&&вход.t2!==вход.t1, '6. «Итоги недели» и «Итоги месяца» — из карточки итогов', JSON.stringify(вход));

  // 7. вкладка — навигация: прокручивает к разделу и подсвечивается
  await p.evaluate(()=>window.scrollTo(0,0));
  await p.click('#pseg [data-sec="goal"]'); await p.waitForTimeout(250);
  const нав=await p.evaluate(()=>{
    const t=document.querySelector('#scr-prog .psec[data-s="goal"]').getBoundingClientRect().top;
    const bar=document.getElementById('pseg').getBoundingClientRect().bottom;
    return {сдвиг:Math.round(window.scrollY), верх:Math.round(t), полоса:Math.round(bar),
      вкл:document.querySelector('#pseg [data-sec="goal"]').classList.contains('on')};
  });
  chk(нав.сдвиг>0&&нав.верх>=нав.полоса-2&&нав.верх<нав.полоса+60&&нав.вкл,
    '7. «Цель» прокручивает к разделу цели и подсвечена', JSON.stringify(нав));

  // 8. влезает в 320, кнопки не меньше 44
  const мера=await p.evaluate(()=>{
    window.scrollTo(0,0);
    const bs=[...document.querySelectorAll('#recapB button,#pseg button')];
    return {экран:document.documentElement.scrollWidth, мин:Math.min(...bs.map(x=>Math.round(x.getBoundingClientRect().height)))};
  });
  chk(мера.экран<=320&&мера.мин>=44, '8. влезает в 320, кнопки не ниже 44', JSON.stringify(мера));

  chk(errs.length===0,'9. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
