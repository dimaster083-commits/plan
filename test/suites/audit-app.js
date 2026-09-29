/* Аудит всего, кроме записи тренировки: вес и цель, «Еда», добавки,
   «Прогресс», итоги, каталог, копия, офлайн-кэш и вёрстка 320–414.
   Каждый пункт — найденная ошибка: на старом коде проверка падает. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:320,height:700}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);

  // чистое состояние: шаблон вт/чт/сб/вс, журнал пуст, свой вес 80
  const сброс=()=>p.evaluate(()=>{
    S.setup=1; S.sound=0; document.getElementById('setup').classList.remove('on');
    S.rec={}; S.map={}; delete S.pause; S.days=build().days; S.kcManual=0;
    S.bw='80'; S.bw0='80'; S.goal=''; S.height=180; S.age=30; S.sex='m'; S.act='sit';
    recRW(today()).bw='80';
    applyNutri(); sel=today(); tab='wo'; save(); render();
  });

  // 1. вес 850 и −80 из «Прогресса», цель 850 и вес в «Фото» за прошлый день не пишутся
  await сброс();
  await p.evaluate(()=>{ tab='prog'; render(); });
  const kc0=await p.evaluate(()=>S.days.find(d=>d.t!=='rest').kc);
  await p.fill('#bw','850');
  const в850=await p.evaluate(()=>({bw:S.bw, rec:recOf(today()).bw, kc:S.days.find(d=>d.t!=='rest').kc}));
  await p.fill('#bw','-80');
  const вМинус=await p.evaluate(()=>({bw:S.bw, rec:recOf(today()).bw}));
  await p.evaluate(()=>document.getElementById('bw').dispatchEvent(new Event('change',{bubbles:true})));
  const поле=await p.evaluate(()=>document.getElementById('bw').value);
  await p.fill('#goalIn','850');
  const цель=await p.evaluate(()=>S.goal);
  await p.fill('#bw','82,5');
  const норм=await p.evaluate(()=>({bw:S.bw, rec:recOf(today()).bw}));
  const фото=await p.evaluate(()=>{
    const y=addDays(today(),-1); sel=y; tab='photo'; render();
    const el=document.getElementById('phW'); el.value='8500'; el.dispatchEvent(new Event('input',{bubbles:true}));
    const r={rec:recOf(y).bw||''}; el.dispatchEvent(new Event('change',{bubbles:true})); r.поле=el.value;
    sel=today(); tab='wo'; render(); return r;
  });
  chk(в850.bw==='80'&&в850.rec==='80'&&в850.kc===kc0&&вМинус.bw==='80'&&вМинус.rec==='80'&&поле==='80'&&
    цель===''&&норм.bw==='82,5'&&норм.rec==='82,5'&&фото.rec===''&&фото.поле==='',
    '1. вес вне 30–300 кг (850, −80, цель 850, «Фото» 8500) не пишется, поле возвращает записанное',
    JSON.stringify({в850,вМинус,поле,цель,норм,фото}));

  chk(errs.length===0,'99. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log(fails?'\nПРОВАЛОВ: '+fails:'\nВСЁ ЧИСТО');
  process.exit(fails?1:0);
})();
