/* Таймер отдыха, гонки: окно закрывается через 1,4 с после нуля — если за это
   время стартовать новый отсчёт, старый таймер прятал уже новый. Плюс окно
   уровня: две ступени подряд гасились первым таймером. */
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

    // 1. короткий отсчёт добегает до нуля и окно само гаснет
    await p.evaluate(()=>{tStart(1);});
    await p.waitForTimeout(1500);
    const midtxt=await p.evaluate(()=>document.getElementById('tmrV').textContent);
    chk(midtxt==='0:00','1. отсчёт доходит до нуля',midtxt);
    await p.waitForTimeout(700);
    const gone=await p.evaluate(()=>document.getElementById('tmr').classList.contains('on'));
    chk(!gone,'2. окно само закрывается после нуля', gone?'осталось открытым':'закрылось');

    // 3. новый подход сразу после нуля — окно должно остаться
    await p.evaluate(()=>{tStart(1);});
    await p.waitForTimeout(1300);          // ноль есть, окно ещё видно
    await p.evaluate(()=>{tStart(90);});   // закрыли следующий подход
    await p.waitForTimeout(900);           // старый таймер погасил бы окно здесь
    const st=await p.evaluate(()=>({on:document.getElementById('tmr').classList.contains('on'),
                                    v:document.getElementById('tmrV').textContent}));
    chk(st.on,'3. новый отсчёт не гасится старым окном',JSON.stringify(st));
    chk(/^1:[23]\d$/.test(st.v),'4. на табло новый отсчёт',st.v);
    await p.evaluate(()=>document.getElementById('tmrX').click());

    // 5. крестик не оставляет отложенного скрытия, которое убьёт следующий запуск
    await p.evaluate(()=>{tStart(1);});
    await p.waitForTimeout(1200);
    await p.evaluate(()=>document.getElementById('tmrX').click());
    await p.evaluate(()=>{tStart(60);});
    await p.waitForTimeout(900);
    const st2=await p.evaluate(()=>document.getElementById('tmr').classList.contains('on'));
    chk(st2,'5. после крестика таймер запускается заново', st2?'окно открыто':'окно закрыто');
    await p.evaluate(()=>document.getElementById('tmrX').click());

    // 6-7. две ступени подряд: окно уровня не должно гаснуть раньше времени
    await p.evaluate(()=>{levelUp(5);});
    await p.waitForTimeout(1800);
    await p.evaluate(()=>{levelUp(6);});
    await p.waitForTimeout(900);           // 2,3 с от первого вызова уже прошли
    const lv=await p.evaluate(()=>({on:document.getElementById('lvup').classList.contains('on'),
                                    n:document.getElementById('lvupN').textContent}));
    chk(lv.on,'6. окно второй ступени не гаснет от первого таймера',JSON.stringify(lv));
    chk(lv.n==='6','7. показана вторая ступень',lv.n);
    await p.waitForTimeout(1700);
    const lv2=await p.evaluate(()=>document.getElementById('lvup').classList.contains('on'));
    chk(!lv2,'8. окно уровня всё-таки закрывается', lv2?'висит':'закрылось');

    chk(errs.length===0,'9. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
