/* Те же придирки, но внутри шторок и наложений, на узком и широком экране */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED = eval('(' + src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
let fails=0;
const SHEETS = [
  ['настройки',      ()=>openSettings()],
  ['разбор',         ()=>openAnalysis()],
  ['прогрессия',     ()=>openProgression()],
  ['история дня',    ()=>{const ds=Object.keys(S.rec).sort().reverse()[0]; openDayReport(ds);}],
  ['история упражнения', ()=>openHistory(dayOf(today()).ex[0].n)],
  ['техника',        ()=>openHow(Object.keys(EXDB)[0])],
  ['итоги месяца',   ()=>monthReport(today().slice(0,7))],
  ['выбор упражнения', ()=>openExPicker()],
  ['рацион',         ()=>openRation()],
  ['итоги тренировки', ()=>workoutSummary(Object.keys(S.rec).sort().reverse()[0])],
  ['выбор продукта', ()=>{tab='food';render();openPick(0);}],
];
const SCAN=()=>{
  const out=[];
  const root=['sh','fp','ov'].map(id=>document.getElementById(id)).find(e=>e&&e.classList.contains('on'));
  if(!root) return ['шторка не открылась'];
  root.querySelectorAll('*').forEach(el=>{
    if(!el.getClientRects().length) return;
    const cs=getComputedStyle(el), r=el.getBoundingClientRect();
    if(r.width<1||r.height<1) return;
    const label=(el.id||el.className||el.tagName)+'«'+(el.textContent||'').trim().slice(0,18)+'»';
    // полосы, которые листаются вбок нарочно, — не находка
    let sc=el.parentElement, scroll=false;
    while(sc && sc!==document.body){ const c2=getComputedStyle(sc);
      if((c2.overflowX==='auto'||c2.overflowX==='scroll')&&sc.scrollWidth>sc.clientWidth+1){scroll=true;break;}
      sc=sc.parentElement; }
    if(scroll) return;
    // текст шире своей ячейки при видимом переполнении — он наезжает на соседа.
    // Меряем сам текст диапазоном: scrollWidth врёт, если у элемента есть
    // псевдоэлемент-подложка с отрицательным inset (зона нажатия).
    if(el.children.length===0 && (el.textContent||'').trim() && cs.overflowX==='visible'
       && !(el instanceof SVGElement) && el.clientWidth>0 && cs.display!=='inline'){
      const rg=document.createRange(); rg.selectNodeContents(el);
      const tw=rg.getBoundingClientRect().width;
      const pad=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
      if(tw>el.clientWidth-pad+1.5)
        out.push('текст шире ячейки: '+label+' ('+tw.toFixed(0)+'>'+(el.clientWidth-pad).toFixed(0)+')');
    }
    if((cs.overflow!=='visible'||cs.overflowX!=='visible') && cs.textOverflow!=='ellipsis'
       && el.scrollWidth>el.clientWidth+1 && el.children.length===0)
      out.push('обрезан текст: '+label+' ('+el.scrollWidth+'>'+el.clientWidth+')');
    if(r.right>window.innerWidth+1||r.left<-1)
      out.push('за краем экрана: '+label+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']');
    const pan=el.closest('.win,.shin,.ovin');
    if(pan&&pan!==el){const pr=pan.getBoundingClientRect();
      if(r.right>pr.right+1.5||r.left<pr.left-1.5)
        out.push('вылезает за рамку: '+label+' ['+Math.round(r.left)+'..'+Math.round(r.right)+'] рамка ['+Math.round(pr.left)+'..'+Math.round(pr.right)+']');}
  });
  return [...new Set(out)];
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const w of [320,390,768]){
    for(const skin of ['sl']){
      const p=await(await b.newContext({viewport:{width:w,height:844}})).newPage();
      const errs=[]; p.on('pageerror',e=>errs.push(e.message));
      await p.goto(APP); await p.waitForTimeout(1500);
      await p.evaluate(SEED);
      await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s;},skin);
      for(const [name,fn] of SHEETS){
        await p.evaluate(f=>{try{sheetClose()}catch(e){} ['fp','ov'].forEach(id=>document.getElementById(id).classList.remove('on'));
          tab='wo';sel=today();exOpen=null;render(); (0,eval)('('+f+')()');}, fn.toString());
        await p.waitForTimeout(280);
        const bad=await p.evaluate(SCAN);
        if(bad.length){fails+=bad.length;console.log(`  ✗ ${w}px ${skin} · ${name}:`);bad.slice(0,5).forEach(x=>console.log('      '+x));}
      }
      if(errs.length){fails++;console.log(`  ✗ ${w}px ${skin} ошибки JS: `+errs.join(' | '));}
      console.log(`  ${w}px ${skin} — ${SHEETS.length} шторок проверено`);
      await p.close();
    }
  }
  await b.close();
  console.log(fails?('находок: '+fails):'шторки чисты на всех ширинах и в обеих темах');
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
