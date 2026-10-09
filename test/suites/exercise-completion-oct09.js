/* Oct 09 exercise completion regressions. Synthetic data in fresh browser
   contexts only. Catches missing explicit completion, all-R/all-D dead ends,
   false zero/empty completion, future-day writes and obscured mobile controls.
   60*8 + 65*9 + 70*10 = 1765 kg; warmup/drop contribute no work volume. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP, LAUNCH } = require('../env');
let failures = 0;
function check(name, actual, verify) {
  try { verify(actual); console.log('✓ ' + name); }
  catch (error) { failures++; console.log('✗ ' + name + ' → ' + error.message + '; actual=' + JSON.stringify(actual)); }
}
function seed(cfg = {}) {
  S.setup = 1; S.sound = 0; S.hints = 0; S.bw = '72';
  S.days = build().days; S.days.forEach(d => { d.ex = []; });
  S.rec = {}; S.pr = {}; S.map = {}; S.once = {}; S.pause = {};
  S.vol = Object.fromEntries(GROUPS.map(([g]) => [g, 0])); S.xp = 0;
  S.start = addDays(today(), 7); S.exNote = {}; S.tips = {};
  sel = cfg.future ? addDays(today(), 1) : today();
  const d = dayOf(sel); d.t = 'up1'; d.s = 'Проверка упражнения';
  d.ex = [{ n: 'Жим лёжа', g: 'Грудь', w: 60,
    s: cfg.s === undefined ? 3 : cfg.s, r: cfg.r === undefined ? '8-10' : cfg.r }];
  S.rec[sel] = { log: cfg.kinds ? { 0: { kinds: cfg.kinds } } : {}, sp: {}, t0: Date.now() - 300000 };
  entCache = null; wkCache = null; justDone = -1; editPast = false;
  tab = 'wo'; exOpen = 0; undoDrop(); pendingActions.clear(); lastTap = { k: '', t: 0 };
  $('setup').classList.remove('on'); render(); save(); flush(); window.scrollTo(0, 0);
}
function result() {
  const l = recOf(sel).log[0] || {}, recap = rangeData(sel, 1);
  return { done: !!l.done, log: l, xp: S.xp, pr: S.pr, weight: dayOf(sel).ex[0].w,
    sets: daySets(sel), ton: dayTon(sel), muscle: vol7m()['Грудь'],
    total: S.vol['Грудь'], recapSets: recap.sets, recapTon: recap.ton,
    rows: [...$('exl').querySelectorAll('.srow')].map(x => x.classList.contains('on')),
    ask: $('ask').classList.contains('on') };
}
function personal() { return JSON.stringify({ rec: S.rec, days: S.days, xp: S.xp, pr: S.pr, vol: S.vol }); }
async function tapTicks(page) {
  const count = await page.locator('.ex [data-tick]').count();
  for (let i = 0; i < count; i++) await page.locator('.ex [data-tick="' + i + '"]').tap();
}

(async () => {
  const browser = await chromium.launch(LAUNCH), errors = [];
  try {
    for (const width of [320, 390]) {
      const context = await browser.newContext({ viewport: { width, height: width === 320 ? 568 : 844 }, hasTouch: true });
      const page = await context.newPage(); page.on('pageerror', error => errors.push(error.message));
      await page.goto(APP); await page.waitForSelector('#setup.on');
      const prep = cfg => page.evaluate(seed, cfg || {});
      const action = () => page.locator('.ex [data-complete]');
      await prep();
      const explicit = await page.evaluate(() => {
        const card = $('exl').querySelector('.ex'), b = card.querySelector('[data-complete]');
        if (!b) return { exists: false };
        const r = b.getBoundingClientRect(), rows = [...card.querySelectorAll('.srow')], last = rows.at(-1).getBoundingClientRect();
        const rpe = card.querySelector('.rpew').getBoundingClientRect();
        return { exists: true, width: r.width, height: r.height, belowRows: r.top >= last.bottom - 1,
          beforeRpe: r.bottom <= rpe.top + 1, caption: b.parentElement.textContent, disabled: b.disabled };
      });
      check(width + ': явное завершение находится после подходов, перед RPE и объясняет запись значений', explicit, x => {
        assert.equal(x.exists, true); assert.equal(x.disabled, false);
        assert.ok(x.width >= 44 && x.height >= 44 && x.belowRows && x.beforeRpe);
        assert.match(x.caption, /Все[\s\S]*подход[\s\S]*указанн[\s\S]*значени/iu);
      });
      const geometry = await page.evaluate(() => {
        const card = $('exl').querySelector('.ex').getBoundingClientRect(), bar = $('wobar').getBoundingClientRect();
        const controls = [...$('exl').querySelectorAll('.srow button,.srow input')].map(x => {
          const r = x.getBoundingClientRect(); return { width: r.width, height: r.height };
        });
        return { cardBottom: card.bottom, barTop: bar.top, overflow: document.documentElement.scrollWidth - innerWidth, controls };
      });
      geometry.exposed = await page.evaluate(() => [...$('exl').querySelectorAll('.srow [data-tick]')].every(x => {
        x.scrollIntoView({ block: 'center', behavior: 'instant' }); const r = x.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return hit === x || x.contains(hit);
      }));
      check(width + ': кнопка тренировки ниже карточки, поля и галочки 44 px, экран не распирает', geometry, x => {
        assert.ok(x.barTop >= x.cardBottom - 1, 'кнопка тренировки перекрывает содержимое карточки');
        assert.ok(x.overflow <= 1); assert.ok(x.controls.every(r => r.width >= 44 && r.height >= 44));
        assert.equal(x.exposed, true, 'после прокрутки галочка должна получать касание');
      });

      // The real explicit action records current row values, not a fresh plan.
      if (explicit.exists) {
        for (let i = 0; i < 3; i++) {
          await page.locator('[data-ws="' + i + '"]').fill(String([60, 65, 70][i]));
          await page.locator('[data-rs="' + i + '"]').fill(String([8, 9, 10][i]));
        }
        const before = await page.evaluate(personal);
        await action().tap(); await page.waitForFunction(() => !document.getElementById('undo').hidden);
        const done = await page.evaluate(result);
        check(width + ': одна кнопка записывает 1765 кг в журнал, мышцы и итоги без лишнего вопроса', done, x => {
          assert.equal(x.done, true); assert.equal(x.ask, false); assert.equal(x.xp, 12);
          assert.equal(x.sets, 3); assert.equal(x.ton, 1765); assert.equal(x.total, 1765);
          assert.equal(x.muscle, 3); assert.equal(x.recapSets, 3); assert.equal(x.recapTon, 1765);
          assert.deepEqual(x.log.rs, [8, 9, 10]); assert.deepEqual(x.log.ws, [60, 65, 70]);
        });
        await page.locator('#undoB').tap();
        check(width + ': Отменить возвращает черновик, программу, опыт и рекорды', await page.evaluate(personal), x => assert.equal(x, before));
        // Reopen after a real UI undo; the 260 ms guard is intentional.
        await page.waitForTimeout(300); await action().tap();
        await page.evaluate(() => flush()); const saved = await page.evaluate(personal);
        await page.reload(); await page.waitForFunction(() => typeof S !== 'undefined' && S.setup === 1);
        check(width + ': завершение переживает перезагрузку без повторного начисления', { state: await page.evaluate(personal), data: await page.evaluate(result) }, x => {
          assert.equal(x.state, saved); assert.equal(x.data.xp, 12); assert.equal(x.data.ton, 1765); assert.equal(x.data.sets, 3);
        });
        await prep({ r: '' });
        for (let i = 0; i < 3; i++) await page.locator('[data-rs="' + i + '"]').fill('8');
        await action().tap();
        check(width + ': собственные повторы можно записать без общей цели', await page.evaluate(result), x => {
          assert.equal(x.done, true); assert.equal(x.ton, 1440); assert.equal(x.sets, 3); assert.deepEqual(x.log.rs, [8, 8, 8]);
        });
      }

      await prep({ r: '' });
      await page.locator('[data-rs="0"]').fill('8');
      // A trusted first-row edit prefills following cells; clear both through
      // the real input handlers to keep this a genuinely partial draft.
      await page.locator('[data-rs="1"]').fill('');
      await page.locator('[data-rs="2"]').fill('');
      await page.locator('[data-tick="0"]').tap();
      check(width + ': своя первая строка отмечается без общей цели и без закрытия остальных', await page.evaluate(result), x => {
        assert.equal(x.done, false); assert.equal(x.xp, 0); assert.equal(x.ton, 0);
        assert.deepEqual(x.rows, [true, false, false]); assert.deepEqual(x.log.ck, [0]);
        assert.deepEqual(x.log.rs, [8, '', '']);
      });

      for (const invalid of ['-3', '8oops']) {
        await prep();
        for (let i = 0; i < 3; i++) await page.locator('[data-rs="' + i + '"]').fill([invalid, '9', '10'][i]);
        if (explicit.exists) await action().tap();
        check(width + ': непустые некорректные повторы «' + invalid + '» не создают завершение или награду', await page.evaluate(result), x => {
          assert.equal(x.done, false); assert.equal(x.xp, 0); assert.equal(x.ton, 0);
          assert.equal(x.sets, 0); assert.deepEqual(x.pr, {});
        });
      }
      await prep();
      await page.locator('[data-f="w"]').fill('-5');
      for (let i = 0; i < 3; i++) await page.locator('[data-rs="' + i + '"]').fill('8');
      if (explicit.exists) await action().tap();
      check(width + ': отрицательный вес не создаёт завершение с нулевым тоннажем и наградой', await page.evaluate(result), x => {
        assert.equal(x.done, false); assert.equal(x.xp, 0); assert.equal(x.ton, 0);
        assert.equal(x.sets, 0); assert.deepEqual(x.pr, {});
      });
      await prep();
      await page.locator('[data-f="r"]').fill('8oops');
      if (explicit.exists) await action().tap();
      check(width + ': некорректная общая цель не записывается как выполненный план', await page.evaluate(result), x => {
        assert.equal(x.done, false); assert.equal(x.xp, 0); assert.equal(x.ton, 0);
        assert.equal(x.sets, 0); assert.deepEqual(x.pr, {});
      });

      await prep(); await tapTicks(page);
      check(width + ': последние обычные галочки по-прежнему закрывают упражнение', await page.evaluate(result), x => {
        assert.equal(x.done, true); assert.equal(x.sets, 3); assert.equal(x.ton, 1800); assert.equal(x.xp, 12);
      });
      for (const kind of ['w', 'd']) {
        await prep({ kinds: [kind, kind, kind] }); await tapTicks(page);
        check(width + ': все ' + (kind === 'w' ? 'разминочные' : 'дроп') + ' галочки завершают запись без выдуманной рабочей нагрузки', await page.evaluate(result), x => {
          assert.equal(x.done, true); assert.equal(x.sets, 0); assert.equal(x.ton, 0); assert.equal(x.total, 0);
          assert.deepEqual(x.pr, {}); assert.equal(x.weight, 60); assert.ok(!x.log.prog);
        });
      }
      await prep();
      for (let i = 0; i < 2; i++) await page.locator('[data-tick="' + i + '"]').tap();
      await page.locator('[data-f="s"]').fill('2'); await page.locator('[data-f="s"]').blur();
      const reduced = await page.evaluate(result);
      if (explicit.exists) await action().tap();
      check(width + ': сокращение 3→2 не закрывает само, явная кнопка завершает две отмеченные строки', { before: reduced, after: await page.evaluate(result) }, x => {
        assert.equal(x.before.done, false); assert.deepEqual(x.before.rows, [true, true]);
        assert.equal(x.after.done, true); assert.equal(x.after.sets, 2); assert.equal(x.after.ton, 1200);
      });
      await prep({ future: true });
      const futureBefore = await page.evaluate(() => JSON.stringify(S)); await tapTicks(page);
      check(width + ': касания галочек будущего дня не меняют состояние', {
        unchanged: await page.evaluate(() => JSON.stringify(S)) === futureBefore,
        log: await page.evaluate(() => recOf(sel).log)
      }, x => assert.equal(x.unchanged, true));

      for (const [name, cfg] of [['ноль подходов', { s: 0 }], ['нет цели и повторов', { r: '' }]]) {
        await prep(cfg); await tapTicks(page);
        if (explicit.exists && !(await action().isDisabled())) await action().tap();
        check(width + ': ' + name + ' не создаёт завершение, опыт или рекорд', await page.evaluate(result), x => {
          assert.equal(x.done, false); assert.equal(x.xp, 0); assert.equal(x.ton, 0); assert.deepEqual(x.pr, {});
        });
      }
      await context.close();
    }
    check('Сценарии не вызывают ошибок страницы', errors, x => assert.deepEqual(x, []));
  } finally { await browser.close(); }
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error('FATAL', error); process.exitCode = 1; });
