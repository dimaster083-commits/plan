/* Проверка сторожа палитры: возвращаем синие поля первого экрана,
   какими они были, и убеждаемся, что он их видит. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'palitra.js'),'utf8');
const SCAN = eval('(' + src.match(/const SCAN\s*=\s*(skin\s*=>\s*\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(() => { applyTheme('ber'); openSetup(); });
  await p.waitForTimeout(350);
  const clean = await p.evaluate(SCAN, 'ber');
  console.log('как сейчас:', clean.length ? clean.slice(0,3).join('; ') : 'чисто');
  await p.evaluate(() => { const st=document.createElement('style');
    st.textContent='.srow input{background:rgba(90,150,255,.16)!important;' +
      'border:1px solid rgba(90,150,255,.45)!important;color:#5C9DFF!important}';
    document.head.appendChild(st); });
  await p.waitForTimeout(250);
  const broken = await p.evaluate(SCAN, 'ber');
  console.log('со старым стилем:', broken.length ? broken.slice(0,3).join('; ') : 'НИЧЕГО НЕ НАШЁЛ');
  await b.close();
  const ok = clean.length === 0 && broken.length > 0;
  console.log(ok ? '✓ сторож палитры видит чужой цвет' : '✗ сторож палитры бесполезен');
  process.exit(ok ? 0 : 1);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
