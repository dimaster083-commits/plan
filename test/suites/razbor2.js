/* Разбор: совет про разгрузку считал недели от начала плана, а не от
   последней разгрузки, и пороги пропорций спорили с собственной подписью. */
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
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');S.sound=0;save();});

  // ставим план так, чтобы шла 7-я абсолютная неделя = 1-я неделя второго цикла
  const wk=await p.evaluate(()=>{
    const d=new Date(); d.setDate(d.getDate()-6*7);
    S.start=mondayOf(iso(d));
    // закрываем по 4 тренировки в каждой неделе, иначе план не двинется
    for(let i=0;i<50;i++){
      const day=new Date(S.start); day.setDate(day.getDate()+i);
      const ds=iso(day), dd=dayOf(ds);
      if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log=r.log||{};
      dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:num(e.w),rs:[8,8,8],vol:100,xp:12};});
    }
    save();
    return {week:planWeek(), cyc:cycIdx()+1, ph:cycOf(today()).ph};
  });
  chk(wk.week>6,'1. план ушёл за первый цикл','абсолютная неделя '+wk.week+', в цикле '+wk.cyc+' ('+wk.ph+')');

  // На 7-й абсолютной неделе (1-я неделя второго цикла) разгрузка была
  // только что — совет брать ещё одну обязан молчать. Старое условие
  // (planWeek()>=3) здесь бы сработало и посоветовало вредное.
  const nowSt=await p.evaluate(()=>({
    stuck: (function(){ const st=[]; const seen={};
      S.days.forEach(d=>d.ex.forEach(e=>{ if(seen[e.n]||!num(e.w))return; seen[e.n]=1;
        const h=bestByDate(e.n); if(h.length<3)return; const t=h.slice(-3);
        if(t[0][1]>=t[2][1]&&daysBetween(t[0][0],today())<=35) st.push(e.n); })); return st.length; })(),
    old: planWeek()>=3,
    now: cycIdx()+1>=3,
    has: !!analyze().find(x=>x.title==='ПОРА РАЗГРУЖАТЬСЯ')
  }));
  chk(nowSt.stuck>=2,'2. застой есть — условие совета выполнимо','застрявших '+nowSt.stuck);
  chk(nowSt.old&&!nowSt.now,'3. старое условие сработало бы, новое — нет',JSON.stringify(nowSt));
  chk(!nowSt.has,'4. сразу после разгрузки совет молчит', nowSt.has?'всё равно советует':'молчит');

  // 4б. а на пятой неделе цикла — говорит, и с правильным числом
  const late=await p.evaluate(()=>{
    const d=new Date(); d.setDate(d.getDate()-4*7);
    S.start=mondayOf(iso(d)); save();
    const f=analyze().find(x=>x.title==='ПОРА РАЗГРУЖАТЬСЯ');
    return {cyc:cycIdx()+1, text:f?f.text.replace(/<[^>]+>/g,''):'', task:f?f.task:''};
  });
  chk(late.cyc===5&&/идёт 5-я тяжёлая неделя/.test(late.text),
      '4б. на пятой неделе цикла совет есть и считает от разгрузки',
      'в цикле '+late.cyc+': '+(late.text||'совета нет'));
  chk(/до неё 1 неделя/.test(late.task),'4в. сказано, сколько осталось до разгрузки',late.task||'—');

  // 5. на неделе разгрузки совета быть не должно
  const onDl=await p.evaluate(()=>{
    const d=new Date(); d.setDate(d.getDate()-5*7);
    S.start=mondayOf(iso(d)); save();
    return {ph:cycOf(today()).ph, has:!!analyze().find(x=>x.title==='ПОРА РАЗГРУЖАТЬСЯ')};
  });
  chk(!(onDl.ph==='РАЗГРУЗКА'&&onDl.has),'5. на неделе разгрузки совет молчит',JSON.stringify(onDl));

  // 6-8. пропорции: пороги и подпись не спорят
  const pr=await p.evaluate(()=>{
    const out=[];
    [[100,105,125],[100,120,150],[100,140,170]].forEach(([bb,sq,dl])=>{
      S.pr={'Жим лёжа':bb,'Присед со штангой':sq,'Становая тяга':dl};
      const f=analyze().find(x=>x.title==='ПРОПОРЦИИ');
      out.push({rs:(sq/bb).toFixed(2), lvl:f?f.lvl:'нет', b:f?f.text.replace(/<[^>]+>/g,''):''});
    });
    return out;
  });
  chk(pr[0].lvl==='warn','6. присед 1,05 и становая 1,25 — предупреждение',JSON.stringify(pr[0]));
  chk(pr[1].lvl==='ok'&&/до ориентира/.test(pr[1].b),'7. 1,20 — норма, но честно сказано, что до ориентира далеко',pr[1].b);
  chk(pr[2].lvl==='ok'&&/набран/.test(pr[2].b),'8. 1,40 и 1,70 — ориентир набран',pr[2].b);

  chk(errs.length===0,'9. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
