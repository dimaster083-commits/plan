/* Автопрогрессия для ленивых: подходы подхватывают вписанное число,
   прошлый раз подставляется сам, поднятый вес и новая цель по повторам
   уходят во все дни с упражнением и откатываются снятием отметки,
   «Пропуск» закрывает день без сброса серии недель. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const chk = (ok, name, info = '') => { console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '   → ' + info : '')); if (!ok) fails++; };
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  await page.goto(APP); await page.waitForTimeout(1000);
  // сегодня — тренировочный день; прошлый раз первого упражнения записан 3×7
  const name = await page.evaluate(() => {
    S.setup = 1; $('setup').classList.remove('on');
    const d = dayOf(today());
    if (d.t === 'rest') { const src = S.days.find(x => x.ex && x.ex.length); d.t = src.t; d.s = src.s; d.ex = src.ex.map(x => ({ ...x })); }
    d.ex[0].s = 3; d.ex[0].r = '6-8';
    const z = new Date(); z.setDate(z.getDate() - 7); z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
    const past = z.toISOString().slice(0, 10), pr = recRW(past);
    pr.log[0] = { done: 1, n: d.ex[0].n, g: d.ex[0].g, s: 3, r: '6-8', w: d.ex[0].w, rs: [7, 7, 7], vol: 1, xp: 1 };
    const ex = d.ex[0];
    // для надёжности прошлый раз ищется по имени — положим запись и в день недели прошлой даты
    const pd = dayOf(past); if (!pd.ex.some(e => e.n === ex.n)) { pd.t = d.t; pd.ex = d.ex.map(x => ({ ...x })); }
    save(); tab = 'wo'; sel = today(); exOpen = 0; render();
    return ex.n;
  });

  const pre = await page.evaluate(() => [...document.querySelectorAll('[data-rs]')].map(x => x.value + (x.dataset.auto === '1' ? '*' : '')));
  chk(pre.length === 3 && pre[0] === '8*' && pre[1] === '7*', 'прошлый раз 7/7/7 подставлен целью 8/7/7', pre.join(' '));

  await page.fill('[data-rs="0"]', '');
  await page.type('[data-rs="0"]', '6');
  const casc = await page.evaluate(() => [...document.querySelectorAll('[data-rs]')].map(x => x.value));
  chk(casc.join('/') === '6/6/6', 'вписанное в первый подход уходит в следующие', casc.join('/'));

  await page.fill('[data-rs="2"]', '5');
  await page.fill('[data-rs="1"]', '');
  await page.type('[data-rs="1"]', '7');
  const own = await page.evaluate(() => [...document.querySelectorAll('[data-rs]')].map(x => x.value));
  chk(own[2] === '5', 'своё число в клетке не перезаписывается', own.join('/'));

  // поднимаем вес и цель по повторам, закрываем подход с недобором низа
  const before = await page.evaluate(n => S.days.flatMap(d => d.ex).filter(e => e.n === n).map(e => [num(e.w), e.r]), name);
  await page.evaluate(() => {
    const c = document.querySelector('.ex[data-j="0"]');
    const w = c.querySelector('[data-f="w"]'); w.value = String(num(dayOf(sel).ex[0].w) + 10);
    c.querySelector('[data-f="r"]').value = '10';
    c.querySelectorAll('[data-rs]').forEach(x => { x.value = '4'; });
    toggleSet(0);
  });
  const after = await page.evaluate(n => S.days.flatMap(d => d.ex).filter(e => e.n === n).map(e => [num(e.w), e.r]), name);
  chk(after.every((x, i) => x[0] === before[i][0] + 10), 'поднятый вес стал рабочим во всех днях, хоть низ и не добран',
    JSON.stringify(before) + ' → ' + JSON.stringify(after));
  chk(after.every(x => x[1] === '10'), 'новая цель по повторам ушла во все дни', JSON.stringify(after));

  await page.evaluate(() => toggleSet(0));
  const undo = await page.evaluate(n => S.days.flatMap(d => d.ex).filter(e => e.n === n).map(e => [num(e.w), e.r]), name);
  chk(JSON.stringify(undo) === JSON.stringify(before), 'снятая отметка возвращает вес и цель', JSON.stringify(undo));

  // пропуск: день закрыт, опыт не начислен, серия считает его
  const sk = await page.evaluate(() => {
    exOpen = null; render();
    const vis = !$('skipDay').hidden, xp = S.xp;
    $('skipDay').click();
    return { vis, skip: !!recOf(sel).skip, xp: S.xp - xp, badge: $('bdg-wo').hidden, pen: $('qPen').textContent };
  });
  chk(sk.vis && sk.skip, '«Пропуск» есть и закрывает день', JSON.stringify(sk));
  chk(sk.xp === 0 && sk.badge, 'опыт не начислен, точка на вкладке погасла');
  const ser = await page.evaluate(() => {
    const m = mondayOf(today()), base = at(m);
    const was = S.rec; S.rec = {};
    // прошлая неделя: три тренировки и один пропуск кнопкой
    for (let i = 0; i < 4; i++) {
      const d = new Date(base); d.setDate(d.getDate() - 7 + i);
      const z = new Date(d); z.setMinutes(z.getMinutes() - z.getTimezoneOffset());
      S.rec[z.toISOString().slice(0, 10)] = i < 3 ? { log: {}, sp: {}, wo: 1 } : { log: {}, sp: {}, skip: 1 };
    }
    const n = streak(); S.rec = was; return n;
  });
  chk(ser === 1, 'пропущенный кнопкой день не рвёт серию недель', String(ser));
  chk(!errs.length, 'без ошибок страницы', errs.join('; '));
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(err => { console.log('FATAL ' + err.message); process.exit(1); });
