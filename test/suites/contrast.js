/* Контраст текста на фоне по настоящим пикселям — грубая проверка
   обеих тем целиком. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');

const SEED = () => {
  const iso = d => { const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset()); return z.toISOString().slice(0,10); };
  const back = n => { const d = new Date(); d.setDate(d.getDate() - n); return iso(d); };
  S.setup = 1; S.bw = '72'; S.bw0 = '70'; S.goal = '95'; S.height = 177; S.age = 30;
  [1,2,3,5,8,10,12,15].forEach(n => {
    const ds = back(n), d = dayOf(ds), r = recRW(ds);
    if (d.t !== 'rest') {
      r.wo = 1; r.t0 = Date.now() - 4e6; r.t1 = Date.now() - 3.6e6;
      (d.ex || []).forEach((e, j) => {
        r.log[j] = { done: 1, n: e.n, g: e.g, s: e.s, r: String(e.r), w: e.w,
          rs: [8,8,8,8].slice(0, +e.s || 3), vol: 8 * 3 * (+e.w || 0), xp: 12, prevPr: 5 };
      });
    }
    r.bw = String(70 + n * 0.1);
    r.ml = [{ n: 'Завтрак', note: '', items: [{ p: 'Овсянка', g: '100' }] }];
  });
  S.pr = { 'Жим лёжа': 60, 'Присед со штангой': 80 };
  save(); render();
};

async function audit(theme) {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' })).newPage();
  const errs = [];
  page.on('pageerror', e => errs.push('PAGEERROR: ' + e.message));
  await page.goto(APP);
  await page.waitForTimeout(400);
  await page.evaluate(SEED);
  await page.evaluate(t => { void t; S.setup=1; document.getElementById('setup').classList.remove('on'); }, theme);
  await page.waitForTimeout(300);

  const findings = [];
  for (const t of ['wo','prog','food','photo']) {
    await page.evaluate(tb => { tab = tb; render(); }, t);
    await page.waitForTimeout(350);
    const bad = await page.evaluate(scr => {
      const px = c => { const m = String(c).match(/[\d.]+/g); return m ? m.map(Number) : null; };
      const lum = ([r,g,b]) => { const f = v => { v /= 255; return v <= .03928 ? v/12.92 : Math.pow((v+.055)/1.055, 2.4); };
        return .2126*f(r) + .7152*f(g) + .0722*f(b); };
      const ratio = (a,b) => { const l1 = lum(a), l2 = lum(b); return (Math.max(l1,l2)+.05)/(Math.min(l1,l2)+.05); };
      // настоящий фон: поднимаемся вверх, пока не встретим непрозрачный
      const bgOf = el => {
        let n = el, acc = null;
        while (n && n.nodeType === 1) {
          const c = px(getComputedStyle(n).backgroundColor);
          if (c && (c[3] === undefined || c[3] >= .999)) return acc ? blend(acc, c) : c;
          if (c && c[3] > 0) acc = acc ? mix(acc, c) : c.slice();
          n = n.parentElement;
        }
        return [255,255,255];
      };
      const blend = (top, base) => top.slice(0,3).map((v,i) => Math.round(v*(top[3]??1) + base[i]*(1-(top[3]??1))));
      const mix = (a,b) => a;
      const out = [];
      document.querySelectorAll(scr + ' *').forEach(el => {
        const txt = [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
        if (!txt) return;
        const r = el.getBoundingClientRect();
        if (!r.width || !r.height || el.offsetParent === null) return;
        const st = getComputedStyle(el);
        if (st.visibility === 'hidden' || +st.opacity === 0) return;
        const fg = px(st.color); if (!fg) return;
        if (fg[3] !== undefined && fg[3] < .1) return;
        const bg = bgOf(el);
        const rr = ratio(fg.slice(0,3), bg.slice(0,3));
        const size = parseFloat(st.fontSize), bold = +st.fontWeight >= 600;
        const need = (size >= 24 || (size >= 18.66 && bold)) ? 3 : 4.5;
        if (rr < need) out.push({ sel: el.tagName.toLowerCase() + (el.id ? '#'+el.id : '') + (el.className && typeof el.className === 'string' ? '.'+el.className.trim().split(/\s+/).join('.') : ''),
          text: el.textContent.trim().slice(0, 40), ratio: +rr.toFixed(2), need: need, color: st.color, bg: 'rgb('+bg.slice(0,3).join(',')+')' });
      });
      return out;
    }, '#scr-' + t);
    bad.forEach(b => findings.push({ tab: t, ...b }));
  }
  await page.screenshot({ path: require('path').join(__dirname, '..', 'out', `shot-${theme}.png`), fullPage: false });
  await browser.close();
  return { findings, errs };
}

(async () => {
  for (const th of ['sl']) {
    const { findings, errs } = await audit(th);
    console.log(`\n===== ${th.toUpperCase()} =====`);
    if (errs.length) console.log('ОШИБКИ JS:', errs.join('\n'));
    const seen = new Set();
    const uniq = findings.filter(f => { const k = f.sel + f.ratio; if (seen.has(k)) return false; seen.add(k); return true; });
    if (!uniq.length) { console.log('контраст везде в норме'); continue; }
    uniq.sort((a,b) => a.ratio - b.ratio).slice(0, 25).forEach(f =>
      console.log(`  ${f.ratio} (нужно ${f.need})  [${f.tab}] ${f.sel}\n      "${f.text}"  ${f.color} на ${f.bg}`));
    console.log('  всего:', uniq.length);
  }
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
