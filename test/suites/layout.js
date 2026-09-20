/* Ищет «дешевизну» глазами машины: обрезанный текст, налезающие друг
   на друга подписи и всё, что вылезает за свою панель. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const CH = LAUNCH.executablePath;
let fails=0;
const SEED=()=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  const d0=dayOf(iso(new Date()));
  if(d0.t==='rest'){const s2=S.days.find(x=>(x.ex||[]).length);d0.t=s2.t;d0.s=s2.s;d0.ex=s2.ex.map(e=>({...e}));}
  [2,4,6,9,11,13,16,18,20,23,26,30,40,55].forEach(n=>{
    const ds=back(n),d=dayOf(ds),r=recRW(ds);
    if(d.t!=='rest'){r.wo=1;r.t0=Date.now()-4.2e6;r.t1=Date.now()-3.6e6;
      (d.ex||[]).forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,rs:[8,8,8],vol:24*(+e.w||0),xp:12};});}
    r.bw=String(70+n*0.06);
    r.ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'},{p:'Творог 5%',g:'180'}]},
          {n:'Обед',note:'',items:[{p:'Рис отварной',g:'200'},{p:'Куриная грудка отварная',g:'220'}]}];
  });
  S.pr={'Жим гантелей на наклонной':14};
  save();recomputeStats(1);render();
};
const SCAN=()=>{
  const out=[];
  const seen=new Set();
  document.querySelectorAll('.scr:not([hidden]) *, #statusbar:not([hidden]) *, #dayctx:not([hidden]) *, .tabbar *').forEach(el=>{
    if(!el.getClientRects().length) return;
    const cs=getComputedStyle(el);
    const r=el.getBoundingClientRect();
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
    // 1. текст обрезан своей же рамкой
    const clipped=(cs.overflow!=='visible'||cs.overflowX!=='visible');
    if(clipped && cs.textOverflow!=='ellipsis' && el.scrollWidth>el.clientWidth+1 && el.children.length===0)
      out.push('обрезан текст: '+label+' ('+el.scrollWidth+'>'+el.clientWidth+')');
    // 2. вылезает за свою панель
    const pan=el.closest('.win,.sysbar,.pln,.cal');
    if(pan && pan!==el){
      const pr=pan.getBoundingClientRect();
      if(r.right>pr.right+1.5||r.left<pr.left-1.5)
        out.push('вылезает за панель: '+label+' ['+Math.round(r.left)+'..'+Math.round(r.right)+'] панель ['+Math.round(pr.left)+'..'+Math.round(pr.right)+']');
    }
    // 3. за пределы экрана
    if(r.right>window.innerWidth+1||r.left<-1)
      out.push('за краем экрана: '+label+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']');
  });
  return [...new Set(out)];
};
(async()=>{
  const b=await chromium.launch({executablePath:CH,args:['--no-sandbox']});
  for(const w of [320,360,390,430,768]){
    const p=await(await b.newContext({viewport:{width:w,height:900}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1200);
    await p.evaluate(SEED);
    await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');});
    for(const skin of ['sl','ber']){
      await p.evaluate(s=>applyTheme(s),skin);
      for(const t of ['wo','prog','food','photo']){
        await p.evaluate(tt=>{tab=tt;exOpen=null;sel=today();render();window.scrollTo(0,0);},t);
        await p.waitForTimeout(160);
        const bad=await p.evaluate(SCAN);
        if(bad.length){fails+=bad.length;console.log(`  ✗ ${w}px ${skin} ${t}:`);bad.slice(0,6).forEach(x=>console.log('      '+x));}
      }
      // «Прогресс» — это четыре разных экрана под одной вкладкой
      for(const sec of ['log','load','goal','prog']){
        await p.evaluate(x=>{tab='prog';pSec=x;exOpen=null;render();window.scrollTo(0,0);},sec);
        await p.waitForTimeout(180);
        const bad=await p.evaluate(SCAN);
        if(bad.length){fails+=bad.length;console.log(`  ✗ ${w}px ${skin} прогресс/${sec}:`);bad.slice(0,6).forEach(x=>console.log('      '+x));}
      }
      // раскрытое упражнение — отдельное состояние
      await p.evaluate(()=>{tab='wo';sel=today();exOpen=0;render();});
      await p.waitForTimeout(160);
      const bad2=await p.evaluate(SCAN);
      if(bad2.length){fails+=bad2.length;console.log(`  ✗ ${w}px ${skin} раскрытое упражнение:`);bad2.slice(0,6).forEach(x=>console.log('      '+x));}
    }
    console.log(`  ${w}px — проверено`);
    if(errs.length){fails++;console.log('  ✗ ошибки JS: '+errs.join(' | '));}
    await p.close();
  }
  await b.close();
  console.log(fails?('находок: '+fails):'вёрстка чиста на всех ширинах, темах и вкладках');
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
