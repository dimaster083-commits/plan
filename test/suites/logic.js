/* Логика счёта: опыт, ступени, тоннаж, подходы, серия — каждое число
   пересчитывается независимо и сверяется с тем, что показано. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1600);
  await p.evaluate(()=>{S.setup=1;save();document.getElementById('setup').classList.remove('on');});

  const res = await p.evaluate(()=>{
    const out=[]; const ok=(n,c,d)=>out.push((c?'✓ ':'✗ ')+n+(c?'':'   → '+d));
    const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};

    /* ---------- словарь ---------- */
    // седьмая ступень — «Национальный уровень» (сентябрь 2026)
    ok('ступеней столько же, сколько порогов', DICT.ranks.length===RANKS.length && DICT.jobs.length===JOBS.length,
       DICT.ranks.length+' при '+RANKS.length+' порогах');
    // от второй темы не осталось ни слова
    const berWords=['Клеймо','Летопись','Ступень','Поход','Припасы','Сирота','Наёмник','Ястреб'];
    const leak=[];
    ['wo','prog','food','photo'].forEach(t=>{tab=t;sel=today();exOpen=null;render();
      const txt=document.body.innerText;
      berWords.forEach(w=>{if(txt.includes(w)) leak.push(t+':'+w);});});
    ok('от «Клейма» не осталось подписей', leak.length===0, [...new Set(leak)].join(', '));

    /* ---------- ступени и опыт ---------- */
    ok('уровень считается от опыта', levelOf()===Math.floor(S.xp/PER)+1, 'levelOf='+levelOf());
    const thr=[[1,0],[4,0],[5,1],[9,1],[10,2],[16,2],[17,3],[25,3],[26,4],[39,4],[40,5],[59,5],[60,6],[99,6]];
    ok('пороги ступеней не сбились', thr.every(([l,i])=>rankIdx(l)===i),
       thr.filter(([l,i])=>rankIdx(l)!==i).map(([l,i])=>'ур '+l+' даёт '+rankIdx(l)+', ждали '+i).join('; '));
    ok('ступень ниже первой не ломается', rankIdx(0)===0 && rankOf(0)===DICT.ranks[0], 'rankIdx(0)='+rankIdx(0));

    /* ---------- даты ---------- */
    ok('неделя начинается с понедельника', wdOf('2026-09-21')===0 && wdOf('2026-09-27')===6,
       wdOf('2026-09-21')+','+wdOf('2026-09-27'));
    ok('понедельник недели через границу года', mondayOf('2027-01-01')==='2026-12-28', mondayOf('2027-01-01'));
    ok('разница дат через границу года', daysBetween('2026-12-28','2027-01-04')===7, daysBetween('2026-12-28','2027-01-04'));
    ok('разница дат через перевод часов', daysBetween('2026-03-28','2026-03-30')===2, daysBetween('2026-03-28','2026-03-30'));
    ok('високосный февраль', daysBetween('2028-02-28','2028-03-01')===2, daysBetween('2028-02-28','2028-03-01'));
    ok('сдвиг месяца через декабрь', shiftMonth('2026-12',1)==='2027-01' && shiftMonth('2026-01',-1)==='2025-12',
       shiftMonth('2026-12',1)+','+shiftMonth('2026-01',-1));

    /* ---------- цикл ---------- */
    let bad=[];
    for(let k=0;k<400;k+=7){const d=new Date();d.setDate(d.getDate()-k);const ds=iso(d);
      const ci=cycIdx(ds); if(ci<0||ci>=CYCLE.length) bad.push(ds+'→'+ci);
      const w=planWeek(ds); if(!(w>=1)) bad.push(ds+' неделя '+w);}
    ok('номер недели и фаза цикла всегда в границах', bad.length===0, bad.slice(0,3).join(', '));

    /* ---------- прогрессия ---------- */
    ok('цель по повторам: верх закрыт → null', nextGoal([8,8,8],8,3)===null, JSON.stringify(nextGoal([8,8,8],8,3)));
    ok('цель по повторам: подходов стало больше', nextGoal([8,8,8],8,4)===null, JSON.stringify(nextGoal([8,8,8],8,4)));
    ok('цель по повторам: добираем первый недобор',
       JSON.stringify(nextGoal([10,12,12],12,3))==='[11,12,12]', JSON.stringify(nextGoal([10,12,12],12,3)));
    ok('цель по повторам не превышает верх диапазона',
       (nextGoal([11,12,12],12,3)||[]).every(v=>v<=12), JSON.stringify(nextGoal([11,12,12],12,3)));
    ok('шаг прибавки растёт от веса', stepFor({g:'Ноги',w:100})>stepFor({g:'Ноги',w:20}),
       stepFor({g:'Ноги',w:100})+' vs '+stepFor({g:'Ноги',w:20}));
    ok('шаг для низа больше, чем для верха', stepFor({g:'Ноги',w:100})>stepFor({g:'Руки',w:100}),
       stepFor({g:'Ноги',w:100})+' vs '+stepFor({g:'Руки',w:100}));
    ok('верхняя граница диапазона читается', topRep('8-12')===12 && topRep('10')===10, topRep('8-12')+','+topRep('10'));
    ok('первое число диапазона читается', firstRep('8-12')===8 && firstRep('10')===10, firstRep('8-12')+','+firstRep('10'));
    ok('запятая как десятичный разделитель', num('12,5')===12.5 && num('12.5')===12.5, num('12,5'));
    ok('пустое значение подменяется программным', pick('', 7)===7 && pick('  ',7)===7 && pick(0,7)===0,
       pick('',7)+','+pick('  ',7)+','+pick(0,7));

    /* ---------- подъём рабочего веса ---------- */
    const nm=S.days.find(d=>(d.ex||[]).length).ex[0].n;
    const before=S.days.map(d=>(d.ex||[]).filter(e=>e.n===nm).map(e=>+e.w)).flat();
    const log={};
    bumpWorking(nm, 999, log);
    const after=S.days.map(d=>(d.ex||[]).filter(e=>e.n===nm).map(e=>+e.w)).flat();
    unbumpWorking(log);
    const back=S.days.map(d=>(d.ex||[]).filter(e=>e.n===nm).map(e=>+e.w)).flat();
    ok('подъём веса затрагивает все дни с этим упражнением', after.every(w=>w===999), JSON.stringify(after));
    ok('откат возвращает веса в точности', JSON.stringify(back)===JSON.stringify(before),
       JSON.stringify(before)+' → '+JSON.stringify(back));
    ok('вес не опускается вниз', bumpWorking(nm, 1, {})===0, 'опустил');

    /* ---------- тоннаж и опыт ---------- */
    const back2=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
    for(let k=1;k<=12;k++){const ds=back2(k),d=dayOf(ds),r=recRW(ds);
      if(!(d.ex||[]).length) continue;
      r.wo=1; d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:3,r:'8',w:20,rs:[8,8,8],vol:3*8*20,xp:12};});}
    save(); recomputeStats();
    const manual={}; GROUPS.forEach(([n])=>manual[n]=0);
    Object.keys(S.rec).forEach(ds=>{const lg=S.rec[ds].log||{};
      Object.keys(lg).forEach(j=>{const l=lg[j]; if(!l||!l.done) return;
        const g=l.g; if(g&&manual[g]!==undefined) manual[g]+=num(l.vol);});});
    GROUPS.forEach(([n])=>manual[n]+=num((S.volBase||{})[n]));
    ok('тоннаж по группам совпадает с суммой по журналу',
       GROUPS.every(([n])=>Math.abs(S.vol[n]-manual[n])<0.5),
       GROUPS.map(([n])=>n+': '+Math.round(S.vol[n])+' vs '+Math.round(manual[n])).join(', '));

    const v1=JSON.stringify(S.vol), x1=S.xp;
    recomputeStats(); recomputeStats();
    ok('повторный пересчёт ничего не меняет', JSON.stringify(S.vol)===v1 && S.xp===x1, v1+' → '+JSON.stringify(S.vol));

    /* ---------- разбор дня совпадает со статистикой ---------- */
    const ds1=Object.keys(S.rec).filter(d=>dayEntries(d).length).sort().reverse()[0];
    if(ds1){
      const ent=dayEntries(ds1);
      const sum=ent.reduce((a,e)=>a+e.vol,0);
      ok('тоннаж дня равен сумме упражнений этого дня', Math.abs(dayTon(ds1)-sum)<0.5, dayTon(ds1)+' vs '+sum);
      ok('подходы дня считаются по фактическим повторам',
         daySets(ds1)===ent.reduce((a,e)=>a+(e.rs?e.rs.length:e.s),0), daySets(ds1));
    }

    /* ---------- миграция ---------- */
    const snap=JSON.stringify(S);
    migrate(); const m1=JSON.stringify(S);
    migrate(); const m2=JSON.stringify(S);
    ok('повторная миграция не меняет состояние', m1===m2, 'разошлось');
    /* Номер переезда — ключ в хранилище. Занял чужой номер — и чужой переезд
       молча не состоится: так один раз уже потерялись цель по весу и рост. */
    (function(){
      const src = document.documentElement.innerHTML;
      const sets = (src.match(/S\.mig\d+ = 1/g) || []).map(x => x.match(/\d+/)[0]);
      const seen = {}, dup = [];
      sets.forEach(n => { if (seen[n]) dup.push(n); seen[n] = 1; });
      ok('номера переездов не повторяются', dup.length === 0, dup.join(', ') || ('всего ' + sets.length));
    })();
    ok('миграция не трогает журнал', JSON.parse(snap).rec && JSON.stringify(JSON.parse(m1).rec)===JSON.stringify(JSON.parse(snap).rec), 'журнал изменён');

    /* ---------- еда ---------- */
    const a1=today(), d7=new Date(); d7.setDate(d7.getDate()-7); const b1=iso(d7);
    mealsRW(a1)[0].items=[{p:'Овсянка на воде готовая',g:'100'}]; save();
    ok('еда принадлежит дате, а не дню недели',
       dayIdx(a1)===dayIdx(b1) && sumMeals(mealsOf(a1)).k>0 && sumMeals(mealsOf(b1)).k===0,
       'одинаковый день недели: '+(dayIdx(a1)===dayIdx(b1)));
    const bw=num(S.bw)||70;
    ok('норма калорий растёт вместе с весом', nutriFor('wo').kc > 0 && nutriFor('wo').kc > nutriFor('rest').kc,
       nutriFor('wo').kc+' vs '+nutriFor('rest').kc);
    ok('направление режима считается от текущего веса',
       // пустая цель — «держать как есть» (первый запуск без чужих 95 кг)
       (!num(S.goal) ? goalDir()===0 : num(S.goal)>bw ? goalDir()>0 : num(S.goal)<bw ? goalDir()<0 : goalDir()===0), 'goalDir='+goalDir());

    /* ---------- серия недель ---------- */
    ok('серия недель не отрицательная и не абсурдная', streak()>=0 && streak()<1000, streak());

    /* ---------- группы мышц ---------- */
    const g1=Object.keys(EXDB).map(n=>EXDB[n][1]);
    ok('все упражнения каталога попадают в известные группы',
       g1.every(g=>GROUPS.some(([n])=>n===g)), [...new Set(g1.filter(g=>!GROUPS.some(([n])=>n===g)))].join(', '));
    ok('плечи отдельная группа и не пустая',
       GROUPS.some(([n])=>n==='Плечи') && g1.includes('Плечи'), 'нет');
    ok('нормы объёма заданы для всех групп',
       GROUPS.every(([n])=>VOL_TARGET[n]>0), GROUPS.filter(([n])=>!VOL_TARGET[n]).map(x=>x[0]).join(', '));

    return out;
  });

  console.log(res.join('\n'));
  console.log('\nошибки JS:', errs.length?[...new Set(errs)].join(' | '):'нет');
  const fail = res.filter(r=>r.startsWith('✗')).length;
  console.log('провалено:', fail, 'из', res.length);
  await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
