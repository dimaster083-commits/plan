/* BUG-0011/0018: journal-first restore, safe photo dates and native IDB failures.
   Each case owns an isolated synthetic context. No personal browser profile is used.
   Faults wrap native IDB methods; product import/storage functions remain real. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const OWN = 'data:image/jpeg;base64,YQ==';
let failures = 0, checks = 0;
async function check(name, fn) {
  checks++;
  try { await fn(); console.log('✓ ' + name); }
  catch (e) { failures++; console.log('✗ ' + name + ' → ' + e.message); }
}
async function fresh(browser, width) {
  const ctx = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 },
    timezoneId: 'Asia/Vladivostok', serviceWorkers: 'block', reducedMotion: 'reduce' });
  await ctx.route('https://**/*', route => route.abort());
  const p = await ctx.newPage();
  const errors = []; p.on('pageerror', e => errors.push(e.message));
  await p.goto(APP); await p.click('#setSkip');
  await p.evaluate(() => {
    S.bw = '70'; S.goal = '80'; S.hints = 0; S.sound = 0; S.bkAsk = Date.now();
    S.exNote = { original: 'Synthetic original journal' };
    save(); flush(); render();
  });
  return { ctx, p, errors };
}
async function copyOf(p, photos = {}) {
  const copy = await p.evaluate(() => ({ v: 3, state: JSON.parse(JSON.stringify(S)), photos: {} }));
  copy.state.bw = '91'; copy.state.exNote = { restored: 'Synthetic restored journal' };
  copy.photos = photos; return copy;
}
async function choose(p, copy) {
  await p.evaluate(() => { $('noteT').textContent = ''; });
  await p.locator('#impFile').setInputFiles({ name: 'synthetic-backup.json', mimeType: 'application/json',
    buffer: Buffer.from(typeof copy === 'string' ? copy : JSON.stringify(copy)) });
}
async function restore(p, copy) {
  await choose(p, copy); await p.waitForSelector('#ask.on'); await p.click('#askY');
  // The generic tap guard may first announce the confirmation button itself.
  // Only a restore result counts as completion; a native abort must not hang.
  await p.waitForFunction(() => {
    const text = $('noteT').textContent;
    return !!text && !/^Сделано:/.test(text) && /восстанов|копи|файл/i.test(text);
  }, null, { timeout: 2500 });
  return p.locator('#noteT').innerText();
}
async function journal(p) {
  return p.evaluate(() => ({ bw: S.bw, note: S.exNote,
    disk: JSON.parse(localStorage.getItem(KEY)).bw }));
}
async function expectRestored(p) {
  assert.deepEqual(await journal(p), { bw: '91', note: { restored: 'Synthetic restored journal' }, disk: '91' });
}
function partial(message) {
  assert.match(message, /журнал|прогресс/i, 'result identifies the restored journal: ' + message);
  assert.match(message, /фото|сним/i, 'result identifies photo trouble: ' + message);
  assert.match(message, /не|ошиб|пропущ|недоступ/i, 'result explains incomplete photos: ' + message);
  assert.doesNotMatch(message, /файл не подошёл/i, 'valid backup is not called invalid');
}
async function fault(p, kind, day) {
  await p.evaluate(({ kind, day }) => {
    window.importFaults = [];
    const wrap = (name, handler) => {
      const old = IDBObjectStore.prototype[name];
      importFaults.push(() => { IDBObjectStore.prototype[name] = old; });
      IDBObjectStore.prototype[name] = function (...args) {
        if (this.name !== 'ph') return old.apply(this, args);
        return handler.call(this, old, args);
      };
    };
    if (kind === 'read') wrap('get', function (old, args) {
      if (args[0] === day) throw new DOMException('synthetic own-photo read failure', 'UnknownError');
      return old.apply(this, args);
    });
    if (kind === 'quota') ['put', 'add'].forEach(name => wrap(name, function (old, args) {
      if (args[1] === day) throw new DOMException('synthetic photo quota failure', 'QuotaExceededError');
      return old.apply(this, args);
    }));
    if (kind === 'abort') ['put', 'add'].forEach(name => wrap(name, function (old, args) {
      const req = old.apply(this, args);
      if (args[1] === day) req.addEventListener('success', () => this.transaction.abort());
      return req;
    }));
    if (kind === 'sync') wrap('getAllKeys', function () {
      throw new DOMException('synthetic photo list read failure', 'UnknownError');
    });
  }, { kind, day });
}
async function unfault(p) {
  await p.evaluate(() => { (window.importFaults || []).forEach(f => f()); window.importFaults = []; });
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) {
      const run = async (label, body) => {
        const { ctx, p, errors } = await fresh(browser, width);
        try { await check(width + ' ' + label, () => body(p));
          await check(width + ' ' + label + ' has no uncaught errors', async () => assert.deepEqual(errors, []));
        } finally { await ctx.close(); }
      };
      await run('valid restore preserves own photo and survives reload', async p => {
        const day = '2026-10-01';
        await p.evaluate(async ({ day, own }) => { await phPut(day, own); PHCACHE.clear(); await phSync(); }, { day, own: OWN });
        const message = await restore(p, await copyOf(p, { [day]: PHOTO, '2026-10-02': PHOTO }));
        assert.match(message, /восстанов/i); await expectRestored(p);
        assert.equal(await p.evaluate(day => phGet(day), day), OWN);
        assert.equal(await p.evaluate(() => phGet('2026-10-02')), PHOTO);
        await p.reload(); await expectRestored(p);
        assert.equal(await p.evaluate(day => phGet(day), day), OWN);
      });
      await run('cancel, bad JSON and bad shape leave both stores intact', async p => {
        await p.evaluate(async own => { await phPut('2026-10-01', own); }, OWN);
        const baseline = await journal(p);
        await choose(p, await copyOf(p, { '2026-10-02': PHOTO }));
        await p.waitForSelector('#ask.on'); await p.click('#askN');
        assert.deepEqual(await journal(p), baseline);
        for (const bad of ['{bad JSON', { state: { days: [] }, photos: {} }]) {
          await choose(p, bad); await p.waitForFunction(() => /не подошёл/.test($('noteT').textContent));
          assert.deepEqual(await journal(p), baseline);
        }
        assert.deepEqual(await p.evaluate(() => phKeys()), ['2026-10-01']);
        assert.equal(await p.evaluate(() => phGet('2026-10-01')), OWN);
      });
      await run('quota is partial success, later valid photo continues and screen repaints', async p => {
        // Visible body weight makes repaint observable without invoking render from the test.
        await p.click('[data-tab="prog"]');
        await p.click('#pseg [data-sec="goal"]');
        assert.equal(await p.locator('#bw').isVisible(), true);
        const before = await p.locator('#bw').inputValue();
        await fault(p, 'quota', '2026-10-01');
        const message = await restore(p, await copyOf(p, { '2026-10-01': PHOTO, '2026-10-02': PHOTO }));
        partial(message); await expectRestored(p);
        assert.notEqual(before, '91'); assert.equal(await p.locator('#bw').inputValue(), '91');
        await unfault(p);
        assert.equal(await p.evaluate(() => phGet('2026-10-01')), undefined);
        assert.equal(await p.evaluate(() => phGet('2026-10-02')), PHOTO);
        await p.reload(); await expectRestored(p);
        assert.equal(await p.evaluate(() => phGet('2026-10-02')), PHOTO);
      });
      await run('own-photo read failure cannot overwrite existing photo', async p => {
        await p.evaluate(async own => { await phPut('2026-10-01', own); PHCACHE.clear(); }, OWN);
        await fault(p, 'read', '2026-10-01');
        const message = await restore(p, await copyOf(p, { '2026-10-01': PHOTO, '2026-10-02': PHOTO }));
        await unfault(p);
        // Check bytes before checking wording: protects the irreversible effect itself.
        assert.equal(await p.evaluate(() => phGet('2026-10-01')), OWN);
        assert.equal(await p.evaluate(() => phGet('2026-10-02')), PHOTO);
        partial(message); await expectRestored(p);
        await p.reload(); assert.equal(await p.evaluate(() => phGet('2026-10-01')), OWN);
      });
      await run('existing falsey photo entry is not treated as an absent key', async p => {
        await p.evaluate(async () => { await phPut('2026-10-01', ''); PHCACHE.clear(); });
        const message = await restore(p, await copyOf(p, { '2026-10-01': PHOTO }));
        assert.match(message, /восстанов/i); await expectRestored(p);
        assert.equal(await p.evaluate(() => phGet('2026-10-01')), '');
        await p.reload(); assert.equal(await p.evaluate(() => phGet('2026-10-01')), '');
      });
      await run('invalid dates skipped with warning, legacy keys retained, leap day accepted', async p => {
        await p.evaluate(async photo => { await phPut('legacy-invalid', photo); await phSync(); }, OWN);
        const photos = { 'broken-day': PHOTO, '2026-02-30': PHOTO, '2026-13-01': PHOTO, '2028-02-29': PHOTO };
        const message = await restore(p, await copyOf(p, photos));
        const keys = await p.evaluate(() => phKeys());
        assert.deepEqual(keys, ['2028-02-29', 'legacy-invalid']);
        assert.match(message, /фото|сним/i); assert.match(message, /дат|ключ/i); assert.match(message, /пропущ|не|некоррект|неверн/i);
        assert.deepEqual(await p.evaluate(() => PH), ['2028-02-29']);
        assert.equal(await p.evaluate(() => recOf('2028-02-29').bw), undefined);
        await p.click('[data-tab="photo"]'); await p.click('#phHist');
        assert.equal(await p.locator('[data-open="legacy-invalid"]').count(), 0);
        assert.equal(await p.locator('[data-open="broken-day"]').count(), 0);
        await p.click('[data-open="2028-02-29"]');
        assert.equal(await p.evaluate(() => sel), '2028-02-29');
        await p.click('#phCmp'); await p.waitForSelector('#ov.on');
        const options = await p.locator('#selA option').evaluateAll(xs => xs.map(x => x.value));
        assert.deepEqual(options, ['2028-02-29']);
        assert.equal(await p.locator('#wA').innerText(), '—');
        await p.reload();
        // Startup reads IDB asynchronously after load; observe its real result.
        await p.waitForFunction(() => PH.includes('2028-02-29'));
        assert.deepEqual(await p.evaluate(() => PH), ['2028-02-29']);
        assert.equal(await p.evaluate(() => phGet('legacy-invalid')), OWN);
      });
      await run('native transaction abort settles import and reports partial result', async p => {
        await fault(p, 'abort', '2026-10-01');
        const message = await restore(p, await copyOf(p, { '2026-10-01': PHOTO, '2026-10-02': PHOTO }));
        partial(message); await expectRestored(p); await unfault(p);
        assert.equal(await p.evaluate(() => phGet('2026-10-01')), undefined);
        assert.equal(await p.evaluate(() => phGet('2026-10-02')), PHOTO);
      });
      await run('photo-list read failure retains archive and reports incomplete refresh', async p => {
        await p.evaluate(async own => { await phPut('2026-10-01', own); await phSync(); }, OWN);
        await fault(p, 'sync');
        const message = await restore(p, await copyOf(p));
        assert.deepEqual(await p.evaluate(() => PH), ['2026-10-01']);
        partial(message); await expectRestored(p); await unfault(p);
        await p.reload(); await p.waitForFunction(() => PH.includes('2026-10-01'));
        assert.deepEqual(await p.evaluate(() => PH), ['2026-10-01']);
      });
    }
  } finally { await browser.close(); }
  console.log('import-photos-oct13: ' + checks + ' checks, ' + failures + ' failures');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('HARNESS FAILURE', e); process.exitCode = 1; });
