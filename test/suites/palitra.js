/* Чужие цвета. «Клеймо» — нейтральные поверхности с медным акцентом;
   другие заметно насыщенные цвета там чужие. «Система» — фиолетовая: синева и
   зелень в ней тоже чужие. Смотрим вычисленные стили всех видимых
   элементов на всех экранах и во всех шторках. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED = eval('(' + src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
const SHEETS = [
  ['разбор', '()=>openAnalysis()'],
  ['прогрессия', '()=>openProgression()'],
  ['история дня', "()=>{const ds=Object.keys(S.rec).filter(d=>S.rec[d].wo).sort().reverse()[0];openDayReport(ds);}"],
  ['история упражнения', '()=>openHistory(dayOf(today()).ex[0].n)'],
  ['техника', '()=>openHow(Object.keys(EXDB)[0])'],
  ['итоги месяца', "()=>monthReport(today().slice(0,7))"],
  ['итоги тренировки', "()=>{const ds=Object.keys(S.rec).filter(d=>S.rec[d].wo).sort().reverse()[0];workoutSummary(ds);}"],
  ['рацион', '()=>openRation()'],
  ['выбор упражнения', '()=>openExPicker()'],
  ['настройки', '()=>openSettings()'],
  ['первичная настройка', '()=>openSetup()'],
];
let fails = 0;
const SCAN = skin => {
  const hsl = (r,g,b) => { r/=255;g/=255;b/=255;
    const mx=Math.max(r,g,b), mn=Math.min(r,g,b), d=mx-mn, l=(mx+mn)/2;
    if(!d) return [0,0,l];
    const s=d/(1-Math.abs(2*l-1));
    let h; if(mx===r) h=60*(((g-b)/d)%6); else if(mx===g) h=60*((b-r)/d+2); else h=60*((r-g)/d+4);
    return [(h+360)%360, s, l]; };
  const parse = c => { const m=String(c).match(/rgba?\(([^)]+)\)/); if(!m) return null;
    const v=m[1].split(',').map(Number); if(v.length>3 && v[3]<0.05) return null;
    return v.slice(0,3); };
  const foreign = c => { const v=parse(c); if(!v) return null;
    const [h,s,l]=hsl(...v);
    if (l<0.04 || l>0.97) return null;            // почти чёрное и почти белое — не в счёт
    // у очень тёмных тонов насыщенность считается по крохотной разнице
    // каналов и ничего не значит: сам фон «Клейма» #0B0D0F даёт 0,15
    if (skin==='ber') return (s>0.12 && l>0.16 && !(h>=15 && h<=45 && s<=0.65)) ? [h,s,l] : null;
    // «Система»: синева и зелень чужие, фиолет и розовый — свои
    if (s<0.2) return null;
    return (h>=180 && h<250) || (h>=70 && h<180) ? [h,s,l] : null; };
  const out = [];
  const roots = [...document.querySelectorAll('.scr:not([hidden]) *, #statusbar:not([hidden]) *, #dayctx:not([hidden]) *, .tabbar *, #sh.on *, #fp.on *, #ov.on *, #setup.on *, .note.on *')];
  roots.forEach(el => {
    if (!el.getClientRects().length) return;
    const cs = getComputedStyle(el);
    [['цвет текста', cs.color], ['фон', cs.backgroundColor],
     ['рамка', cs.borderTopColor], ['рамка', cs.borderLeftColor],
     ['заливка', cs.fill], ['обводка', cs.stroke]].forEach(([what, c]) => {
      const f = foreign(c);
      if (f) out.push(what + ' ' + c + ' у ' + (el.id||el.className||el.tagName) +
        '«' + (el.textContent||'').trim().slice(0,16) + '»');
    });
    const bi = cs.backgroundImage;
    if (bi && bi !== 'none') {
      (bi.match(/rgba?\([^)]+\)/g)||[]).forEach(c => { const f=foreign(c);
        if (f) out.push('в градиенте ' + c + ' у ' + (el.id||el.className||el.tagName)); });
    }
  });
  return [...new Set(out)];
};
(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  await p.goto(APP); await p.waitForTimeout(1400);
  await p.addStyleTag({content:'*,*::before,*::after{transition:none!important;animation:none!important}'});
  await p.evaluate(SEED);
  await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on'); });
  for (const skin of ['sl','ber']) {
    await p.evaluate(s => applyTheme(s), skin);
    if (skin === 'ber') {
      const marker = await p.evaluate(() => getComputedStyle(document.querySelector('.tab.on'), '::after').backgroundColor);
      if (marker !== 'rgb(201, 138, 98)') {
        fails++;
        console.log('  ✗ ber: активная вкладка не имеет медного акцента (' + marker + ')');
      }
    }
    const all = [];
    for (const t of ['wo','prog','food','photo']) {
      await p.evaluate(tt => { tab=tt; exOpen=null; sel=today(); render(); }, t);
      await p.waitForTimeout(140);
      all.push(...(await p.evaluate(SCAN, skin)).map(x => t + ' · ' + x));
    }
    for (const sec of ['log','load','goal','prog']) {
      await p.evaluate(x => { tab='prog'; pSec=x; render(); }, sec);
      await p.waitForTimeout(160);
      all.push(...(await p.evaluate(SCAN, skin)).map(x => 'прогресс/' + sec + ' · ' + x));
    }
    await p.evaluate(() => { tab='wo'; sel=today(); exOpen=0; render(); });
    await p.waitForTimeout(160);
    all.push(...(await p.evaluate(SCAN, skin)).map(x => 'упражнение · ' + x));
    for (const [name, fn] of SHEETS) {
      await p.evaluate(f => { try{sheetClose()}catch(e){}
        ['fp','ov','setup'].forEach(id=>document.getElementById(id).classList.remove('on'));
        tab='wo'; sel=today(); exOpen=null; render(); (0,eval)('('+f+')()'); }, fn);
      await p.waitForTimeout(260);
      all.push(...(await p.evaluate(SCAN, skin)).map(x => name + ' · ' + x));
    }
    const uniq = [...new Set(all)];
    if (uniq.length) { fails += uniq.length;
      console.log('  ✗ ' + skin + ': чужих цветов ' + uniq.length);
      uniq.slice(0, 25).forEach(x => console.log('      ' + x)); }
    else console.log('  ✓ ' + skin + ': палитра чистая');
  }
  await b.close();
  console.log(fails ? 'находок: ' + fails : 'обе темы держат свою палитру');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
