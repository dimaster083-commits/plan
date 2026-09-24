/* Вес — одна цифра на всё приложение. Где бы его ни вписали, нормы по еде
   и поля на других вкладках должны съехать следом. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
const type=(p,id,v)=>p.evaluate(([id,v])=>{const el=document.getElementById(id);
  el.value=v; el.dispatchEvent(new Event('input',{bubbles:true}));},[id,v]);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl']){
    console.log('\n===== '+skin+' =====');
    const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1300);
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');void s;S.sound=0;
      S.kcManual=0; S.bw='72'; S.goal='95'; applyNutri(); save();
      tab='ph'; sel=today(); render();},skin);
    await p.waitForTimeout(300);
    const было=await p.evaluate(()=>({kc:dayOf(today()).kc, bw:S.bw, поле:document.getElementById('bw').value}));
    chk(было.bw==='72','1. исходный вес на месте',JSON.stringify(было));

    // вписываем вес рядом со снимком
    await type(p,'phW','80');
    await p.waitForTimeout(300);
    const стало=await p.evaluate(()=>({kc:dayOf(today()).kc, bw:S.bw,
      поле:document.getElementById('bw').value, рек:recOf(today()).bw,
      подпись:document.getElementById('kcTxt').textContent}));
    chk(стало.bw==='80','2. общий вес обновился',стало.bw);
    chk(стало.рек==='80','3. записан в журнал дня',стало.рек);
    chk(стало.поле==='80','4. поле на «Прогрессе» съехало следом',стало.поле);
    chk(стало.kc!==было.kc,'5. норма по калориям пересчитана',было.kc+' → '+стало.kc);
    chk(/80 кг/.test(стало.подпись),'6. подпись «расчёт от веса» показывает новый вес',стало.подпись);

    // прошлый день: общий вес не трогаем, но в журнал пишем
    const вчера=await p.evaluate(()=>{const d=new Date(Date.now()-864e5); return iso(d);});
    await p.evaluate(d=>{sel=d; render();},вчера);
    await p.waitForTimeout(250);
    await type(p,'phW','79');
    await p.waitForTimeout(250);
    const прош=await p.evaluate(d=>({bw:S.bw, рек:recOf(d).bw}),вчера);
    chk(прош.bw==='80','7. правка прошлого дня не меняет сегодняшний вес',прош.bw);
    chk(прош.рек==='79','8. но в журнал того дня попадает',прош.рек);

    chk(errs.length===0,'9. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
