/* Добавки. Отметка приёма — это только номер строки в списке: снимка, как
   у подхода, у неё нет. Значит удаление добавки из середины обязано двигать
   отметки следом, и не только в сегодняшнем дне, а во всех датах этого же
   дня недели — иначе галочки молча съезжают на чужие строки. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const да=p=>p.evaluate(()=>{const b=[...document.querySelectorAll('.askw button')]
  .find(x=>!/отмен|нет/i.test(x.textContent)); if(b) b.click();});
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl','ber']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);

    const seed=await p.evaluate(s=>{
      S.setup=1; document.getElementById('setup').classList.remove('on'); applyTheme(s); S.sound=0;
      S.rec={};
      const d=dayOf(today());
      d.sp=[{w:'утро',n:'А',h:''},{w:'утро',n:'Б',h:''},{w:'обед',n:'В',h:''},
            {w:'вечер',n:'Г',h:''},{w:'ночь',n:'Д',h:''}];
      // прошлая дата того же дня недели
      const пр=new Date(); пр.setDate(пр.getDate()-7);
      const вчера=iso(пр);
      recRW(today()).sp={2:1,4:1};        // отмечены В и Д
      recRW(вчера).sp={2:1,4:1};
      statsDirty=true; save(); recomputeStats(1);
      tab='food'; sel=today(); render();
      return {вчера:вчера, опыт:S.xp};
    },skin);

    const было=await p.evaluate(([пр])=>({
      сегодня:Object.keys(recOf(today()).sp).map(k=>dayOf(today()).sp[+k].n).sort().join(''),
      прошлое:Object.keys(recOf(пр).sp).map(k=>dayOf(пр).sp[+k].n).sort().join(''),
      всего:dayOf(today()).sp.length
    }),[seed.вчера]);
    chk(было.сегодня==='ВД'&&было.прошлое==='ВД','1. отмечены В и Д в обоих днях',JSON.stringify(было));

    // удаляем первую добавку — все остальные съезжают на строку вверх
    await p.evaluate(()=>{ document.querySelector('#spl [data-spd="0"]').click(); });
    await p.waitForTimeout(250);
    await да(p);
    await p.waitForTimeout(350);

    const стало=await p.evaluate(([пр])=>{
      const d=dayOf(today());
      const имя=(rec,day)=>Object.keys(rec.sp).map(k=>(day.sp[+k]||{}).n||'?').sort().join('');
      return {
        список:d.sp.map(x=>x.n).join(''),
        сегодня:имя(recOf(today()), d),
        прошлое:имя(recOf(пр), dayOf(пр)),
        счётчик:document.getElementById('spCnt').textContent,
        сирот:Object.keys(recOf(today()).sp).filter(k=>!d.sp[+k]).length +
              Object.keys(recOf(пр).sp).filter(k=>!dayOf(пр).sp[+k]).length,
        опыт:S.xp
      };
    },[seed.вчера]);
    chk(стало.список==='БВГД','2. добавка убрана из списка',стало.список);
    chk(стало.сегодня==='ВД','3. сегодняшние галочки остались на В и Д',стало.сегодня);
    chk(стало.прошлое==='ВД','4. и в прошедшем дне тоже',стало.прошлое);
    chk(стало.сирот===0,'5. не осталось галочек на несуществующих строках','сирот: '+стало.сирот);
    chk(стало.счётчик==='2 / 4','6. счётчик считает по живому списку',стало.счётчик);

    // удаление отмеченной добавки снимает её опыт
    const доУдаления=стало.опыт;
    await p.evaluate(()=>{
      const j=dayOf(today()).sp.findIndex(x=>x.n==='В');
      document.querySelector('#spl [data-spd="'+j+'"]').click();
    });
    await p.waitForTimeout(250);
    await да(p);
    await p.waitForTimeout(350);
    const после=await p.evaluate(([пр])=>{
      const d=dayOf(today());
      return {
        список:d.sp.map(x=>x.n).join(''),
        сегодня:Object.keys(recOf(today()).sp).map(k=>(d.sp[+k]||{}).n||'?').sort().join(''),
        прошлое:Object.keys(recOf(пр).sp).map(k=>(dayOf(пр).sp[+k]||{}).n||'?').sort().join(''),
        опыт:S.xp
      };
    },[seed.вчера]);
    chk(после.список==='БГД','7. отмеченная добавка тоже убирается',после.список);
    chk(после.сегодня==='Д'&&после.прошлое==='Д','8. её галочки ушли, чужие остались',
        JSON.stringify([после.сегодня,после.прошлое]));
    chk(после.опыт<доУдаления,'9. и опыт за снятые галочки вернулся',доУдаления+' → '+после.опыт);

    chk(errs.length===0,'10. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
