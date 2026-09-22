/* Переживает ли всё перезагрузку: журнал, веса, рацион, тема и
   выбранный день после закрытия вкладки. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const out=[]; const ok=(n,c,d)=>out.push((c?'  ✓ ':'  ✗ ')+n+(c?'':'   → '+d));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1700);

  // пишем данные как человек: через интерфейс, без save() руками
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
    const d=dayOf(today()); if(d.t==='rest'){const s2=S.days.find(x=>(x.ex||[]).length);d.t=s2.t;d.s=s2.s;d.ex=s2.ex.map(e=>({...e}));}
    tab='wo';sel=today();exOpen=null;render();});
  await p.waitForTimeout(300);
  await p.click('#exl [data-open="0"]'); await p.waitForTimeout(400);
  const f=await p.$('.exfkg'); await f.click({clickCount:3}); await p.keyboard.type('37,5');
  await p.waitForTimeout(200);
  await p.evaluate(()=>{document.querySelector('.exfkg').blur(); toggleSet(0);});
  await p.waitForTimeout(600);
  const before=await p.evaluate(()=>({w:recOf(today()).log[0].w, done:recOf(today()).log[0].done,
    vol:JSON.stringify(S.vol), xp:S.xp}));

  // обычная перезагрузка
  await p.reload(); await p.waitForTimeout(1800);
  const after=await p.evaluate(()=>({w:(recOf(today()).log[0]||{}).w, done:(recOf(today()).log[0]||{}).done,
    vol:JSON.stringify(S.vol), xp:S.xp}));
  ok('записанное переживает перезагрузку',
     before.w===after.w && before.done===after.done && before.vol===after.vol && before.xp===after.xp,
     JSON.stringify(before)+' → '+JSON.stringify(after));

  // тема тоже
  await p.evaluate(()=>applyTheme('ber'));
  await p.reload(); await p.waitForTimeout(1700);
  const sk=await p.evaluate(()=>skinNow());
  ok('выбранная тема переживает перезагрузку', sk==='ber', sk);

  // Ошибка записи не должна выглядеть как успешно сохранённые данные.
  const saveFailure=await p.evaluate(()=>{
    const old=localStorage.setItem;
    localStorage.setItem=()=>{throw new DOMException('quota','QuotaExceededError');};
    S.bw='74'; flush();
    const el=document.querySelector('[data-save-state]');
    const result={state:el&&el.dataset.saveState,text:document.getElementById('noteT').textContent};
    localStorage.setItem=old;
    return result;
  });
  ok('отказ сохранения виден человеку',saveFailure.state==='failed'&&/сохран/i.test(saveFailure.text),JSON.stringify(saveFailure));

  // «Начать заново» стирает по-настоящему
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');tab='prog';pSec='prog';render();});
  await p.waitForTimeout(400);
  await p.click('#wipe'); await p.waitForTimeout(400);
  await p.click('#askY'); await p.waitForTimeout(500);
  await p.click('#askY'); await p.waitForTimeout(2200);
  const wiped=await p.evaluate(()=>({raw:localStorage.getItem('sys-gym-v3'), rec:Object.keys(S.rec||{}).length}));
  ok('«Начать заново» стирает и не возвращает данные назад',
     (wiped.raw===null||JSON.parse(wiped.raw||'{}').rec===undefined||Object.keys(JSON.parse(wiped.raw||'{"rec":{}}').rec||{}).length===0)
     && wiped.rec===0,
     'в хранилище '+(wiped.raw?Object.keys(JSON.parse(wiped.raw).rec||{}).length+' дней':'пусто')+', в памяти '+wiped.rec);

  console.log(out.join('\n'));
  console.log('ошибки JS:', errs.length?[...new Set(errs)].slice(0,3).join(' | '):'нет');
  await b.close();
})().catch(e=>{console.log(out.join('\n'));console.log('FATAL',e.message);process.exit(1);});
