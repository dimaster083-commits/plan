/* Фото: вес за день снимка, история, сравнение, удаление. Снимки
   кладём настоящими файлами через выбор файла, как человек. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs=require('fs'), os=require('os'), path=require('path');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'foto-'));
// две разные картинки
const mk=(name,color)=>{
  const { PNG } = require('pngjs');
  const png=new PNG({width:120,height:160});
  for(let i=0;i<png.data.length;i+=4){
    png.data[i]=color[0]; png.data[i+1]=color[1]; png.data[i+2]=color[2]; png.data[i+3]=255;
  }
  const f=path.join(tmp,name); fs.writeFileSync(f, PNG.sync.write(png)); return f;
};
(async()=>{
  const A=mk('a.png',[200,40,40]), B=mk('b.png',[40,200,40]);
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1400);
  const days=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    S.setup=1;document.getElementById('setup').classList.remove('on');
    S.bw='75'; save();
    const d=new Date(); d.setDate(d.getDate()-20);
    return { old:iso(d), now:today() };
  });

  const upload=async (ds,file)=>{
    await p.evaluate(x=>{ sel=x; tab='photo'; render(); }, ds);
    await p.waitForTimeout(250);
    const [ch]=await Promise.all([p.waitForEvent('filechooser'),
      p.evaluate(()=>document.getElementById('phAdd').click())]);
    await ch.setFiles(file);
    await p.waitForTimeout(900);
  };

  await upload(days.old, A);
  await upload(days.now, B);
  const st=await p.evaluate(()=>({ n:PH.length, keys:PH.slice() }));
  chk(st.n===2, '1. два снимка на разных датах', st.keys.join(', '));

  // 2. вес за день снимка пишется в журнал этой даты
  const w=await p.evaluate(x=>{
    sel=x; tab='photo'; render();
    const inp=document.getElementById('phW');
    inp.value='74,2'; inp.dispatchEvent(new Event('input',{bubbles:true})); inp.blur();
    return { saved:String((S.rec[x]||{}).bw||''), other:String((S.rec[today()]||{}).bw||'') };
  }, days.old);
  chk(w.saved.replace('.',',')==='74,2', '2. вес за день снимка попал в этот день', JSON.stringify(w));

  // 3. история снимков показывает оба и с весом
  const hist=await p.evaluate(async ()=>{
    openPhotoHistory();
    await new Promise(r=>setTimeout(r,500));
    const btns=[...document.querySelectorAll('#sh [data-open]')];
    const t=document.getElementById('sh').innerText;
    return { n:btns.length, hasKg:/кг/.test(t), junk:/NaN|undefined/.test(t) };
  });
  chk(hist.n===2 && hist.hasKg && !hist.junk, '3. история снимков показывает оба и вес',
      JSON.stringify(hist));

  // 4. нажатие в истории открывает этот день
  const jump=await p.evaluate(async x=>{
    const btn=document.querySelector('#sh [data-open="'+x+'"]');
    if(!btn) return {err:'кнопки нет'};
    btn.click();
    await new Promise(r=>setTimeout(r,300));
    return { sel, tab, sheet:document.getElementById('sh').classList.contains('on') };
  }, days.old);
  chk(!jump.err && jump.sel===days.old, '4. из истории открывается нужный день',
      jump.err||JSON.stringify(jump));

  // 5. сравнение открывается с двумя снимками
  const cmp=await p.evaluate(async ()=>{
    tab='photo'; render();
    await new Promise(r=>setTimeout(r,200));
    document.getElementById('phCmp').click();
    await new Promise(r=>setTimeout(r,700));
    const on=document.getElementById('ov').classList.contains('on');
    const imgs=document.querySelectorAll('#ov .pic img').length;
    const opts=document.querySelectorAll('#selA option').length;
    return { on, imgs, opts };
  });
  chk(cmp.on && cmp.imgs===2 && cmp.opts===2, '5. сравнение открывается с двумя снимками',
      JSON.stringify(cmp));

  // 6. снимки в сравнении разные
  const diff=await p.evaluate(()=>{
    const a=document.querySelectorAll('#ov .pic img');
    return a.length===2 ? a[0].src!==a[1].src : false;
  });
  chk(diff, '6. в сравнении два разных снимка');

  // 7. удаление снимка убирает его отовсюду
  const del=await p.evaluate(async x=>{
    document.getElementById('ovX').click();
    await new Promise(r=>setTimeout(r,200));
    sel=x; tab='photo'; render();
    await new Promise(r=>setTimeout(r,300));
    const btn=[...document.querySelectorAll('#scr-photo button')].find(e=>/удал/i.test(e.textContent));
    if(!btn) return {err:'кнопки удаления нет'};
    btn.click();
    await new Promise(r=>setTimeout(r,200));
    if(document.getElementById('ask').classList.contains('on')){ try{askClose(true)}catch(e){} }
    await new Promise(r=>setTimeout(r,700));
    return { n:PH.length, has:PH.indexOf(x)>=0 };
  }, days.old);
  chk(!del.err && del.n===1 && !del.has, '7. снимок удаляется', del.err||JSON.stringify(del));

  // 8. журнал и вес после удаления снимка на месте
  const after=await p.evaluate(x=>({ bw:String((S.rec[x]||{}).bw||'') }), days.old);
  chk(after.bw.replace('.',',')==='74,2', '8. вес за тот день остался в журнале', after.bw);

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
