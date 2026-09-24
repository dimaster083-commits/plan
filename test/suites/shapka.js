/* шапка на всех ширинах и всех ступенях: номер не должен уезжать,
   а длинные названия — ломать строку или вылезать за панель */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails=0;
(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const w of [320,360,375,390,414,430,768]) {
    const p = await (await b.newContext({ viewport:{width:w,height:844} })).newPage();
    await p.goto(APP); await p.waitForTimeout(1200);
    await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on'); save(); });
    for (const skin of ['sl']) {
      const rows = await p.evaluate(sk => {
        void sk; tab='wo'; sel=today(); exOpen=null;
        const out=[];
        for (const xp of [0, 5*500, 12*500, 20*500, 30*500, 45*500]) {
          S.xp = xp; render();
          const vis = e => !!(e && e.getClientRects().length);
          const lv=document.querySelector('.st8lv b'), lv2=document.getElementById('st8n2'),
                rk=document.getElementById('st8rank'), hex=document.querySelector('.st8lv'),
                pan=document.querySelector('.st8'), h1=document.querySelector('.st8t h1');
          const mid=e=>{const r=e.getBoundingClientRect();return [r.left+r.width/2,r.top+r.height/2];};
          const pr=pan.getBoundingClientRect();
          let bad=[];
          const num = vis(lv2)?lv2:(vis(lv)?lv:null);
          if(!num) bad.push('номера нет');
          if(vis(lv2)&&vis(lv)) bad.push('номер в двух местах');
          if(!vis(rk)) bad.push('ступени нет');
          if(num&&vis(lv2)){ const d=Math.abs(mid(lv2)[1]-mid(rk)[1]); if(d>6) bad.push('номер и ступень разошлись на '+d.toFixed(1)); }
          if(num&&!vis(lv2)){ const c=mid(hex),a=mid(num); if(Math.abs(a[0]-c[0])>2||Math.abs(a[1]-c[1])>2) bad.push('номер съехал со знака'); }
          [rk,h1,num].filter(Boolean).forEach(e=>{const r=e.getBoundingClientRect();
            if(r.right>pr.right-1||r.left<pr.left+1||r.bottom>pr.bottom-1) bad.push('«'+e.textContent.trim().slice(0,14)+'» вылезает за панель');});
          out.push({ lvl: Math.floor(xp/500)+1, rank: rk.textContent.trim(), num: num?num.textContent:'-', bad });
        }
        S.xp = 0; render();
        return out;
      }, skin);
      rows.forEach(r => {
        if (r.bad.length) { fails++; console.log(`  ✗ ${w}px ${skin} ур.${r.lvl} «${r.rank}» — ${r.bad.join('; ')}`); }
      });
      const good = rows.filter(r=>!r.bad.length).length;
      console.log(`  ${w}px ${skin}: чисто ${good}/${rows.length}  (${rows.map(r=>r.rank).join(' · ')})`);
    }
    await p.close();
  }
  await b.close();
  console.log(fails ? 'провалено: '+fails : 'шапка чиста на всех ширинах и ступенях');
  process.exit(fails?1:0);
})().catch(e=>{console.log('FATAL',e.message);process.exit(1);});
