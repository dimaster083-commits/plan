/* Текст поверх текста. Ищем пары видимых текстовых элементов, чьи
   прямоугольники перекрываются, а родства между ними нет — и у верхнего
   нет своей непрозрачной подложки. Именно так «новая ступень» легла
   на список упражнений. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED = eval('(' + src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
let fails = 0;
const SCAN = () => {
  const vis = el => {
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden' || +cs.opacity < 0.2) return false;
    return !!el.getClientRects().length;
  };
  const opaque = el => {           // есть ли у элемента или его предка своя подложка
    let e = el;
    for (let i = 0; i < 8 && e && e !== document.body; i++) {
      const cs = getComputedStyle(e);
      const m = cs.backgroundColor.match(/rgba?\(([^)]+)\)/);
      if (m) { const v = m[1].split(',').map(Number);
        if (v.length < 4 || v[3] >= 0.75) return true; }
      if (cs.backdropFilter && cs.backdropFilter !== 'none') return true;
      e = e.parentElement;
    }
    return false;
  };
  const leaves = [...document.querySelectorAll('body *')].filter(el =>
    el.children.length === 0 && (el.textContent || '').trim().length > 1 && vis(el));
  const boxes = leaves.map(el => ({ el, r: el.getBoundingClientRect(),
    z: (() => { let e = el, z = 0; while (e && e !== document.body) {
      const v = parseInt(getComputedStyle(e).zIndex, 10); if (!isNaN(v)) { z = v; break; } e = e.parentElement; }
      return z; })() }));
  const out = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
    const ox = Math.min(a.r.right, b.r.right) - Math.max(a.r.left, b.r.left);
    const oy = Math.min(a.r.bottom, b.r.bottom) - Math.max(a.r.top, b.r.top);
    if (ox < 4 || oy < 4) continue;                         // касание — не наложение
    const area = ox * oy, small = Math.min(a.r.width * a.r.height, b.r.width * b.r.height);
    if (area < small * 0.3) continue;                        // задели краем
    const top = a.z >= b.z ? a : b;
    if (opaque(top.el)) continue;                            // сверху своя подложка — норма
    out.push('«' + (a.el.textContent||'').trim().slice(0,18) + '» и «' +
      (b.el.textContent||'').trim().slice(0,18) + '»');
  }
  return [...new Set(out)];
};
(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const w of [320, 390]) {
    const p = await (await b.newContext({ viewport:{width:w,height:844} })).newPage();
    await p.goto(APP); await p.waitForTimeout(1400);
    await p.evaluate(SEED);
    await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on'); });
    for (const skin of ['sl','ber']) {
      await p.evaluate(s => applyTheme(s), skin);
      const states = [
        ['зал', "()=>{tab='wo';sel=today();exOpen=null;render();}"],
        ['упражнение', "()=>{tab='wo';sel=today();exOpen=0;render();}"],
        ['еда', "()=>{tab='food';render();}"],
        ['фото', "()=>{tab='photo';render();}"],
        ['прогресс/журнал', "()=>{tab='prog';pSec='log';render();}"],
        ['прогресс/нагрузка', "()=>{tab='prog';pSec='load';render();}"],
        ['прогресс/цель', "()=>{tab='prog';pSec='goal';render();}"],
        ['прогресс/веса', "()=>{tab='prog';pSec='prog';render();}"],
        ['новая ступень', "()=>{tab='wo';sel=today();exOpen=null;render();levelUp(7);}"],
        ['уведомление', "()=>{tab='wo';render();note('Проверочное уведомление');}"],
        ['настройки', "()=>{openSettings();}"],
        ['разбор', "()=>{openAnalysis();}"],
        ['итоги месяца', "()=>{monthReport(today().slice(0,7));}"],
        ['первичная настройка', "()=>{openSetup();}"],
      ];
      for (const [name, fn] of states) {
        await p.evaluate(f => { try{sheetClose()}catch(e){}
          ['fp','ov','setup','lvup'].forEach(id=>{const e=document.getElementById(id); if(e) e.classList.remove('on');});
          document.body.style.overflow=''; (0,eval)('('+f+')()'); }, fn);
        await p.waitForTimeout(260);
        const bad = await p.evaluate(SCAN);
        if (bad.length) { fails += bad.length;
          console.log(`  ✗ ${w}px ${skin} · ${name}:`);
          bad.slice(0,4).forEach(x => console.log('      ' + x)); }
      }
    }
    console.log(`  ${w}px — проверено`);
    await p.close();
  }
  await b.close();
  console.log(fails ? 'находок: ' + fails : 'текст нигде не ложится на текст');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
