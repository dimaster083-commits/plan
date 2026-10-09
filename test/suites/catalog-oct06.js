/* Каталог: компактное начало, полная база, живые «Мои» и сохранённая личность.
   Проверки ловят устаревший снимок избранного/использованных id, фильтрацию
   лесенки активным списком и затирание связки при совпавших русских именах. */
const { chromium } = require('playwright-core');
const { LAUNCH, APP } = require('../env');
let fails = 0;
const chk = (yes, name, detail) => {
  if (!yes) fails++;
  console.log('  ' + (yes ? '✓ ' : '✗ ') + name + (detail ? ' → ' + JSON.stringify(detail) : ''));
};
(async () => {
  const browser = await chromium.launch(LAUNCH);
  const page = await (await browser.newContext({ viewport: { width: 320, height: 700 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.route('https://cdn.jsdelivr.net/**', r => r.abort());
  await page.goto(APP);
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function' && !document.getElementById('boot') && document.getElementById('setup').classList.contains('on'));
  await page.evaluate(async () => {
    S.setup = 1; S.sound = 0; S.hints = 0;
    document.getElementById('setup').classList.remove('on');
    S.rec = {}; S.once = {}; S.fav = []; S.libEx = {}; S.myEx = {};
    const day = dayOf(today()); day.t = 'up1';
    day.ex = [{ n: 'Жим лёжа', s: 3, r: '8-10', w: 60, g: 'Грудь' }];
    sel = today(); tab = 'ex'; await loadLib(); render();
  });

  const start = await page.evaluate(() => ({ scope: LF.scope, n: libList().length,
    ids: libList().map(o => o.id), full: LIB.byId.size,
    scopes: [...document.querySelectorAll('[data-lscope]')].map(b => b.dataset.lscope) }));
  chk(start.scope === 'core' && start.n === 40 && start.ids.includes('Machine_Bench_Press') &&
    !start.ids.includes('Inchworm') && !start.ids.includes('Upright_Barbell_Row') && start.full === 876,
  'первое открытие показывает компактную основу и сохраняет все 876 id', { scope: start.scope, n: start.n, full: start.full });
  chk(start.scopes.join(',') === 'core,mine,all', 'Основа / Мои / Вся база доступны отдельными кнопками', start.scopes);

  const full = await page.evaluate(() => {
    LF.scope = 'all'; LF.q = ''; LF.mu = ''; paintLib();
    const n = libList().length;
    LF.q = 'inchworm'; paintLib();
    const found = [...document.querySelectorAll('#exgrid [data-lib]')].map(b => b.dataset.lib);
    LF.q = ''; LF.scope = 'core'; LF.mu = '';
    document.querySelector('[data-lmu="cardio"]').click();
    const cardioCore = LF.scope;
    document.querySelector('#exgrid [data-lall]')?.click();
    const cardio = { scope: LF.scope, n: libList().length };
    LF.scope = 'core'; LF.mu = '';
    document.querySelector('[data-lmu="stretch"]').click();
    const stretchCore = LF.scope;
    document.querySelector('#exgrid [data-lall]')?.click();
    const stretch = { scope: LF.scope, n: libList().length };
    LF.mu = ''; LF.q = ''; paintLib();
    return { n, found, cardio, stretch, cardioCore, stretchCore };
  });
  chk(full.n === 876 && full.found.includes('Inchworm'), 'в полной базе доступны все упражнения и поиск по скрытому раньше id', full);
  chk(full.cardioCore === 'core' && full.stretchCore === 'core' && full.cardio.scope === 'all' &&
    full.cardio.n > 0 && full.stretch.scope === 'all' && full.stretch.n > 0,
    'кардио и растяжка доступны после явного открытия всей базы', full);

  const favFocus = await page.evaluate(() => {
    LF.scope = 'all'; LF.mu = ''; LF.q = ''; paintLib();
    const button = document.querySelector('#exgrid [data-lfav]'), id = button.dataset.lfav;
    button.focus(); libToggleFav(id);
    const kept = document.activeElement && document.activeElement.dataset.lfav === id;
    libToggleFav(id); return kept;
  });
  chk(favFocus, 'переключение избранного сохраняет фокус клавиатуры в полной базе');

  const fav = await page.evaluate(() => {
    LF.scope = 'mine'; LF.mu = 'fav';
    libToggleFav('Inchworm');
    const added = libList().map(o => o.id);
    const cards = [...document.querySelectorAll('#exgrid [data-lib]')].map(b => b.dataset.lib);
    flush(); return { added, cards };
  });
  chk(fav.added.includes('Inchworm') && fav.cards.includes('Inchworm'), 'новое избранное сразу видно без переиндексации', fav);
  await page.reload();
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
  const reloaded = await page.evaluate(async () => {
    await loadLib(); tab = 'ex'; LF.scope = 'mine'; LF.mu = 'fav'; paintLib();
    const yes = libList().some(o => o.id === 'Inchworm');
    libToggleFav('Inchworm');
    return { yes, removed: !libList().some(o => o.id === 'Inchworm'), fav: S.fav };
  });
  chk(reloaded.yes && reloaded.removed && reloaded.fav.length === 0,
    'избранное переживает загрузку и удаляется из «Моих» сразу', reloaded);

  const used = await page.evaluate(() => {
    LF.mu = ''; LF.scope = 'mine'; sel = today();
    libAdd('Running_Treadmill', today());
    const name = Object.keys(S.libEx).find(n => S.libEx[n][0] === 'Running_Treadmill');
    return { listed: libList().some(o => o.id === 'Running_Treadmill'), name,
      lookup: !!name && (libByName(name) || {}).id, mineOwn: libList().some(o => o.id === 'Barbell_Bench_Press_-_Medium_Grip') };
  });
  chk(used.listed && used.lookup === 'Running_Treadmill' && used.mineOwn,
    'добавленное скрытое упражнение и упражнение программы сразу находятся в «Моих»', used);

  const custom = await page.evaluate(() => {
    S.myEx['Моё контрольное движение'] = 'Спина';
    LF.scope = 'mine'; LF.q = 'контрольное'; tab = 'ex'; paintLib();
    const rows = libList(); return { names: rows.map(o => o.n), id: (rows[0] || {}).id,
      rendered: document.getElementById('exgrid').textContent, mapped: !!S.libEx['Моё контрольное движение'] };
  });
  chk(custom.names.includes('Моё контрольное движение') && /Моё контрольное движение/.test(custom.rendered) && !custom.mapped,
    'самостоятельно созданное упражнение доступно в «Моих» без подмены базой', custom);
  if (custom.id) {
    await page.evaluate(id => openLib(id), custom.id);
    await page.waitForFunction(() => document.querySelector('#shB .lname')?.textContent === 'Моё контрольное движение');
    const customOpen = await page.evaluate(() => ({ name: document.querySelector('#shB .lname').textContent,
      tech: document.getElementById('shB').textContent, add: !!document.querySelector('#shB [data-libadd]') }));
    chk(customOpen.add && /описание|Описание/.test(customOpen.tech), 'своё движение открывается отдельной карточкой и доступно для добавления', customOpen);
  } else chk(false, 'своё движение открывается отдельной карточкой и доступно для добавления');

  const ladders = [];
  for (const scope of ['core', 'mine', 'all']) {
    await page.evaluate(scope => { sheetClose(); LF.q = 'inchworm'; LF.mu = 'fav'; LF.scope = scope; openLib('Barbell_Deadlift'); }, scope);
    await page.waitForFunction(() => document.querySelector('#shB .lpage') && document.querySelector('#shB [data-libadd="Barbell_Deadlift"]'));
    ladders.push(await page.evaluate(() => [...document.querySelectorAll('#shB .lstep [data-lib]')].map(b => b.dataset.lib)));
  }
  const expectedHip = ['Seated_Leg_Curl', 'Single_Leg_Glute_Bridge', 'Hyperextensions_Back_Extensions', 'Romanian_Deadlift', 'Barbell_Deadlift', 'Kettlebell_One-Legged_Deadlift'];
  chk(ladders.every(ids => JSON.stringify(ids) === JSON.stringify(expectedHip)),
    'лесенка содержит полный доступный набор и не зависит от вида/поиска/избранного', ladders);

  const metadata = await page.evaluate(() => ['Standing_Cable_Chest_Press', 'Handstand_Push-Ups', 'One-Arm_Dumbbell_Row', 'Kettlebell_Sumo_High_Pull']
    .map(id => { const o = LIB.byId.get(id); return { id, st: o.st, pl: o.pl }; }));
  chk(metadata.every(o => o.st === 0) && metadata[3].pl === 'vpush',
    'четыре несовпадающие техники не получают точной ступени, высокая тяга не становится шрагом', metadata);

  const duplicate = await page.evaluate(() => {
    sheetClose(); LF.q = ''; LF.mu = ''; LF.scope = 'all';
    const ids = ['Bent_Over_One-Arm_Long_Bar_Row', 'One-Arm_Long_Bar_Row'];
    return ids.map(id => ({ id, name: LIB.byId.get(id).n, card: libCard(LIB.byId.get(id)) }));
  });
  chk(duplicate[0].name !== duplicate[1].name && duplicate.every(o => /вариант/i.test(o.name)),
    'одноимённые варианты в каталоге различаются до выбора', duplicate.map(o => ({ id: o.id, name: o.name })));
  const identity = await page.evaluate(() => {
    const legacy = 'Тяга Т-грифа одной рукой', first = 'Bent_Over_One-Arm_Long_Bar_Row', second = 'One-Arm_Long_Bar_Row';
    S.myEx[legacy] = 'Спина'; S.libEx[legacy] = [first, 'Спина'];
    dayOf(today()).ex = [{ n: legacy, g: 'Спина', s: 3, r: '8-10', w: 20 }];
    S.rec = { '2026-09-01': { log: { 0: { n: legacy, g: 'Спина', s: 3, r: '8-10', w: 20, rs: [8, 8, 8], done: 1 } } } };
    const rec = JSON.stringify(S.rec);
    libAdd(second, today());
    const added = dayOf(today()).ex[1];
    const secondId = S.libEx[added.n] && S.libEx[added.n][0];
    const beforeRepeat = JSON.stringify(S);
    libAdd(first, today());
    flush();
    return { old: S.libEx[legacy][0], added: added.n, secondId, oldName: dayOf(today()).ex[0].n,
      count: dayOf(today()).ex.length, repeatUnchanged: JSON.stringify(S) === beforeRepeat,
      history: JSON.stringify(S.rec) === rec };
  });
  chk(identity.old === 'Bent_Over_One-Arm_Long_Bar_Row' && identity.secondId === 'One-Arm_Long_Bar_Row' &&
    identity.added !== 'Тяга Т-грифа одной рукой' && identity.oldName === 'Тяга Т-грифа одной рукой' &&
    identity.count === 2 && identity.repeatUnchanged && identity.history,
    'другой вариант сохраняет прежнюю личность; повтор прежнего id не добавляет дубликат и не меняет состояние', identity);

  await page.waitForTimeout(400); // повторное действие после защиты от двойного тапа
  const oneSlot = await page.evaluate(() => {
    const ds = today(), secondName = dayOf(ds).ex[1].n;
    const row = LIB.byId.get('Dumbbell_Bench_Press'), replacement = libExerciseName(row);
    const applied = swapApply(ds, 0, replacement, row, 30, false);
    const beforeAdd = JSON.stringify(S);
    libAdd('Bent_Over_One-Arm_Long_Bar_Row', ds);
    return { applied, first: dayOf(ds).ex[0].n, replacement,
      second: dayOf(ds).ex[1].n, secondName, count: dayOf(ds).ex.length,
      baseBlocked: JSON.stringify(S) === beforeAdd };
  });
  chk(oneSlot.applied && oneSlot.first === oneSlot.replacement && oneSlot.second === oneSlot.secondName &&
    oneSlot.count === 2 && oneSlot.baseBlocked,
    'разовая замена меняет только выбранный слот, повтор исходного имени шаблона блокируется', oneSlot);

  const stableId = await page.evaluate(() => {
    const id = 'Barbell_Curl', alias = 'Другой старый псевдоним';
    S.once = {}; S.myEx['Сгибания старые'] = 'Руки'; S.libEx['Сгибания старые'] = [id, 'Бицепс'];
    S.myEx[alias] = 'Руки'; S.libEx[alias] = [id, 'Бицепс'];
    dayOf(today()).ex = [{ n: alias, g: 'Руки', s: 3, r: '8-10', w: 20 }];
    const before = JSON.stringify(S); libAdd(id, today());
    return { same: JSON.stringify(S) === before, count: dayOf(today()).ex.length,
      note: document.getElementById('noteT').textContent };
  });
  chk(stableId.same && stableId.count === 1 && /уже/.test(stableId.note),
    'повтор одного id под прежним другим именем блокируется с понятным сообщением', stableId);

  const legacyPicker = await page.evaluate(() => {
    S.once = {}; dayOf(today()).ex = [{ n: 'Жим лёжа', g: 'Грудь', s: 3, r: '8-10', w: 60 }];
    sel = today(); tab = 'wo'; render(); openExPicker();
    const before = JSON.stringify(S);
    document.querySelector('#shB [data-addex="Жим лёжа"]').click();
    const result = { same: JSON.stringify(S) === before, count: dayOf(today()).ex.length,
      note: document.getElementById('noteT').textContent };
    sheetClose(); return result;
  });
  chk(legacyPicker.same && legacyPicker.count === 1 && /уже/.test(legacyPicker.note),
    'старый выбор упражнения также не создаёт одинаковые имена в дне', legacyPicker);

  const customPicker = await page.evaluate(() => {
    openExPicker(); const input = document.getElementById('exq');
    input.value = 'Жим  лёжа'; input.dispatchEvent(new Event('input', { bubbles: true }));
    const before = JSON.stringify(S), button = document.querySelector('#shB [data-myex="Грудь"]');
    if (button) button.click();
    const result = { button: !!button, same: JSON.stringify(S) === before, count: dayOf(today()).ex.length,
      note: document.getElementById('noteT').textContent };
    sheetClose(); return result;
  });
  chk(customPicker.button && customPicker.same && customPicker.count === 1 && /уже/.test(customPicker.note),
    'создание своего имени после нормализации пробелов также не дублирует имеющееся', customPicker);

  const oldDuplicates = await page.evaluate(() => {
    S.once = {}; dayOf(today()).ex = [
      { n: 'Жим лёжа', g: 'Грудь', s: 3, r: '8-10', w: 60 },
      { n: 'Жим лёжа', g: 'Грудь', s: 3, r: '8-10', w: 70 }
    ];
    const row = LIB.byId.get('Dumbbell_Bench_Press'), name = libExerciseName(row);
    const before = JSON.stringify(S);
    const once = swapApply(today(), 0, name, row, 30, false);
    const safe = JSON.stringify(S) === before, note = document.getElementById('noteT').textContent;
    S = JSON.parse(before); // отдельный исходный случай для явно общей замены
    const history = JSON.stringify(S.rec);
    const all = swapApply(today(), 0, name, row, 30, true);
    return { once, safe, note, all, names: dayOf(today()).ex.map(e => e.n), name,
      history: JSON.stringify(S.rec) === history };
  });
  chk(!oldDuplicates.once && oldDuplicates.safe && /дубликат|одинаков/.test(oldDuplicates.note),
    'разовая замена старых одинаковых имён отклоняется с объяснением и без записи состояния', oldDuplicates);
  chk(oldDuplicates.all && oldDuplicates.names.every(n => n === oldDuplicates.name) && oldDuplicates.history,
    'явная замена во всех днях остаётся доступной, сохранённые записи не меняются', oldDuplicates);
  await page.reload();
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function');
  const persisted = await page.evaluate(async () => {
    await loadLib(); const name = Object.keys(S.libEx).find(n => S.libEx[n][0] === 'One-Arm_Long_Bar_Row');
    return { old: S.libEx['Тяга Т-грифа одной рукой'][0], name, pic: name && exPic(name, 0),
      history: (S.rec['2026-09-01'].log[0] || {}).n };
  });
  chk(persisted.old === 'Bent_Over_One-Arm_Long_Bar_Row' && persisted.name !== 'Тяга Т-грифа одной рукой' &&
    /\/One-Arm_Long_Bar_Row\/0\.jpg$/.test(persisted.pic || '') && persisted.history === 'Тяга Т-грифа одной рукой',
    'различные личности и фотографии остаются после загрузки', persisted);

  const mobile = await page.evaluate(() => {
    tab = 'ex'; LF.q = ''; LF.mu = ''; LF.scope = 'all'; render();
    const buttons = [...document.querySelectorAll('#scr-ex [data-lscope],#scr-ex .lfav,#scr-ex .lmu')].filter(x => x.offsetParent);
    return { width: document.documentElement.scrollWidth, min: Math.min(...buttons.map(x => Math.min(x.getBoundingClientRect().width, x.getBoundingClientRect().height))) };
  });
  chk(mobile.width <= 320 && mobile.min >= 44, 'каталог помещается в 320 px, выбор вида и избранное имеют цели 44 px', mobile);
  chk(errors.length === 0, 'каталог без ошибок JavaScript', errors);
  await browser.close();
  process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
