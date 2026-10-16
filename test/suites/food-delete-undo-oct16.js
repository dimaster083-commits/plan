/* BUG-0036: Undo restores the one selected position removed by deleting its
   own product, not an old copy of the whole picker. A broken/missing back
   loses B; an unconditional snapshot overwrites later toggles or a new picker.
   Literal arithmetic: 125g saved B + three 100g selections =425kcal.
   Real UI/state/storage; synthetic isolated profiles only. */
const assert = require('node:assert/strict');
const { chromium } = require('playwright-core');
const { APP: LOCAL_APP, LAUNCH } = require('../env');
const APP = process.env.GYM_APP_URL || LOCAL_APP;
const DAY = '2026-10-13', TIME = Date.parse('2026-10-15T12:00:00+10:00');
const only = process.argv.find(x => x.startsWith('--case='))?.slice(7);
let checks = 0, failures = 0;
function check(name, got, want) {
  checks++;
  try { assert.deepEqual(got, want); console.log('  ✓ ' + name); }
  catch (e) { failures++; console.log('  ✗ ' + name + ' ' + e.message.split('\n').slice(0, 6).join(' ')); }
}
async function tap(p, s) { await p.locator(s).first().click(); await p.clock.runFor(280); }
async function search(p, n) { await p.locator('#fq').fill('UNDO ' + n); }
async function select(p, n) { await search(p, n); await tap(p, '[data-add="UNDO ' + n + '"]'); }
async function removeB(p, yes = true) {
  await search(p, 'B'); await tap(p, '[data-my="UNDO B"]');
  await tap(p, yes ? '#askY' : '#askN');
}
async function close(p) {
  await tap(p, '#fpX');
  if (await p.locator('#ask.on').count()) await tap(p, '#askY');
}
async function state(p) {
  return p.evaluate(() => {
    flush();
    return {memory: JSON.stringify(S), disk: localStorage.getItem(KEY),
      picked: picked.map(x => ({...x})), sums: ['2026-10-13', '2026-10-14'].map(d => daySum(d).k),
      grams: S.rec['2026-10-13'].ml[0].items.map(x => x.g),
      base: S.myFood.map(x => x.n), open: $('fp').classList.contains('on'),
      bar: $('fpbar').classList.contains('on'), meal: pickMeal, ds: pickDs,
      raw: $('nfP')?.value ?? null, count: S.rec['2026-10-13'].ml[0].items.length,
      undo: !!undoRec};
  });
}
async function fresh(browser, width) {
  const ctx = await browser.newContext({viewport:{width,height:width === 320 ? 568 : 844},
    timezoneId:'Asia/Vladivostok', reducedMotion:'reduce', serviceWorkers:'block'});
  await ctx.route('https://**/*', r => new URL(r.request().url()).origin === new URL(APP).origin ? r.continue() : r.abort());
  const p = await ctx.newPage(), errors = [];
  p.setDefaultTimeout(6000); p.on('pageerror', e => errors.push(e.message));
  await p.clock.install({time:new Date(TIME - 86400000)});
  await p.clock.pauseAt(new Date(TIME));
  assert.equal(await p.evaluate(() => Date.now()), TIME);
  await p.goto(APP); await p.clock.runFor(800); await tap(p, '#setSkip');
  await p.evaluate(() => {
    S = build(); migrate(); S.setup = 1; S.sound = 0; S.hints = 0;
    S.bw = '80'; S.goal = '80'; S.height = 180; S.bkAsk = Date.now();
    S.rec = {}; S.map = {}; S.pause = {};
    S.myFood = ['A','B','C','D'].map(n => ({n:'UNDO '+n,k:100,p:10,f:2,c:15}));
    invalidateFood();
    recRW('2026-10-13').ml = [{n:'First',note:'',items:[{p:'UNDO B',g:'125'}]},
      {n:'Second',note:'',items:[]}];
    recRW('2026-10-14').ml = [{n:'History',note:'',items:[{p:'UNDO B',g:'250'}]}];
    sel = '2026-10-13'; mo = '2026-10'; tab = 'food'; exOpen = null;
    undoDrop(); save(); flush(); render();
  });
  await tap(p, '[data-pick="0"]');
  return {ctx, p, errors};
}
async function run(browser, width, name, fn) {
  if (only && name !== only) return;
  const f = await fresh(browser, width);
  try {
    console.log(width + ' ' + name); await fn(f.p);
    check('no uncaught application errors', f.errors, []);
    check('no horizontal overflow', await f.p.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
  } finally { await f.ctx.close(); }
}
(async () => {
  const browser = await chromium.launch(LAUNCH);
  try { for (const width of [320,390]) {
    await run(browser,width,'restore-and-add',async p => {
      for (const n of ['A','B','C']) await select(p,n);
      await search(p,'B'); await p.locator('#nfP').fill('0012,50');
      const before = await state(p);
      await removeB(p); const deleted = await state(p);
      check('deletion removes B only from pending choice', deleted.picked, [{p:'UNDO A',g:100},{p:'UNDO C',g:100}]);
      check('warning semantics: dated totals no longer count removed base', deleted.sums, [0,0]);
      await tap(p,'#undoB'); const restored = await state(p);
      check('Undo restores original order and grams', restored.picked,
        [{p:'UNDO A',g:100},{p:'UNDO B',g:100},{p:'UNDO C',g:100}]);
      check('Undo restores exact saved state', restored.memory, before.memory);
      check('Undo persists exact saved state', restored.disk, before.disk);
      check('Undo returns dated kcal', restored.sums, [125,250]);
      check('raw nutrient form survives deletion/Undo', restored.raw, '0012,50');
      await tap(p,'#fpAdd');
      if (await p.locator('#ask.on').count()) await tap(p,'#askY');
      const added = await state(p);
      check('actual add counts all restored selections', added.sums, [425,250]);
      check('actual add writes one original and three selections', added.count, 4);
      await tap(p,'#undoB');
      check('Undo addition returns original journal', (await state(p)).memory, before.memory);
      await p.reload(); await p.waitForFunction(() => typeof render === 'function');
      check('reload preserves original dated food', await p.evaluate(() => [daySum('2026-10-13').k,daySum('2026-10-14').k]), [125,250]);
      check('transient selections are not persisted', await p.evaluate(() => picked.length), 0);
    });
    await run(browser,width,'later-choices',async p => {
      for (const n of ['A','B','C']) await select(p,n);
      await removeB(p); await select(p,'A'); await select(p,'D');
      check('later removal/addition keeps old Undo available', (await state(p)).undo, true);
      await tap(p,'#undoB'); const s = await state(p);
      check('only B returns: A stays off, C and later D stay selected', s.picked,
        [{p:'UNDO B',g:100},{p:'UNDO C',g:100},{p:'UNDO D',g:100}]);
      check('restored base and saved calories agree', s.sums, [125,250]);
      check('visible selection marks match surviving choices', await p.evaluate(() => {
        drawPick('UNDO'); return [...$('fpl').querySelectorAll('[data-add].sel')].map(x => x.dataset.add).sort();
      }), ['UNDO B','UNDO C','UNDO D']);
    });
    await run(browser,width,'new-picker',async p => {
      await select(p,'B'); await removeB(p); await close(p);
      await tap(p,'[data-pick="1"]'); await select(p,'D');
      await p.locator('#nfP').fill('0009,50');
      await tap(p,'#undoB'); const s = await state(p);
      check('old Undo does not populate another picker', s.picked, [{p:'UNDO D',g:100}]);
      check('new picker remains open on its own meal/date', [s.open,s.meal,s.ds], [true,1,DAY]);
      check('new raw form remains intact', s.raw, '0009,50');
      check('old base deletion is still undone globally', s.sums, [125,250]);
    });
    await run(browser,width,'closed-picker',async p => {
      await select(p,'B'); await removeB(p); await close(p);
      await tap(p,'#undoB'); const s = await state(p);
      check('Undo never reopens the closed picker or restores hidden choices', [s.open,s.bar,s.picked], [false,false,[]]);
      check('closed picker Undo restores saved food', s.sums, [125,250]);
      await tap(p,'[data-pick="0"]');
      check('subsequent picker starts empty', (await state(p)).picked, []);
    });
    await run(browser,width,'unselected-product',async p => {
      await select(p,'A'); await select(p,'C'); await removeB(p);
      await tap(p,'#undoB');
      check('Undo of an unselected product does not invent a selection', (await state(p)).picked,
        [{p:'UNDO A',g:100},{p:'UNDO C',g:100}]);
    });
    await run(browser,width,'decline-and-expire',async p => {
      await select(p,'B'); const before = await state(p);
      await removeB(p,false); const cancelled = await state(p);
      check('declining deletion leaves state and disk unchanged', [cancelled.memory,cancelled.disk], [before.memory,before.disk]);
      check('declining deletion retains selected position', cancelled.picked, [{p:'UNDO B',g:100}]);
      await removeB(p); await p.clock.runFor(7100); const expired = await state(p);
      check('expired Undo does not silently restore selection/base', [expired.undo,expired.picked,expired.sums], [false,[],[0,0]]);
      await p.reload(); await p.waitForFunction(() => typeof render === 'function');
      check('confirmed deletion persists after reload', await p.evaluate(() => S.myFood.map(x => x.n)), ['UNDO A','UNDO C','UNDO D']);
    });
  } } finally { await browser.close(); }
  console.log('FOOD DELETE UNDO: ' + checks + ' checks, ' + failures + ' failures');
  process.exitCode = failures ? 1 : 0;
})().catch(e => { console.error(e.stack); process.exitCode = 2; });
