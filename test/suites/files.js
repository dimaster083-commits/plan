/* Выгрузка файлов: резервная копия и таблица CSV скачиваются, внутри
   лежит то, что в журнале. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs=require('fs'), path=require('path');
const PHOTO_FIXTURE = path.join(__dirname, '../../icon-192.png');
const out=[]; const ok=(n,c,d)=>out.push((c?'  ✓ ':'  ✗ ')+n+(c?'':'   → '+d));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  p.on('dialog',d=>d.accept().catch(()=>{}));
  await p.goto(APP); await p.waitForTimeout(1700);

  // наполняем журнал
  await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
    S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;
    for(let k=1;k<=10;k++){const ds=back(k),d=dayOf(ds),r=recRW(ds);
      if((d.ex||[]).length){r.wo=1;d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:3,r:'8',w:20,rs:[8,8,8],vol:480,xp:12};});}
      r.ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'}]}];}
    S.pr={'Жим лёжа':60}; save(); recomputeStats();
    document.getElementById('setup').classList.remove('on'); tab='photo'; render();
  });
  await p.waitForTimeout(400);

  // ---- 1. загрузка снимка ----
  await p.setInputFiles('#phFile', PHOTO_FIXTURE);
  await p.waitForTimeout(1400);
  let r1=await p.evaluate(async()=>({stored:(await phKeys()).length, shown:!!document.querySelector('#phT img'),
    delBtn:!document.getElementById('phDel').hidden, day:PH[0]}));
  ok('снимок загружается и показывается', r1.stored===1&&r1.shown&&r1.delBtn, JSON.stringify(r1));

  // ---- 2. второй снимок на другую дату ----
  await p.evaluate(()=>{const d=new Date();d.setDate(d.getDate()-5);
    const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());sel=z.toISOString().slice(0,10);render();});
  await p.waitForTimeout(300);
  await p.setInputFiles('#phFile', PHOTO_FIXTURE);
  await p.waitForTimeout(1400);
  let r2=await p.evaluate(async()=>({stored:(await phKeys()).length}));
  ok('второй снимок кладётся отдельной датой', r2.stored===2, JSON.stringify(r2));

  // ---- 3. сжатие ----
  const size=await p.evaluate(async()=>{const k=(await phKeys()).sort(); const v=await phGet(k[0]);
    return {len:v.length, jpeg:v.startsWith('data:image/jpeg')};});
  ok('снимок сжимается в JPEG', size.jpeg && size.len<400000, JSON.stringify(size));

  // ---- 4. история снимков ----
  await p.evaluate(()=>{tab='photo';render();});
  await p.waitForTimeout(300);
  await p.click('#phHist'); await p.waitForTimeout(900);
  const r4=await p.evaluate(()=>({open:document.getElementById('sh').classList.contains('on'),
    thumbs:document.querySelectorAll('#stripAll [data-open]').length}));
  ok('история снимков открывается и показывает все', r4.open&&r4.thumbs===2, JSON.stringify(r4));
  await p.evaluate(()=>sheetClose());

  // ---- 5. сравнение ----
  await p.click('#phCmp'); await p.waitForTimeout(1200);
  const r5=await p.evaluate(()=>({on:document.getElementById('ov').classList.contains('on'),
    a:!!document.querySelector('#picA img'), b:!!document.querySelector('#picB img'),
    opts:document.querySelectorAll('#selA option').length}));
  ok('сравнение открывается с двумя снимками', r5.on&&r5.a&&r5.b&&r5.opts===2, JSON.stringify(r5));
  await p.evaluate(()=>document.getElementById('ov').classList.remove('on'));

  // ---- 6. копия: выгрузка ----
  await p.evaluate(()=>{tab='prog';pSec='prog';render();});
  await p.waitForTimeout(400);
  const stateBefore=await p.evaluate(()=>JSON.stringify(S));
  const dl=await Promise.all([p.waitForEvent('download',{timeout:15000}), p.click('#exp')]).then(a=>a[0]).catch(()=>null);
  if(!dl){ ok('копия сохраняется файлом', false, 'выгрузка не началась'); }
  else{
    const f='/tmp/backup.json'; await dl.saveAs(f);
    const j=JSON.parse(fs.readFileSync(f,'utf8'));
    ok('копия сохраняется файлом', !!j.state&&!!j.state.days&&!!j.photos, 'в файле: '+Object.keys(j).join(','));
    ok('в копии лежат снимки', Object.keys(j.photos||{}).length===2, Object.keys(j.photos||{}).length+' шт');
    ok('в копии весь журнал', Object.keys(j.state.rec||{}).length>=10, Object.keys(j.state.rec||{}).length+' дней');

    // ---- 7. стираем всё и восстанавливаем ----
    // canSave=false обязателен: иначе уход со страницы запишет состояние обратно
    await p.evaluate(async()=>{canSave=false;clearTimeout(saveTimer);
      localStorage.removeItem('sys-gym-v3');
      for(const k of await phKeys()) await phDelete(k);});
    await p.reload(); await p.waitForTimeout(1800);
    await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');});
    const empty=await p.evaluate(()=>Object.keys(S.rec).length);
    ok('после стирания журнал пуст', empty===0, empty+' дней осталось');

    await p.evaluate(()=>{tab='prog';pSec='prog';render();});
    await p.waitForTimeout(300);
    await p.setInputFiles('#impFile', f);
    await p.waitForTimeout(900);
    // приложение спрашивает подтверждение — отвечаем «да», как человек
    const asked = await p.evaluate(()=>document.getElementById('ask').classList.contains('on'));
    ok('восстановление спрашивает подтверждение', asked, 'спросило без вопроса');
    await p.click('#askY');
    await p.waitForTimeout(2200);
    const after=await p.evaluate(async()=>({rec:Object.keys(S.rec).length, vol:JSON.stringify(S.vol),
      ph:(await phKeys()).length, bw:S.bw, pr:JSON.stringify(S.pr)}));
    const before=JSON.parse(stateBefore);
    ok('журнал восстановлен полностью', after.rec===Object.keys(before.rec).length,
       after.rec+' vs '+Object.keys(before.rec).length);
    ok('тоннаж восстановлен', after.vol===JSON.stringify(before.vol), after.vol+' vs '+JSON.stringify(before.vol));
    ok('снимки восстановлены', after.ph===2, after.ph+' шт');
    ok('рекорды и вес восстановлены', after.bw===before.bw && after.pr===JSON.stringify(before.pr),
       after.bw+'/'+after.pr);
  }

  // ---- 8. выгрузка в таблицу ----
  await p.evaluate(()=>{try{sheetClose();}catch(e){} try{askClose(false);}catch(e){} tab='prog';pSec='prog';render();});
  await p.waitForTimeout(400);
  const dl2=await Promise.all([p.waitForEvent('download',{timeout:15000}), p.click('#csv')]).then(a=>a[0]).catch(e=>null);
  if(!dl2) ok('журнал выгружается в таблицу', false, 'выгрузка не началась');
  else{
    const f2='/tmp/journal.csv'; await dl2.saveAs(f2);
    const t=fs.readFileSync(f2,'utf8');
    const lines=t.trim().split('\n');
    ok('журнал выгружается в таблицу', lines.length>5 && t.charCodeAt(0)===0xFEFF,
       lines.length+' строк, метка кодировки '+(t.charCodeAt(0)===0xFEFF?'есть':'нет'));
  }

  // ---- 9. удаление снимка ----
  await p.evaluate(()=>{try{sheetClose();}catch(e){} try{askClose(false);}catch(e){}
    tab='photo';sel=PH[PH.length-1];render();});
  await p.waitForTimeout(500);
  await p.click('#phDel'); await p.waitForTimeout(400);
  await p.click('#askY'); await p.waitForTimeout(1000);
  const r9=await p.evaluate(async()=>({left:(await phKeys()).length}));
  ok('снимок удаляется', r9.left===1, JSON.stringify(r9));

  console.log(out.join('\n'));
  console.log('ошибки JS:', errs.length?[...new Set(errs)].slice(0,3).join(' | '):'нет');
  await b.close();
})().catch(e=>{console.log(out.join('\n'));console.log('FATAL',e.message);process.exit(1);});
