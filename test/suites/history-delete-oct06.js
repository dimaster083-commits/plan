/* Removing a template exercise must keep every date's log attached to its
   own movement, including nameless drafts and a selected-day once Proxy. */
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let fails = 0;
function check(value, name, detail) {
  if (!value) fails++;
  console.log(`  ${value ? '✓' : '✗'} ${name}${detail ? ' → ' + JSON.stringify(detail) : ''}`);
}
async function removeFirst(page) {
  await page.evaluate(() => { sel = today(); tab = 'wo'; exOpen = null; editPast = false; render(); });
  await page.locator('.exrow[data-open="0"]').click();
  await page.locator('[data-del="0"]').click();
  await page.waitForSelector('#ask.on');
  await page.locator('#askY').click();
  await page.waitForFunction(() => dayOf(today()).ex.length === 1);
  await page.waitForFunction(() => !document.getElementById('undo').hidden ||
    document.getElementById('ask').classList.contains('on') && /В журнале/.test(document.getElementById('askT').textContent));
  if (await page.locator('#ask').evaluate(e => e.classList.contains('on'))) await page.locator('#askN').click();
  await page.waitForFunction(() => !document.getElementById('undo').hidden);
}
const snapshot = () => JSON.stringify({ days: S.days, rec: S.rec, once: S.once, vol: S.vol, xp: S.xp, pr: S.pr });
(async () => {
  const browser = await chromium.launch(LAUNCH), errors = [];
  try {
    for (const useOnce of [true, false]) {
      const context = await browser.newContext({ viewport: { width: 320, height: 700 } });
      const page = await context.newPage(); page.on('pageerror', e => errors.push(e.message));
      await page.goto(APP); await page.waitForSelector('#setup.on');
      const dates = await page.evaluate(useOnce => {
        S.setup = 1; S.sound = 0; S.bw = 72; S.days = build().days; S.rec = {}; S.map = {};
        S.once = {}; S.pr = {}; S.vol = {}; S.start = mondayOf(today());
        document.getElementById('setup').classList.remove('on');
        const now = today(), past = addDays(now, -7), future = addDays(now, 7), other = addDays(now, 14);
        const d = S.days[dayIdx(now)]; d.t = 'up1'; d.s = 'Проверка удаления';
        d.ex = [{ n: 'Жим лёжа', s: 3, r: '8-10', w: 60, g: 'Грудь' },
          { n: 'Тяга штанги в наклоне', s: 2, r: '8-10', w: 40, g: 'Спина' }];
        if (useOnce) S.once[now] = { 'Жим лёжа': { n: 'Жим гантелей лёжа', s: 3, r: '8-10', w: 25, g: 'Грудь' } };
        S.once[other] = { 'Жим лёжа': { n: 'Разовая замена будущего дня', s: 3, r: '8-10', w: 22, g: 'Грудь' } };
        S.rec[past] = { log: {
          0: { n: 'Жим лёжа', done: 1, s: 3, r: '10', w: 60, rs: [10, 10, 10], vol: 1800, xp: 100, g: 'Грудь' },
          1: { n: 'Тяга штанги в наклоне', done: 1, s: 2, r: '10', w: 40, rs: [10, 10], vol: 800, xp: 100, g: 'Спина' }
        }, sp: {}, wo: 1 };
        S.rec[now] = { log: { 0: { w: 25, rs: [7, 8] }, 1: { w: 42, rs: [9, 8] } }, sp: {}, wo: 0 };
        S.rec[future] = { log: { 0: { w: 65, rs: [7, 6] }, 1: { w: 43, rs: [8, 7] } }, sp: {}, wo: 0 };
        S.rec[other] = { log: { 0: { w: 22, rs: [6, 5] }, 1: { w: 44, rs: [9, 7] } }, sp: {}, wo: 0 };
        sel = now; tab = 'wo'; exOpen = null; editPast = false; save(); render(); flush();
        return { now, past, future, other };
      }, useOnce);
      const mode = useOnce ? 'С разовой заменой' : 'Без разовой замены';
      const before = await page.evaluate(snapshot);
      const stats = await page.evaluate(() => JSON.stringify({ vol: S.vol, xp: S.xp, pr: S.pr }));
      await removeFirst(page);
      const after = await page.evaluate(d => ({
        row: recOf(d.past).log[0], past: dayEntries(d.past).map(e => [e.n, e.w, e.vol]).sort(),
        current: recOf(d.now).log[0], future: recOf(d.future).log, other: recOf(d.other).log,
        stats: JSON.stringify({ vol: S.vol, xp: S.xp, pr: S.pr }), ton: dayTon(d.past)
      }), dates);
      await page.locator('#undoB').click();
      await page.waitForFunction(() => dayOf(today()).ex.length === 2);
      check(await page.evaluate(snapshot) === before, mode + ': Отмена точно возвращает программу, журнал и счёт');
      check(after.row && after.row.n === 'Тяга штанги в наклоне' && after.row.w === 40, mode + ': прошлый жим не попадает в карточку тяги', after.row);
      check(after.current && after.current.w === 42 && after.current.n === 'Тяга штанги в наклоне' && after.current.rs.join() === '9,8', mode + ': черновик выбранной даты остаётся у тяги', after.current);
      check(after.future[0] && after.future[1] && after.future[0].w === 43 && after.future[0].n === 'Тяга штанги в наклоне' && after.future[1].w === 65 && after.future[1].n === 'Жим лёжа', mode + ': чужой черновик использует прежнее имя шаблона', after.future);
      check(after.other[0] && after.other[1] && after.other[0].w === 44 && after.other[0].n === 'Тяга штанги в наклоне' && after.other[1].w === 22 && after.other[1].n === 'Разовая замена будущего дня', mode + ': другая разовая замена сохраняет собственное имя', after.other);
      check(after.stats === stats && after.ton === 2600 && JSON.stringify(after.past) === JSON.stringify([['Жим лёжа', 60, 1800], ['Тяга штанги в наклоне', 40, 800]]), mode + ': закрытая история, тоннаж, опыт и рекорды сохранены', after.past);
      await page.waitForFunction(() => performance.now() - lastTap.t >= UNDO_TAP_MS);
      await removeFirst(page);
      await page.evaluate(d => { sel = d.past; exOpen = 0; editPast = true; render(); flush(); }, dates);
      check(await page.locator('.exfkg').inputValue() === '40', mode + ': карточка прошлой тяги показывает свои 40 кг');
      await page.reload(); await page.waitForFunction(() => typeof render === 'function');
      await page.evaluate(d => { sel = d.past; tab = 'wo'; exOpen = 0; editPast = true; render(); }, dates);
      check(await page.locator('.exfkg').inputValue() === '40' && await page.evaluate(d => dayTon(d.past) === 2600 && recOf(d.future).log[0].w === 43, dates), mode + ': после перезагрузки история и черновики привязаны верно');
      await context.close();
    }
    check(errors.length === 0, 'Нет ошибок JavaScript', errors);
  } finally { await browser.close(); }
  console.log(`history-delete-oct06: ${fails} failed`); process.exitCode = fails ? 1 : 0;
})().catch(e => { console.error(e); process.exitCode = 1; });
