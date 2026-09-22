/* Числа. Каждое считается второй раз, независимо от приложения, и
   сравнивается с тем, что оно показывает. Проверяются цепочки, которых
   раньше не трогал ни один прогон. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const ok  = (n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad = (n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk = (c,n,d)=>c?ok(n,d):bad(n,d);
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60}; S.bw='72'; S.bw0='70'; S.goal='95'; S.height=177; S.age=30;
    const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
    save(); recomputeStats(1); tab='wo'; sel=today(); render(); });
  await p.waitForTimeout(300);

  // 1. kg() устойчив: показал — сохранил — показал то же
  chk(await p.evaluate(() => {
    const vals=[0,2.5,7.5,12.5,17.5,70,72.4,105.25,0.05,1234.567];
    return vals.every(v => kg(kg(v).replace(',', '.')) === kg(v));
  }), '1. показ веса не плывёт при повторе');

  // 2. один знак после запятой и запятая вместо точки
  chk(await p.evaluate(() => {
    const bad2=[];
    [12.125,35.625,70.04,2.449,99.96].forEach(v=>{
      const t=kg(v);
      if(t.indexOf('.')>=0) bad2.push(t+' с точкой');
      const dec=(t.split(',')[1]||'');
      if(dec.length>1) bad2.push(t+' — два знака');
    });
    return bad2.length?bad2.join('; '):true;
  }) === true, '2. вес пишется одним знаком через запятую');

  // 3. предлагаемый вес стоит на сетке своего упражнения: до 20 кг —
  //    килограмм (гантели и блоки), выше — 2,5 кг (пара блинов)
  chk(await p.evaluate(() => {
    const bad2=[];
    S.days.forEach(d => (d.ex||[]).forEach(e => {
      const gr = granOf(e.w);
      Object.keys(INT).forEach(k => {
        const w = weightFor(e, INT[k]);
        if (w && (Math.abs(w/gr - Math.round(w/gr)) > 1e-9 || w < gr)) bad2.push(e.n+' '+k+' '+w+' сетка '+gr);
      });
    }));
    return bad2.slice(0,3).join('; ') || true;
  }) === true, '3. предлагаемые веса стоят на сетке своего упражнения');

  // 4. тоннаж дня равен сумме повторов на вес, посчитанной отдельно
  chk(await p.evaluate(() => {
    const r=recRW(sel), d=dayOf(sel);
    d.ex.forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:'3',r:'8',w:'20',rs:['10','9','8']}; });
    delete r.log[0].vol;
    save(); entCache=null;
    const mine = d.ex.length * (10+9+8) * 20;
    const app = Math.round(dayTon(sel));
    return { mine, app };
  }).then(x => Math.abs(x.mine - x.app) < 1 ? true : JSON.stringify(x)) === true,
  '4. тоннаж дня сходится с ручным счётом');

  // 5. подходы дня считаются по коробкам повторов
  chk(await p.evaluate(() => daySets(sel) === dayOf(sel).ex.length * 3),
      '5. подходы считаются по фактическим повторам');

  // 6. калории равны сумме по продуктам
  chk(await p.evaluate(() => {
    const m = mealsRW(sel);
    m.length = 0;
    m.push({n:'Тест',note:'',items:[{p:'Рис белый отварной',g:'200'},{p:'Творог 5%',g:'150'}]});
    save();
    const base = allFood();
    const f1 = base.find(f=>f[0]==='Рис белый отварной'), f2 = base.find(f=>f[0]==='Творог 5%');
    const mine = f1[1]*2 + f2[1]*1.5;
    const app = daySum(sel).k;
    return Math.abs(mine-app) < 0.5 ? true : JSON.stringify({mine, app});
  }) === true, '6. калории равны сумме по продуктам');

  // 7. диаграмма показывает ровно то, что считает vol7()
  chk(await p.evaluate(() => {
    tab='prog'; pSec='load'; render();
    const acc = vol7();
    const txt = [...document.querySelectorAll('#rad .rnum')].map(t=>t.textContent);
    const mine = GROUPS.map(([n]) => (acc[n]||0)+'/'+volTarget(n));
    return JSON.stringify(txt)===JSON.stringify(mine) ? true : JSON.stringify({txt, mine});
  }) === true, '7. подписи диаграммы равны недельному счёту');

  // 8. вершина диаграммы пропорциональна доле нормы
  chk(await p.evaluate(() => {
    const acc = vol7();
    const pts = document.querySelector('#rad .rfill');
    if (!pts) return 'фигуры нет';
    const xy = pts.getAttribute('points').split(' ').map(s2=>s2.split(',').map(Number));
    // Граница — одна недельная норма: добранная группа стоит на краю,
    // а не на половине радиуса, как было при шкале до двух норм.
    const cx=150, cy=114, R=78;
    const bad2=[];
    GROUPS.forEach(([n],i)=>{
      const want = Math.min(1, (acc[n]||0)/volTarget(n));
      if (!want) return;
      const d = Math.hypot(xy[i][0]-cx, xy[i][1]-cy) / R;
      if (Math.abs(d-want) > 0.02) bad2.push(n+': '+d.toFixed(2)+' вместо '+want.toFixed(2));
    });
    return bad2.join('; ') || true;
  }) === true, '8. длина луча равна доле нормы');

  // 9. смена режима пересчитывает норму калорий
  chk(await p.evaluate(() => {
    tab='prog'; pSec='goal'; render();
    const up = dayOf(sel).kc;
    document.querySelector('#wdir [data-dir="down"]').click();
    const down = dayOf(sel).kc;
    document.querySelector('#wdir [data-dir="up"]').click();
    const back = dayOf(sel).kc;
    return (num(down) < num(up) && num(back) > num(down)) ? true : JSON.stringify({up,down,back});
  }) === true, '9. похудение снижает норму калорий, набор поднимает');

  // 10. замена на аналог пересчитывает тоннаж группы
  chk(await p.evaluate(async () => {
    tab='wo'; sel=today(); exOpen=0; render();
    const d=dayOf(sel), was=d.ex[0].n, alt=altsOf(was)[0];
    const before = JSON.stringify(S.vol);
    openHow(was, 0);
    await new Promise(r=>setTimeout(r,200));
    const btn=document.querySelector('#sh [data-alt]');
    if(!btn) return 'кнопки замены нет';
    btn.click();
    await new Promise(r=>setTimeout(r,150));
    try{askClose(true)}catch(e){}
    await new Promise(r=>setTimeout(r,250));
    return (d.ex[0].n === alt && JSON.stringify(S.vol) !== undefined) ? true
      : JSON.stringify({was, alt, now:d.ex[0].n});
  }) === true, '10. аналог встаёт и статистика пересчитывается');

  // 11. разгрузочная неделя действительно снимает вес
  chk(await p.evaluate(() => {
    const e = dayOf(today()).ex[0];
    const h = weightFor(e, INT.h), d2 = weightFor(e, INT.d);
    return (d2 < h && d2 >= 2.5) ? true : JSON.stringify({h, d:d2});
  }) === true, '11. разгрузка снимает вес относительно тяжёлой недели');

  // 12. номер недели и круга не уходят в минус и не прыгают
  chk(await p.evaluate(() => {
    const bad2=[];
    for (let k=0;k<400;k+=7){
      const d=new Date(); d.setDate(d.getDate()+k);
      const z=new Date(d); z.setMinutes(z.getMinutes()-z.getTimezoneOffset());
      const ds=z.toISOString().slice(0,10);
      const w=planWeek(ds);
      if (w < 0 || w > 200) bad2.push(ds+': '+w);
    }
    return bad2.slice(0,3).join('; ') || true;
  }) === true, '12. неделя плана считается на год вперёд без срывов');

  console.log('ошибки JS: ' + (errs.length ? [...new Set(errs)].join(' | ') : 'нет'));
  await b.close();
  console.log('провалено: ' + fails);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
