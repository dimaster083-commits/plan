/* Regression: per-row loads govern progression; exercise replacements preserve past slots/types. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let failures = 0;
function check(name, actual, verify) {
  try { verify(actual); console.log('✓ ' + name); }
  catch (error) { failures++; console.log('✗ ' + name + ' → ' + error.message + '; actual=' + JSON.stringify(actual)); }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(APP);
    await page.waitForFunction(() => typeof toggleSet === 'function' && typeof S === 'object');
    // Mutation caught: passing the unused card load instead of actual work-row loads.
    const fixtures = [
      { name: '60 кг во всех строках не закрепляют общий вес 100 кг', ws: [60, 60, 60], rs: [8, 8, 8], wantTon: 1440, want: 100 },
      { name: '120 кг во всех рабочих строках становятся рабочим весом', ws: [120, 120, 120], rs: [6, 6, 6], wantTon: 2160, minimum: 120 },
      { name: '60/80/100 кг не закрепляют все подходы на 100 кг', ws: [60, 80, 100], rs: [8, 8, 8], wantTon: 1920, want: 100 },
      { name: 'разминка и дроп не мешают запомнить рабочие 120 кг', ws: [20, 120, 120, 30], rs: [6, 6, 6, 6], kinds: ['w', '', '', 'd'], wantTon: 1440, minimum: 120 }
    ];
    for (const fixture of fixtures) {
      const result = await page.evaluate(f => {
        S = build(); S.setup = 1; S.sound = 0; entCache = null;
        $('setup').classList.remove('on');
        S.days.forEach(d => { d.ex = []; });
        const ds = today(); sel = ds; tab = 'wo'; exOpen = 0;
        const d = dayOf(ds); d.t = 'up1';
        d.ex = [{ n: 'Жим лёжа', s: f.rs.length, r: '6-8', w: 100, g: 'Грудь' }];
        render();
        const card = document.querySelector('.ex[data-j="0"]');
        card.querySelector('[data-f="w"]').value = '100';
        card.querySelector('[data-f="r"]').value = '6-8';
        card.querySelector('[data-f="s"]').value = String(f.rs.length);
        [...card.querySelectorAll('[data-ws]')].forEach((x, i) => { x.value = String(f.ws[i]); });
        [...card.querySelectorAll('[data-rs]')].forEach((x, i) => {
          x.value = String(f.rs[i]); x.dataset.kind = (f.kinds || [])[i] || '';
        });
        toggleSet(0);
        const l = recOf(ds).log[0];
        return { working: dayOf(ds).ex[0].w, ton: dayTon(ds), done: l.done, ws: l.ws, rs: l.rs };
      }, fixture);
      check(fixture.name, result, actual => {
        assert.equal(actual.done, 1);
        assert.equal(actual.ton, fixture.wantTon, 'тоннаж только фактических рабочих строк');
        if (fixture.want !== undefined) assert.equal(actual.working, fixture.want, 'рабочий вес без ложной прибавки');
        else assert.ok(actual.working >= fixture.minimum, 'рабочий вес должен быть не меньше ' + fixture.minimum + ' кг');
      });
    }
    // Mutation caught: an empty work-row list falls back to the unused card load for work/PR credit.
    const zeroWork = await page.evaluate(() => {
      S = build(); S.setup = 1; S.sound = 0; entCache = null; wkCache = null;
      S.days.forEach(d => { d.ex = []; });
      const ds = today(), past = addDays(ds, -7), n = 'Жим лёжа';
      sel = ds; tab = 'wo'; exOpen = 0;
      const d = dayOf(ds); d.t = 'up1'; d.ex = [{ n, s: 2, r: '6-8', w: 100, g: 'Грудь' }];
      S.rec[past] = { log: { 0: {
        done: 1, n, g: 'Грудь', w: '100', s: '2', r: '6-8',
        rs: [6, 6], ws: [100, 100], vol: 1200, sd: 1, xp: 12
      } } };
      S.pr[n] = 100;
      render();
      const card = document.querySelector('.ex[data-j="0"]');
      card.querySelector('[data-f="w"]').value = '120';
      card.querySelector('[data-f="r"]').value = '6-8';
      card.querySelector('[data-f="s"]').value = '2';
      [...card.querySelectorAll('[data-ws]')].forEach((x, i) => { x.value = String([20, 30][i]); });
      [...card.querySelectorAll('[data-rs]')].forEach((x, i) => { x.value = '6'; x.dataset.kind = ['w', 'd'][i]; });
      toggleSet(0);
      const l = recOf(ds).log[0];
      return { working: dayOf(ds).ex[0].w, ton: dayTon(ds), sets: daySets(ds), pr: S.pr[n], xp: l.xp, recs: l.recs || [], previousPr: l.prevPr };
    });
    check('только разминка/дроп не повышают рабочие 100 кг по общей графе 120', zeroWork, actual => assert.equal(actual.working, 100));
    check('только разминка/дроп дают нулевой тоннаж и ноль рабочих подходов', zeroWork, actual => {
      assert.equal(actual.ton, 0); assert.equal(actual.sets, 0);
    });
    check('только разминка/дроп сохраняют прежний рекорд 100 кг', zeroWork, actual => assert.equal(actual.pr, 100));
    check('только разминка/дроп не получают бонус опыта за ложный рекорд', zeroWork, actual => {
      assert.notEqual(actual.xp, 30); assert.deepEqual(actual.recs, []);
    });
    // Removing a real PR must not resurrect the unused load of a warmup-only session.
    const afterUndoRecord = await page.evaluate(() => {
      const ds = addDays(today(), -1), n = 'Жим лёжа';
      const d = dayOf(ds); d.t = 'up1'; d.ex = [{ n, s: 2, r: '6-8', w: 100, g: 'Грудь' }];
      S.rec[ds] = { log: { 0: { done: 1, n, g: 'Грудь', w: '110', s: '2', r: '6-8',
        rs: [6, 6], vol: 1320, sd: 1, xp: 12 } }, sp: {} };
      S.pr[n] = 110; entCache = null;
      sel = ds; tab = 'wo'; exOpen = 0; editPast = true; render();
      toggleSet(0);
      return S.pr[n];
    });
    check('отмена настоящего рекорда не возвращает общий вес сессии без рабочих подходов',
      afterUndoRecord, actual => assert.equal(actual, 100));
    // Mutation caught: failStreak/maybeRegress use the unused card load instead of work-row loads.
    for (const fixture of [
      { name: 'два недобора на фактических 60 кг не снижают рабочие 100 кг', common: 100, actual: 60, want: 100 },
      { name: 'два недобора на фактических 100 кг снижают 100 до 97,5 кг при общей графе 60', common: 60, actual: 100, want: 97.5 },
      { name: 'пустой вес строки берёт общие 120 кг: 100/120/100 не снижают рабочие 100 кг', common: 120, ws: [100, '', 100], want: 100, wantTon: 1600 }
    ]) {
      const result = await page.evaluate(f => {
        S = build(); S.setup = 1; S.sound = 0; entCache = null; wkCache = null;
        S.days.forEach(d => { d.ex = []; });
        const ds = today(), past = addDays(ds, -7), n = 'Жим лёжа';
        const ws = f.ws || [f.actual, f.actual, f.actual];
        sel = ds; tab = 'wo'; exOpen = 0;
        const d = dayOf(ds); d.t = 'up1'; d.ex = [{ n, s: 3, r: '6-8', w: 100, g: 'Грудь' }];
        S.rec[past] = { log: { 0: {
          done: 1, n, g: 'Грудь', w: String(f.common), s: '3', r: '6-8',
          rs: [5, 5, 5], ws, vol: f.wantTon === undefined ? f.actual * 15 : f.wantTon, sd: 1
        } } };
        render();
        const card = document.querySelector('.ex[data-j="0"]');
        card.querySelector('[data-f="w"]').value = String(f.common);
        card.querySelector('[data-f="r"]').value = '6-8';
        card.querySelector('[data-f="s"]').value = '3';
        [...card.querySelectorAll('[data-ws]')].forEach((x, i) => { x.value = String(ws[i]); });
        [...card.querySelectorAll('[data-rs]')].forEach(x => { x.value = '5'; });
        toggleSet(0);
        return { working: dayOf(ds).ex[0].w, rows: recOf(ds).log[0].ws, reps: recOf(ds).log[0].rs, ton: dayTon(ds) };
      }, fixture);
      check(fixture.name, result, actual => {
        if (fixture.wantTon !== undefined) assert.equal(actual.ton, fixture.wantTon);
        assert.equal(actual.working, fixture.want);
      });
    }
    // Mutation caught: one name-keyed past override affects every new duplicate slot.
    const collision = await page.evaluate(() => {
      S = build(); S.setup = 1; S.sound = 0; entCache = null;
      S.days.forEach(d => { d.ex = []; });
      const ds = today(), past = addDays(ds, -1), i = wdOf(ds), j = wdOf(past);
      const a = 'Жим лёжа', b = 'Жим гантелей лёжа';
      S.days[i].t = S.days[j].t = 'up1';
      S.days[i].ex = [{ n: a, w: 60, r: '6-8', s: 3, g: 'Грудь' }];
      S.days[j].ex = [
        { n: a, w: 60, r: '6-8', s: 3, g: 'Грудь' },
        { n: b, w: 20, r: '8-12', s: 3, g: 'Грудь' }
      ];
      S.rec[past] = { log: { 0: { done: 1, n: a, s: 3, r: '6-8', w: 60, rs: [6, 6, 6], g: 'Грудь' } } };
      sel = ds; tab = 'wo'; exOpen = null; render();
      const applied = swapApply(ds, 0, b, null, 20, true);
      return { applied, exercises: dayOf(past).ex.map(e => ({ n: e.n, w: e.w, r: e.r })), ton: dayTon(past) };
    });
    check('глобальная замена сохраняет оба разных места прошлого дня', collision, actual => {
      assert.equal(actual.applied, true);
      assert.equal(actual.ton, 1080);
      assert.deepEqual(actual.exercises, [
        { n: 'Жим лёжа', w: 60, r: '6-8' },
        { n: 'Жим гантелей лёжа', w: 20, r: '8-12' }
      ]);
    });
    // Mutation caught: deleting today's draft before determining whether its colliding template is skipped.
    const skippedDraft = await page.evaluate(() => {
      S = build(); S.setup = 1; S.sound = 0; entCache = null; wkCache = null;
      S.days.forEach(d => { d.ex = []; });
      const ds = today(), i = wdOf(ds), other = (i + 1) % 7;
      const a = 'Жим лёжа', b = 'Жим гантелей лёжа', c = 'Отжимания от пола';
      S.days[i].t = S.days[other].t = 'up1';
      S.days[i].ex = [
        { n: a, w: 60, r: '6-8', s: 3, g: 'Грудь' },
        { n: b, w: 20, r: '8-12', s: 3, g: 'Грудь' }
      ];
      S.days[other].ex = [{ n: a, w: 60, r: '6-8', s: 3, g: 'Грудь' }];
      S.once = { [ds]: { [b]: { n: c, w: 0, r: '8-12', s: 3, g: 'Грудь' } } };
      S.rec[ds] = { log: { 0: { rs: [6, 7, 8] } } };
      sel = ds; tab = 'wo'; exOpen = null; render();
      const applied = swapApply(ds, 0, b, null, 20, true);
      return {
        applied, template: S.days[i].ex.map(e => ({ n: e.n, w: e.w, r: e.r })),
        once: S.once && S.once[ds] && S.once[ds][b], draft: recOf(ds).log[0] || null,
        other: S.days[other].ex[0].n
      };
    });
    check('пропущенный при глобальной замене день сохраняет шаблон, разовую замену и черновик', skippedDraft, actual => {
      assert.equal(actual.applied, true);
      assert.equal(actual.other, 'Жим гантелей лёжа');
      assert.deepEqual(actual.template, [
        { n: 'Жим лёжа', w: 60, r: '6-8' },
        { n: 'Жим гантелей лёжа', w: 20, r: '8-12' }
      ]);
      assert.deepEqual(actual.once, { n: 'Отжимания от пола', w: 0, r: '8-12', s: 3, g: 'Грудь' });
      assert.deepEqual(actual.draft, { rs: [6, 7, 8] });
    });
    // Mutation caught: comparing proxy identity to the template misses the past-day snapshot.
    const pastType = await page.evaluate(async () => {
      S = build(); S.setup = 1; S.sound = 0; entCache = null;
      const ds = addDays(today(), -7), i = wdOf(ds), a = 'Жим лёжа', b = 'Жим гантелей лёжа';
      S.days[i].t = 'up1'; S.days[i].s = 'Верх · сила';
      S.days[i].ex = [{ n: a, s: 3, r: '6-8', w: 60, g: 'Грудь' }];
      S.once = { [ds]: { [a]: { n: b, s: 3, r: '6-8', w: 20, g: 'Грудь' } } };
      S.rec[ds] = { log: { 0: { done: 1, n: b, s: 3, r: '6-8', w: 20, rs: [6, 6, 6], g: 'Грудь' } } };
      sel = today(); tab = 'wo'; exOpen = null; render();
      const pending = setDayType(i, 'rest'); $('askY').click(); await pending;
      return { look: dayLook(ds), planned: weekData(mondayOf(ds)).days.find(x => x.ds === ds).tr, ton: dayTon(ds) };
    });
    check('тип прошлого дня с разовой заменой не становится отдыхом', pastType, actual => {
      assert.deepEqual(actual.look, { t: 'up1', s: 'Верх · сила' });
      assert.equal(actual.planned, true);
      assert.equal(actual.ton, 360);
    });
    check('сценарии не вызывают ошибок страницы', errors, actual => assert.deepEqual(actual, []));
  } finally { await browser.close(); }
  process.exitCode = failures ? 1 : 0;
})().catch(error => { console.error('FATAL', error); process.exitCode = 1; });
