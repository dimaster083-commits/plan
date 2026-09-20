/* Копирование рациона кладётся поверх дня целиком. Одно касание не должно
   молча стирать уже записанную еду. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const click=(p,re)=>p.evaluate(r=>{
  const b=[...document.querySelectorAll('.askw button')].find(x=>new RegExp(r,'i').test(x.textContent));
  if(!b) return false; b.click(); return true;},re);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl','ber']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    // вчера — полный рацион, сегодня — свой
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');applyTheme(s);S.sound=0;
      const y=iso(new Date(Date.now()-864e5));
      recRW(y).ml=[{n:'Завтрак',note:'',items:[{p:'Рис белый отварной',g:'300'}]}];
      recRW(today()).ml=[{n:'Обед',note:'',items:[{p:'Гречка отварная',g:'200'}]}];
      tab='food'; sel=today(); save(); render();},skin);
    await p.waitForTimeout(300);
    const было=await p.evaluate(()=>rnd(daySum(sel).k));
    chk(было===220,'1. в сегодняшнем дне есть еда',String(было));

    // 2. отказ оставляет день как был
    await p.evaluate(()=>{ openRation(); });
    await p.waitForTimeout(250);
    await p.evaluate(()=>document.querySelector('#shB [data-from]').click());
    await p.waitForTimeout(250);
    const q=await p.evaluate(()=>({on:document.getElementById('ask').classList.contains('on'),
                                   t:document.getElementById('askT').textContent}));
    chk(q.on&&/Заменить рацион/.test(q.t),'2. спрашивает перед заменой',q.t||'окна нет');
    chk(await click(p,'отмен|нет|не '),'3. есть кнопка отказа');
    await p.waitForTimeout(300);
    const после=await p.evaluate(()=>rnd(daySum(sel).k));
    chk(после===220,'4. отказ оставил день нетронутым',String(после));

    // 5. согласие заменяет
    await p.evaluate(()=>{ if(!document.getElementById('sh').classList.contains('on')) openRation(); });
    await p.waitForTimeout(200);
    await p.evaluate(()=>document.querySelector('#shB [data-from]').click());
    await p.waitForTimeout(250);
    chk(await click(p,'ЗАМЕНИТЬ'),'5. есть кнопка согласия');
    await p.waitForTimeout(400);
    const итог=await p.evaluate(()=>rnd(daySum(sel).k));
    chk(итог===348,'6. согласие заменило рацион на вчерашний',String(итог));
    const sheetGone=await p.evaluate(()=>document.getElementById('sh').classList.contains('on'));
    chk(!sheetGone,'7. лист закрылся после замены', sheetGone?'висит':'закрылся');

    // 8. в пустой день кладём без вопросов
    await p.evaluate(()=>{ recRW(sel).ml=[]; save(); render(); openRation(); });
    await p.waitForTimeout(250);
    await p.evaluate(()=>document.querySelector('#shB [data-from]').click());
    await p.waitForTimeout(350);
    const noAsk=await p.evaluate(()=>({ask:document.getElementById('ask').classList.contains('on'),
                                       k:rnd(daySum(sel).k)}));
    chk(!noAsk.ask&&noAsk.k===348,'8. в пустой день кладётся без лишнего вопроса',JSON.stringify(noAsk));

    // 9. пустой день не сохраняется шаблоном
    await p.evaluate(()=>{ recRW(sel).ml=[]; save(); render(); openRation(); });
    await p.waitForTimeout(250);
    await p.evaluate(()=>document.querySelector('#shB [data-save]').click());
    await p.waitForTimeout(300);
    const st=await p.evaluate(()=>({tpl:(S.tpl||[]).length,
      note:document.getElementById('noteT').textContent}));
    chk(st.tpl===0&&/ничего не записано/.test(st.note),'9. пустой рацион не уходит в шаблоны',JSON.stringify(st));

    chk(errs.length===0,'10. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
