/* Глубокий прогон на месяце записей: цифры статистики, журнал, разбор
   и переходы между вкладками — всё подряд, с ловлей ошибок JS. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');

const SEED = () => {
  const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes()-z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
  const back = n => { const d = new Date(); d.setDate(d.getDate()-n); return iso(d); };
  S.setup=1; S.bw='72'; S.bw0='70'; S.goal='95'; S.height=177; S.age=30;
  [1,2,3,5,7,8,10,12,15,20,30].forEach(n => {
    const ds = back(n), d = dayOf(ds), r = recRW(ds);
    if (d.t !== 'rest') { r.wo=1; r.t0=Date.now()-4e6; r.t1=Date.now()-3.6e6;
      (d.ex||[]).forEach((e,j) => { r.log[j]={done:1,n:e.n,g:e.g,s:e.s,r:String(e.r),w:e.w,
        rs:[8,8,8,8].slice(0,+e.s||3),vol:24*(+e.w||0),xp:12,prevPr:(+e.w||0)-2}; }); }
    r.bw = String(70+n*0.05);
    r.ml = [{n:'Завтрак',note:'',items:[{p:'Овсянка на воде готовая',g:'250'}]}];
  });
  S.pr = {'Жим лёжа':60,'Присед со штангой':80};
  S.tpl = [{n:'Обычный день',ml:[{n:'Завтрак',note:'',items:[]}]}];
  save(); render();
};

async function run(theme) {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport:{width:390,height:844}, colorScheme:theme })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  page.on('console', m => { if (m.type()==='error') errs.push('CONSOLE: ' + m.text()); });
  page.on('dialog', d => d.dismiss().catch(()=>{}));
  await page.goto(APP);
  await page.waitForTimeout(1200);
  await page.evaluate(SEED);

  const reset = t => page.evaluate(tb => {
    S.setup = 1;
    try { sheetClose(); } catch(e){}
    try { askClose(false); } catch(e){}
    ['fp','ov','setup'].forEach(id => { const e=document.getElementById(id); if(e) e.classList.remove('on'); });
    document.body.style.overflow = '';
    if (tb) { tab = tb; render(); }
  }, t);

  // подпись кнопки — стабильный ключ, переживающий перерисовку
  const list = () => page.$$eval('button', bs => bs.map(b => ({
    key: (b.id||'') + '|' + (typeof b.className==='string'?b.className:'') + '|' +
         (b.dataset.j??b.dataset.d??b.dataset.cd??b.dataset.day??b.dataset.go??b.dataset.rest??
          b.dataset.del??b.dataset.tog??b.dataset.spd??b.dataset.mv??b.dataset.t??b.dataset.how??
          b.dataset.hist??b.dataset.fill??b.dataset.rm??b.dataset.pick??b.dataset.mld??'') + '|' +
         b.textContent.trim().slice(0,22),
    vis: b.offsetParent !== null && !b.disabled && b.getBoundingClientRect().width > 0,
    id: b.id
  })));

  const SKIP = /^(wipe|exp|imp|csv|impFile|phFile)$/;
  let clicks = 0; const covered = new Set();

  for (const t of ['wo','prog','food','photo']) {
    await reset(t); await page.waitForTimeout(300);
    for (let pass = 0; pass < 4; pass++) {
      const items = await list();
      let progressed = false;
      for (const it of items) {
        if (!it.vis || SKIP.test(it.id) || covered.has(t + it.key)) continue;
        covered.add(t + it.key); progressed = true;
        const h = await page.$(`button >> nth=${items.indexOf(it)}`).catch(()=>null);
        // найти заново по ключу — индекс мог съехать
        const target = await page.evaluateHandle(k => {
          const bs = [...document.querySelectorAll('button')];
          return bs.find(b => ((b.id||'')+'|'+(typeof b.className==='string'?b.className:'')+'|'+
            (b.dataset.j??b.dataset.d??b.dataset.cd??b.dataset.day??b.dataset.go??b.dataset.rest??
             b.dataset.del??b.dataset.tog??b.dataset.spd??b.dataset.mv??b.dataset.t??b.dataset.how??
             b.dataset.hist??b.dataset.fill??b.dataset.rm??b.dataset.pick??b.dataset.mld??'')+'|'+
            b.textContent.trim().slice(0,22)) === k) || null;
        }, it.key);
        const el = target.asElement();
        if (!el) continue;
        await el.click({ timeout: 1200, force: true }).catch(()=>{});
        clicks++;
        await page.waitForTimeout(70);

        // потыкать внутри открывшейся шторки
        const ov = await page.evaluate(() => ['sh','fp','ov'].find(id => {
          const e = document.getElementById(id); return e && e.classList.contains('on'); }) || null);
        if (ov) {
          const root = ov === 'sh' ? '#shB' : '#' + ov;
          const kids = await page.$$(`${root} button`);
          for (const k of kids.slice(0, 10)) {
            const kk = await k.evaluate(b => b.offsetParent !== null && !b.disabled && b.id !== 'csvSheet').catch(()=>false);
            if (!kk) continue;
            await k.click({ timeout: 900, force: true }).catch(()=>{});
            clicks++;
            await page.waitForTimeout(50);
            await page.evaluate(() => { try { askClose(false); } catch(e){} });
          }
        }
        await reset(null);
        // вернуться на свою вкладку, если кнопка увела
        const cur = await page.evaluate(() => tab);
        if (cur !== t) await reset(t);
        await page.waitForTimeout(40);
        const alive = await page.evaluate(id => { const s = document.querySelector(id);
          return !!s && s.classList.contains('on') && s.textContent.trim().length > 20; }, '#scr-' + t);
        if (!alive) errs.push('экран ' + t + ' опустел после: ' + it.key);
      }
      if (!progressed) break;
      await page.waitForTimeout(100);
    }
  }
  await browser.close();
  return { clicks, covered: covered.size, errs };
}

(async () => {
  for (const th of ['light','dark']) {
    const r = await run(th);
    console.log(`\n=== ${th.toUpperCase()} === нажатий: ${r.clicks}, разных кнопок: ${r.covered}`);
    console.log(r.errs.length ? [...new Set(r.errs)].slice(0,25).join('\n') : 'ошибок нет');
  }
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
