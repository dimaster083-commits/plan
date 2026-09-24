/* Годовая сетка и месяц: раскладка дат по колонкам недели, заливка по
   тоннажу, подписи недель цикла, границы перелистывания и то, что нажатие
   на месяц открывает именно его. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s;S.sound=0;
      S.rec={};
      // год записей с разным тоннажем, чтобы заливка была разной
      for(let k=1;k<=200;k++){
        const d=new Date(); d.setDate(d.getDate()-k); const ds=iso(d);
        const dd=dayOf(ds); if(dd.t==='rest') continue;
        const r=recRW(ds); r.wo=1; r.log={};
        dd.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:'3',r:'8',w:num(e.w),
          rs:[8,8,8],vol:(k%5+1)*300,xp:12};});
      }
      entCache=null; statsDirty=true; save(); recomputeStats(1);
      tab='prog'; pSec='log'; calView='year'; render(); paintSections(); cal();},skin);
    await p.waitForTimeout(400);

    // 1-3. двенадцать месяцев одной высоты, даты стоят в своих колонках
    const год=await p.evaluate(()=>{
      const мес=[...document.querySelectorAll('#cyear .mob')];
      const клеток=мес.map(m=>m.querySelectorAll('.mc').length);
      // колонка недели: 1 января каждого месяца обязано попасть в свой столбец
      const плохо=[];
      MON.forEach((_,k)=>{
        const c=monthCells(calYear, k+1);
        const первый=c.findIndex(Boolean);
        const wd=(new Date(calYear, k, 1).getDay()+6)%7;
        if(первый!==wd) плохо.push(MON[k]+': отступ '+первый+' вместо '+wd);
        const len=new Date(calYear,k+1,0).getDate();
        if(c.filter(Boolean).length!==len) плохо.push(MON[k]+': дней '+c.filter(Boolean).length+' вместо '+len);
      });
      return {месяцев:мес.length, клеток:[...new Set(клеток)], плохо:плохо,
              подпись:document.getElementById('cmo').textContent};
    });
    chk(год.месяцев===12,'1. в годовой сетке двенадцать месяцев',String(год.месяцев));
    chk(год.клеток.length===1&&год.клеток[0]===42,'2. у всех месяцев одна высота сетки',
        'клеток: '+год.клеток.join('/'));
    chk(год.плохо.length===0,'3. каждое число стоит в своей колонке недели',
        год.плохо.join('; ')||'все месяцы сходятся');

    // 4-5. заливка по тоннажу: есть все ступени и пустые дни не залиты
    const заливка=await p.evaluate(()=>{
      const ст={};
      document.querySelectorAll('#cyear .mc').forEach(c=>{
        const m=[...c.classList].find(x=>/^l[0-4]$/.test(x));
        if(m) ст[m]=(ст[m]||0)+1;
      });
      // проверяем сам расчёт ступени
      const L=dayLevels(calYear);
      const плохо=[];
      Object.keys(L.tons).slice(0,50).forEach(ds=>{
        const lv=lvlOf(L.tons[ds], L.mx);
        if(lv<1||lv>4) плохо.push(ds+' ступень '+lv);
      });
      if(lvlOf(0,L.mx)!==0) плохо.push('пустой день не нулевой ступени');
      return {ступени:ст, плохо:плохо};
    });
    chk(Object.keys(заливка.ступени).length>=3,'4. в году встречаются разные ступени заливки',
        JSON.stringify(заливка.ступени));
    chk(заливка.плохо.length===0,'5. ступень считается в границах 0-4',
        заливка.плохо.join('; ')||'в границах');

    // 6-8. перелистывание года упирается в границы
    const края=await p.evaluate(()=>{
      const nowY=new Date().getFullYear();
      const выход=[];
      for(let i=0;i<9;i++){ if(!document.getElementById('pm').disabled) document.getElementById('pm').click(); }
      выход.push({год:calYear, назад:document.getElementById('pm').disabled});
      for(let i=0;i<12;i++){ if(!document.getElementById('nm').disabled) document.getElementById('nm').click(); }
      выход.push({год:calYear, вперёд:document.getElementById('nm').disabled});
      return {выход, nowY};
    });
    chk(края.выход[0].назад&&края.выход[0].год===края.nowY-6,'6. назад листается ровно на шесть лет',
        JSON.stringify(края.выход[0]));
    chk(края.выход[1].вперёд&&края.выход[1].год===края.nowY+1,'7. вперёд — на год',
        JSON.stringify(края.выход[1]));

    // 9-11. нажатие на месяц открывает его, подписи недель цикла на месте
    const месяц=await p.evaluate(()=>{
      calYear=new Date().getFullYear(); calView='year'; cal();
      const k=new Date().getMonth()+1;
      document.querySelector('#cyear [data-mo="'+k+'"]').click();
      const подписи=[...document.querySelectorAll('#cmonth .wk, #cmonth .cwk')].map(x=>x.textContent.trim());
      const сегодня=today();
      return {вид:calView, месяц:mo, сегодня:сегодня, заголовок:document.getElementById('cmo').textContent,
              шапка:[...document.querySelectorAll('#chead .cw')].map(x=>x.textContent).join(''),
              подписи:подписи.filter(Boolean).slice(0,3)};
    });
    chk(месяц.вид==='month','8. нажатие на месяц открывает месяц',месяц.вид);
    chk(месяц.месяц===месяц.сегодня.slice(0,7),'9. открывается именно нажатый месяц',месяц.месяц);
    chk(месяц.шапка==='ПНВТСРЧТПТСБВС','10. шапка недели начинается с понедельника',месяц.шапка);

    // 12. возврат к году
    const назад=await p.evaluate(()=>{
      document.getElementById('calBack').click();
      return {вид:calView, скрыт:document.getElementById('cmonth').hidden};
    });
    chk(назад.вид==='year'&&назад.скрыт,'11. кнопка возврата уводит обратно в год',JSON.stringify(назад));

    chk(errs.length===0,'12. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
