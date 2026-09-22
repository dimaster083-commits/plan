/* Шестерёнка и всё, что за ней: настройки, каталог, резервные копии,
   обнуление. Со снимками. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const D=require('path').join(__dirname, '..', 'out') + require('path').sep;
const out=[]; const ok=(n,c,d)=>out.push((c?'  ✓ ':'  ✗ ')+n+(c?'':'   → '+d));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1700);
  await p.evaluate(()=>{S.setup=1;save();document.getElementById('setup').classList.remove('on');tab='wo';render();});
  await p.waitForTimeout(400);

  const start=await p.evaluate(()=>skinNow());
  // как человек: жмём шестерёнку
  await p.click('#gear'); await p.waitForTimeout(600);
  const opened=await p.evaluate(()=>({sheet:document.getElementById('sh').classList.contains('on'),
    title:document.getElementById('shT').textContent,
    picks:[...document.querySelectorAll('[data-skin-set]')].map(e=>e.dataset.skinSet)}));
  ok('шестерёнка открывает настройки', opened.sheet && opened.picks.length===2,
     JSON.stringify(opened));
  await p.screenshot({path:D+'settings.png'});

  // жмём вторую тему
  await p.click('[data-skin-set="ber"]'); await p.waitForTimeout(700);
  const after=await p.evaluate(()=>({skin:skinNow(), acc:getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(),
    stored:localStorage.getItem('sys-gym-skin'),
    marked:!!document.querySelector('[data-skin-set="ber"].on')}));
  ok('вторая тема включается нажатием', after.skin==='ber' && after.acc==='#C98A62' && after.stored==='ber',
     JSON.stringify(after));
  ok('выбранная тема отмечена в списке', after.marked, 'отметка не встала');
  await p.screenshot({path:D+'settings-ber.png'});

  // и обратно
  await p.click('[data-skin-set="sl"]'); await p.waitForTimeout(700);
  const back=await p.evaluate(()=>skinNow());
  ok('первая тема возвращается', back==='sl', back);

  // переживает перезагрузку
  await p.click('[data-skin-set="ber"]'); await p.waitForTimeout(500);
  await p.reload(); await p.waitForTimeout(1700);
  ok('выбор держится после перезагрузки', (await p.evaluate(()=>skinNow()))==='ber', 'сбросился');

  // настройка дня из настроек
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');tab='wo';render();});
  await p.click('#gear'); await p.waitForTimeout(500);
  await p.click('[data-dayset]'); await p.waitForTimeout(600);
  const dayset=await p.evaluate(()=>({edit:edit, shown:!document.getElementById('dedit').hidden,
    sheet:document.getElementById('sh').classList.contains('on')}));
  ok('настройка дня открывается из настроек', dayset.edit && dayset.shown && !dayset.sheet, JSON.stringify(dayset));

  console.log(out.join('\n'));
  console.log('ошибки JS:', errs.length?[...new Set(errs)].slice(0,3).join(' | '):'нет');
  await b.close();
})().catch(e=>{console.log(out.join('\n'));console.log('FATAL',e.message);process.exit(1);});
