/* Влезает ли всё в телефон: ширина документа, обрезанные блоки,
   горизонтальная прокрутка на узком экране. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const W = [320, 360, 375, 390, 414, 430, 768];
const SEED=()=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  const d0=dayOf(iso(new Date()));
  if(d0.t==='rest'){const s2=S.days.find(x=>(x.ex||[]).length);d0.t=s2.t;d0.s=s2.s;d0.ex=s2.ex.map(e=>({...e}));}
  for(let k=1;k<=20;k++){const ds=back(k),d=dayOf(ds),r=recRW(ds);
    if((d.ex||[]).length){r.wo=1;r.t0=Date.now()-4e6;r.t1=Date.now()-3.6e6;
      d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,rs:[8,8,8],vol:100,xp:12};});}
    r.bw=String(70+k*0.05); r.ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'}]}];}
  S.pr={'Жим лёжа':60,'Присед со штангой':80};
  save();recomputeStats();render();
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for (const w of W) {
    const p=await(await b.newContext({viewport:{width:w,height:800}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(SEED);
    await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');});
    const bad=[];
    for (const t of ['wo','prog','food','photo']) {
      await p.evaluate(tb=>{tab=tb;sel=today();editPast=false;exOpen=null;render();},t);
      await p.waitForTimeout(280);
      const r=await p.evaluate(w2=>{
        const out=[];
        if (document.documentElement.scrollWidth > w2 + 0.5) out.push('страница шире экрана: '+document.documentElement.scrollWidth);
        document.querySelectorAll('#scr-'+tab+' *, #statusbar *, #daysbar *, .tabbar *').forEach(el=>{
          const b2=el.getBoundingClientRect();
          if (b2.width<1||el.offsetParent===null) return;
          if (b2.right > w2+0.5 || b2.left < -0.5)
            out.push(el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:'')
              +' '+Math.round(b2.left)+'..'+Math.round(b2.right)+' «'+el.textContent.trim().slice(0,18)+'»');
        });
        return [...new Set(out)].slice(0,4);
      }, w);
      r.forEach(x=>bad.push('['+t+'] '+x));
    }
    // и раскрытое упражнение
    await p.evaluate(()=>{tab='wo';exOpen=0;render();});
    await p.waitForTimeout(280);
    const r2=await p.evaluate(w2=>{
      const out=[];
      document.querySelectorAll('#exl *').forEach(el=>{const b2=el.getBoundingClientRect();
        if(b2.width<1||el.offsetParent===null)return;
        if(b2.right>w2+0.5||b2.left<-0.5) out.push(el.tagName+(el.className&&typeof el.className==='string'?'.'+el.className.trim().split(/\s+/)[0]:'')+' '+Math.round(b2.left)+'..'+Math.round(b2.right));});
      return [...new Set(out)].slice(0,3);
    }, w);
    r2.forEach(x=>bad.push('[упражнение] '+x));
    console.log(`${w}px: ${bad.length?'\n   '+bad.join('\n   '):'чисто'}${errs.length?' | ОШИБКИ '+errs[0]:''}`);
    await p.close();
  }
  await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
