/* Диаграмма нагрузки: шкала, подписи, фигура по данным
   и пустое состояние. Со снимками. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const DIR=require('path').join(__dirname, '..', 'out') + require('path').sep;
const src=require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED=eval('('+src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'')+')');
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const w of [320,390]){
    const p=await(await b.newContext({viewport:{width:w,height:844},deviceScaleFactor:3})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1400);
    // сперва пустой журнал
    await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');tab='prog';pSec='load';render();});
    await p.waitForTimeout(300);
    if(w===390) await p.locator('.radar').screenshot({path:DIR+'rad-empty.png'});
    await p.evaluate(SEED);
    for(const sk of ['sl']){
      await p.evaluate(s=>{void s;tab='prog';pSec='load';render();},sk);
      await p.waitForTimeout(350);
      await p.locator('.radar').screenshot({path:DIR+`rad-${sk}-${w}.png`});
      // ничего не выходит за рамку карточки
      const bad=await p.evaluate(()=>{
        const card=document.querySelector('.radar').getBoundingClientRect();
        const out=[];
        document.querySelectorAll('#rad text').forEach(t=>{
          const r=t.getBoundingClientRect();
          if(r.left<card.left-1||r.right>card.right+1) out.push(t.textContent+' ['+Math.round(r.left)+'..'+Math.round(r.right)+']');
        });
        return out;
      });
      if(bad.length) console.log('  ✗',w,sk,'подписи вылезают:',bad.join('; '));
    }
    console.log(w+'px — ок', errs.length?('ОШИБКИ '+errs.join('|')):'');
    await p.close();
  }
  await b.close(); console.log('готово');
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
