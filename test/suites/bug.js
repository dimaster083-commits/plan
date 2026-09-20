/* Карточка упражнения: правка подходов, повторов и веса, «ПОДХ» до и
   после правки, пустые поля. Ловит ошибки JS на каждом шаге. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:2 })).newPage();
  p.on('pageerror', e => console.log('PAGEERROR', e.message));
  await p.goto(APP);
  await p.waitForTimeout(1200);
  await p.evaluate(() => { S.setup=1; save(); document.getElementById('setup').classList.remove('on');
    const d = dayOf(today()); if (d.t==='rest'){ const src=S.days.find(x=>(x.ex||[]).length); d.t=src.t; d.s=src.s; d.ex=src.ex.map(e=>({...e})); }
    tab='wo'; sel=today(); editPast=false; render(); });
  await p.waitForTimeout(300);

  // упражнение раскрывается нажатием — поля появляются только внутри
  await p.click('#exl [data-open="0"]');
  await p.waitForTimeout(300);
  const field = await p.$('#exl .ex[data-j="0"] [data-f="s"]');
  if (!field) throw new Error('раскрытое упражнение без поля «ПОДХ»');
  console.log('ПОДХ до правки:', await field.inputValue());

  // как человек: выделить и вписать 6
  await field.click({ clickCount: 3 });
  await p.keyboard.type('6');
  await p.waitForTimeout(250);
  console.log('после ввода:', await p.$eval('#exl .ex[data-j="0"] [data-f="s"]', i => i.value),
              '| коробок повторов:', (await p.$$('#exl .ex[data-j="0"] [data-rs]')).length);
  console.log('в журнале:', await p.evaluate(() => JSON.stringify(recOf(sel).log[0])));

  // уйти в прогресс и вернуться
  await p.evaluate(() => { tab='prog'; render(); });
  await p.waitForTimeout(300);
  await p.evaluate(() => { tab='wo'; render(); });
  await p.waitForTimeout(300);
  if (!(await p.$('#exl .ex[data-j="0"]'))) { await p.click('#exl [data-open="0"]'); await p.waitForTimeout(250); }
  console.log('после возврата:', await p.$eval('#exl .ex[data-j="0"] [data-f="s"]', i => i.value),
              '| коробок:', (await p.$$('#exl .ex[data-j="0"] [data-rs]')).length);
  console.log('в журнале:', await p.evaluate(() => JSON.stringify(recOf(sel).log[0])));

  // а теперь — очистка поля и ввод (как реально на телефоне)
  const f2 = await p.$('#exl .ex[data-j="0"] [data-f="s"]');
  await f2.click({ clickCount: 3 });
  await p.keyboard.press('Backspace');
  await p.waitForTimeout(200);
  console.log('после очистки поля, в журнале:', await p.evaluate(() => JSON.stringify(recOf(sel).log[0])),
              '| коробок:', (await p.$$('#exl .ex[data-j="0"] [data-rs]')).length);
  await p.evaluate(() => { tab='prog'; render(); tab='wo'; render(); });
  await p.waitForTimeout(300);
  if (!(await p.$('#exl .ex[data-j="0"]'))) { await p.click('#exl [data-open="0"]'); await p.waitForTimeout(250); }
  console.log('после возврата с пустым:', await p.$eval('#exl .ex[data-j="0"] [data-f="s"]', i => i.value));

  // как выглядят 8 подходов
  await p.evaluate(() => { const r=recRW(sel); r.log[0]={s:'8'}; save(); exOpen=0; render(); });
  await p.waitForTimeout(300);
  const card = await p.$('#exl .ex[data-j="0"]');
  await card.screenshot({ path: require('path').join(__dirname, '..', 'out', 'podhody8.png') });
  const ov = await p.evaluate(() => { const rb=document.querySelector('#exl .rb'); 
    return { scroll: rb.scrollWidth, client: rb.clientWidth, boxes: rb.children.length }; });
  console.log('строка повторов при 8 подходах:', JSON.stringify(ov));
  await b.close();
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
