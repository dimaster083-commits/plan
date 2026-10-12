/* Synthetic, isolated Chrome: native IndexedDB faults, trusted UI buttons.
   No owner photos or browser profile. Failure injection is not real quota loss. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
const PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
let checks = 0, failures = 0;
function check(name, actual, expected) {
  checks++;
  try { assert.deepEqual(actual, expected); console.log('  ✓ ' + name); }
  catch (e) { failures++; console.log('  ✗ ' + name + ' — expected ' + JSON.stringify(expected) + ', actual ' + JSON.stringify(actual)); }
}
async function fresh(browser, width) {
  const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, timezoneId: 'Asia/Vladivostok', serviceWorkers: 'block' });
  await context.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function(type, fn, options) {
      if ((this.id === 'phDel' && type === 'click') && typeof fn === 'function') {
        return add.call(this, type, function(...args) {
          window.fixtureDeleteDone = false;
          const result = fn.apply(this, args);
          Promise.resolve(result).then(() => { window.fixtureDeleteDone = true; }, e => { window.fixtureDeleteDone = true; throw e; });
          return result;
        }, options);
      }
      return add.call(this, type, fn, options);
    };
  });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.clock.install({ time: new Date('2026-10-10T12:00:00+10:00') });
  await page.goto(APP); await page.click('#setSkip');
  await page.evaluate(async photo => {
    S.bw = '70'; S.bkAsk = Date.now(); S.exNote = { fixture: 'original journal' }; save(); flush(); undoDrop();
    await phPut(today(), photo); await phSync(); PHCACHE.clear();
  }, PHOTO);
  await page.click('[data-tab="photo"]'); await page.waitForSelector('#phT img');
  // Drain the setup button's deferred tap insurance before starting a case.
  await page.clock.runFor(300); await page.evaluate(() => undoDrop());
  return { context, page, errors };
}
async function remove(page) {
  await page.click('#phDel'); await page.waitForSelector('#ask.on'); await page.click('#askY');
  await page.waitForFunction(() => window.fixtureDeleteDone, null, { timeout: 3000 });
}
async function fault(page, kind) {
  await page.evaluate(kind => {
    window.fixtureMethods = {};
    const method = kind === 'read' ? 'get' : kind === 'put' ? 'put' : 'delete';
    const original = IDBObjectStore.prototype[method]; fixtureMethods[method] = original;
    IDBObjectStore.prototype[method] = function(...args) {
      if (this.name !== 'ph') return original.apply(this, args);
      if (kind === 'abort') { const request = original.apply(this, args); this.transaction.abort(); return request; }
      throw new DOMException('synthetic photo ' + kind, kind === 'put' ? 'QuotaExceededError' : 'UnknownError');
    };
    if (kind === 'read') PHCACHE.clear();
  }, kind);
}
async function repair(page) {
  await page.evaluate(() => { for (const [method, original] of Object.entries(fixtureMethods)) IDBObjectStore.prototype[method] = original; });
}
async function state(page) {
  return page.evaluate(async () => ({ photo: (await phGet(today())) || null, keys: PH.slice(), cache: PHCACHE.get(today()) || null,
    journal: S.exNote, disk: JSON.parse(localStorage.getItem(KEY)).exNote,
    undo: !!undoRec, visibleUndo: !$('undo').hidden, notice: $('noteT').textContent }));
}
async function pauseUndoCommit(page) {
  await page.evaluate(() => {
    window.fixturePutCount = 0; window.fixtureGate = null;
    const originalPut = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function(...args) { if (this.name === 'ph') fixturePutCount++; return originalPut.apply(this, args); };
    const originalTx = IDBDatabase.prototype.transaction;
    const setter = Object.getOwnPropertyDescriptor(IDBTransaction.prototype, 'oncomplete').set;
    let held = false;
    IDBDatabase.prototype.transaction = function(...args) {
      const t = originalTx.apply(this, args);
      if (args[1] === 'readwrite' && !held) { held = true; Object.defineProperty(t, 'oncomplete', { configurable: true, set(fn) {
        setter.call(t, function(event) { window.fixtureGate = () => fn.call(t, event); });
      }}); }
      return t;
    };
    window.fixtureRelease = () => { IDBObjectStore.prototype.put = originalPut; IDBDatabase.prototype.transaction = originalTx; fixtureGate(); };
  });
}
async function uploadColor(page, color) {
  const buffer = Buffer.from((await page.evaluate(color => {
    const canvas = document.createElement('canvas'); canvas.width = 16; canvas.height = 24;
    canvas.getContext('2d').fillStyle = color; canvas.getContext('2d').fillRect(0, 0, 16, 24);
    return canvas.toDataURL('image/png');
  }, color)).split(',')[1], 'base64');
  const before = await page.evaluate(() => undoSeq);
  const chooser = page.waitForEvent('filechooser'); await page.click('#phAdd');
  await (await chooser).setFiles({ name: 'synthetic-color.png', mimeType: 'image/png', buffer });
  await page.waitForFunction(before => undoSeq > before && !!undoRec && !undoRec.busy, before, { timeout: 3000 });
  return page.evaluate(() => phGet(today()));
}
async function undoSettled(page) {
  // Native transaction completion triggers the application continuation and render.
  await page.waitForFunction(() => !undoRec?.busy && ($('noteT').textContent === 'Отменено' || /Не удалось/.test($('noteT').textContent)), null, { timeout: 3000 });
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    for (const width of [320, 390]) {
      for (const kind of ['delete', 'read', 'abort']) {
        const { context, page, errors } = await fresh(browser, width);
        try {
          const before = await state(page); await fault(page, kind);
          try { await remove(page); } catch (e) { check(width + ' ' + kind + ' rejection/abort settles', false, true); }
          await repair(page); const after = await state(page);
          check(width + ' ' + kind + ' failure preserves native stored photo', after.photo, PHOTO);
          check(width + ' ' + kind + ' failure preserves archive keys', after.keys, before.keys);
          // A failed read leaves an uncached entry; it must not erase an existing cached image.
          if (kind !== 'read') check(width + ' ' + kind + ' failure preserves cache', after.cache, before.cache);
          check(width + ' ' + kind + ' failure preserves journal/disk', [after.journal, after.disk], [before.journal, before.disk]);
          check(width + ' ' + kind + ' failure creates no false Undo', [after.undo, after.visibleUndo], [false, false]);
          check(width + ' ' + kind + ' local failure notice', /Не удалось.*(удалить|фото)/i.test(after.notice) && !/перезапусти/.test(after.notice), true);
          check(width + ' ' + kind + ' no uncaught error', errors, []);
          if (after.photo === PHOTO && await page.locator('#phDel').isVisible()) {
            await page.clock.runFor(300); await remove(page);
            check(width + ' ' + kind + ' retry deletes photo', (await state(page)).photo, null);
            await page.click('#undoB'); await undoSettled(page);
            check(width + ' ' + kind + ' normal Undo after retry restores exact photo', (await state(page)).photo, PHOTO);
          } else check(width + ' ' + kind + ' retry deletion remains available', false, true);
        } finally { await context.close(); }
      }
      {
        const { context, page } = await fresh(browser, width);
        try {
          await remove(page); const before = await state(page);
          // Observable sentinel distinguishes an early journal rollback from no rollback.
          await page.evaluate(() => { S.exNote.fixture = 'current marker'; });
          await fault(page, 'put'); await page.click('#undoB'); await undoSettled(page);
          await repair(page); const failed = await state(page);
          check(width + ' failed Undo keeps deleted photo absent', failed.photo, null);
          check(width + ' failed Undo does not report success', failed.notice !== 'Отменено' && /Не удалось/.test(failed.notice), true);
          check(width + ' failed Undo retains retry record/bar', [failed.undo, failed.visibleUndo], [true, true]);
          check(width + ' failed Undo keeps current S', failed.journal.fixture, 'current marker');
          check(width + ' failed Undo leaves disk journal untouched', failed.disk, before.disk);
          if (failed.visibleUndo) {
            await page.clock.runFor(300); await page.click('#undoB');
            await page.waitForFunction(() => !undoRec && $('noteT').textContent === 'Отменено', null, { timeout: 3000 });
            const restored = await state(page);
            check(width + ' retry Undo restores original photo', restored.photo, PHOTO);
            check(width + ' retry Undo restores original S', restored.journal.fixture, 'original journal');
            check(width + ' retry Undo consumed once', [restored.undo, restored.visibleUndo, restored.notice], [false, false, 'Отменено']);
          } else check(width + ' retry Undo available through trusted button', false, true);
        } finally { await context.close(); }
      }
      {
        const { context, page } = await fresh(browser, width);
        try {
          await remove(page); await fault(page, 'put'); await page.click('#undoB'); await undoSettled(page); await repair(page);
          await page.clock.runFor(7100);
          check(width + ' failed Undo expires within original seven second window', await page.evaluate(() => [!!undoRec, !$('undo').hidden]), [false, false]);
        } finally { await context.close(); }
      }
      for (const lateSave of [false, true]) {
        const { context, page } = await fresh(browser, width);
        try {
          await remove(page); await pauseUndoCommit(page);
          await page.evaluate(() => { S.exNote.fixture = 'marker before pending Undo'; });
          await page.click('#undoB');
          await page.waitForFunction(() => !!fixtureGate);
          check(width + ' pending Undo defers S rollback until native back succeeds', await page.evaluate(() => S.exNote.fixture), 'marker before pending Undo');
          if (lateSave) await page.evaluate(() => { S.exNote.later = 'saved during pending Undo'; save(); flush(); });
          else {
            await page.clock.runFor(300);
            if (await page.locator('#undoB').isVisible()) await page.click('#undoB');
            check(width + ' pending Undo ignores second trusted tap', await page.evaluate(() => fixturePutCount), 1);
          }
          await page.evaluate(() => fixtureRelease());
          await page.waitForFunction(() => $('noteT').textContent === 'Отменено' || /Действие с фото отменено/.test($('noteT').textContent), null, { timeout: 3000 });
          const after = await state(page);
          check(width + ' pending Undo native photo restored', after.photo, PHOTO);
          if (lateSave) check(width + ' pending Undo never overwrites later saved journal', [after.journal.later, after.disk.later], ['saved during pending Undo', 'saved during pending Undo']);
          else check(width + ' normal pending Undo confirms success', [after.notice, after.undo], ['Отменено', false]);
        } finally { await context.close(); }
      }
      for (const newer of ['upload', 'delete']) {
        const { context, page } = await fresh(browser, width);
        try {
          await uploadColor(page, '#ff0000'); await page.clock.runFor(300);
          const replacement = await uploadColor(page, '#0000ff');
          await pauseUndoCommit(page); await page.click('#undoB');
          await page.waitForFunction(() => !!fixtureGate, null, { timeout: 3000 });
          let expected;
          if (newer === 'upload') expected = await uploadColor(page, '#00ff00');
          else { await remove(page); expected = null; }
          await page.evaluate(() => { window.fixtureLatestUndo = undoRec; window.fixtureLatestLabel = $('undoT').textContent; });
          check(width + ' newer ' + newer + ' changes native photo before old callback', await page.evaluate(async () => (await phGet(today())) || null), expected);
          await page.evaluate(() => fixtureRelease());
          await page.waitForFunction(() => /Действие с фото отменено/.test($('noteT').textContent), null, { timeout: 3000 });
          // render() reads IndexedDB asynchronously after invalidating its cache.
          // On the old runtime this bounded observation times out, then the
          // explicit equality checks below record the stale image as RED.
          await page.waitForFunction(expected => ($('phT').querySelector('img')?.getAttribute('src') || null) === expected,
            expected, { timeout: 1000 }).catch(() => {});
          const after = await page.evaluate(async () => ({ disk: (await phGet(today())) || null,
            cache: PHCACHE.get(today()) || null, image: $('phT').querySelector('img')?.getAttribute('src') || null,
            ownUndo: undoRec === fixtureLatestUndo && !$('undo').hidden && $('undoT').textContent === fixtureLatestLabel }));
          check(width + ' old Undo preserves newer ' + newer + ' native image', after.disk, expected);
          check(width + ' old Undo preserves newer ' + newer + ' cached image', after.cache === expected, true);
          check(width + ' old Undo preserves newer ' + newer + ' visible image', after.image === expected, true);
          check(width + ' old Undo preserves newer ' + newer + ' own Undo', after.ownUndo, true);
          check(width + ' replacement fixture really differs from newer image', replacement !== expected, true);
        } finally { await context.close(); }
      }
    }
  } finally { await browser.close(); }
  console.log('Photo fault regressions: ' + checks + ' checks, ' + failures + ' failures.');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error('FATAL', e); process.exitCode = 1; });
