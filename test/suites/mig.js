/* Переезд пресса на старом журнале: записи, сделанные до правки, помечены
   группой «Ноги» — миграция обязана их переклеить, иначе прошлые недели
   так и будут врать. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:390,height:844}});
  const p=await ctx.newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // кладём в хранилище журнал «старого» вида: пресс помечен ногами, mig6 нет
  const seeded=await p.evaluate(()=>{
    S.setup=1; S.sound=0;
    delete S.mig14;
    S.days.forEach(d=>(d.ex||[]).forEach(e=>{ if(EXDB[e.n]&&EXDB[e.n][1]==='Пресс') e.g='Ноги'; }));
    const день=S.days.find(d=>(d.ex||[]).some(e=>EXDB[e.n]&&EXDB[e.n][1]==='Пресс'));
    const j=день.ex.findIndex(e=>EXDB[e.n]&&EXDB[e.n][1]==='Пресс');
    let ds=today();
    for(let k=0;k<7;k++){ const d=new Date(); d.setDate(d.getDate()-k);
      if(S.days[wdOf(iso(d))]===день){ ds=iso(d); break; } }
    S.rec={}; const r=recRW(ds); r.wo=1; r.log={};
    r.log[j]={done:1,n:день.ex[j].n,g:'Ноги',s:'3',r:'15',w:0,rs:[15,15,15],vol:0,xp:12};
    flush();
    return {дата:ds, метка:r.log[j].g, mig14:!!S.mig14};
  });
  chk(seeded.метка==='Ноги'&&!seeded.mig14,'1. в хранилище лежит журнал старого вида',JSON.stringify(seeded));

  // перезагружаем — load() должен прогнать миграцию
  await p.reload(); await p.waitForTimeout(1400);
  const after=await p.evaluate(d=>{
    const lg=S.rec[d].log, j=Object.keys(lg)[0];
    const день=S.days[wdOf(d)];
    const e=(день.ex||[]).find(x=>EXDB[x.n]&&EXDB[x.n][1]==='Пресс');
    const a=vol7();
    return {журнал:lg[j].g, программа:e?e.g:null, пресс:a['Пресс'], ноги:a['Ноги'], mig14:!!S.mig14};
  },seeded.дата);
  chk(after.mig14,'2. миграция отметилась как пройденная',String(after.mig6));
  chk(after.программа==='Пресс','3. метка в программе переклеена',String(after.программа));
  chk(after.журнал==='Пресс','4. метка в записи журнала переклеена',String(after.журнал));
  chk(after.пресс===3&&after.ноги===0,'5. прошедшая неделя считается по-новому',JSON.stringify(after));

  // повторная загрузка ничего не ломает
  await p.reload(); await p.waitForTimeout(1400);
  const again=await p.evaluate(()=>({пресс:vol7()['Пресс'], ноги:vol7()['Ноги']}));
  chk(again.пресс===3&&again.ноги===0,'6. вторая загрузка не двоит и не сбрасывает',JSON.stringify(again));

  // 8-11. Дополнение программы: задняя дельта и пресс приезжают в уже
  // заведённый журнал, но только туда, где человек не поставил своё.
  const prog=await p.evaluate(()=>{
    delete S.mig15;
    S.days.forEach(d=>{
      d.ex=(d.ex||[]).filter(e=>['Махи в наклоне','Тяга каната к лицу','Подъём ног в висе'].indexOf(e.n)<0);
      if(d.t==='lo2') d.ex.forEach(x=>{ if(x.n==='Пресс'){ x.s=3; x.r='10'; } });
    });
    // на пятницу человек уже сам поставил заднюю дельту — трогать нельзя
    const пт=S.days.find(d=>d.t==='up2');
    пт.ex.push({n:'Махи в наклоне',s:4,r:'12-15',w:6,g:'Плечи'});
    flush();
    return {до:S.days.map(d=>(d.ex||[]).length)};
  });
  await p.reload(); await p.waitForTimeout(1400);
  const now=await p.evaluate(()=>{
    const f=t=>S.days.find(d=>d.t===t);
    const пресс=f('lo2').ex.find(x=>x.n==='Пресс');
    return {
      пн: f('up1').ex.some(x=>x.n==='Махи в наклоне'),
      ср: f('lo1').ex.some(x=>x.n==='Подъём ног в висе'),
      пт: f('up2').ex.filter(x=>x.n==='Тяга каната к лицу').length,
      своё: f('up2').ex.some(x=>x.n==='Махи в наклоне'),
      прессПодх: пресс?num(пресс.s):0,
      прессГр: пресс?пресс.g:null,
      mig15: !!S.mig15
    };
  });
  chk(now.пн,'8. задняя дельта дописана в силовой верх',String(now.пн));
  chk(now.ср,'9. пресс дописан в силовой низ',String(now.ср));
  chk(now.пт===0&&now.своё,'10. туда, где человек поставил своё, ничего не лезет',
      'тяга каната добавлена раз: '+now.пт+', своё на месте: '+now.своё);
  chk(now.прессПодх===4&&now.прессГр==='Пресс','11. пресс в объёмном дне доведён до 4 подходов',
      now.прессПодх+' подх., группа '+now.прессГр);

  chk(errs.length===0,'7. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
