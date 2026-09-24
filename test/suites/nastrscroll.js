/* Первичная настройка — единственный экран, через который нельзя перешагнуть:
   пока не сохранил, приложением не пользуешься. Окно центрируется, и если
   содержимое выше экрана, обрезаются ОБА конца: до кнопки «сохранить»
   не добраться ни прокруткой, ни как-либо ещё. На узком телефоне с
   открытой клавиатурой это происходит всегда. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  // маленькая высота — как на телефоне с поднятой клавиатурой
  for(const skin of ['sl']) for(const [W,H] of [[390,844],[390,560],[320,480]]){
    console.log('\n===== '+skin+' '+W+'×'+H+' =====');
    const p=await(await b.newContext({viewport:{width:W,height:H}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1200);
    const r=await p.evaluate(s=>{
      void s; S.sound=0;
      delete S.setup; openSetup();
      const окно=document.getElementById('setup');
      const карта=окно.querySelector('.setw');
      const сохранить=document.getElementById('setOk');
      const пропустить=document.getElementById('setSkip');
      const kr=карта.getBoundingClientRect();
      const ok2=сохранить?сохранить.getBoundingClientRect():null;
      const st=getComputedStyle(окно);
      return {
        выше: kr.height > окно.clientHeight,
        верхОбрезан: kr.top < -1,
        прокрутка: st.overflowY,
        можноПрокрутить: окно.scrollHeight > окно.clientHeight + 1,
        кнопкаНизу: ok2 ? Math.round(ok2.bottom) : null,
        экран: окно.clientHeight,
        высотаКарты: Math.round(kr.height),
        естьКнопки: !!(сохранить && пропустить)
      };
    },skin);
    chk(r.естьКнопки,'1. кнопки настройки на месте',String(r.естьКнопки));
    chk(!r.верхОбрезан,'2. верх окна не уехал за край экрана',
        r.верхОбрезан?('top = '+r.высотаКарты+' при экране '+r.экран):'на месте');
    // главное: если окно выше экрана, до низа обязан быть путь прокруткой
    if(r.выше){
      const докрутили=await p.evaluate(()=>{
        const окно=document.getElementById('setup');
        окно.scrollTop=окно.scrollHeight;
        const ok2=document.getElementById('setOk').getBoundingClientRect();
        return {видна: ok2.bottom <= окно.clientHeight + 2 && ok2.top >= -2,
                низ: Math.round(ok2.bottom), экран: окно.clientHeight};
      });
      chk(r.прокрутка==='auto'||r.прокрутка==='scroll',
          '3. окно настройки прокручивается',r.прокрутка);
      chk(докрутили.видна,'4. до кнопки «сохранить» можно докрутить',
          'низ кнопки '+докрутили.низ+' при экране '+докрутили.экран);
    } else {
      ok('3-4. окно помещается целиком — крутить нечего',
         r.высотаКарты+' при экране '+r.экран);
    }
    chk(errs.length===0,'5. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
