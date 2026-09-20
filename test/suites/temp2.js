/* «ТЕМП» в разборе: коридор называется 0,3–0,5, а нормой считалось всё
   от 0,1 до 0,7. И при перелёте цели он всё ещё считал, сколько осталось. */
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

  // темп задаётся двумя взвешиваниями: 14 дней назад и сегодня
  const tempo=(from,to,goal)=>p.evaluate(([from,to,goal])=>{
    S.rec={}; S.goal=String(goal); S.bw=String(to);
    const d=new Date(); d.setDate(d.getDate()-14);
    recRW(iso(d)).bw=String(from);
    recRW(today()).bw=String(to);
    save();
    const f=analyze().find(x=>x.title==='ТЕМП');
    return f?{lvl:f.lvl,text:f.text.replace(/<[^>]+>/g,''),task:f.task}:null;
  },[from,to,goal]);

  const a=await tempo(80,80.3,95);   // 0,15 кг/нед
  chk(a&&/медленнее коридора/.test(a.text),'1. 0,15 кг/нед больше не зовётся нормой',a?a.text:'нет блока');
  const b2=await tempo(80,80.8,95);  // 0,40 кг/нед
  chk(b2&&/в коридоре 0,3–0,5/.test(b2.text),'2. 0,40 кг/нед — в коридоре',b2?b2.text:'нет блока');
  const c=await tempo(80,81.2,95);   // 0,60 кг/нед
  chk(c&&/чуть быстрее коридора/.test(c.text),'3. 0,60 кг/нед — чуть быстрее коридора',c?c.text:'нет блока');
  const d=await tempo(94,94.8,95);   // цель почти достигнута
  chk(d&&/расчётный срок/.test(d.text),'4. до цели срок считается',d?d.text:'нет блока');
  const e=await tempo(95,95.2,95);   // цель чуть позади, движение вперёд
  chk(e&&/уже пройдена/.test(e.text),'5. при перелёте не врёт про «остаётся»',e?e.text:'нет блока');
  chk(e&&/новую цель/.test(e.task),'6. и предлагает поставить новую цель',e?e.task:'—');
  const e2=await tempo(95,95.8,95);  // цель снизу, а вес растёт
  chk(e2&&/обратную цели/.test(e2.text),'6б. движение от цели не зовётся «стоит на месте»',e2?e2.text:'нет блока');
  chk(e2&&!/Снижение \+/.test(e2.text),'6в. прибавка не называется снижением',e2?e2.text:'нет блока');
  // срок никогда не 0 недель
  const g=await tempo(94.9,95.3,95);
  chk(!g||!/срок 0 нед/.test(g.text),'7. срок не бывает нулевым',g?g.text:'нет блока');

  chk(errs.length===0,'8. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
