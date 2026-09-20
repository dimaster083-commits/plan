/* Контраст по настоящим пикселям, придирчиво: каждый видимый текст
   на своей фактической подложке, обе темы. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const { PNG } = require('pngjs');

const SEED = () => {
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  const d0=dayOf(iso(new Date()));
  if(d0.t==='rest'){const s2=S.days.find(x=>(x.ex||[]).length);d0.t=s2.t;d0.s=s2.s;d0.ex=s2.ex.map(e=>({...e}));}
  for(let k=1;k<=40;k++){const ds=back(k),d=dayOf(ds),r=recRW(ds);
    if((d.ex||[]).length&&Math.random()<0.8){r.wo=1;r.t0=Date.now()-4e6;r.t1=Date.now()-3.6e6;
      d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,rs:[8,8,8],vol:Math.round(80*(+e.w||1)),xp:12};});}
    if(k%7===0) r.bw=String(70+k*0.04);
    r.ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'}]}];}
  S.pr={'Жим лёжа':60};save();recomputeStats();render();
};

const lum = ([r,g,b]) => { const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};
  return .2126*f(r)+.7152*f(g)+.0722*f(b); };
const ratio = (a,b) => { const l1=lum(a), l2=lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };

async function audit(skin, secs) {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844}, deviceScaleFactor:1 })).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1900);
  await p.evaluate(SEED);
  await p.evaluate(s=>{applyTheme(s);S.setup=1;document.getElementById('setup').classList.remove('on');},skin);
  await p.waitForTimeout(500);

  const found = [];
  for (const [tab, sec] of secs) {
    await p.evaluate(([t,s])=>{tab=t; if(s){pSec=s;} sel=today(); editPast=false; exOpen=null; render(); window.scrollTo(0,0);}, [tab,sec]);
    await p.waitForTimeout(450);
    // фон снимаем отдельным кадром: весь текст делаем прозрачным, остальное
    // остаётся на месте. Тогда под каждой надписью виден настоящий фон,
    // а не догадка о нём.
    await p.addStyleTag({ content: '*,*::before,*::after{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important}text,tspan{fill:transparent!important}' });
    await p.waitForTimeout(160);
    const buf = await p.screenshot();
    await p.evaluate(() => { const st=[...document.querySelectorAll('style')].pop(); if(st) st.remove(); });
    await p.waitForTimeout(120);
    const png = PNG.sync.read(buf);
    const px = (x,y) => { x=Math.max(0,Math.min(png.width-1,Math.round(x))); y=Math.max(0,Math.min(png.height-1,Math.round(y)));
      const i=(png.width*y+x)<<2; return [png.data[i],png.data[i+1],png.data[i+2]]; };

    const items = await p.evaluate(() => {
      const out=[];
      document.querySelectorAll('body *').forEach(el=>{
        const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim());
        if(!txt) return;
        const r=el.getBoundingClientRect();
        if(r.width<4||r.height<4||el.offsetParent===null) return;
        if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth) return;
        const st=getComputedStyle(el);
        if(st.visibility==='hidden'||+st.opacity===0) return;
        const c=String(st.color).match(/[\d.]+/g).map(Number);
        if(c[3]!==undefined&&c[3]<.3) return;
        const size=parseFloat(st.fontSize), bold=+st.fontWeight>=600;
        out.push({ r:{x:r.x,y:r.y,w:r.width,h:r.height}, c:c.slice(0,3),
          need:(size>=24||(size>=18.66&&bold))?3:4.5,
          sel:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:''),
          txt:el.textContent.trim().slice(0,30) });
      });
      return out;
    });

    for (const it of items) {
      // сетка точек внутри самой надписи: под ней теперь чистый фон
      const samples = [];
      for (let fy = 0.15; fy <= 0.85; fy += 0.175)
        for (let fx = 0.05; fx <= 0.95; fx += 0.15)
          samples.push(px(it.r.x + it.r.w*fx, it.r.y + it.r.h*fy));
      let worst = null, worstR = 99;
      for (const s2 of samples) { const rr = ratio(it.c, s2); if (rr < worstR) { worstR = rr; worst = s2; } }
      if (worstR < it.need)
        found.push({ tab, sec, ...it, ratio:+worstR.toFixed(2), bg:'rgb('+worst.join(',')+')' });
    }
  }
  await b.close();
  return { found, errs };
}

(async () => {
  const secs = [['wo',null],['prog','log'],['prog','load'],['prog','goal'],['prog','prog'],['food',null],['photo',null]];
  for (const skin of ['sl','ber']) {
    const { found, errs } = await audit(skin, secs);
    console.log(`\n===== ${skin.toUpperCase()} =====`);
    if (errs.length) console.log('ОШИБКИ JS:', [...new Set(errs)].join(' | '));
    const seen=new Set();
    const u = found.filter(f=>{const k=f.sel+f.ratio;if(seen.has(k))return false;seen.add(k);return true;});
    if(!u.length){console.log('контраст везде в норме');continue;}
    u.sort((a,b)=>a.ratio-b.ratio).slice(0,18).forEach(f=>
      console.log(`  ${f.ratio} (нужно ${f.need})  [${f.tab}${f.sec?'/'+f.sec:''}] ${f.sel}\n      "${f.txt}"  rgb(${f.c}) на ${f.bg}`));
    console.log('  всего:', u.length);
  }
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
