/* Контраст внутри всех шторок и наложений по настоящим пикселям. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const { PNG } = require('pngjs');
const lum=([r,g,b])=>{const f=v=>{v/=255;return v<=.03928?v/12.92:Math.pow((v+.055)/1.055,2.4);};return .2126*f(r)+.7152*f(g)+.0722*f(b);};
const ratio=(a,b)=>{const l1=lum(a),l2=lum(b);return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05);};

const SEED=()=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  const d0=dayOf(iso(new Date()));
  if(d0.t==='rest'){const s2=S.days.find(x=>(x.ex||[]).length);d0.t=s2.t;d0.s=s2.s;d0.ex=s2.ex.map(e=>({...e}));}
  for(let k=1;k<=45;k++){const ds=back(k),d=dayOf(ds),r=recRW(ds);
    if((d.ex||[]).length&&k%2){r.wo=1;r.t0=Date.now()-4e6;r.t1=Date.now()-3.6e6;
      d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:(Math.round((((+e.w||0)+Math.floor(k/7)*2.5))/2.5)*2.5),rs:[8,8,8],vol:80*(+e.w||1),xp:12};});}
    if(k%7===0) r.bw=String(70+k*0.04);
    r.ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'}]}];}
  S.pr={'Жим лёжа':60,'Присед со штангой':80};S.tpl=[{n:'Обычный день',ml:[{n:'Завтрак',note:'',items:[]}]}];
  save();recomputeStats();render();
};

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

(async()=>{
  const b=await chromium.launch(LAUNCH);
  for (const skin of ['sl']) {
    const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:1})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1800);
    await p.evaluate(SEED);
    await p.evaluate(s=>{void s;S.setup=1;document.getElementById('setup').classList.remove('on');},skin);
    const found=[];
    for (const [name, fn] of SHEETS) {
      await p.evaluate(`(${fn.toString()})()`).catch(e=>errs.push(name+': '+e.message));
      await p.waitForTimeout(450);
      const open = await p.evaluate(()=>['sh','fp','ov'].some(id=>{const e=document.getElementById(id);return e&&e.classList.contains('on');}));
      if (!open) { found.push({name, sel:'—', txt:'шторка не открылась', ratio:0, need:0, c:[], bg:''}); continue; }
      await p.addStyleTag({content:'*,*::before,*::after{color:transparent!important;text-shadow:none!important;-webkit-text-fill-color:transparent!important}text,tspan{fill:transparent!important}'});
      await p.waitForTimeout(140);
      const buf=await p.screenshot();
      await p.evaluate(()=>{const st=[...document.querySelectorAll('style')].pop(); if(st) st.remove();});
      await p.waitForTimeout(100);
      const png=PNG.sync.read(buf);
      const px=(x,y)=>{x=Math.max(0,Math.min(png.width-1,Math.round(x)));y=Math.max(0,Math.min(png.height-1,Math.round(y)));
        const i=(png.width*y+x)<<2;return [png.data[i],png.data[i+1],png.data[i+2]];};
      const items=await p.evaluate(()=>{
        const root=['sh','fp','ov'].map(id=>document.getElementById(id)).find(e=>e&&e.classList.contains('on'));
        const out=[];
        root.querySelectorAll('*').forEach(el=>{
          const txt=[...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim()); if(!txt) return;
          const r=el.getBoundingClientRect(); if(r.width<4||r.height<4||el.offsetParent===null) return;
          if(r.bottom<0||r.top>innerHeight||r.right<0||r.left>innerWidth) return;
          const st=getComputedStyle(el); if(st.visibility==='hidden'||+st.opacity===0) return;
          const c=String(st.color).match(/[\d.]+/g).map(Number); if(c[3]!==undefined&&c[3]<.3) return;
          const size=parseFloat(st.fontSize), bold=+st.fontWeight>=600;
          out.push({r:{x:r.x,y:r.y,w:r.width,h:r.height},c:c.slice(0,3),
            need:(size>=24||(size>=18.66&&bold))?3:4.5,
            sel:el.tagName.toLowerCase()+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:''),
            txt:el.textContent.trim().slice(0,28)});
        });
        return out;
      });
      for (const it of items) {
        const S2=[];
        for(let fy=.15;fy<=.85;fy+=.175) for(let fx=.05;fx<=.95;fx+=.15) S2.push(px(it.r.x+it.r.w*fx,it.r.y+it.r.h*fy));
        let w=null,wr=99; for(const s3 of S2){const rr=ratio(it.c,s3); if(rr<wr){wr=rr;w=s3;}}
        if (wr<it.need) found.push({name,...it,ratio:+wr.toFixed(2),bg:'rgb('+w.join(',')+')'});
      }
      await p.evaluate(()=>{try{sheetClose();}catch(e){} ['fp','ov'].forEach(id=>{const e=document.getElementById(id);if(e)e.classList.remove('on');}); document.body.style.overflow='';});
      await p.waitForTimeout(200);
    }
    console.log(`\n===== ШТОРКИ · ${skin.toUpperCase()} =====`);
    if (errs.length) console.log('ОШИБКИ:', [...new Set(errs)].slice(0,4).join(' | '));
    const seen=new Set();
    const u=found.filter(f=>{const k=f.name+f.sel+f.ratio;if(seen.has(k))return false;seen.add(k);return true;});
    if(!u.length){console.log('контраст во всех шторках в норме');continue;}
    u.sort((a,b2)=>a.ratio-b2.ratio).slice(0,14).forEach(f=>
      console.log(`  ${f.ratio} (нужно ${f.need})  [${f.name}] ${f.sel}\n      "${f.txt}"  rgb(${f.c}) на ${f.bg}`));
    console.log('  всего:', u.length);
    await p.close();
  }
  await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
