/* Пальцем в зале. Любая кнопка должна ловиться пальцем: меньше 44×44
   по рекомендации Apple — промах, особенно мокрыми руками. Считаем и
   саму кнопку, и её зону нажатия через псевдоэлемент. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src=require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED=eval('('+src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'')+')');
let fails=0;
const SCAN=()=>{
  const out=[];
  const hit=el=>{
    const r=el.getBoundingClientRect();
    let w=r.width,h=r.height;
    const cs=getComputedStyle(el,'::after');
    if(cs.content && cs.content!=='none' && cs.position==='absolute'){
      const pad=v=>{const n=parseFloat(v); return isNaN(n)?0:-Math.min(0,n);};
      w+=pad(cs.left)+pad(cs.right); h+=pad(cs.top)+pad(cs.bottom);
    }
    return [w,h];
  };
  document.querySelectorAll('button,[role="button"],input[type="checkbox"]').forEach(el=>{
    if(!el.getClientRects().length||el.disabled) return;
    const [w,h]=hit(el);
    if(w<1||h<1) return;
    if(w<43.5||h<43.5) out.push((el.id||el.className||el.tagName)+'«'+(el.textContent||'').trim().slice(0,14)+'» '+
      Math.round(w)+'×'+Math.round(h));
  });
  return [...new Set(out)];
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(SEED);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');});
  const states=[
    ['зал',"()=>{tab='wo';sel=today();exOpen=null;render();}"],
    ['упражнение',"()=>{tab='wo';sel=today();exOpen=0;render();}"],
    ['еда',"()=>{tab='food';render();}"],
    ['фото',"()=>{tab='photo';render();}"],
    ['журнал',"()=>{tab='prog';pSec='log';render();}"],
    ['нагрузка',"()=>{tab='prog';pSec='load';render();}"],
    ['цель',"()=>{tab='prog';pSec='goal';render();}"],
    ['веса',"()=>{tab='prog';pSec='prog';render();}"],
    ['месяц в журнале',"()=>{tab='prog';pSec='log';calView='month';mo=today().slice(0,7);render();cal();}"],
    ['настройки',"()=>{openSettings();}"],
    ['первичная настройка',"()=>{openSetup();}"],
    ['рацион',"()=>{tab='food';render();openRation();}"],
    ['техника',"()=>{tab='wo';sel=today();exOpen=0;render();openHow(dayOf(sel).ex[0].n,0);}"],
    ['итоги месяца',"()=>{monthReport(today().slice(0,7));}"],
  ];
  for(const [name,fn] of states){
    await p.evaluate(f=>{ try{sheetClose()}catch(e){}
      ['fp','ov','setup'].forEach(id=>{const e2=document.getElementById(id); if(e2) e2.classList.remove('on');});
      document.body.style.overflow=''; (0,eval)('('+f+')()'); }, fn);
    await p.waitForTimeout(250);
    const bad=await p.evaluate(SCAN);
    if(bad.length){ fails+=bad.length; console.log('  ✗ '+name+':');
      bad.slice(0,6).forEach(x=>console.log('      '+x)); }
    else console.log('  ✓ '+name);
  }
  await b.close();
  console.log(fails?('мелких кнопок: '+fails):'все кнопки ловятся пальцем');
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
