/* Шкала «за всё время» и подпись недели плана.
   Полосы считались от самой большой группы, поэтому та всегда стояла
   залитой до конца: 8,8 т выглядели так же, как 880 т.
   Подпись недели говорила «закрыто 0 из 4» про текущую неделю, а причина,
   по которой неделя повторяется, лежит в прошлой. */
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

  // задаём тоннаж по группам напрямую и смотрим, как ложится шкала
  const шкала = тонны => p.evaluate(т=>{
    GROUPS.forEach(([n],i)=>{ S.vol[n]=(т[i]||0)*1000; });
    S.volBase=Object.assign({}, S.vol); S.xpBase=num(S.xp);
    tab='prog'; pSec='load'; render(); paintSections(); paintVol();
    const строки=[...document.querySelectorAll('#loadList .ld')].map(r=>({
      имя:r.querySelector('.n').textContent,
      ширина:parseFloat(r.querySelector('.b i').style.width),
      число:r.querySelector('.v b').textContent
    }));
    return {потолок:document.getElementById('volTop').textContent, строки};
  },тонны);

  // 1-3. 8,8 т — самая большая группа: шкала уходит на 10 т, полоса не упирается
  const a = await шкала([2.0,0.9,0.8,8.8,1.2,0]);
  chk(/10 т/.test(a.потолок),'1. шкала берёт ближайшую круглую отметку выше',a.потолок);
  const ноги=a.строки.find(x=>x.имя==='Ноги');
  chk(ноги.ширина>80&&ноги.ширина<100,'2. самая большая группа не залита до конца',
      ноги.имя+' '+ноги.число+' → '+ноги.ширина+'%');
  const спина=a.строки.find(x=>x.имя==='Спина');
  chk(Math.abs(спина.ширина-20)<1,'3. остальные группы меряются той же шкалой',
      спина.имя+' '+спина.число+' → '+спина.ширина+'%');

  // 4-5. дошёл до отметки — шкала переезжает на следующую
  const c = await шкала([2.0,0.9,0.8,12,1.2,0]);
  chk(/25 т/.test(c.потолок),'4. перешагнул отметку — шкала переехала на следующую',c.потолок);
  const ноги2=c.строки.find(x=>x.имя==='Ноги');
  chk(ноги2.ширина<60,'5. и полоса снова показывает, сколько осталось',ноги2.ширина+'%');

  // 6. пустой журнал не ломает шкалу
  const d = await шкала([0,0,0,0,0,0]);
  chk(d.строки.every(x=>x.ширина===0)&&/\d/.test(d.потолок),'6. пустой журнал: полосы пустые, шкала названа',
      d.потолок);

  // 7-9. подпись недели объясняет, почему неделя та же
  const w = await p.evaluate(()=>{
    S.rec={};
    const пн=mondayOf(today()); const d2=at(пн); d2.setDate(d2.getDate()-7);
    S.start=iso(d2);
    // на прошлой неделе закрыто всего две тренировки
    let n=0;
    for(let i=0;i<7&&n<2;i++){
      const day=new Date(iso(d2)); day.setDate(day.getDate()+i);
      const ds=iso(day), dd=dayOf(ds);
      if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log={}; n++;
      dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),w:num(e.w),rs:[8,8,8],vol:1,xp:1};});
    }
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    tab='prog'; pSec='goal'; render(); paintSections(); paintCycle();
    return {текст:document.getElementById('cycNote').textContent,
            неделя:document.getElementById('cycW').textContent, план:planWeek()};
  });
  chk(w.план===1,'7. план не двинулся: прошлая неделя не добрана','неделя плана '+w.план);
  chk(/Прошлая неделя: 2 из 4/.test(w.текст),'8. подпись называет прошлую неделю',w.текст.slice(0,200));
  chk(/не засчитана, поэтому идёт та же неделя/.test(w.текст),'9. и объясняет, почему неделя та же',
      /не засчитана/.test(w.текст)?'объясняет':'молчит');

  // 10. добрали прошлую неделю — подпись меняется, план двигается
  const w2 = await p.evaluate(()=>{
    const пн=mondayOf(today()); const d2=at(пн); d2.setDate(d2.getDate()-7);
    for(let i=0;i<7;i++){
      const day=new Date(iso(d2)); day.setDate(day.getDate()+i);
      const ds=iso(day), dd=dayOf(ds);
      if(dd.t==='rest') continue;
      const r=recRW(ds); r.wo=1; r.log=r.log||{};
      dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),w:num(e.w),rs:[8,8,8],vol:1,xp:1};});
    }
    entCache=null; statsDirty=true; save(); recomputeStats(1);
    paintCycle();
    return {текст:document.getElementById('cycNote').textContent, план:planWeek()};
  });
  chk(w2.план===2,'10. добранная прошлая неделя двигает план','неделя плана '+w2.план);
  chk(/засчитана/.test(w2.текст)&&!/не засчитана/.test(w2.текст),'11. и подпись это говорит',
      w2.текст.slice(0,200));

  chk(errs.length===0,'12. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
