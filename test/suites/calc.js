/* Контраст цифр в журнале по настоящим пикселям: заливка клетки
   складывается из цвета дня и насыщенности по тоннажу, посчитать
   её формулой нельзя — только снять со снимка. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const { PNG } = require('pngjs');
const src = require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED = eval('(' + src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
const lum = ([r,g,b]) => { const f=c=>{c/=255;return c<=.03928?c/12.92:Math.pow((c+.055)/1.055,2.4);};
  return .2126*f(r)+.7152*f(g)+.0722*f(b); };
const ratio = (a,b) => { const l1=Math.max(lum(a),lum(b)), l2=Math.min(lum(a),lum(b)); return (l1+.05)/(l2+.05); };
let fails=0;
(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const skin of ['sl']) {
    const p = await (await b.newContext({ viewport:{width:390,height:900}, deviceScaleFactor:2 })).newPage();
    await p.goto(APP); await p.waitForTimeout(1400);
    await p.evaluate(SEED);
    await p.evaluate(s => { S.setup=1; document.getElementById('setup').classList.remove('on'); void s;
      tab='prog'; calView='month'; mo=today().slice(0,7); render(); cal(); }, skin);
    await p.waitForTimeout(400);
    // прогон по всем шестнадцати сочетаниям «тип дня × ступень тоннажа»:
    // настоящий журнал их все сразу не даёт, а сливаться может любое
    await p.evaluate(() => {
      const T=['t-up1','t-lo1','t-up2','t-lo2'], L=['l1','l2','l3','l4'];
      [...document.querySelectorAll('#cgrid [data-cd]')].forEach((c,i)=>{
        c.className='cd in wo '+T[i%4]+' '+L[Math.floor(i/4)%4];
        if(!c.querySelector('.ok')) c.insertAdjacentHTML('afterbegin','<span class="ok">✓</span>');
        if(!c.querySelector('.dot')) c.insertAdjacentHTML('beforeend','<span class="dot"></span>');
      });
    });
    await p.waitForTimeout(200);
    // календарь лежит ниже сгиба: без прокрутки пиксели снимать неоткуда
    await p.evaluate(() => document.querySelector('#cgrid').scrollIntoView({block:'center'}));
    await p.waitForTimeout(350);
    const cells = await p.evaluate(() => [...document.querySelectorAll('#cgrid [data-cd]')]
      .map(c => { const r = c.getBoundingClientRect();
        return { ds: c.dataset.cd, cls: c.className,
                 x: Math.round(r.left + r.width/2), y: Math.round(r.top + r.height/2),
                 col: getComputedStyle(c).color }; }));
    const shot = PNG.sync.read(await p.screenshot());
    await p.evaluate(() => { const st=document.createElement('style');
      st.textContent='#cgrid [data-cd]{color:transparent!important}#cgrid [data-cd] *{color:transparent!important}';
      document.head.appendChild(st); });
    await p.waitForTimeout(200);
    const bgShot = PNG.sync.read(await p.screenshot());
    const px = (img,x,y) => { const i=(img.width*y+x)<<2; return [img.data[i],img.data[i+1],img.data[i+2]]; };
    let worst = { r: 99 };
    cells.forEach(c => {
      if (!/\bin\b/.test(c.cls)) return;
      if (c.y < 4 || c.y*2 >= bgShot.height - 2 || c.x*2 >= bgShot.width - 2) { fails++;
        console.log('  ✗ ' + skin + ' ' + c.ds + ' не попала в кадр (y=' + c.y + ')'); return; }
      const bg = px(bgShot, c.x*2, c.y*2);
      const fg = (c.col.match(/\d+/g)||[255,255,255]).slice(0,3).map(Number);
      const r = ratio(fg, bg);
      if (r < worst.r) worst = { r, ds:c.ds, cls:c.cls, fg, bg };
      if (r < 4.5) { fails++; console.log(`  ✗ ${skin} ${c.ds} [${c.cls}] контраст ${r.toFixed(2)} — цифра rgb(${fg}) на rgb(${bg})`); }
    });
    console.log(`  ${skin}: проверено ${cells.filter(c=>/\bin\b/.test(c.cls)).length} клеток, худший контраст ${worst.r.toFixed(2)} (${worst.ds})`);
    await p.close();
  }
  await b.close();
  console.log(fails ? 'находок: '+fails : 'цифры в журнале читаются на любой заливке');
  process.exit(fails?1:0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
