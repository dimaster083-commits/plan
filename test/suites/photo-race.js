/* A slow photo operation must keep the date on which it began. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');

let failures = 0;
function check(ok, name, detail) {
  console.log(`  ${ok ? '✓' : '✗'} ${name}${detail ? ' — ' + detail : ''}`);
  if (!ok) failures++;
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext()).newPage();
  await page.goto(APP);
  await page.waitForTimeout(1000);
  const dates = await page.evaluate(() => {
    const a = new Date(today() + 'T12:00:00');
    a.setDate(a.getDate() - 1);
    const old = a.toISOString().slice(0, 10), current = today();
    S.setup = 1;
    document.getElementById('setup').classList.remove('on');
    tab = 'photo'; sel = old; render();
    return { old, current };
  });

  const upload = await page.evaluate(async ({ old, current }) => {
    const data = 'data:image/jpeg;base64,YQ==';
    compress = () => new Promise(resolve => { window.finishCompress = resolve; });
    const input = document.getElementById('phFile');
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'test.png', { type: 'image/png' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    sel = current; render();
    window.finishCompress(data);
    for (let i = 0; i < 50 && !PH.includes(old) && !PH.includes(current); i++)
      await new Promise(resolve => setTimeout(resolve, 20));
    return { old: PH.includes(old), current: PH.includes(current) };
  }, dates);
  check(upload.old && !upload.current, 'медленное сохранение не переносит фото на другой день', JSON.stringify(upload));

  const painting = await page.evaluate(async ({ old, current }) => {
    const original = phLoad, pending = new Map();
    phLoad = day => new Promise(resolve => pending.set(day, resolve));
    recRW(old).bw = '61'; recRW(current).bw = '73';
    sel = old;
    const first = paintPhotoScreen();
    sel = current;
    const second = paintPhotoScreen();
    pending.get(current)('data:image/jpeg;base64,Yg==');
    await second;
    pending.get(old)('data:image/jpeg;base64,YQ==');
    await first;
    phLoad = original;
    return { date: document.getElementById('phDate').textContent,
      expectedDate: 'снимок за ' + fmt(current),
      weight: document.getElementById('phW').value,
      image: document.querySelector('#phT img')?.getAttribute('src') };
  }, dates);
  check(painting.image === 'data:image/jpeg;base64,Yg==' &&
    painting.date === painting.expectedDate && painting.weight === '73',
    'запоздавший снимок не перерисовывает другой день', JSON.stringify(painting));

  const deletion = await page.evaluate(async ({ old, current }) => {
    await phPut(old, 'data:image/jpeg;base64,YQ==');
    await phPut(current, 'data:image/jpeg;base64,Yg==');
    await phSync();
    sel = old; tab = 'photo'; render();
    ask = () => new Promise(resolve => { window.confirmDelete = resolve; });
    document.getElementById('phDel').click();
    sel = current; render();
    window.confirmDelete(true);
    for (let i = 0; i < 50 && PH.includes(old) && PH.includes(current); i++)
      await new Promise(resolve => setTimeout(resolve, 20));
    return { old: PH.includes(old), current: PH.includes(current) };
  }, dates);
  check(!deletion.old && deletion.current, 'подтверждение удаления относится к исходному дню', JSON.stringify(deletion));

  await browser.close();
  process.exit(failures ? 1 : 0);
})().catch(err => { console.error('FATAL', err); process.exit(1); });
