/* Аудит всего, кроме записи тренировки: вес и цель, «Еда», добавки,
   «Прогресс», итоги, каталог, копия, офлайн-кэш и вёрстка 320–414.
   Каждый пункт — найденная ошибка: на старом коде проверка падает. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const fs=require('fs'), path=require('path'), vm=require('vm');

/* сервис-воркер в песочнице: кэш фото каталога с настоящим порядком ключей */
async function swCdn(){
  const src=fs.readFileSync(path.join(__dirname,'..','..','sw.js'),'utf8');
  const store=new Map();
  const open=name=>{ if(!store.has(name)) store.set(name,new Map()); const m=store.get(name);
    return { put:async(k,v)=>{ const u=typeof k==='string'?k:k.url; m.delete(u); m.set(u,v); },
      keys:async()=>[...m.keys()].map(url=>({url})), delete:async k=>m.delete(typeof k==='string'?k:k.url),
      addAll:async()=>{}, match:async()=>null }; };
  const h={};
  const ctx={ self:{addEventListener:(t,f)=>{h[t]=f;},location:{origin:'https://x'},skipWaiting(){},clients:{claim(){}}},
    caches:{open:async n=>open(n),keys:async()=>[...store.keys()],delete:async n=>store.delete(n),match:async()=>null},
    fetch:async()=>({ok:true,status:200,type:'cors',clone(){return this;}}), URL, console, Promise, setTimeout };
  vm.createContext(ctx); vm.runInContext(src,ctx);
  const N=700;
  for(let i=0;i<N;i++){
    const url='https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Ex_'+i+'/0.jpg';
    let pr; h.fetch({request:{method:'GET',mode:'cors',url},respondWith:x=>{pr=x;}}); await pr;
    await new Promise(r=>setTimeout(r,1));
  }
  await new Promise(r=>setTimeout(r,50));
  const m=store.get('sys-gym-cdn')||new Map(), ks=[...m.keys()];
  return {всего:ks.length, последнее:/Ex_699\//.test(ks[ks.length-1]||''), первоеУшло:!m.has('https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/Ex_0/0.jpg')};
}

(async()=>{
  // 5. фото каталога: кэш sys-gym-cdn не растёт без края, свежие остаются
  const cdn=await swCdn();
  chk(cdn.всего>0&&cdn.всего<=400&&cdn.последнее&&cdn.первоеУшло,
    '5. кэш фото каталога ограничен, уходят самые старые', JSON.stringify(cdn));

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

  // 2. план из трёх дней: «из 3», «нужно 2» — как считает planWeek, и в выгрузке «3 тренировки»
  await сброс();
  const цикл=await p.evaluate(()=>{
    const sat=S.days.findIndex(d=>d.k==='Сб'); S.days[sat].t='rest'; S.days[sat].ex=[];
    S.start=addDays(mondayOf(today()),-7); save(); tab='prog'; render(); paintCycle();
    return {текст:$('cycNote').textContent, нужно:weekNeed(), сводка:buildSummary().split('\n').find(l=>/^План:/.test(l))};
  });
  chk(цикл.нужно===2&&/из 3\b/.test(цикл.текст)&&!/из 4/.test(цикл.текст)&&/нужно 2\./.test(цикл.текст)&&
    /3 тренировки в неделю/.test(цикл.сводка)&&!/4 тренировки|верх\/низ дважды/.test(цикл.сводка),
    '2. три дня в шаблоне: «из 3», «нужно 2» (как planWeek), в выгрузке «3 тренировки»', JSON.stringify(цикл));

  // 3. вторник стал отдыхом во всех неделях — прошлый тренировочный вторник ест по норме тренировки
  await сброс();
  const тип=await p.evaluate(async()=>{
    const ti=S.days.findIndex(d=>d.k==='Вт'), tue=(()=>{let x=addDays(today(),-1);while(wdOf(x)!==ti)x=addDays(x,-1);return x;})();
    const r=recRW(tue); r.wo=1; r.log={0:{done:1,n:'Жим лёжа',g:'Грудь',w:'60',s:'3',r:'8',rs:[8,8,8]}};
    r.ml=blankMeals(tue); r.ml[0].items=[{p:'Овсянка',g:'100'}];
    const keep=ask; ask=()=>Promise.resolve(true);
    await setDayType(ti,'rest'); ask=keep;
    sel=tue; tab='food'; render();
    const тр=S.days.find(d=>d.t!=='rest').kc, отд=S.days.find(d=>d.t==='rest').kc;
    return {тр, отд, вид:dayLook(tue).t, норма:normDay(tue).kc, поле:$('kc').value};
  });
  chk(тип.вид!=='rest'&&тип.тр!==тип.отд&&тип.норма===тип.тр&&тип.поле===тип.тр,
    '3. смена типа дня во всех неделях: прошлая тренировка в «Еде» — с нормой тренировки', JSON.stringify(тип));

  // 4. неделя на паузе: у дня тренировки нет кофеина и цитруллина «за 45 мин до зала»; «Принял всё» их не отмечает
  await сброс();
  const доб=await p.evaluate(()=>{
    const m=mondayOf(today()), ti=S.days.findIndex(d=>d.k==='Вт'), tue=addDays(m,ti);
    S.pause={}; S.pause[m]=1; sel=tue; tab='food'; save(); render();
    const names=()=>[...document.querySelectorAll('#spl [data-sp] input[data-sf="n"]')].map(i=>i.value);
    const r={имена:names(), счёт:$('spCnt').textContent};
    $('spAll').click();
    const d=dayOf(tue); r.отмечено=Object.keys(recOf(tue).sp).map(j=>d.sp[+j].n);
    // закрыл тренировку всё-таки — полный список
    recRW(tue).wo=1; render(); r.послеЗакрытия=names().length; r.всего=d.sp.length;
    delete S.pause; sel=today(); save(); render();
    return r;
  });
  const тренДобавки=/Кофеин|Цитруллин/;
  chk(доб.имена.length>0&&!доб.имена.some(n=>тренДобавки.test(n))&&!доб.отмечено.some(n=>тренДобавки.test(n))&&
    new RegExp('^0 / '+доб.имена.length+'$').test(доб.счёт)&&доб.послеЗакрытия===доб.всего,
    '4. неделя на паузе: добавки дня тренировки — как у отдыха, закрытая тренировка возвращает список', JSON.stringify(доб));

  chk(errs.length===0,'99. без ошибок в консоли',errs.join(' | ')||'чисто');
  await b.close();
  console.log(fails?'\nПРОВАЛОВ: '+fails:'\nВСЁ ЧИСТО');
  process.exit(fails?1:0);
})();
