/* Пути, которые пишут в журнал, но до сих пор проверялись только на «не падает».
   Кнопки: добавить упражнение, сменить тип дня, переименовать день, добавить
   добавку, вернуть нормы к расчётным, возраст для расчёта жира, дата старта
   плана, цель по весу, пропуск первичной настройки.

   После каждого нажатия — одни и те же неизменные правила. Главное из них:
   день недели в этом приложении ОБЩИЙ на все недели, а отметки подходов лежат
   под НОМЕРАМИ упражнений. Сегодня этот класс трижды портил журнал: меняешь
   состав дня — и во всех прошедших датах номера начинают указывать на соседние
   упражнения, а отмена такого подхода откатывает чужой тоннаж и чужой рекорд. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);

const ПРАВИЛА = () => {
  const бед=[];
  Object.keys(S.rec).forEach(ds=>{
    const ex=(dayOf(ds)||{}).ex||[], lg=(S.rec[ds]||{}).log||{};
    Object.keys(lg).forEach(k=>{
      const l=lg[k]; if(!l||!l.n) return;
      const под=ex[+k];
      if(под && под.n!==l.n) бед.push('отметка «'+l.n+'» под «'+под.n+'» ('+ds+')');
    });
    const sp=(dayOf(ds)||{}).sp||[], mk=(S.rec[ds]||{}).sp||{};
    Object.keys(mk).forEach(k=>{ if(!sp[+k]) бед.push('галочка добавки №'+k+' в пустоту ('+ds+')'); });
  });
  const былXp=num(S.xp), былVol=Object.assign({}, S.vol);
  statsDirty=true; recomputeStats(1);
  if(Math.abs(num(S.xp)-былXp)>0.5) бед.push('опыт разошёлся: '+былXp+' → '+S.xp);
  GROUPS.forEach(([n])=>{
    if(Math.abs(num(S.vol[n])-num(былVol[n]))>1) бед.push('объём «'+n+'»: '+былVol[n]+' → '+S.vol[n]);
    if(isNaN(num(S.vol[n]))||num(S.vol[n])<0) бед.push('объём «'+n+'» = '+S.vol[n]);
  });
  if(isNaN(num(S.xp))||num(S.xp)<0) бед.push('опыт = '+S.xp);
  Object.keys(S.rec).forEach(ds=>{
    if(!/^\d{4}-\d{2}-\d{2}$/.test(ds)) { бед.push('мусорная дата «'+ds+'»'); return; }
    const lg=(S.rec[ds]||{}).log||{};
    Object.keys(lg).forEach(k=>{ const l=lg[k]||{};
      ['w','vol','xp'].forEach(f=>{ const v=l[f];
        if(v!==undefined && (isNaN(num(v))||num(v)<0)) бед.push(ds+' №'+k+' '+f+'='+v); }); });
  });
  S.days.forEach(d=>(d.ex||[]).forEach(e=>{
    const w=num(e.w); if(!w) return;
    const g=granOf(w);
    if(Math.abs(w/g-Math.round(w/g))>1e-9) бед.push('вес «'+e.n+'» = '+w+' мимо сетки');
  }));
  S.days.forEach(d=>{
    if(isNaN(num(d.kc))||num(d.kc)<0) бед.push('норма ккал «'+d.k+'» = '+d.kc);
    if(isNaN(num(d.pr))||num(d.pr)<0) бед.push('норма белка «'+d.k+'» = '+d.pr);
  });
  return бед;
};

(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl','ber']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(f=>{ window.ПРАВИЛА=eval('('+f+')'); },ПРАВИЛА.toString());
    await p.evaluate(s=>{
      S.setup=1; document.getElementById('setup').classList.remove('on'); applyTheme(s); S.sound=0;
      S.rec={}; S.map={}; S.pr={}; S.bw='72'; S.goal='95'; S.kcManual=0;
      applyNutri();            // иначе нормы остаются от прежнего веса
      for(let k=1;k<=28;k++){
        const d=new Date(); d.setDate(d.getDate()-k); const ds=iso(d);
        const dd=dayOf(ds); if(dd.t==='rest') continue;
        const r=recRW(ds); r.wo=1; r.log={};
        dd.ex.forEach((e,j)=>{ r.log[j]={done:1,n:e.n,g:e.g,s:String(e.s),r:String(e.r),
          w:num(e.w),rs:[8,8,8],vol:num(e.w)*24,xp:12}; });
        r.sp={0:1,2:1};
      }
      entCache=null; statsDirty=true; save(); recomputeStats(1);
    },skin);

    const шаг = async (имя, код) => {
      const бед = await p.evaluate(async c=>{
        try { await eval('(async()=>{'+c+'})()'); } catch(e){ return ['УПАЛО: '+e.message]; }
        entCache=null; return window.ПРАВИЛА();
      }, код);
      chk(бед.length===0, имя, бед.slice(0,2).join(' · ')||'журнал цел');
    };

    await шаг('1. исходный журнал цел','void 0;');

    // --- добавление упражнения из каталога ---
    const доб = await p.evaluate(async()=>{
      const d=S.days.find(x=>x.t!=='rest');
      let ds=today();
      for(let k=0;k<14;k++){const x=new Date();x.setDate(x.getDate()-k); if(dayOf(iso(x))===d){ds=iso(x);break;}}
      sel=ds; tab='wo'; edit=true; editPast=true; exOpen=null; render();
      const было=d.ex.length;
      const кн=document.getElementById('addEx');
      if(!кн||кн.hidden) return {err:'кнопки «добавить» нет'};
      кн.click(); await new Promise(r=>setTimeout(r,250));
      const поз=document.querySelector('#shB [data-addex]');
      if(!поз) return {err:'каталог не открылся'};
      const имя=поз.dataset.addex;
      поз.click(); await new Promise(r=>setTimeout(r,300));
      const e=d.ex[d.ex.length-1];
      return {было, стало:d.ex.length, имя, вес:num(e?e.w:0), группа:e?e.g:null, вКонце:e&&e.n===имя};
    });
    chk(!доб.err&&доб.стало===доб.было+1,'2. упражнение добавилось в день',
        доб.err||(доб.было+' → '+доб.стало+', «'+доб.имя+'»'));
    chk(!доб.err&&доб.вКонце,'3. и встало в конец, не сдвинув чужие номера',String(доб.вКонце));
    chk(!доб.err&&доб.группа,'4. с мышечной группой, иначе подходы не попадут в объём',String(доб.группа));
    await шаг('5. журнал цел после добавления упражнения','void 0;');

    // --- переименование дня ---
    await шаг('6. переименование дня журнал не трогает',
      `const el=document.getElementById('dnm'); el.value='Мой день';
       el.dispatchEvent(new Event('input',{bubbles:true}));`);
    const имяДня = await p.evaluate(()=>dayOf(sel).n);
    chk(имяДня==='Мой день','7. новое имя дня сохранилось',имяДня);

    // --- смена типа дня во всех неделях ---
    const тип = await p.evaluate(async()=>{
      const d=dayOf(sel), был=d.t;
      const хочу=(был==='up1'||был==='up2')?'lo1':'up1';
      const кн=document.querySelector('#types [data-t="'+хочу+'"]');
      if(!кн) return {err:'кнопки типа нет'};
      кн.click(); await new Promise(r=>setTimeout(r,250));
      const да=[...document.querySelectorAll('.askw button')].find(x=>!/отмен|нет/i.test(x.textContent));
      if(!да) return {err:'подтверждения нет'};
      да.click(); await new Promise(r=>setTimeout(r,350));
      return {был, стал:d.t, подпись:d.s, упр:(d.ex[0]||{}).n};
    });
    chk(!тип.err&&тип.стал!==тип.был,'8. тип дня сменился во всех неделях',
        тип.err||(тип.был+' → '+тип.стал));
    await шаг('9. журнал цел после смены типа дня','void 0;');

    // --- добавление добавки ---
    await шаг('10. добавка добавилась, чужие галочки не съехали',
      `tab='food'; sel=today(); render();
       const кн=document.getElementById('addSp'); кн.click();`);
    const сп = await p.evaluate(()=>({всего:dayOf(today()).sp.length,
      отмечено:Object.keys(recOf(today()).sp||{}).length}));
    chk(сп.всего>0,'11. список добавок не пуст','в списке '+сп.всего);

    // --- нормы: руками и обратно к расчётным ---
    const нормы = await p.evaluate(async()=>{
      tab='food'; sel=today(); render();
      const до=dayOf(today()).kc;
      const el=document.getElementById('kc'); el.value='9999';
      el.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>setTimeout(r,200));
      const руками={норма:dayOf(today()).kc, флаг:S.kcManual,
                    кнопка:!document.getElementById('kcAuto').hidden};
      document.getElementById('kcAuto').click();
      await new Promise(r=>setTimeout(r,300));
      return {до, руками, после:{норма:dayOf(today()).kc, флаг:S.kcManual,
              кнопка:!document.getElementById('kcAuto').hidden}};
    });
    chk(нормы.руками.норма==='9999'&&нормы.руками.флаг===1&&нормы.руками.кнопка,
        '12. вписанная руками норма встаёт и показывает кнопку возврата',JSON.stringify(нормы.руками));
    chk(нормы.после.норма===нормы.до&&!нормы.после.флаг&&!нормы.после.кнопка,
        '13. возврат к расчётным работает и прячет кнопку',
        нормы.руками.норма+' → '+нормы.после.норма+' (было '+нормы.до+')');
    await шаг('14. журнал цел после игр с нормами','void 0;');

    // --- мусор в норме не роняет полосу ---
    const мусор = await p.evaluate(async()=>{
      const el=document.getElementById('kc');
      const из=[];
      for(const v of ['','-500','абв','0']){
        el.value=v; el.dispatchEvent(new Event('input',{bubbles:true}));
        await new Promise(r=>setTimeout(r,80));
        из.push(document.getElementById('bKc').style.width);
      }
      document.getElementById('kcAuto').click();
      await new Promise(r=>setTimeout(r,200));
      return из;
    });
    const ширины=мусор.map(w=>parseFloat(w)||0);
    chk(ширины.every(w=>w>=0&&w<=100),'15. мусор в норме не ломает полосу',мусор.join(' · '));

    // --- цель по весу ---
    const цель = await p.evaluate(async()=>{
      tab='prog'; pSec='goal'; render(); paintSections();
      const из=[];
      for(const v of ['60','95','72','','-5','абв']){
        const el=document.getElementById('goalIn'); el.value=v;
        el.dispatchEvent(new Event('input',{bubbles:true}));
        await new Promise(r=>setTimeout(r,80));
        из.push({v, dir:goalDir(), kc:dayOf(today()).kc, pr:dayOf(today()).pr});
      }
      return из;
    });
    chk(цель[0].dir<0&&цель[1].dir>0,'16. цель ниже веса — похудение, выше — набор',
        'цель 60 → '+цель[0].dir+', цель 95 → '+цель[1].dir);
    chk(цель[2].dir===0,'17. цель вровень с весом — удержание','цель 72 → '+цель[2].dir);
    const чис=v=>parseFloat(String(v).replace(',','.'));
    chk(цель.every(x=>чис(x.kc)>0&&чис(x.pr)>0),
        '18. мусор в цели не даёт NaN и нулевых норм',
        цель.map(x=>'«'+x.v+'»:'+x.kc+'/'+x.pr).join(' '));
    await шаг('19. журнал цел после игр с целью',`setGoal('95');`);

    // --- дата старта плана ---
    const дата = await p.evaluate(async()=>{
      const годная=planStart();
      const из=[];
      for(const v of ['', '2026-13-45', '2026-02-30']){
        const el=document.getElementById('startIn'); el.value=v;
        el.dispatchEvent(new Event('change',{bubbles:true}));
        await new Promise(r=>setTimeout(r,80));
        из.push({v, start:S.start, план:planStart(), неделя:planWeek(), цикл:cycIdx()});
      }
      // далёкое прошлое и будущее
      const год=new Date(); год.setDate(год.getDate()-370);
      S.start=iso(год); save();
      const далеко={неделя:planWeek(), цикл:cycIdx(), начался:started()};
      const буд=new Date(); буд.setDate(буд.getDate()+30);
      S.start=iso(буд); save();
      const впереди={начался:started(), неделя:planWeek()};
      S.start=годная; save();
      return {из, далеко, впереди, длинаЦикла:CYCLE.length};
    });
    chk(дата.из.every(x=>/^\d{4}-\d{2}-\d{2}$/.test(x.план)),
        '20. негодная дата не становится стартом плана',
        дата.из.map(x=>'«'+x.v+'»→'+x.план).join(' '));
    chk(дата.из.every(x=>x.цикл>=0&&x.цикл<дата.длинаЦикла),'21. неделя цикла остаётся в границах',
        дата.из.map(x=>x.цикл).join(','));
    chk(дата.далеко.цикл>=0&&дата.далеко.цикл<дата.длинаЦикла,
        '22. старт год назад не выносит цикл за границы',
        'неделя '+дата.далеко.неделя+', цикл '+дата.далеко.цикл);
    chk(дата.впереди.начался===false,'23. старт в будущем — план ещё не начался',
        'started='+дата.впереди.начался);
    await шаг('24. журнал цел после игр с датой старта','void 0;');

    // --- пропуск первичной настройки не стирает журнал ---
    const пропуск = await p.evaluate(async()=>{
      const дат=Object.keys(S.rec).length, xp=num(S.xp);
      openSetup(); await new Promise(r=>setTimeout(r,200));
      document.getElementById('setSkip').click();
      await new Promise(r=>setTimeout(r,300));
      return {былоДат:дат, сталоДат:Object.keys(S.rec).length, былXp:xp, сталXp:num(S.xp),
              закрыт:!document.getElementById('setup').classList.contains('on')};
    });
    chk(пропуск.закрыт,'25. пропуск закрывает настройку',String(пропуск.закрыт));
    chk(пропуск.сталоДат===пропуск.былоДат&&пропуск.сталXp===пропуск.былXp,
        '26. и не стирает ни журнал, ни опыт',
        пропуск.былоДат+' дат / '+пропуск.былXp+' опыта → '+пропуск.сталоДат+' / '+пропуск.сталXp);
    await шаг('27. журнал цел после пропуска настройки','void 0;');

    // --- всё пережило перезагрузку ---
    await p.evaluate(()=>flush());
    await p.reload(); await p.waitForTimeout(1500);
    await p.evaluate(f=>{ window.ПРАВИЛА=eval('('+f+')'); },ПРАВИЛА.toString());
    const после=await p.evaluate(()=>{ entCache=null; return window.ПРАВИЛА(); });
    chk(после.length===0,'28. журнал цел после перезагрузки',после.slice(0,2).join(' · ')||'цел');

    chk(errs.length===0,'29. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
