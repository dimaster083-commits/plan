/* Живой прогон: открыть, закрыть подход, поставить рекорд, закрыть
   тренировку — и проверить, что журнал и статистика сошлись. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(()=>{S.setup=1;save();document.getElementById('setup').classList.remove('on');
    const d=dayOf(today()); if(d.t==='rest'){const s2=S.days.find(x=>(x.ex||[]).length);d.t=s2.t;d.s=s2.s;d.ex=s2.ex.map(e=>({...e}));}
    tab='wo';sel=today();editPast=false;exOpen=null;render();});
  await p.waitForTimeout(300);
  const out=[];
  const ok=(n,c,d)=>out.push((c?'  ✓ ':'  ✗ ')+n+(c?'':'   → '+d));

  // 1. набранное и не сохранённое число в поле
  await p.click('#exl [data-open="0"]'); await p.waitForTimeout(300);
  const f=await p.$('.exfkg'); await f.click({clickCount:3}); await p.keyboard.type('47,5');
  await p.waitForTimeout(150);
  const before=await p.$eval('.exfkg',i=>({v:i.value,sel:[i.selectionStart,i.selectionEnd],focused:document.activeElement===i}));
  await p.evaluate(()=>applyTheme('ber')); await p.waitForTimeout(250);
  const after=await p.$eval('.exfkg',i=>({v:i.value,sel:[i.selectionStart,i.selectionEnd],focused:document.activeElement===i}));
  ok('набранное в поле переживает смену темы', before.v===after.v && after.v==='47,5', JSON.stringify([before,after]));
  ok('фокус и курсор в поле не теряются', after.focused && JSON.stringify(before.sel)===JSON.stringify(after.sel), JSON.stringify([before,after]));

  // 2. раскрытое упражнение
  const exo=await p.evaluate(()=>exOpen);
  ok('раскрытое упражнение остаётся раскрытым', exo===0, 'exOpen='+exo);

  // 3. идущий таймер
  await p.evaluate(()=>{applyTheme('sl');tStart(120);});
  await p.waitForTimeout(1100);
  const t1=await p.$eval('#tmrV',e=>e.textContent);
  await p.evaluate(()=>applyTheme('ber')); await p.waitForTimeout(1100);
  const t2=await p.$eval('#tmrV',e=>e.textContent);
  const on=await p.$eval('#tmr',e=>e.classList.contains('on'));
  ok('таймер не сбивается и продолжает идти', on && t1!==t2, `${t1} → ${t2}, виден ${on}`);

  // 4. открытая шторка
  await p.evaluate(()=>{clearInterval(tInt);document.getElementById('tmr').classList.remove('on');
    sheet('ПРОВЕРКА','<p id="probe">текст</p>');});
  await p.waitForTimeout(200);
  await p.evaluate(()=>applyTheme('sl')); await p.waitForTimeout(200);
  const sh=await p.evaluate(()=>({on:document.getElementById('sh').classList.contains('on'),
    probe:!!document.getElementById('probe')}));
  ok('открытая шторка не закрывается', sh.on && sh.probe, JSON.stringify(sh));

  // 5. открытый диалог
  await p.evaluate(()=>{sheetClose();ask('Вопрос?','ДА');});
  await p.waitForTimeout(200);
  await p.evaluate(()=>applyTheme('ber')); await p.waitForTimeout(200);
  const as=await p.$eval('#ask',e=>e.classList.contains('on'));
  ok('открытый диалог не закрывается', as, 'виден='+as);
  await p.evaluate(()=>askClose(false));

  // 6. календарь перекрасился без перерисовки
  await p.evaluate(()=>{applyTheme('sl');tab='prog';exOpen=null;render();calView='month';mo=today().slice(0,7);cal();});
  await p.waitForTimeout(400);
  const c1=await p.$eval('#cgrid .cd.in',e=>getComputedStyle(e).getPropertyValue('--cd-c').trim());
  // и год тоже
  const html1=await p.$eval('#cgrid',e=>e.innerHTML.length);
  await p.evaluate(()=>applyTheme('ber')); await p.waitForTimeout(250);
  const c2=await p.$eval('#cgrid .cd.in',e=>getComputedStyle(e).getPropertyValue('--cd-c').trim());
  const html2=await p.$eval('#cgrid',e=>e.innerHTML.length);
  ok('календарь перекрашивается без перерисовки', c1!==c2 && html1===html2, `${c1} → ${c2}`);

  console.log(out.join('\n'));
  console.log('ошибки JS:', errs.length?[...new Set(errs)].join(' | '):'нет');
  await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
