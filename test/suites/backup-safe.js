/* Импорт обязан сначала проверить копию целиком. Неподходящий файл не имеет
   права менять уже открытый журнал, даже если в нём есть поле days. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
const fs = require('fs'), os = require('os'), path = require('path');
let fails = 0;
const chk = (ok, name, info = '') => {
  console.log((ok ? '  ✓ ' : '  ✗ ') + name + (info ? '   → ' + info : ''));
  if (!ok) fails++;
};
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-safe-'));
const file = (name, value) => {
  const target = path.join(dir, name);
  fs.writeFileSync(target, JSON.stringify(value));
  return target;
};

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 390, height: 844 } })).newPage();
  await page.goto(APP); await page.waitForTimeout(1200);
  await page.evaluate(() => {
    S.setup = 1;
    document.getElementById('setup').classList.remove('on');
    const r = recRW(today());
    r.wo = 1;
    S.bw = '73.5';
    flush(); render();
  });
  const before = await page.evaluate(() => JSON.stringify(S));
  const brokenShape = file('bad-shape.json', {
    v: 3,
    state: { days: [{ n: 'Чужой день', ex: [] }], rec: [], map: 'не объект' },
    photos: {}
  });
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.click('#imp')
  ]);
  await chooser.setFiles(brokenShape);
  await page.waitForTimeout(250);
  if (await page.locator('#ask').evaluate(el => el.classList.contains('on')))
    await page.evaluate(() => askClose(true));
  await page.waitForTimeout(400);
  const after = await page.evaluate(() => ({
    state: JSON.stringify(S),
    note: document.getElementById('noteT').textContent
  }));
  chk(after.state === before, 'битая структура не заменяет текущий журнал', after.note);
  chk(/не подошёл|поврежд|ошиб/i.test(after.note), 'человек получает понятную причину', after.note);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(err => { console.log('FATAL ' + err.message); process.exit(1); });
