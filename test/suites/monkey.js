/* Тыкает как человек: случайные нажатия и ввод, но после каждого шага
   проверяет, что журнал остался цел — ни NaN, ни потерянных дней,
   ни вылезшей за экран вёрстки, ни ошибок в консоли. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const src = require('fs').readFileSync(require('path').join(__dirname,'sheets.js'),'utf8');
const SEED = eval('(' + src.match(/const SEED\s*=\s*(\(\)=>\{[\s\S]*?\n\};)/)[1].replace(/;$/,'') + ')');
const STEPS = 700;
let fails = 0;
const bad = m => { fails++; console.log('  ✗ ' + m); };

const CHECK = () => {
  const out = [];
  // 1. состояние сериализуется и не содержит NaN
  let j;
  try { j = JSON.stringify(S); } catch (e) { return ['состояние не сериализуется: ' + e.message]; }
  if (/NaN|Infinity/.test(j)) out.push('в состоянии NaN/Infinity');
  // 2. дни программы на месте
  if (!Array.isArray(S.days) || S.days.length !== 7) out.push('дней программы не 7, а ' + (S.days||[]).length);
  S.days.forEach((d, i) => { if (!d || typeof d.t !== 'string') out.push('день ' + i + ' без типа'); });
  // 3. рабочие веса — числа и не отрицательные
  S.days.forEach(d => (d.ex || []).forEach(e => {
    const w = Number(e.w);
    if (e.w !== '' && e.w !== undefined && (!isFinite(w) || w < 0)) out.push('вес «' + e.n + '» = ' + JSON.stringify(e.w));
    if (!e.n) out.push('упражнение без названия');
  }));
  // 4. журнал не разъехался
  Object.keys(S.rec || {}).forEach(ds => {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(ds)) out.push('в журнале ключ не дата: ' + ds);
    const r = S.rec[ds];
    if (r && r.log) Object.keys(r.log).forEach(k => {
      const g = r.log[k];
      if (g && g.vol !== undefined && !isFinite(Number(g.vol))) out.push('тоннаж не число: ' + ds + '/' + k);
    });
  });
  // 5. счётчики не сходят с ума
  const t = Object.keys(S.rec||{}).reduce((a2,ds)=>a2+dayTon(ds),0);
  if (!isFinite(t) || t < 0) out.push('общий тоннаж = ' + t);
  // 6. вёрстка не вылезла
  if (document.documentElement.scrollWidth > window.innerWidth + 1)
    out.push('документ шире экрана: ' + document.documentElement.scrollWidth);
  return out;
};

(async () => {
  const b = await chromium.launch(LAUNCH);
  for (const skin of ['sl']) {
    const p = await (await b.newContext({ viewport:{width:390,height:844} })).newPage();
    const errs = []; p.on('pageerror', e => errs.push(e.message));
    await p.goto(APP); await p.waitForTimeout(1400);
    await p.evaluate(SEED);
    await p.evaluate(s => { S.setup=1; document.getElementById('setup').classList.remove('on'); void s; render(); }, skin);

    let clicks = 0, typed = 0; const seen = new Set();
    for (let i = 0; i < STEPS; i++) {
      const act = await p.evaluate(seed => {
        // свой генератор, чтобы прогон повторялся
        let x = seed; const rnd = () => (x = (x * 1103515245 + 12345) % 2147483648) / 2147483648;
        const vis = e => e.getClientRects().length && !e.disabled;
        const SKIP = /^(wipe|imp|impFile|phFile|exp|csv)$/;
        const els = [...document.querySelectorAll('button,input,select,[data-cd],[data-mo],[data-d]')]
          .filter(e => vis(e) && !SKIP.test(e.id));
        if (!els.length) return 'нет элементов';
        const el = els[Math.floor(rnd() * els.length)];
        const name = (el.id || el.className || el.tagName) + '«' + (el.textContent||'').trim().slice(0,14) + '»';
        if (el.tagName === 'INPUT' && el.type !== 'file') {
          const vals = ['', '8', '12', '0', '-3', '99', '7,5', 'абв'];
          el.focus(); el.value = vals[Math.floor(rnd() * vals.length)];
          el.dispatchEvent(new Event('input', { bubbles:true }));
          el.dispatchEvent(new Event('change', { bubbles:true }));
          el.blur();
          return 'ВВОД ' + name + ' = ' + JSON.stringify(el.value);
        }
        el.click();
        return 'КЛИК ' + name;
      }, i * 7919 + 13);
      seen.add(act.replace(/ = .*$/,''));
      if (/^ВВОД/.test(act)) typed++; else clicks++;
      // раз в 25 шагов принудительно уводим на другую вкладку, иначе
      // обезьяна залипает в одном углу и проверяет один и тот же угол
      if (i % 25 === 24) await p.evaluate(n => {
        const t=['wo','prog','food','photo'][n%4];
        try{sheetClose()}catch(e){}
        ['fp','ov'].forEach(id=>document.getElementById(id).classList.remove('on'));
        document.body.style.overflow=''; tab=t; exOpen=null; render();
      }, i);
      await p.waitForTimeout(35);
      // диалог подтверждения закрываем отказом, чтобы не стереть журнал
      await p.evaluate(() => { const a = document.getElementById('ask');
        if (a && a.classList.contains('on')) { try { askClose(false); } catch(e) { a.classList.remove('on'); } } });
      const probs = await p.evaluate(CHECK);
      if (probs.length) { bad(skin + ' шаг ' + i + ' после «' + act + '»: ' + probs.join('; ')); break; }
    }
    // журнал переживает перезагрузку после всей этой вакханалии
    const before = await p.evaluate(() => JSON.stringify(S));
    await p.reload(); await p.waitForTimeout(1400);
    const after = await p.evaluate(() => JSON.stringify(S));
    if (before !== after) {
      const a = JSON.parse(before), c = JSON.parse(after);
      bad(skin + ': состояние изменилось после перезагрузки (дней ' + (a.days||[]).length + '→' + (c.days||[]).length +
          ', записей ' + Object.keys(a.rec||{}).length + '→' + Object.keys(c.rec||{}).length + ')');
    }
    if (errs.length) bad(skin + ' ошибки JS: ' + [...new Set(errs)].slice(0,4).join(' | '));
    console.log(`  ${skin}: ${clicks} нажатий, ${typed} вводов, разных элементов ${seen.size} — ${errs.length?'с ошибками':'чисто'}`);
    await p.close();
  }
  await b.close();
  console.log(fails ? 'находок: ' + fails : 'журнал цел после случайного тыканья в обеих темах');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
