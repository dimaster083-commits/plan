/* Проверка самой проверки: нарочно ломаем вёрстку так, как она была
   сломана на самом деле, и убеждаемся, что сторож это видит. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'layout.js'),'utf8');
const SCAN = eval('(' + src.match(/const SCAN\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
const SEED = eval('(' + src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:900} })).newPage();
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(SEED);
  await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on');
    tab='prog'; pSec='prog'; render(); });
  await p.waitForTimeout(400);
  const clean = await p.evaluate(SCAN);
  console.log('как сейчас:', clean.length ? clean.slice(0,3).join('; ') : 'чисто');
  // возвращаем прежнее поведение заголовков
  await p.evaluate(() => { const st=document.createElement('style');
    st.id='broken';
    st.textContent='.wtab th{white-space:nowrap!important;font-size:10.5px!important;'+
      'letter-spacing:.02em!important;overflow:visible!important}'+
      '.wtab col.nm{width:38%!important}.wtab col.d{width:13%!important}.wtab col.n{width:16%!important}';
    document.head.appendChild(st); });
  await p.waitForTimeout(250);
  const broken = await p.evaluate(SCAN);
  // заголовку теперь подложена страховка overflow:hidden, поэтому сторож
  // ловит ту же поломку под другим именем — засчитываем оба
  const caught = broken.filter(x => /текст шире ячейки|обрезан текст/.test(x));
  console.log('со старым правилом:', caught.length ? caught.slice(0,4).join('; ') : 'НИЧЕГО НЕ НАШЁЛ');
  await b.close();
  const okNow = clean.length === 0, okThen = caught.length > 0;
  console.log(okNow && okThen ? '✓ сторож видит именно тот баг, который чинили' : '✗ сторож бесполезен');
  process.exit(okNow && okThen ? 0 : 1);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
