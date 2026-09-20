/* Вид списка продуктов с крестиком у своих: ничего не должно вылезать за
   край, наезжать на подпись или быть меньше пальца. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
const ok=(n,d)=>console.log('  ✓ '+n+(d?'   → '+d:''));
const bad=(n,d)=>{fails++;console.log('  ✗ '+n+(d?'   → '+d:''));};
const chk=(c,n,d)=>c?ok(n,d):bad(n,d);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  for(const skin of ['sl','ber']) for(const W of [320,390]){
    console.log('\n===== '+skin+' '+W+'px =====');
    const p=await(await b.newContext({viewport:{width:W,height:844}})).newPage();
    const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1200);
    await p.evaluate(s=>{S.setup=1;document.getElementById('setup').classList.remove('on');applyTheme(s);S.sound=0;
      S.myFood=[{n:'Шаурма у дома на углу возле остановки',k:250,p:12,f:10,c:25},
                {n:'Творог',k:120,p:18,f:5,c:3}];
      invalidateFood(); save(); tab='food'; sel=today(); render(); openPick(0);},skin);
    await p.waitForTimeout(400);
    await p.evaluate(()=>{const q=document.getElementById('fq'); q.value='Творог';
      q.dispatchEvent(new Event('input',{bubbles:true}));});
    await p.waitForTimeout(300);

    const r=await p.evaluate(()=>{
      const out={за:[],мелкие:[],наезд:[]};
      const лист=document.getElementById('fpl');
      const кр=лист.getBoundingClientRect();
      лист.querySelectorAll('.fpdel').forEach(d=>{
        const b=d.getBoundingClientRect();
        if(b.right>кр.right+1||b.left<кр.left-1) out.за.push(d.dataset.my+' '+Math.round(b.right)+'>'+Math.round(кр.right));
        if(b.width<44||b.height<44) out.мелкие.push(d.dataset.my+' '+Math.round(b.width)+'×'+Math.round(b.height));
        const тx=d.parentElement.querySelector('.tx');
        if(тx){ const t=тx.getBoundingClientRect();
          if(t.right>b.left+1) out.наезд.push(d.dataset.my+': текст до '+Math.round(t.right)+', крестик с '+Math.round(b.left)); }
      });
      const свои=[...лист.querySelectorAll('.fpi.my')];
      out.своих=свои.length;
      out.безКрестика=свои.filter(x=>!(x.parentElement.classList.contains('fpw')
        && x.parentElement.querySelector('.fpdel'))).map(x=>x.dataset.add);
      out.чужихСКрестиком=[...лист.querySelectorAll('.fpi:not(.my)')].filter(x=>
        x.parentElement.classList.contains('fpw')).map(x=>x.dataset.add);
      // ничего не вылезает за правый край списка целиком
      out.шире=[...лист.querySelectorAll('.fpi,.fpw')].filter(x=>
        x.getBoundingClientRect().right>кр.right+1).map(x=>x.textContent.slice(0,20));
      return out;
    });
    chk(r.своих>=1&&r.безКрестика.length===0,'1. у каждого своего продукта есть крестик',
        'своих в списке '+r.своих+(r.безКрестика.length?', без крестика: '+r.безКрестика.join(', '):''));
    chk(r.чужихСКрестиком.length===0,'2. у продуктов из базы крестика нет',
        r.чужихСКрестиком.join(', ')||'ни одного');
    chk(r.за.length===0,'3. крестик не вылезает за край',r.за.join(', ')||'в пределах');
    chk(r.мелкие.length===0,'4. крестик не меньше пальца',r.мелкие.join(', ')||'все 44+');
    chk(r.наезд.length===0,'5. название не наезжает на крестик',r.наезд.join(', ')||'не наезжает');
    chk(r.шире.length===0,'6. строки не шире списка',r.шире.join(', ')||'по ширине');
    chk(errs.length===0,'7. без ошибок в консоли',errs.join(' | ')||'чисто');
    await p.context().close();
  }
  await b.close();
  console.log('\nпроблем: '+fails);
  process.exit(fails?1:0);
})();
