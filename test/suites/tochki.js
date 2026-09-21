/* Точки-страницы в раскрытом упражнении. Восемь упражнений в дне не
   помещались в строку по 44 px, и flex ужимал их до 43 — кнопка
   становилась меньше пальца. Плюс сокращённое background сбрасывало
   background-clip обратно на border-box, и текущая страница заливалась
   квадратом 44×44 вместо полоски. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl','ber']) for(const W of [320,390]){
    console.log('\n===== '+skin+' '+W+'px =====');
    const p=await(await b.newContext({viewport:{width:W,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    const r=await p.evaluate(s=>{
      S.setup=1; document.getElementById('setup').classList.remove('on'); applyTheme(s); S.sound=0;
      // самый длинный день программы и сегодняшняя дата под него
      const день=S.days.reduce((a,d)=>((d.ex||[]).length>(a.ex||[]).length?d:a), S.days[0]);
      const ds=today();
      S.map=S.map||{}; S.map[ds]=S.days.indexOf(день);
      sel=ds; tab='wo'; exOpen=2; save(); render();
      const d=[...document.querySelectorAll('.exfdots .dot')];
      if(!d.length) return {нет:1, упр:(день.ex||[]).length};
      const c=getComputedStyle(d[2]);
      const пр=d.map(x=>x.getBoundingClientRect());
      const кор=document.querySelector('.exfdots').getBoundingClientRect();
      return {
        упр:(день.ex||[]).length,
        сколько:d.length,
        мелкие:пр.filter(x=>x.width<44||x.height<44).map(x=>Math.round(x.width)+'×'+Math.round(x.height)),
        обрезка:c.backgroundClip||c.webkitBackgroundClip,
        заКраем:пр.filter(x=>x.right>кор.right+1||x.left<кор.left-1).length,
        рядов:new Set(пр.map(x=>Math.round(x.top))).size
      };
    },skin);
    chk(!r.нет,'1. карточка раскрылась', r.нет?('упражнений в дне: '+r.упр):('точек '+r.сколько+' при '+r.упр+' упражнениях'));
    if(!r.нет){
      chk(r.сколько===r.упр,'2. точка на каждое упражнение дня',r.сколько+' из '+r.упр);
      chk(r.мелкие.length===0,'3. каждая точка не меньше пальца',r.мелкие.join(', ')||'все 44×44');
      chk(r.обрезка==='content-box','4. текущая страница рисуется полоской, а не квадратом',r.обрезка);
      chk(r.заКраем===0,'5. ни одна точка не вылезает за край',String(r.заКраем));
      chk(r.рядов<=2,'6. точки укладываются не больше чем в два ряда','рядов '+r.рядов);
    }
    chk(errs.length===0,'7. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
