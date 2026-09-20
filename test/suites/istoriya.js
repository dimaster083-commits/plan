/* История упражнения, график роста и текстовая выгрузка: числа на
   графике обязаны совпадать с журналом, а выгрузка — с состоянием. */
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
  await p.goto(APP); await p.waitForTimeout(1400);

  const name=await p.evaluate(()=>{
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
    S.setup=1; document.getElementById('setup').classList.remove('on');
    S.anchors={b:70,s:50,d:60}; S.bw='75'; S.goal='95'; S.height=177; S.age=30; deriveWeights();
    const st=new Date(); st.setDate(st.getDate()-60); S.start=iso(st);
    const nm=S.days.flatMap(d=>(d.ex||[])).map(e=>e.n)[0];
    let w=40;
    for(let k=56;k>=0;k-=7){
      const d=new Date(); d.setDate(d.getDate()-k); const ds=iso(d);
      const day=dayOf(ds); if(!day) continue;
      const j=(day.ex||[]).findIndex(e=>e.n===nm);
      const r=recRW(ds); r.wo=1;
      r.log[j>=0?j:0]={done:1,n:nm,g:'Грудь',s:'3',r:'8',w:String(w),rs:['8','8','8'],vol:24*w,xp:12};
      w+=2.5;
    }
    S.pr={}; S.pr[nm]=w-2.5;
    save(); recomputeStats(1); entCache=null;
    return nm;
  });

  // 1. история упражнения собирает все записи
  const h=await p.evaluate(n=>{
    const hist=exHistory(n);
    let mine=0;
    Object.keys(S.rec).forEach(ds=>{
      const lg=S.rec[ds].log||{};
      Object.keys(lg).forEach(j=>{ if(lg[j].done&&(lg[j].n===n)) mine++; });
    });
    return { hist:hist.length, mine, max:Math.max(...hist.map(x=>x[1])), pr:num(S.pr[n]) };
  }, name);
  chk(h.hist===h.mine, '1. в истории упражнения столько же записей, сколько в журнале',
      h.hist+' и '+h.mine);
  chk(h.max===h.pr, '2. личный рекорд равен максимуму из истории', h.max+' / '+h.pr);

  // 3. точки графика идут по возрастанию даты и попадают в рамку
  const chart=await p.evaluate(async n=>{
    openHistory(n);
    await new Promise(r=>setTimeout(r,300));
    const sv=document.querySelector('#sh svg');
    if(!sv) return {err:'графика нет'};
    const cs=[...sv.querySelectorAll('circle')].map(c=>[+c.getAttribute('cx'),+c.getAttribute('cy')]);
    const vb=sv.getAttribute('viewBox').split(' ').map(Number);
    const out=cs.filter(([x,y])=>x<vb[0]-1||x>vb[0]+vb[2]+1||y<vb[1]-1||y>vb[1]+vb[3]+1);
    const asc=cs.every((c,i)=>i===0||c[0]>=cs[i-1][0]-0.01);
    const txt=document.getElementById('sh').innerText;
    return { n:cs.length, out:out.length, asc, junk:/NaN|undefined/.test(txt) };
  }, name);
  if(chart.err) bad('3. график истории', chart.err);
  else {
    chk(chart.n===h.hist, '3. на графике столько точек, сколько записей', chart.n+'');
    chk(chart.out===0, '4. точки не вылезают за рамку графика', 'вне рамки '+chart.out);
    chk(chart.asc, '5. точки идут по возрастанию даты');
    chk(!chart.junk, '6. в истории нет NaN и undefined');
  }

  // 7. текстовая выгрузка содержит настоящие числа
  const sum=await p.evaluate(()=>{
    try{
      const t=buildSummary();
      return { ok:true, len:t.length, junk:/NaN|undefined|Infinity/.test(t),
               hasTon:/тонн|т\b/i.test(t), hasBw:/вес/i.test(t), head:t.slice(0,60) };
    }catch(e){ return { ok:false, err:e.message }; }
  });
  chk(sum.ok && sum.len>200 && !sum.junk, '7. текстовая выгрузка собирается без мусора',
      sum.ok?('знаков '+sum.len):sum.err);

  // 8. выгрузка совпадает с состоянием по ключевым числам
  const match=await p.evaluate(()=>{
    const t=buildSummary();
    const bw=String(num(S.bw)).replace('.',',');
    return { hasBw:t.indexOf(bw)>=0, bw };
  });
  chk(match.hasBw, '8. в выгрузке стоит настоящий вес тела', match.bw);

  console.log('ошибки JS: '+(errs.length?[...new Set(errs)].join(' | '):'нет'));
  await b.close();
  console.log('провалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
