/* Таймер отдыха: запуск, обратный отсчёт, продление, стоп, переживание
   смены темы и перерисовки. Ни один прогон его до сих пор не трогал. */
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
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');applyTheme(s);S.sound=0;
      const d=dayOf(today()); if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length);d.t=x.t;d.s=x.s;d.ex=x.ex.map(e=>({...e}));}
      save(); tab='wo'; sel=today(); exOpen=0; render();},skin);
    await p.waitForTimeout(300);
    const btn=await p.$('.exfbar [id="tmrBtn"], #exl [data-tmr], .tmrb, .exf .tm');
    const started=await p.evaluate(()=>{
      const el=[...document.querySelectorAll('button')].find(x=>/⏱|таймер|отдых/i.test(x.textContent+x.getAttribute('aria-label')));
      if(!el) return {err:'кнопки таймера нет'};
      el.click();
      return { on: document.getElementById('tmr').classList.contains('on'),
               txt: document.getElementById('tmr').innerText.replace(/\n/g,' ') };
    });
    chk(started.on, '1. таймер запускается', started.err||started.txt);
    if(started.on){
      const t1=await p.evaluate(()=>document.getElementById('tmr').innerText.match(/\d+:\d\d/)?.[0]);
      await p.waitForTimeout(2200);
      const t2=await p.evaluate(()=>document.getElementById('tmr').innerText.match(/\d+:\d\d/)?.[0]);
      chk(t1&&t2&&t1!==t2, '2. отсчёт идёт', t1+' → '+t2);
      // перерисовка не сбивает
      await p.evaluate(()=>render());
      await p.waitForTimeout(400);
      const t3=await p.evaluate(()=>({on:document.getElementById('tmr').classList.contains('on'),
        t:document.getElementById('tmr').innerText.match(/\d+:\d\d/)?.[0]}));
      chk(t3.on, '3. перерисовка не гасит таймер', JSON.stringify(t3));
      // смена темы не сбивает
      await p.evaluate(s=>applyTheme(s), skin==='sl'?'ber':'sl');
      await p.waitForTimeout(300);
      const t4=await p.evaluate(()=>({on:document.getElementById('tmr').classList.contains('on'),
        t:document.getElementById('tmr').innerText.match(/\d+:\d\d/)?.[0]}));
      chk(t4.on, '4. смена темы не гасит таймер', JSON.stringify(t4));
      await p.evaluate(s=>applyTheme(s), skin);
      // длительность задаётся готовыми кнопками 60/90/120/180
      const plus=await p.evaluate(()=>{
        const before=document.getElementById('tmr').innerText.match(/\d+:\d\d/)?.[0];
        const el=[...document.querySelectorAll('#tmr button')].find(x=>x.textContent.trim()==='90');
        if(!el) return {err:'кнопки 90 нет'};
        el.click();
        return { before, after: document.getElementById('tmr').innerText.match(/\d+:\d\d/)?.[0] };
      });
      chk(!plus.err && plus.after==='1:30', '5. готовые кнопки задают длительность',
          plus.err||(plus.before+' → '+plus.after));
      // стоп
      const stop=await p.evaluate(()=>{
        const el=[...document.querySelectorAll('#tmr button')].find(x=>/стоп|×|стоп/i.test(x.textContent));
        if(!el) return {err:'кнопки стоп нет'};
        el.click();
        return { on: document.getElementById('tmr').classList.contains('on') };
      });
      chk(!stop.err && !stop.on, '6. таймер останавливается', stop.err||('открыт: '+stop.on));
    }
    if(errs.length) bad('ошибки JS',[...new Set(errs)].join(' | '));
    await p.close();
  }
  await b.close();
  console.log('\nпровалено: '+fails);
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
