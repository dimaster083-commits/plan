/* Длинные названия. Человек может вписать свой продукт или добавку
   как угодно длинно, а названия упражнений бывают в три слова.
   Ничего не должно вылезать за экран и наезжать друг на друга. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const LONG = 'Разгибание голени в тренажёре сидя с фиксацией таза и паузой в верхней точке';
const LONGWORD = 'Электроэнцефалографическираспространяющийсяпродуктнаименование';
let fails=0;
const SCAN=()=>{
  const out=[];
  document.querySelectorAll('.scr:not([hidden]) *, #sh.on *, #dayctx:not([hidden]) *').forEach(el=>{
    if(!el.getClientRects().length) return;
    const cs=getComputedStyle(el), r=el.getBoundingClientRect();
    if(r.width<1||r.height<1) return;
    if(r.right>window.innerWidth+1||r.left<-1)
      out.push('за краем: '+(el.className||el.tagName)+'«'+(el.textContent||'').trim().slice(0,20)+'» ['+Math.round(r.left)+'..'+Math.round(r.right)+']');
    let sc=el.parentElement, scroll=false;
    while(sc&&sc!==document.body){ const c2=getComputedStyle(sc);
      if((c2.overflowX==='auto'||c2.overflowX==='scroll')&&sc.scrollWidth>sc.clientWidth+1){scroll=true;break;}
      sc=sc.parentElement; }
    if(scroll) return;
    if(el.children.length===0&&(el.textContent||'').trim()&&cs.overflowX==='visible'
       &&!(el instanceof SVGElement)&&el.clientWidth>0&&cs.display!=='inline'){
      const rg=document.createRange(); rg.selectNodeContents(el);
      const tw=rg.getBoundingClientRect().width;
      const pad=parseFloat(cs.paddingLeft)+parseFloat(cs.paddingRight);
      if(tw>el.clientWidth-pad+1.5)
        out.push('шире ячейки: '+(el.className||el.tagName)+'«'+(el.textContent||'').trim().slice(0,20)+'»');
    }
  });
  return [...new Set(out)];
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const w of [320,390]){
    for(const skin of ['sl']){
      const p=await(await b.newContext({viewport:{width:w,height:844}})).newPage();
      const errs=[]; p.on('pageerror',e=>errs.push(e.message));
      await p.goto(APP); await p.waitForTimeout(1300);
      await p.evaluate(([skin,LONG,LONGWORD])=>{
        S.setup=1; document.getElementById('setup').classList.remove('on'); void skin;
        S.anchors={b:70,s:50,d:60};
        const d=dayOf(today());
        if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
        d.ex[0].n=LONG; if(d.ex[1]) d.ex[1].n=LONGWORD;
        d.n=LONG.slice(0,40); d.s=LONG.slice(0,30);
        const m=mealsRW(today()); m.length=0;
        m.push({n:LONG.slice(0,30),note:'',items:[{p:LONG,g:'250'},{p:LONGWORD,g:'100'}]});
        S.sp=[{n:LONG,h:LONGWORD},{n:LONGWORD,h:LONG}];
        const r=recRW(today()); r.wo=1;
        r.log[0]={done:1,n:LONG,g:d.ex[0].g,s:'3',r:'8',w:'20',rs:['8','8','8'],vol:480,xp:12};
        S.pr={}; S.pr[LONG]=200;
        save(); recomputeStats(1);
      },[skin,LONG,LONGWORD]);
      const states=[
        ['зал',"()=>{tab='wo';sel=today();exOpen=null;render();}"],
        ['упражнение',"()=>{tab='wo';sel=today();exOpen=0;render();}"],
        ['еда',"()=>{tab='food';render();}"],
        ['веса',"()=>{tab='prog';pSec='prog';render();}"],
        ['журнал',"()=>{tab='prog';pSec='log';render();}"],
        ['история дня',"()=>{openDayReport(today());}"],
        ['прогрессия',"()=>{openProgression();}"],
        ['техника',"()=>{openHow(Object.keys(EXDB)[0],0);}"],
        ['итоги месяца',"()=>{monthReport(today().slice(0,7));}"],
      ];
      for(const [name,fn] of states){
        await p.evaluate(f=>{ try{sheetClose()}catch(e){}
          ['fp','ov','setup'].forEach(id=>{const e2=document.getElementById(id); if(e2) e2.classList.remove('on');});
          document.body.style.overflow=''; (0,eval)('('+f+')()'); }, fn);
        await p.waitForTimeout(220);
        const bad=await p.evaluate(SCAN);
        const wide=await p.evaluate(()=>document.documentElement.scrollWidth);
        const probs=bad.slice(0,3);
        if(wide>w+1) probs.unshift('документ шире экрана: '+wide);
        if(probs.length){ fails+=probs.length; console.log(`  ✗ ${w}px ${skin} · ${name}:`);
          probs.forEach(x=>console.log('      '+x)); }
      }
      if(errs.length){ fails++; console.log('  ✗ ошибки JS: '+[...new Set(errs)].join(' | ')); }
      await p.close();
    }
    console.log(`  ${w}px — проверено`);
  }
  await b.close();
  console.log(fails?('находок: '+fails):'длинные названия не ломают вёрстку');
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
