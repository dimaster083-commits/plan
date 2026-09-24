/* Дни недели наверху — кнопки, и на узком телефоне они сжимались
   уже пальца: 38,9 px на 320 и 43,7 px на 360. Семь кнопок по 44 px
   влезают в 320, если убрать поля по краям и оставить зазор 2 px. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const W of [320,360,390]){
    const p=await(await b.newContext({viewport:{width:W,height:700}})).newPage();
    await p.goto(APP); await p.waitForTimeout(1300);
    const r=await p.evaluate(()=>{ S.setup=1; document.getElementById('setup').classList.remove('on'); tab='wo'; render();
      const c=[...document.querySelectorAll('#chips .chip')].map(x=>x.getBoundingClientRect());
      return {n:c.length, minW:Math.min(...c.map(q=>q.width)), minH:Math.min(...c.map(q=>q.height)),
        left:Math.min(...c.map(q=>q.left)), right:Math.max(...c.map(q=>q.right)), vw:innerWidth}; });
    chk(r.n===7 && r.minW>=44 && r.minH>=44, W+' px: все семь дней не уже 44×44', r.minW.toFixed(1)+'×'+r.minH.toFixed(1));
    chk(r.left>=0 && r.right<=r.vw, W+' px: все семь видны без прокрутки', Math.round(r.left)+'..'+Math.round(r.right)+' из '+r.vw);
    await p.close();
  }
  await b.close();
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
