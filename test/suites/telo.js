/* Карта мышц на анатомическом теле (фишка из Lyfta: «какие мышцы
   тренировались» в итогах и «что тренирует упражнение»).
   До этой правки карта была палочными человечками из овалов и пряталась
   в итогах недели; на «Прогрессе» её не было, касанием ничего не открывалось,
   на странице упражнения целевая мышца не показывалась. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // журнал: вчера жим на полную норму груди, присед 4 подхода, тяга 2
  await p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.pr={};
    const y=new Date(); y.setDate(y.getDate()-1); const ds=iso(y);
    const nch=volTargetM('Грудь');
    S.rec[ds]={wo:1,log:{
      0:{done:1,n:'Жим лёжа',g:'Грудь',w:'80',s:String(nch),r:'8',rs:Array(nch).fill(8),sd:1},
      1:{done:1,n:'Присед со штангой',g:'Ноги',w:'100',s:'4',r:'8',rs:[8,8,8,8],sd:1},
      2:{done:1,n:'Тяга штанги в наклоне',g:'Спина',w:'60',s:'2',r:'8',rs:[8,8],sd:1}}};
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    tab='prog'; render();
    const bt=[...document.querySelectorAll('#pseg button')].find(x=>/Нагрузка/.test(x.textContent)); if(bt) bt.click();
  });
  await p.waitForTimeout(400);

  // 1. карта на «Прогрессе», все девять мышц на рисунке
  const есть=await p.evaluate(()=>{
    const box=document.getElementById('bmapBox');
    if(!box) return {карта:false};
    const ms=[...new Set([...box.querySelectorAll('[data-mus]')].map(x=>x.dataset.mus))];
    return {карта:true, мышц:ms.length, все:MUSCLES.every(m=>ms.indexOf(m)>=0)};
  });
  chk(есть.карта&&есть.все, '1. на «Прогрессе» карта мышц, на рисунке все девять', JSON.stringify(есть));

  // 2. анатомия подробная, а не человечки из овалов
  const подробно=await p.evaluate(()=>{
    const box=document.getElementById('bmapBox');
    return box?{контуров:box.querySelectorAll('[data-mus]').length,
      овалов:box.querySelectorAll('ellipse,rect,polygon').length}:{контуров:0};
  });
  chk(подробно.контуров>=70&&подробно.овалов===0,
    '2. подробная анатомия: десятки контуров мышц, ни одного овала', JSON.stringify(подробно));

  // 3. заливка — независимый пересчёт по журналу против нормы программы
  const уровни=await p.evaluate(()=>{
    const cnt={}; MUSCLES.forEach(m=>cnt[m]=0);
    const from=new Date(); from.setDate(from.getDate()-6); const f7=iso(from);
    Object.keys(S.rec).forEach(ds=>{ if(ds<f7||ds>today()) return;
      Object.values(S.rec[ds].log||{}).forEach(l=>{ if(!l||!l.done) return;
        const m=muscleOf(l.n,l.g); if(m) cnt[m]+= (l.rs?l.rs.length:+l.s); }); });
    const ждём=m=>{ const t=volTargetM(m), s=cnt[m]; if(!s) return 'mm0'; if(!t) return 'mm3';
      return s>=t?'mm3':s>=t/2?'mm2':'mm1'; };
    const на=m=>[...new Set([...document.querySelectorAll('#bmapBox [data-mus="'+m+'"]')].map(x=>x.getAttribute('class')))];
    const бад=MUSCLES.filter(m=>{ const c=на(m); return c.length!==1||c[0]!==ждём(m); });
    return {бад, грудь:на('Грудь')[0], спина:на('Спина')[0], икры:на('Икры')[0]};
  });
  chk(уровни.бад.length===0&&уровни.грудь==='mm3'&&уровни.икры==='mm0',
    '3. заливка каждой мышцы совпадает с пересчётом по журналу', JSON.stringify(уровни));

  // 4. касание мышцы открывает подробности с её числами
  const шторка=await p.evaluate(()=>{
    document.querySelector('#bmapBox [data-mus="Грудь"]').dispatchEvent(new MouseEvent('click',{bubbles:true}));
    const t=document.getElementById('shB').textContent.replace(/\s+/g,' ');
    return {открыта:document.getElementById('sh').classList.contains('on'),
      заголовок:document.getElementById('shT').textContent, текст:t.slice(0,160),
      норма:volTargetM('Грудь')};
  });
  chk(шторка.открыта&&/ГРУДЬ/.test(шторка.заголовок)&&new RegExp(шторка.норма+'\\s*из\\s*'+шторка.норма).test(шторка.текст)&&/Жим лёжа/.test(шторка.текст),
    '4. касание груди: «N из N подходов», упражнения за неделю', шторка.текст);

  // 5. в тексте шторки нет мусора из подписей контуров
  const чисто=await p.evaluate(()=>({
    title:document.querySelectorAll('#shB .bmap title, #bmapBox title').length,
    повторов:(document.getElementById('shB').textContent.match(/Трицепс/g)||[]).length
  }));
  chk(чисто.title===0&&чисто.повторов===0, '5. у контуров нет подписей: читалка не зачитает «Грудь, Грудь…»', JSON.stringify(чисто));

  // 6. список мышц под палец и всё влезает в 320
  const мера=await p.evaluate(()=>{
    document.getElementById('sh').classList.remove('on');
    const rows=[...document.querySelectorAll('#mlist .mrow')];
    const w=document.getElementById('mapw');
    return {строк:rows.length, мин:Math.min(...rows.map(r=>Math.round(r.getBoundingClientRect().height))),
      вылез:w.scrollWidth-w.clientWidth, экран:document.documentElement.scrollWidth};
  });
  chk(мера.строк===9&&мера.мин>=44&&мера.вылез<=1&&мера.экран<=320,
    '6. девять строк мышц не ниже 44 px, всё влезает в 320', JSON.stringify(мера));

  // 7. строка списка открывает ту же мышцу
  const строка=await p.evaluate(()=>{
    document.querySelector('#mlist .mrow[data-mus="Спина"]').click();
    return document.getElementById('shT').textContent;
  });
  chk(/СПИНА/.test(строка), '7. строка «Спина» открывает спину', строка);

  // 8. страница упражнения показывает, что оно тренирует
  const фокус=await p.evaluate(()=>{
    openHow('Тяга штанги в наклоне');
    const f=document.querySelector('#shB .exfocus');
    if(!f) return {есть:false};
    const lit=[...new Set([...f.querySelectorAll('[data-mus]')].filter(x=>x.getAttribute('class')==='mm3').map(x=>x.dataset.mus))];
    const off=[...f.querySelectorAll('[data-mus]')].filter(x=>x.dataset.mus!=='Спина'&&x.getAttribute('class')!=='mm0').length;
    return {есть:true, горит:lit, чужих:off, подпись:f.textContent.trim()};
  });
  chk(фокус.есть&&фокус.горит.length===1&&фокус.горит[0]==='Спина'&&фокус.чужих===0&&/Спина/.test(фокус.подпись),
    '8. «Тяга штанги в наклоне» — горит только спина', JSON.stringify(фокус));

  // 9. итоги недели рисуют ту же анатомию
  const неделя=await p.evaluate(()=>{
    document.getElementById('sh').classList.remove('on');
    openWeek();
    const m=document.querySelector('#shB .bmap');
    return {карта:!!m, контуров:m?m.querySelectorAll('[data-mus]').length:0};
  });
  chk(неделя.карта&&неделя.контуров>=70, '9. итоги недели — та же подробная карта', JSON.stringify(неделя));

  chk(errs.length===0,'10. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})();
