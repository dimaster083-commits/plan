/* Пресс — своя мышечная группа. Пять упражнений на живот держались группой
   «Ноги»: подходы на пресс задирали ногам норму, а сам пресс нигде не был
   виден — ни в разборе, ни в диаграмме. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl','ber']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');applyTheme(s);S.sound=0;save();},skin);

    const cat=await p.evaluate(()=>{
      const abs=['Пресс','Подъём ног в висе','Планка','Скручивания на блоке','Русский твист'];
      return { нога: abs.filter(n=>EXDB[n] && EXDB[n][1]==='Ноги'),
               пресс: abs.filter(n=>EXDB[n] && EXDB[n][1]==='Пресс'),
               группы: GROUPS.map(g=>g[0]),
               норма: VOL_TARGET['Пресс'] };
    });
    chk(cat.нога.length===0,'1. ни одно упражнение на живот не числится ногами',cat.нога.join(', ')||'ни одного');
    chk(cat.пресс.length===5,'2. все пять в группе «Пресс»','их '+cat.пресс.length);
    chk(cat.группы.indexOf('Пресс')>=0,'3. «Пресс» есть в списке групп',cat.группы.join(', '));
    chk(cat.норма>0,'4. у пресса есть недельная норма подходов',String(cat.норма));

    // 5-7. журнал: подходы на пресс идут в свою группу, а не в ноги
    const vol=await p.evaluate(()=>{
      S.rec={};
      const день=S.days.find(d=>(d.ex||[]).some(e=>EXDB[e.n]&&EXDB[e.n][1]==='Пресс'));
      if(!день) return {err:'в программе нет пресса'};
      const j=день.ex.findIndex(e=>EXDB[e.n]&&EXDB[e.n][1]==='Пресс');
      // ищем ближайшую прошедшую дату этого дня недели
      let ds=today();
      for(let k=0;k<7;k++){ const d=new Date(); d.setDate(d.getDate()-k);
        if(S.days[wdOf(iso(d))]===день){ ds=iso(d); break; } }
      const r=recRW(ds); r.wo=1; r.log={};
      r.log[j]={done:1,n:день.ex[j].n,g:день.ex[j].g,s:'3',r:'15',w:0,rs:[15,15,15],vol:0,xp:12};
      entCache=null; statsDirty=true; save(); recomputeStats(1);
      const a=vol7();
      return {пресс:a['Пресс'], ноги:a['Ноги'], имя:день.ex[j].n, метка:день.ex[j].g};
    });
    chk(!vol.err,'5. пресс есть в программе',vol.err||vol.имя);
    chk(vol.метка==='Пресс','6. в программе он помечен своей группой',String(vol.метка));
    chk(vol.пресс===3&&vol.ноги===0,'7. три подхода легли в пресс, а не в ноги',JSON.stringify(vol));

    // 8-10. диаграмма рисуется по числу групп, а не пятиугольником
    const rad=await p.evaluate(()=>{
      tab='prog'; pSec='load'; render(); paintSections(); paintRadar();
      const sv=document.getElementById('rad');
      const gr=sv.querySelector('polygon.rgrid');
      const pts=gr.getAttribute('points').trim().split(/\s+/).length;
      const подписи=[...sv.querySelectorAll('text.rlab')].map(t=>t.textContent);
      // спиц нет, а кольца по четвертям нормы — есть
      const спиц=sv.querySelectorAll('line, .rspoke').length;
      const колец=sv.querySelectorAll('polygon.rstep').length;
      return {углов:pts, подписи:подписи, спиц:спиц, колец:колец, групп:GROUPS.length};
    });
    chk(rad.углов===rad.групп,'8. у фигуры столько углов, сколько групп',rad.углов+' при '+rad.групп+' группах');
    chk(rad.спиц===0&&rad.колец===9,'9. внутри девять колец шкалы и ни одной спицы',
        'колец '+rad.колец+', спиц '+rad.спиц);
    chk(rad.подписи.indexOf('ПРЕСС')>=0,'10. «ПРЕСС» подписан на диаграмме',rad.подписи.join(' · '));

    chk(errs.length===0,'11. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
