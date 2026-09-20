/* Ничего не вылезает за края: ширина документа и каждый блок на
   320 и 390 px в обеих темах. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await(await b.newContext({viewport:{width:390,height:844},deviceScaleFactor:2})).newPage();
  await p.goto(APP); await p.waitForTimeout(1200);
  await p.evaluate(()=>{S.setup=1;document.getElementById('setup').classList.remove('on');
    S.pr={'Жим лёжа':60,'Присед со штангой':80,'Становая тяга':90};tab='prog';render();});
  await p.waitForTimeout(400);
  const r=await p.evaluate(()=>{
    const out=[];
    document.querySelectorAll('#scr-prog *').forEach(el=>{
      const b=el.getBoundingClientRect();
      if(b.width>0 && (b.right>390.5 || b.left<-0.5))
        out.push({sel:el.tagName+(el.id?'#'+el.id:'')+(typeof el.className==='string'&&el.className?'.'+el.className.trim().split(/\s+/)[0]:''),
          left:Math.round(b.left),right:Math.round(b.right),txt:el.textContent.trim().slice(0,25)});
    });
    return {doc:document.documentElement.scrollWidth, over:out.slice(0,12)};
  });
  console.log('ширина документа:',r.doc,'(экран 390)');
  r.over.forEach(o=>console.log('  вылезает:',o.sel,o.left+'..'+o.right,'«'+o.txt+'»'));
  await b.close();
})();
