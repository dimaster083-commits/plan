/* Breaks caught: stale photo Undo replacing newer journal; an untouched tab
   writing stale S; backup photo values paired with keys from another snapshot.
   Only timing is controlled. Real handlers, IndexedDB and localStorage run. */
const assert = require('assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');

const OLD_PHOTO = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aJ1sAAAAASUVORK5CYII=';
const NEW_PHOTO = OLD_PHOTO + '\n';
let failures = 0;
function check(name, actual, expected) {
  try { assert.deepStrictEqual(actual, expected); console.log('  ✓ ' + name); }
  catch (error) {
    failures++;
    console.log('  ✗ ' + name + ' — expected ' + JSON.stringify(expected) + ', actual ' + JSON.stringify(actual));
  }
}

async function fresh(browser) {
  const context = await browser.newContext();
  await context.addInitScript(() => {
    const add = EventTarget.prototype.addEventListener;
    EventTarget.prototype.addEventListener = function (type, listener, options) {
      if (type === 'change' && this.id === 'phFile' && typeof listener === 'function') {
        return add.call(this, type, function (...args) {
          const result = listener.apply(this, args);
          window.photoHandlerDone = Promise.resolve(result);
          return result;
        }, options);
      }
      return add.call(this, type, listener, options);
    };
  });
  const page = await context.newPage();
  await page.goto(APP);
  await page.waitForFunction(() => !!S);
  await page.evaluate(() => {
    S.setup = 1;
    document.getElementById('setup').classList.remove('on');
    window.chooseFixture = (id, file) => {
      const dt = new DataTransfer(); dt.items.add(file);
      const input = document.getElementById(id);
      input.files = dt.files;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    };
  });
  return { context, page };
}

async function startPendingPhoto(page) {
  await page.evaluate(async ({ oldPhoto, newPhoto }) => {
    S.exNote = { before: 'old journal' };
    sel = addDays(today(), -1); tab = 'photo'; render(); flush();
    window.fixtureDay = sel;
    await phPut(fixtureDay, oldPhoto); PHCACHE.set(fixtureDay, oldPhoto); await phSync();
    // Compression has no storage side effects. The actual DB write remains real;
    // its start is delayed so a later journal action can finish first.
    compress = async () => newPhoto;
    window.originalTx = tx;
    let delayFirstWrite = true;
    tx = (mode, fn) => {
      if (mode !== 'readwrite' || !delayFirstWrite) return originalTx(mode, fn);
      delayFirstWrite = false;
      return new Promise(resolve => {
        window.finishPhotoWrite = () => originalTx(mode, fn).then(resolve);
      });
    };
    chooseFixture('phFile', new File(['synthetic image'], 'photo.png', { type: 'image/png' }));
  }, { oldPhoto: OLD_PHOTO, newPhoto: NEW_PHOTO });
  await page.waitForFunction(() => typeof finishPhotoWrite === 'function');
}

async function finishPhotoAndUndo(page) {
  await page.evaluate(() => { finishPhotoWrite(); tx = originalTx; });
  await page.waitForFunction(() => !document.getElementById('undo').hidden);
  return page.evaluate(async () => {
    await undoNow();
    return { memory: S.exNote, disk: JSON.parse(localStorage.getItem(KEY)).exNote,
      photo: await phGet(fixtureDay) };
  });
}

