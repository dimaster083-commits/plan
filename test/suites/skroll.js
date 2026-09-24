/* Позиция прокрутки. Отметил подход внизу списка — страница не должна
   прыгать наверх; то же на еде и в журнале. */
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
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s;S.sound=0;
      const d=dayOf(today());
      if(d.t==='rest'){const x=S.days.find(y=>(y.ex||[]).length); d.t=x.t; d.s=x.s; d.ex=x.ex.map(e=>({...e}));}
      save(); tab='wo'; sel=today(); exOpen=0; render();},skin);
    await p.waitForTimeout(400);

    // 1. отметка подхода не выбрасывает наверх.
    // Карточка упражнения на полном экране помещается целиком, прокручивать
    // нечего — сужаем окно, иначе проверка пройдёт впустую.
    await p.setViewportSize({width:390,height:430});
    await p.waitForTimeout(200);
    await p.evaluate(()=>window.scrollTo(0,document.body.scrollHeight));
    await p.waitForTimeout(200);
    const y0=await p.evaluate(()=>window.scrollY);
    chk(y0>50,'0. карточке есть куда прокручиваться','scrollY='+y0);
    const hit=await p.evaluate(()=>{
      const c=document.querySelector('#exl [data-go]');
      if(!c) return 'нет кнопки «закрыть подход»';
      c.click(); return '';
    });
    await p.waitForTimeout(500);
    const y1=await p.evaluate(()=>window.scrollY);
    chk(hit===''&&Math.abs(y1-y0)<80,'1. отметка подхода не прыгает наверх',hit||('было '+y0+' стало '+y1));

    await p.setViewportSize({width:390,height:844});
    await p.waitForTimeout(200);
    // 2. вкладка «еда»: добавление продукта не сбрасывает прокрутку
    await p.evaluate(()=>{tab='food'; render(); window.scrollTo(0,document.body.scrollHeight);});
    await p.waitForTimeout(400);
    const f0=await p.evaluate(()=>window.scrollY);
    chk(f0>0,'2. на еде есть что прокручивать','scrollY='+f0);
    await p.evaluate(()=>{ if(typeof paintFood==='function') paintFood(); else render(); });
    await p.waitForTimeout(300);
    const f1=await p.evaluate(()=>window.scrollY);
    chk(Math.abs(f1-f0)<80,'3. перерисовка еды не прыгает наверх','было '+f0+' стало '+f1);

    // 4. журнал: перерисовка на месте
    await p.evaluate(()=>{tab='prog'; render(); window.scrollTo(0,document.body.scrollHeight);});
    await p.waitForTimeout(400);
    const g0=await p.evaluate(()=>window.scrollY);
    await p.evaluate(()=>render());
    await p.waitForTimeout(300);
    const g1=await p.evaluate(()=>window.scrollY);
    chk(Math.abs(g1-g0)<80,'4. перерисовка журнала не прыгает наверх','было '+g0+' стало '+g1);


    chk(errs.length===0,'6. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
