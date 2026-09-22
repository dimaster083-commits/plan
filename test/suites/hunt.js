/* Охота на мёртвые кнопки: у каждой должен быть обработчик, каждый
   обработчик должен находить свою кнопку. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const out=[]; const bad=(t,d)=>out.push('  ✗ '+t+(d?'   → '+d:'')); const ok=t=>out.push('  ✓ '+t);

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1500);
  await p.evaluate(()=>{S.setup=1;save();document.getElementById('setup').classList.remove('on');});

  // 1. повторяющиеся id в разметке
  const dup = await p.evaluate(()=>{
    const seen={}, d=[];
    document.querySelectorAll('[id]').forEach(e=>{seen[e.id]=(seen[e.id]||0)+1;});
    Object.keys(seen).forEach(k=>{if(seen[k]>1) d.push(k+'×'+seen[k]);});
    return d;
  });
  dup.length ? bad('повторяющиеся id', dup.join(', ')) : ok('повторяющихся id нет');

  // 2. $('x') на несуществующие элементы
  const src = require('fs').readFileSync(require('url').fileURLToPath(APP),'utf8');
  const ids = [...new Set([...src.matchAll(/\$\('([A-Za-z0-9_-]+)'\)/g)].map(m=>m[1]))];
  // часть узлов рождается позже — в шторках и наложениях. Такие id
  // всё равно встречаются в исходнике как id="...", и это не ошибка.
  const born = new Set([...src.matchAll(/id=["']([A-Za-z0-9_-]+)["']/g)].map(m=>m[1]));
  const born2 = new Set([...src.matchAll(/id="([A-Za-z0-9_-]+)"/g)].map(m=>m[1]));
  const present = await p.evaluate(list => list.filter(i => !!document.getElementById(i)), ids);
  const miss = ids.filter(i => present.indexOf(i)<0 && !born.has(i) && !born2.has(i));
  miss.length ? bad('код обращается к несуществующим элементам', miss.join(', ')) : ok('все $() находят свои элементы');

  // 3. кнопки, которые ничего не делают
  const dead = await p.evaluate(async ()=>{
    const res=[], tested=new Set();
    const tick=()=>new Promise(r=>setTimeout(r,160));  // часть обработчиков асинхронна
    // кнопка, уже находящаяся в своём состоянии, ничего и не должна делать
    const isActive=el=>/(^| )(on|now|cur|sel)( |$)/.test(el.className||'')||
      el.getAttribute('aria-selected')==='true';
    const hash=s2=>{let h=0;for(let i=0;i<s2.length;i++){h=(h*31+s2.charCodeAt(i))|0;}return h;};
    const snap=()=>[JSON.stringify(S), tab, sel, mo, exOpen, pSec, calView, calYear, edit, editPast,
      document.getElementById('sh').className, document.getElementById('ask').className,
      document.getElementById('fp').className, document.getElementById('ov').className,
      document.getElementById('tmr').className, hash(document.body.innerHTML)].join('|');
    const key=btn=>(btn.id||'')+'|'+(typeof btn.className==='string'?btn.className:'')+'|'+
      (btn.dataset.d??btn.dataset.j??btn.dataset.go??btn.dataset.open??btn.dataset.cd??btn.dataset.mo??
       btn.dataset.sec??btn.dataset.tab??btn.dataset.jump??btn.dataset.tog??btn.dataset.day??'')+'|'+
      btn.textContent.trim().slice(0,20);
    // Native file pickers do not alter the DOM; foto.js exercises the upload flow.
    const SKIP=/^(wipe|exp|imp|csv|impFile|phFile|phAdd)$/;
    const reset=t=>{try{sheetClose();}catch(e){} try{askClose(false);}catch(e){}
      ['fp','ov','setup'].forEach(id=>{const e2=document.getElementById(id); if(e2) e2.classList.remove('on');});
      document.body.style.overflow=''; tab=t; sel=today(); exOpen=null; render();};

    for (const t of ['wo','prog','food','photo']) {
      sel=today(); reset(t);
      for (let pass=0; pass<4; pass++) {
        // список берём заново на каждом шаге: перерисовка заменяет элементы
        const names=[...document.querySelectorAll('button')]
          .filter(x=>x.offsetParent&&!x.disabled&&!SKIP.test(x.id))
          .map(key).filter(k=>!tested.has(t+k));
        if (!names.length) break;
        for (const k of names) {
          if (tested.has(t+k)) continue;
          tested.add(t+k);
          const btn=[...document.querySelectorAll('button')].find(x=>key(x)===k&&x.offsetParent&&!x.disabled);
          if (!btn) continue;
          const active=isActive(btn);
          const before=snap();
          try{ btn.click(); }catch(e){ res.push('ПАДАЕТ · '+k.split('|').pop()+' — '+e.message); reset(t); continue; }
          await tick();
          const after=snap();
          if (before===after && !active) res.push('«'+k.split('|').pop()+'» на «'+t+'» ('+k+', день '+sel+')');
          reset(t);
        }
      }
    }
    return res;
  });
  dead.length ? bad('кнопки без действия ('+dead.length+')', dead.join('\n       ')) : ok('все кнопки что-то делают');

  // 4. крайние случаи, на которых обычно падает
  const edge = await p.evaluate(()=>{
    const res=[];
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    const t=(n,f)=>{try{f();}catch(e){res.push(n+': '+e.message);}};
    t('пустой журнал', ()=>{const keep=S.rec;S.rec={};recomputeStats();['wo','prog','food','photo'].forEach(x=>{tab=x;render();});S.rec=keep;recomputeStats();});
    t('день отдыха', ()=>{const d=dayOf(today());const w=d.t;d.t='rest';d.ex=[];tab='wo';exOpen=null;render();d.t=w;});
    t('день без упражнений', ()=>{const d=dayOf(today());const e=d.ex;d.ex=[];tab='wo';exOpen=0;render();d.ex=e;exOpen=null;});
    t('дата в будущем', ()=>{const d=new Date();d.setDate(d.getDate()+40);sel=iso(d);tab='wo';render();sel=today();});
    t('дата пятилетней давности', ()=>{const d=new Date();d.setFullYear(d.getFullYear()-5);sel=iso(d);tab='wo';render();sel=today();});
    t('год без записей в журнале', ()=>{tab='prog';pSec='log';calView='year';calYear=1990;cal();calYear=new Date().getFullYear();cal();});
    t('удаление упражнения при раскрытом', ()=>{const d=dayOf(today());const e=JSON.parse(JSON.stringify(d.ex));
      exOpen=d.ex.length-1;render();d.ex.splice(d.ex.length-1,1);render();d.ex=e;exOpen=null;render();});
    t('вес с запятой', ()=>{const r=recRW(today());r.log[0]={w:'12,5',s:'3',r:'8'};save();tab='wo';exOpen=0;render();
      if(num('12,5')!==12.5) res.push('запятая как разделитель не читается');exOpen=null;delete r.log[0];save();});
    t('отрицательный и пустой ввод', ()=>{const r=recRW(today());r.log[0]={w:'-5',s:'',r:'abc'};save();tab='wo';exOpen=0;render();
      exOpen=null;delete r.log[0];save();render();});
    t('журнал за прошлый год', ()=>{tab='prog';pSec='log';calView='month';mo=(new Date().getFullYear()-1)+'-02';cal();calView='year';cal();});
    t('копия состояния туда-обратно', ()=>{const a=JSON.stringify(S);S=JSON.parse(a);migrate();recomputeStats();
      if(JSON.stringify(S.rec)!==JSON.stringify(JSON.parse(a).rec)) res.push('журнал изменился при повторной миграции');});
    t('все дни — отдых', ()=>{const w=S.days.map(d=>d.t);S.days.forEach(d=>{d.t='rest';});tab='prog';render();tab='wo';render();
      S.days.forEach((d,i)=>{d.t=w[i];});render();});
    return res;
  });
  edge.length ? bad('крайние случаи ('+edge.length+')', edge.join(' | ')) : ok('крайние случаи проходят');

  // 5. кнопки без доступного названия
  const nolabel = await p.evaluate(()=>{
    const res=[];
    ['wo','prog','food','photo'].forEach(t=>{tab=t;exOpen=null;render();
      document.querySelectorAll('button,input,select').forEach(e=>{
        if(!e.offsetParent) return;
        const lab=(e.textContent||'').trim()||e.getAttribute('aria-label')||e.getAttribute('placeholder')||e.value;
        if(!lab) res.push(t+': '+(e.id||e.className||e.tagName));
      });});
    return [...new Set(res)];
  });
  nolabel.length ? bad('элементы без подписи ('+nolabel.length+')', nolabel.slice(0,5).join(', ')) : ok('у всех элементов есть подпись');

  console.log(out.join('\n'));
  console.log('ошибки JS:', errs.length?[...new Set(errs)].slice(0,4).join(' | '):'нет');
  await b.close();
})().catch(e=>{console.log(out.join('\n'));console.log('FATAL',e.message);process.exit(1);});
