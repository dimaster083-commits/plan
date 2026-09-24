/* Проверка сторожа наложений: убираем подложку у окна ступени —
   ровно так, как было, — и смотрим, увидит ли он текст на тексте. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'nalozh.js'),'utf8');
const SCAN = eval('(' + src.match(/const SCAN\s*=\s*(\(\)\s*=>\s*\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on');
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    save(); tab='wo'; sel=today(); exOpen=null; render(); levelUp(7); });
  await p.waitForTimeout(400);
  const clean = await p.evaluate(SCAN);
  console.log('как сейчас:', clean.length ? clean.slice(0,3).join('; ') : 'чисто');
  await p.evaluate(() => { const st=document.createElement('style');
    st.textContent='.lvup{background:radial-gradient(420px 320px at 50% 50%,rgba(165,169,174,.07),transparent 72%)!important}' +
      '.lvup div{background:none!important;border:0!important;box-shadow:none!important}';
    document.head.appendChild(st);
    document.getElementById('lvup').classList.add('on'); });
  await p.waitForTimeout(350);
  const broken = await p.evaluate(SCAN);
  console.log('как было:', broken.length ? broken.slice(0,3).join('; ') : 'НИЧЕГО НЕ НАШЁЛ');
  await b.close();
  const ok = clean.length === 0 && broken.length > 0;
  console.log(ok ? '✓ сторож видит текст поверх текста' : '✗ сторож наложений бесполезен');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
