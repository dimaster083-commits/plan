/* Regression: actual per-set weights must drive records, not the card target. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage();
    await page.goto(APP);
    await page.waitForTimeout(1300);
    const result = await page.evaluate(() => {
      S.rec = {}; entCache = null;
      const ds = today(), n = 'Жим лёжа';
      S.rec[ds] = { log: { 0: { done: 1, n, w: 200, s: 3, r: '5', rs: [10, 5, 1], ws: [60, 80, 100], g: 'Грудь' } } };
      recOf(ds); // Normalize the day container before measuring journal immutability.
      const before = JSON.stringify(S.rec);
      const varied = exSessions(n)[0];
      const rollbackBest = prFromLog(n);
      const untouched = JSON.stringify(S.rec) === before;
      S.rec[ds].log[0].ws = [60, '', 100];
      S.rec[ds].log[0].w = 70; entCache = null;
      const fallback = exSessions(n)[0];
      delete S.rec[ds].log[0].ws; entCache = null;
      const legacy = exSessions(n)[0];
      S.rec[ds].log[0].done = 0; entCache = null;
      const draft = exSessions(n);
      return { varied, rollbackBest, untouched, fallback, legacy, draft };
    });
    assert.equal(result.varied.w, 100, 'record weight must not be the unused 200 kg card target');
    assert.equal(result.varied.e1, 100, 'e1RM must pair each weight with its own reps');
    assert.equal(result.varied.set, 600);
    assert.equal(result.varied.sw, 60);
    assert.equal(result.varied.sr, 10);
    assert.equal(result.varied.vol, 1100);
    assert.equal(result.rollbackBest, 100, 'undo reconstructs actual max weight');
    assert.equal(result.untouched, true);
    console.log('✓ Actual weights drive records, volume and rollback without rewriting history');
    assert.equal(result.fallback.w, 100);
    assert.equal(result.fallback.vol, 1050);
    assert.equal(result.legacy.w, 70);
    assert.equal(result.legacy.set, 700);
    assert.equal(result.legacy.vol, 1120);
    assert.deepEqual(result.draft, []);
    console.log('✓ Missing per-set weights retain legacy fallback; drafts are excluded');
    const closed = await page.evaluate(() => {
      S.setup = 1; S.sound = 0; S.rec = {}; S.pr = { 'Жим лёжа': 80 };
      document.getElementById('setup').classList.remove('on');
      const d = dayOf(today()); d.t = 'up1';
      d.ex = [{ n: 'Жим лёжа', s: 3, r: '5', w: 200, g: 'Грудь' }];
      entCache = null; save(); tab = 'wo'; sel = today(); exOpen = 0; render();
      const card = document.querySelector('.ex[data-j="0"]');
      card.querySelector('[data-f="w"]').value = '200';
      [...card.querySelectorAll('[data-ws]')].forEach((x, i) => { x.value = [60, 80, 100][i]; });
      [...card.querySelectorAll('[data-rs]')].forEach((x, i) => { x.value = [10, 5, 1][i]; });
      toggleSet(0);
      const peak = S.pr['Жим лёжа'];
      toggleSet(0);
      return { peak, afterUndo: S.pr['Жим лёжа'] || 0 };
    });
    assert.equal(closed.peak, 100, 'closing stores the actual weight record, not the card target');
    assert.equal(closed.afterUndo, 0, 'undo excludes the removed session even after records were cached');
    console.log('✓ Closing and undo keep the weight record synchronized with actual sets');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
