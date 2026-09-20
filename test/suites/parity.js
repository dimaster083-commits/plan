/* Равенство тем: на двух неделях записей обе темы показывают одни и
   те же числа, кнопки и состояния — отличаются только цвета. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');

const SEED = () => {
  const iso=d=>{const z=new Date(d);z.setMinutes(z.getMinutes()-z.getTimezoneOffset());return z.toISOString().slice(0,10);};
  const back=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d);};
  S.setup=1;S.bw='72';S.bw0='70';S.goal='95';S.height=177;S.age=30;
  for(let k=1;k<=14;k++){
    const ds=back(k),d=dayOf(ds),r=recRW(ds);
    if((d.ex||[]).length){r.wo=1;r.t0=Date.now()-4e6;r.t1=Date.now()-3.6e6;
      d.ex.forEach((e,j)=>{r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,rs:[8,8,8],vol:24*(+e.w||0),xp:12};});}
    r.bw=String(70+k*0.05);
    r.ml=[{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'}]}];
  }
  S.pr={'Жим лёжа':60}; save(); recomputeStats(); render();
};

// снимок того, что видно и на что можно нажать — без учёта подписей
const SNAP = () => {
  const acts = [];
  document.querySelectorAll('button,[data-act],input,select,textarea').forEach(el => {
    if (el.offsetParent === null) return;
    const key = el.id || el.dataset.act || [...el.attributes]
      .filter(a => a.name.startsWith('data-') && a.name !== 'data-t')
      .map(a => a.name + '=' + a.value).join(',') || el.tagName + ':' + (el.className || '');
    acts.push(key);
  });
  return acts.sort();
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(APP); await p.waitForTimeout(1300);
  await p.evaluate(SEED);
  await p.evaluate(() => { S.setup=1; document.getElementById('setup').classList.remove('on'); });

  let bad = [];
  for (const tab of ['wo','prog','food','photo']) {
    await p.evaluate(t => { applyTheme('sl'); tab = t; sel = today(); editPast = false; render(); }, tab);
    await p.waitForTimeout(250);
    const a = await p.evaluate(SNAP);
    const stA = await p.evaluate(() => JSON.stringify(S));

    await p.evaluate(() => applyTheme('ber'));
    await p.waitForTimeout(250);
    const c = await p.evaluate(SNAP);
    const stB = await p.evaluate(() => JSON.stringify(S));

    await p.evaluate(() => applyTheme('sl'));
    await p.waitForTimeout(200);
    const stC = await p.evaluate(() => JSON.stringify(S));

    if (JSON.stringify(a) !== JSON.stringify(c)) {
      const only1 = a.filter(x => !c.includes(x)), only2 = c.filter(x => !a.includes(x));
      bad.push(`[${tab}] набор действий разный: только в теме 1 → ${only1.slice(0,5)} | только в теме 2 → ${only2.slice(0,5)}`);
    }
    if (stA !== stB) bad.push(`[${tab}] состояние изменилось при переключении темы`);
    if (stA !== stC) bad.push(`[${tab}] состояние не вернулось после двух переключений`);
  }

  // словарь: ключ есть в обеих темах
  const dictGap = await p.evaluate(() => {
    const a = Object.keys(DICT.sl), b2 = Object.keys(DICT.ber);
    return { onlySl: a.filter(k => !b2.includes(k)), onlyBer: b2.filter(k => !a.includes(k)) };
  });
  if (dictGap.onlySl.length || dictGap.onlyBer.length)
    bad.push('в словаре нет пары: ' + JSON.stringify(dictGap));

  // обои и палитра действительно разные
  const look = await p.evaluate(() => {
    const g = () => { const c = getComputedStyle(document.documentElement);
      return { acc: c.getPropertyValue('--acc').trim(), wall: c.getPropertyValue('--wall').trim(),
               cut: c.getPropertyValue('--cut').trim() }; };
    applyTheme('sl'); const a = g(); applyTheme('ber'); const b3 = g(); applyTheme('sl');
    return { a, b: b3 };
  });
  if (look.a.acc === look.b.acc || look.a.wall === look.b.wall) bad.push('темы выглядят одинаково: ' + JSON.stringify(look));

  console.log(bad.length ? bad.join('\n') : '✓ каркас одинаковый, состояние не сбивается, темы различаются');
  console.log('палитра/обои:', JSON.stringify(look));
  console.log('ошибки JS:', errs.length ? [...new Set(errs)].join(' | ') : 'нет');
  await b.close();
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