(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    {
      const { context, page } = await fresh(browser);
      try {
        await startPendingPhoto(page);
        await page.evaluate(() => {
          S.exNote.later = 'saved while upload pending'; save(); flush();
        });
        const result = await finishPhotoAndUndo(page);
        check('отмена фото сохраняет позднюю заметку в памяти и на диске',
          { memory: result.memory, disk: result.disk }, {
            memory: { before: 'old journal', later: 'saved while upload pending' },
            disk: { before: 'old journal', later: 'saved while upload pending' }
          });
        check('отмена позднего upload возвращает прежнее фото', result.photo, OLD_PHOTO);
      } finally { await context.close(); }
    }

    {
      const { context, page } = await fresh(browser);
      try {
        await startPendingPhoto(page);
        await page.evaluate(() => {
          const imported = JSON.parse(JSON.stringify(S));
          imported.exNote = { restored: 'new journal from backup' };
          ask = async () => true;
          chooseFixture('impFile', new File([
            JSON.stringify({ v: 3, state: imported, photos: {} })
          ], 'backup.json', { type: 'application/json' }));
        });
        await page.waitForFunction(() =>
          document.getElementById('noteT').textContent === 'Прогресс восстановлен');
        const result = await finishPhotoAndUndo(page);
        check('отмена pending upload не отменяет уже восстановленный журнал',
          { memory: result.memory, disk: result.disk }, {
            memory: { restored: 'new journal from backup' },
            disk: { restored: 'new journal from backup' }
          });
        check('фото откатывается отдельно от восстановленного журнала', result.photo, OLD_PHOTO);
      } finally { await context.close(); }
    }

    {
      const { context, page: a } = await fresh(browser);
      try {
        const b = await context.newPage(); await b.goto(APP);
        await b.waitForFunction(() => !!S);
        await a.evaluate(() => { S.exNote = { one: 'A saved this' }; save(); flush(); });
        await b.waitForFunction(() => JSON.parse(localStorage.getItem(KEY)).exNote?.one === 'A saved this');
        // No state changes in B: just the event fired when switching tabs.
        const disk = await b.evaluate(() => {
          document.dispatchEvent(new Event('visibilitychange'));
          flush();
          return JSON.parse(localStorage.getItem(KEY)).exNote;
        });
        check('нетронутая соседняя вкладка не перезаписывает сохранённую заметку',
          disk, { one: 'A saved this' });
      } finally { await context.close(); }
    }

    {
      const { context, page: a } = await fresh(browser);
      try {
        const b = await context.newPage(); await b.goto(APP);
        await b.waitForFunction(() => !!S);
        await a.evaluate(() => { S.exNote = { one: 'A saved this' }; save(); flush(); });
        await b.waitForFunction(() => JSON.parse(localStorage.getItem(KEY)).exNote?.one === 'A saved this');
        const result = await b.evaluate(() => {
          S.exNote = { two: 'B wants to save this' }; save(); flush();
          const warning = document.getElementById('note');
          return {
            memory: S.exNote,
            disk: JSON.parse(localStorage.getItem(KEY)).exNote,
            visibleConflict: warning.classList.contains('on') &&
              /другом окне/.test(document.getElementById('noteT').textContent)
          };
        });
        check('при конфликте правка B остаётся в памяти, запись A на диске, предупреждение видно',
          result, {
            memory: { two: 'B wants to save this' },
            disk: { one: 'A saved this' },
            visibleConflict: true
          });
      } finally { await context.close(); }
    }

    {
      const { context, page } = await fresh(browser);
      try {
        await page.evaluate(async oldPhoto => {
          S.exNote = { before: 'old journal' };
          sel = addDays(today(), -1); tab = 'photo'; render(); flush();
          window.fixtureDay = sel;
          await phPut(fixtureDay, oldPhoto); PHCACHE.set(fixtureDay, oldPhoto); await phSync();
          ask = async () => true;
          window.originalTx = tx;
          let delayFirstWrite = true;
          tx = (mode, fn) => {
            if (mode !== 'readwrite' || !delayFirstWrite) return originalTx(mode, fn);
            delayFirstWrite = false;
            return new Promise(resolve => {
              window.finishPhotoWrite = () => originalTx(mode, fn).then(resolve);
            });
          };
          document.getElementById('phDel').click();
        }, OLD_PHOTO);
        await page.waitForFunction(() => typeof finishPhotoWrite === 'function');
        await page.evaluate(() => {
          S.exNote.later = 'saved while deletion pending'; save(); flush();
        });
        const result = await finishPhotoAndUndo(page);
        check('отмена медленного удаления фото сохраняет позднюю заметку',
          { memory: result.memory, disk: result.disk }, {
            memory: { before: 'old journal', later: 'saved while deletion pending' },
            disk: { before: 'old journal', later: 'saved while deletion pending' }
          });
        check('отмена медленного удаления возвращает фото в IndexedDB', result.photo, OLD_PHOTO);
      } finally { await context.close(); }
    }

    {
      const { context, page } = await fresh(browser);
      try {
        await page.evaluate(async oldPhoto => {
          sel = addDays(today(), -1); tab = 'photo'; render();
          window.fixtureDay = sel;
          await phPut(fixtureDay, oldPhoto); PHCACHE.set(fixtureDay, oldPhoto); await phSync();
          compress = () => new Promise(resolve => { window.finishCompression = resolve; });
          chooseFixture('phFile', new File(['synthetic image'], 'pending.png', { type: 'image/png' }));
          ask = async () => true;
          document.getElementById('phDel').click();
        }, OLD_PHOTO);
        await page.waitForFunction(async () =>
          !document.getElementById('undo').hidden && (await phGet(fixtureDay)) === undefined);
        const afterUpload = await page.evaluate(async newPhoto => {
          finishCompression(newPhoto);
          await photoHandlerDone;
          return phGet(fixtureDay);
        }, NEW_PHOTO);
        check('подтверждённое удаление отменяет более раннюю незавершённую загрузку',
          afterUpload, undefined);
        const afterUndo = await page.evaluate(async () => { await undoNow(); return phGet(fixtureDay); });
        check('отмена удаления после отменённой загрузки возвращает прежнее фото',
          afterUndo, OLD_PHOTO);
      } finally { await context.close(); }
    }

    {
      const { context, page } = await fresh(browser);
      try {
        await page.evaluate(async oldPhoto => {
          sel = addDays(today(), -1); tab = 'photo'; render();
          window.fixtureDay = sel;
          await phPut(fixtureDay, oldPhoto); PHCACHE.set(fixtureDay, oldPhoto); await phSync();
          compress = () => new Promise(resolve => { window.finishCompression = resolve; });
          chooseFixture('phFile', new File(['synthetic image'], 'pending.png', { type: 'image/png' }));
          window.deleteQuestionAnswered = false;
          ask = async () => { window.deleteQuestionAnswered = true; return false; };
          document.getElementById('phDel').click();
        }, OLD_PHOTO);
        await page.waitForFunction(() => window.deleteQuestionAnswered);
        const afterUpload = await page.evaluate(async newPhoto => {
          finishCompression(newPhoto);
          await photoHandlerDone;
          return phGet(fixtureDay);
        }, NEW_PHOTO);
        check('отказ от удаления позволяет выбранной фотографии сохраниться', afterUpload, NEW_PHOTO);
      } finally { await context.close(); }
    }

    {
      const { context, page } = await fresh(browser);
      try {
        await page.evaluate(async ({ oldPhoto, newPhoto }) => {
          window.dateA = '2025-01-01'; window.dateB = '2025-01-02';
          await phPut(dateA, oldPhoto); await phPut(dateB, newPhoto); await phSync();
          const getKeys = IDBObjectStore.prototype.getAllKeys;
          let deletionScheduled = false;
          IDBObjectStore.prototype.getAllKeys = function (...args) {
            const request = getKeys.apply(this, args);
            if (this.name === 'ph' && !deletionScheduled) {
              deletionScheduled = true;
              // Queue deletion after key snapshot. Same-transaction values stay
              // coherent; a second transaction sees changed values and fails.
              request.addEventListener('success', () => {
                window.fixtureDeletion = phDelete(dateA);
              }, { once: true });
            }
            return request;
          };
          URL.createObjectURL = blob => { window.exportBlob = blob.text(); return 'blob:fixture'; };
          HTMLAnchorElement.prototype.click = function () {};
          document.getElementById('exp').click();
        }, { oldPhoto: OLD_PHOTO, newPhoto: NEW_PHOTO });
        await page.waitForFunction(() => !!window.exportBlob);
        const photos = await page.evaluate(async () => {
          const copy = JSON.parse(await exportBlob);
          if (window.fixtureDeletion) await fixtureDeletion;
          return copy.photos;
        });
        // Either atomic snapshot is legal: before deletion (A+B), or after (B).
        const coherent = JSON.stringify(photos) === JSON.stringify({
          '2025-01-01': OLD_PHOTO, '2025-01-02': NEW_PHOTO
        }) || JSON.stringify(photos) === JSON.stringify({ '2025-01-02': NEW_PHOTO });
        check('экспорт хранит фото под своими датами при параллельном удалении', coherent, true);
        if (!coherent) console.log('    photos: ' + JSON.stringify(photos));
      } finally { await context.close(); }
    }
  } finally { await browser.close(); }
  process.exit(failures ? 1 : 0);
})().catch(error => { console.error('FATAL', error); process.exit(1); });
