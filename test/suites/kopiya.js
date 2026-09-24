/* Резервная копия. Кнопка лежала внизу вкладки «Веса», под таблицей из
   двух десятков строк: самая важная кнопка в приложении была спрятана
   глубже всех. Она должна быть достижима из шестерёнки — с любого экрана,
   и должна действительно отдавать файл со всем журналом. */
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
    const ctx=await b.newContext({viewport:{width:390,height:844},acceptDownloads:true});
    const p=await ctx.newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s=>{
      S.setup=1; document.getElementById('setup').classList.remove('on'); void s; S.sound=0;
      S.bw='72'; S.goal='95'; S.rec={};
      // сегодня может быть днём отдыха — берём ближайший прошедший тренировочный
      let ds=today();
      for(let k=0;k<7;k++){ const d=new Date(); d.setDate(d.getDate()-k);
        if(dayOf(iso(d)).t!=='rest'){ ds=iso(d); break; } }
      const dd=dayOf(ds);
      const r=recRW(ds); r.wo=1; r.log={};
      (dd.ex||[]).forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:'3',r:'8',w:num(e.w),rs:[8,8,8],vol:500,xp:12};});
      statsDirty=true; save(); flush();
      tab='wo'; sel=ds; render();},skin);
    await p.waitForTimeout(300);

    // 1-2. из шестерёнки копия достижима с любого экрана
    const изШестерни=await p.evaluate(()=>{
      document.getElementById('gear').click();
      const b2=[...document.querySelectorAll('#shB [data-bk]')].map(x=>x.dataset.bk);
      return {лист:document.getElementById('sh').classList.contains('on'), кнопки:b2};
    });
    chk(изШестерни.лист,'1. шестерёнка открывает настройки',String(изШестерни.лист));
    chk(изШестерни.кнопки.join(',')==='exp,imp,csv',
        '2. в настройках есть сохранить, восстановить и CSV',изШестерни.кнопки.join(', ')||'нет ни одной');

    // 3. нажатие в настройках действительно отдаёт файл
    const dl = p.waitForEvent('download', {timeout:8000}).catch(()=>null);
    await p.evaluate(()=>{ document.querySelector('#shB [data-bk="exp"]').click(); });
    const файл = await dl;
    chk(!!файл,'3. копия из настроек скачивается', файл?файл.suggestedFilename():'файла не было');
    if(файл){
      const путь=await файл.path();
      const данные=JSON.parse(require('fs').readFileSync(путь,'utf8'));
      chk(данные.state&&данные.state.days&&данные.state.rec,'4. в файле есть журнал и программа',
          'дней '+(данные.state.days||[]).length+', дат '+Object.keys(данные.state.rec||{}).length);
      chk(Object.keys(данные.state.rec).some(k=>Object.keys(данные.state.rec[k].log||{}).length),
          '5. и закрытые подходы внутри','есть');
      chk(данные.state.bw==='72'&&данные.state.goal==='95','6. вес и цель сохранены',
          данные.state.bw+' / '+данные.state.goal);
    }

    // 7-8. и прежнее место никуда не делось, но теперь оно выше таблицы
    const вАрхиве=await p.evaluate(()=>{
      sheetClose();
      tab='prog'; pSec='prog'; render(); paintSections();
      const e=document.getElementById('exp');
      const t=document.querySelector('#wtab');
      if(!e||!t) return {нет:1};
      return {виден:e.getBoundingClientRect().height>0,
              вышеТаблицы:e.getBoundingClientRect().top < t.getBoundingClientRect().top};
    });
    chk(!вАрхиве.нет&&вАрхиве.виден,'7. во вкладке «Веса» кнопка на месте',
        вАрхиве.нет?'нет кнопки или таблицы':'видна');
    chk(вАрхиве.вышеТаблицы,'8. и стоит выше таблицы весов, а не под ней',
        вАрхиве.вышеТаблицы?'выше':'по-прежнему под таблицей');

    chk(errs.length===0,'9. без ошибок в консоли',errs.join(' | ')||'чисто');
    await ctx.close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
