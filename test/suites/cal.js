/* Календарь журнала: месяц, год, раскрытие месяца, подписи и цветовые
   обозначения тренировок на двух месяцах записей. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const DIR=require('path').join(__dirname, '..', 'out') + require('path').sep;
const SEED=()=>{
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  [2,4,6,9,11,13,16,18,20,23,26,28].forEach(n=>{
    const ds=back(n),d=dayOf(ds),r=recRW(ds);
    if(d.t!=='rest'){r.wo=1;r.t0=Date.now()-4.2e6;r.t1=Date.now()-3.6e6;
      (d.ex||[]).forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,rs:[8,8,8],vol:24*(+e.w||0),xp:12};});}
    r.bw=String(70+n*0.06);
  });
  S.map[back(6)]=0;
  save();recomputeStats();render();
};
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const th of ['light','dark']){
    const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP);
    await p.waitForTimeout(1100);
    await p.evaluate(SEED);
    await p.evaluate(t=>{applyTheme(t);S.setup=1;document.getElementById('setup').classList.remove('on');},th);
    await p.evaluate(()=>{tab='prog';render();});
    await p.waitForTimeout(500);
    const el=await p.$('.cal');
    await el.screenshot({path:DIR+`${th}-5calendar.png`});
    // проверить кнопки календаря
    // в годовом виде стрелки листают годы, а не месяцы
    const y0=await p.evaluate(()=>calYear);
    await p.click('#pm'); await p.waitForTimeout(200);
    const y1=await p.evaluate(()=>calYear);
    await p.click('#nm'); await p.waitForTimeout(200);
    const y2=await p.evaluate(()=>calYear);
    if(!(y1===y0-1&&y2===y0)) throw new Error('стрелки года: '+y0+'→'+y1+'→'+y2);
    // журнал открывается годом: сперва проваливаемся в месяц
    const viewYear=await p.evaluate(()=>calView);
    const mob=await p.$('#cyear [data-mo]');
    if(!mob) throw new Error('в годовом виде нет месяцев');
    await mob.click(); await p.waitForTimeout(300);
    const viewMonth=await p.evaluate(()=>calView);
    const cell=await p.$('#cgrid [data-cd]');
    if(!cell) throw new Error('в месяце нет дней');
    await cell.click(); await p.waitForTimeout(300);
    const opened=await p.evaluate(()=>({sheet:document.getElementById('sh').classList.contains('on'),tab:tab}));
    await p.evaluate(()=>{try{sheetClose()}catch(e){}});
    // верхняя полоса дней
    await p.evaluate(()=>{tab='wo';render();window.scrollTo(0,0);});
    await p.waitForTimeout(300);
    const strip=await p.$('#daysbar');
    await strip.screenshot({path:DIR+`${th}-6dni.png`});
    const chip=await p.$$('#chips [data-d]');
    const before=await p.evaluate(()=>sel);
    await chip[0].click(); await p.waitForTimeout(250);
    const after=await p.evaluate(()=>sel);
    // вернуться в год кнопкой «назад» и убедиться, что вид сменился
    await p.evaluate(()=>{tab='prog';render();});
    await p.waitForTimeout(300);
    await p.click('#calBack'); await p.waitForTimeout(250);
    const viewBack=await p.evaluate(()=>calView);
    if(viewBack!=='year') throw new Error('назад из месяца не вернул в год');
    // месяцы листаются стрелками внутри месячного вида
    await p.click('#cyear [data-mo]'); await p.waitForTimeout(250);
    const m0=await p.evaluate(()=>mo);
    await p.click('#nm'); await p.waitForTimeout(200);
    const m1=await p.evaluate(()=>mo);
    if(m0===m1) throw new Error('стрелка не листает месяц');
    console.log(`${th}: годы ${y0}→${y1}→${y2}, вид ${viewYear}→${viewMonth}→${viewBack}, месяц ${m0}→${m1}, клик по дню: ${JSON.stringify(opened)}, чип: ${before}→${after}, ошибок ${errs.length}`);
    await p.close();
  }
  await b.close();
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
