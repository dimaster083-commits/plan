/* Еда, вес и цель — ошибки, найденные агентом-тестировщиком питания. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // 1. первый запуск: в состоянии нет чужих цифр
  const f=await p.evaluate(()=>({bw:num(S.bw), goal:num(S.goal), h:num(S.height), bw0:num(S.bw0)}));
  chk(!f.bw&&!f.goal&&!f.h&&!f.bw0,'1. первый запуск — ни веса, ни цели, ни роста не подставлено',JSON.stringify(f));

  await p.evaluate(()=>{ S.setup=1; S.sex='m'; S.height=180; S.age='30'; document.getElementById('setup').classList.remove('on'); setBw('80'); S.goal='90'; applyNutri(); save(); });

  // 2. цель стирается и набирается заново без подставленных 95
  await p.evaluate(()=>{ tab='prog'; pSec='goal'; render(); paintSections(); });
  await p.click('#goalIn',{clickCount:3}); await p.keyboard.press('Backspace'); await p.keyboard.type('85');
  const g2=await p.evaluate(()=>({field:document.getElementById('goalIn').value, goal:S.goal}));
  chk(g2.field==='85'&&String(g2.goal)==='85','2. поле цели стирается и набирается: 85, а не 9585',JSON.stringify(g2));

  // 3. стёртый вес не оставляет в журнале «8»
  await p.click('#bw',{clickCount:3}); await p.keyboard.type('85'); await p.keyboard.press('Backspace'); await p.keyboard.press('Backspace');
  const w3=await p.evaluate(()=>(S.rec[today()]||{}).bw);
  chk(!w3,'3. стёр вес — сегодняшнего «8» в журнале нет',String(w3));
  await p.evaluate(()=>setBw('80'));

  // 4-5. возраст из шторки ИМТ и смена типа дня пересчитывают норму
  const n4=await p.evaluate(()=>{ const t=dayOf(today()); const k0=num(t.kc); openBmi();
    const a=document.getElementById('bmiAge'); a.value='60'; a.dispatchEvent(new Event('input',{bubbles:true}));
    sheetClose(); const k1=num(dayOf(today()).kc); S.age='30'; applyNutri(); return {k0,k1}; });
  chk(n4.k1<n4.k0,'4. возраст в шторке ИМТ пересчитал норму калорий',n4.k0+' → '+n4.k1);

  // 6. доля жира у женщин — по формуле для женщин
  const fat=await p.evaluate(()=>{ S.sex='f'; S.bw='60'; S.height=165; S.age='30'; const a=bmiOf().fat; S.sex='m'; S.bw='80'; S.height=180; return a; });
  chk(Math.abs(fat-27.9)<0.3,'6. жир у женщины 60 кг/165 см/30 лет ≈ 27,9 %',fat.toFixed(1));

  // 7. фото за прошлый день не пишет туда сегодняшний вес
  const ph=await p.evaluate(async()=>{ const z=new Date(); z.setDate(z.getDate()-20); const d=iso(z); sel=d;
    const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    window.compress=async()=>png; const dt=new DataTransfer(); dt.items.add(new File([new Uint8Array([1])],'a.png',{type:'image/png'}));
    const inp=document.getElementById('phFile'); inp.files=dt.files; inp.dispatchEvent(new Event('change'));
    await new Promise(r=>setTimeout(r,500)); sel=today(); return (S.rec[d]||{}).bw||''; });
  chk(!ph,'7. снимок за прошлый день не записал туда сегодняшний вес',String(ph));

  // 8. вес на будущую дату не принимается
  const fu=await p.evaluate(()=>{ const z=new Date(); z.setDate(z.getDate()+1); const d=iso(z); sel=d; tab='photo'; render();
    const el=document.getElementById('phW'); el.value='86'; el.dispatchEvent(new Event('input',{bubbles:true}));
    sel=today(); return (S.rec[d]||{}).bw||''; });
  chk(!fu,'8. вес на завтра не записывается',String(fu));

  // 9. удержание: вес стоит ровно — и график, и «Разбор» говорят «держи»
  const keep=await p.evaluate(()=>{ S.rec={}; S.goal='80'; S.bw='80'; S.bw0='80';
    for(const k of [14,7,0]){ const z=new Date(); z.setDate(z.getDate()-k); recRW(iso(z)).bw='80'; }
    save(); tab='prog'; pSec='load'; render(); paintChart();
    const f=analyze().find(x=>x.title==='ТЕМП'); return {hint:document.getElementById('whint').textContent, raz:f?f.task:'—'}; });
  chk(/держи/i.test(keep.hint)&&/держи/i.test(keep.raz),'9. удержание, вес ровный — график и «Разбор» согласны: держи',JSON.stringify(keep));

  // 10. темп по двум взвешиваниям за сутки не оценивается
  const two=await p.evaluate(()=>{ S.rec={}; S.goal='90'; const z=new Date(); z.setDate(z.getDate()-1);
    recRW(iso(z)).bw='70'; recRW(today()).bw='71'; S.bw='71'; save(); return paceOf(wlog()); });
  chk(two===null,'10. 70 → 71 за сутки — темп не оценивается (нужно 3 взвешивания за 7+ дней)',JSON.stringify(two));

  // 11. белок в «Разборе» — по той же норме, что в «Еде»
  const pr=await p.evaluate(()=>{ S.rec={}; S.bw='71'; S.goal='95'; applyNutri(); const norm=num(dayOf(today()).pr);
    for(let k=0;k<7;k++){ const z=new Date(); z.setDate(z.getDate()-k); const r=recRW(iso(z));
      r.ml=[{n:'Обед',note:'',items:[{p:'Куриная грудка отварная',g:String(Math.round(norm*0.8/0.29))}]}]; }
    save(); invalidateFood(); const a=analyze(); const pk=a.find(x=>x.title==='БЕЛОК НА КГ');
    return {norm, lvl:pk?pk.lvl:'—', text:pk?pk.text.replace(/<[^>]+>/g,''):''}; });
  chk(pr.lvl==='warn','11. белок ниже нормы «Еды» — «Разбор» не пишет «держи этот уровень»',JSON.stringify(pr));

  // 12. свой продукт: правка регистра в названии не теряет записи
  const mf=await p.evaluate(()=>{ S.myFood=[{n:'Сырники мамины',k:220,p:15,f:9,c:20}]; invalidateFood();
    S.rec={}; recRW(today()).ml=[{n:'Завтрак',note:'',items:[{p:'Сырники мамины',g:'200'}]}]; save();
    tab='food'; sel=today(); render(); openPick && 0;
    const i=S.myFood.findIndex(x=>x.n==='Сырники мамины');
    // та же логика, что в кнопке «Обновить»
    document.body.insertAdjacentHTML('beforeend','<div id="tmpnf"><input id="nfN" value="Сырники Мамины"><input id="nfK" value="220"><input id="nfP" value="15"><input id="nfF" value="9"><input id="nfC" value="20"><button id="nfSave"></button><input id="fq"></div>');
    return i; });
  const mf2=await p.evaluate(()=>{ const bt=document.getElementById('nfSave'); const sh=document.getElementById('fpl'); sh.appendChild(document.getElementById('tmpnf')); bt.click(); const t9=document.getElementById('tmpnf'); if(t9) t9.remove();
    return {p:mealsOf(today())[0].items[0].p, k:Math.round(sumMeals(mealsOf(today())).k)}; });
  chk(mf2.p==='Сырники Мамины'&&mf2.k>0,'12. переименовал свой продукт — записи дня пошли следом',JSON.stringify(mf2));

  // 13. гигантская цель не подвешивает приложение, дробная пишется через запятую
  const big=await p.evaluate(()=>{ S.goal='99999999999'; const t0=performance.now(); milesOf(); const t=performance.now()-t0;
    S.goal='85,5'; S.bw='80'; tab='prog'; pSec='goal'; render(); paintSections();
    return {t:Math.round(t), txt:document.getElementById('miles').textContent+' '+document.getElementById('qleft').textContent}; });
  chk(big.t<50,'13. цель 99 999 999 999 считается мгновенно',big.t+' мс');
  chk(!/\d\.\d/.test(big.txt),'14. дробная цель пишется через запятую',big.txt);

  // 15. настройка: рост «1,80» — это 180 см; вес вне 30–300 не принимается
  const st=await p.evaluate(async()=>{ openSetup(); await new Promise(r=>setTimeout(r,200));
    document.getElementById('anBw').value='80'; document.getElementById('anH').value='1,80';
    document.getElementById('anH').dispatchEvent(new Event('input',{bubbles:true}));
    const h=S.height; document.getElementById('anBw').value='99999'; document.getElementById('setOk').click();
    await new Promise(r=>setTimeout(r,200)); return {h, open:document.getElementById('setup').classList.contains('on')}; });
  chk(st.h===180,'15. рост «1,80» записан как 180 см',String(st.h));
  chk(st.open,'16. вес 99 999 не принят — настройка не закрылась',String(st.open));
  chk(errs.length===0,'17. без ошибок страницы',errs.join(' | ')||'чисто');
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
