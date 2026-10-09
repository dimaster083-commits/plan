/* Реальный каталог: компактный выбор не прячет свою программу, полная база
   открывается явно, а добавление не создаёт дубль или упражнение в отдыхе. */
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
  await page.waitForFunction(() => typeof S !== 'undefined' && typeof render === 'function' && !document.getElementById('boot'));
  await page.evaluate(async () => {
    S.setup = 1; S.sound = 0; S.hints = 0;
    document.getElementById('setup').classList.remove('on');
    S.rec = {}; S.once = {}; S.fav = []; S.libEx = {}; S.myEx = {};
    sel = today(); dayOf(sel).t = 'up1';
    dayOf(sel).ex = [{ n: 'Жим лёжа', s: 3, r: '8-10', w: 60, g: 'Грудь' }];
    tab = 'ex'; await loadLib(); render();
  });

  // Старый own||st даёт 78 и прячет три упражнения стартовой программы.
  const compact = await page.evaluate(() => {
    LF.scope = 'core'; LF.q = ''; LF.mu = ''; paintLib();
    const list = libList(), names = list.map(o => o.n);
    return { n: list.length, cards: document.querySelectorAll('#exgrid [data-lib]').length,
      ids: list.map(o => o.id), names, full: LIB.byId.size };
  });
  const programNames = ['Жим лёжа', 'Тяга штанги в наклоне', 'Жим гантелей на наклонной', 'Тяга верхнего блока',
    'Жим гантелей сидя', 'Махи в наклоне', 'Подъём штанги на бицепс', 'Французский жим',
    'Присед со штангой', 'Становая тяга', 'Жим ногами', 'Сгибания ног', 'Икры стоя', 'Подъём ног в висе',
    'Разводка гантелей', 'Тяга горизонтального блока', 'Тяга гантели одной рукой', 'Махи в стороны',
    'Тяга каната к лицу', 'Сгибания на скамье Скотта', 'Разгибания на блоке', 'Фронтальный присед',
    'Румынская тяга', 'Болгарские выпады', 'Икры сидя', 'Пресс'];
  chk(compact.n === 40 && compact.cards === 40 && compact.full === 876 &&
    !compact.ids.includes('Zercher_Squats') && !compact.ids.includes('Inchworm'),
  'первый экран содержит 40 обычных упражнений; все 876 вариантов сохранены', { n: compact.n, cards: compact.cards, full: compact.full });
  chk(programNames.every(n => compact.names.includes(n)),
    'все 26 движений стартовой программы видны в основе под прежними именами', programNames.filter(n => !compact.names.includes(n)));

  // Переименование own вместе с переводным дублем ломало libByName и подбор замен.
  const identity = await page.evaluate(() => {
    const o = libByName('Жим гантелей сидя');
    return { lookup: o && o.id, name: LIB.byId.get('Seated_Dumbbell_Press').n,
      other: LIB.byId.get('Dumbbell_Shoulder_Press').n, plane: o && o.pl,
      choices: swapCands('Жим гантелей сидя', today()).filter(c => c.tier === 0).map(c => c.o.id) };
  });
  chk(identity.lookup === 'Seated_Dumbbell_Press' && identity.name === 'Жим гантелей сидя' &&
    identity.other !== identity.name && identity.plane === 'vpush' && identity.choices.includes('Standing_Military_Press'),
  'встроенное имя сохраняет id и тип движения при одноимённом варианте', identity);

  const stale = await page.evaluate(() => {
    LF.scope = 'all'; LF.q = 'ничего'; LF.mu = 'fo'; LF.eq = 'k'; LF.lv = 3;
    LF.pl = 'vpn'; LF.cat = 't'; LF.safe = true; LF.ru = true;
    libOpenPick(today());
    return { f: { ...LF }, count: libList().length, pick: libPick };
  });
  chk(stale.f.scope === 'core' && !stale.f.q && !stale.f.mu && !stale.f.eq && !stale.f.lv &&
    !stale.f.pl && !stale.f.cat && !stale.f.safe && !stale.f.ru && stale.count === 40,
  'новый выбор из Зала открывает основу без прежних фильтров', stale);

  const search = await page.evaluate(() => {
    const i = document.getElementById('exs'); i.value = 'зерхер'; i.dispatchEvent(new Event('input'));
    const before = libList().length;
    document.querySelector('[data-lscope="all"]').click();
    return { before, q: LF.q, input: i.value, ids: libList().map(o => o.id) };
  });
  chk(search.before === 0 && search.q === 'зерхер' && search.input === 'зерхер' && search.ids.includes('Zercher_Squats'),
    'переход ко всем вариантам сохраняет поиск скрытого упражнения', { before: search.before, q: search.q, found: search.ids.includes('Zercher_Squats') });

  const explicit = await page.evaluate(() => {
    LF.scope = 'core'; LF.q = ''; LF.mu = ''; paintLib();
    document.querySelector('[data-lmu="cardio"]').click();
    const before = { scope: LF.scope, n: libList().length };
    const expand = document.querySelector('#exgrid [data-lall]');
    if (expand) expand.click();
    return { before, offered: !!expand, scope: LF.scope, category: LF.mu, n: libList().length };
  });
  chk(explicit.before.scope === 'core' && explicit.before.n === 0 && explicit.offered &&
    explicit.scope === 'all' && explicit.category === 'cardio' && explicit.n > 0,
  'кардио открывает полную базу только явным выбором, сохраняя фильтр', explicit);

  const mine = await page.evaluate(() => {
    S.myEx['Личная тяга'] = 'Спина';
    S.myEx['Беговая дорожка личная'] = 'Ноги'; S.libEx['Беговая дорожка личная'] = ['Running_Treadmill', null];
    S.fav = ['Inchworm'];
    S.rec = { '2026-09-01': { log: { 0: { n: 'Шраги со штангой', g: 'Спина', s: 3, r: '8-10', w: 40, rs: [8, 8, 8], done: 1 } } } };
    const before = JSON.stringify(S);
    LF.scope = 'mine'; LF.mu = ''; LF.q = ''; paintLib();
    const ids = libList().map(o => o.id);
    sel = today(); tab = 'wo'; libPick = null; render(); openExPicker();
    const names = [...document.querySelectorAll('#shB [data-addex]')].map(b => b.dataset.addex);
    return { ids, names, unchanged: before === JSON.stringify(S) };
  });
  chk(mine.ids.includes('Inchworm') && mine.ids.includes('Running_Treadmill') && mine.ids.includes('Barbell_Shrug') &&
    mine.names.includes('Личная тяга') && mine.names.includes('Беговая дорожка личная') &&
    mine.names.includes('Шраги со штангой') && mine.names.includes('«Гусеница»') &&
    !mine.names.includes('Присед Зерхера') && mine.unchanged,
  'обычный выбор включает личные, избранные и использованные упражнения без переписывания истории', { personal: mine.names.filter(n => /Личная|личная|Шраги|Гусеница/.test(n)), unchanged: mine.unchanged });

  // Новое избранное не имеет S.libEx до первого добавления: простой push
  // имени теряет id, мышцу и фотографию, хотя оно видно в обычном выборе.
  const favAdd = await page.evaluate(() => {
    const history = JSON.stringify(S.rec);
    document.querySelector('#shB [data-addex="«Гусеница»"]').click();
    const added = dayOf(today()).ex.find(e => e.n === '«Гусеница»');
    return { added, link: S.libEx['«Гусеница»'], muscle: added && muscleOf(added.n, added.g),
      image: exPic('«Гусеница»', 0), history: history === JSON.stringify(S.rec) };
  });
  chk(favAdd.added && favAdd.added.g === 'Ноги' && favAdd.link && favAdd.link[0] === 'Inchworm' &&
    favAdd.muscle === 'Бицепс бедра' && /\/Inchworm\/0\.jpg$/.test(favAdd.image) && favAdd.history,
  'избранное из обычного выбора сохраняет id, мышцу и фото без изменения прошлых записей', favAdd);

  const picker = await page.evaluate(() => {
    S.rec = {}; S.once = {}; S.myEx = {}; S.libEx = {}; S.fav = [];
    dayOf(today()).ex = [{ n: 'Жим лёжа', s: 3, r: '8-10', w: 60, g: 'Грудь' }];
    sheetClose(); openExPicker();
    const n = document.querySelectorAll('#shB [data-addex]').length;
    const used = document.querySelector('#shB [data-addex="Жим лёжа"]');
    const state = { disabled: used.disabled, text: used.textContent };
    document.querySelector('#shB [data-libpick]').click();
    return { n, state, scope: LF.scope, full: libList().length };
  });
  chk(picker.n === 40 && picker.state.disabled && /уже/i.test(picker.state.text),
    'обычное окно также показывает 40 и заранее обозначает упражнение, которое уже в дне', picker);
  chk(picker.scope === 'all' && picker.full === 876,
    'отдельная ссылка обычного выбора явно открывает все варианты', picker);

  const duplicates = await page.evaluate(async () => {
    const id = 'Barbell_Bench_Press_-_Medium_Grip';
    LF.scope = 'core'; LF.q = ''; LF.mu = ''; paintLib();
    const card = document.querySelector('#exgrid [data-lib="' + id + '"]');
    const button = card.querySelector('[data-libadd]');
    const before = JSON.stringify(S), cardState = { disabled: button.disabled, text: card.textContent };
    libAdd(id, today());
    await openLib(id); await Promise.resolve();
    const detail = document.querySelector('#shB [data-libadd]');
    return { cardState, detail: detail && { disabled: detail.disabled, text: detail.textContent }, unchanged: before === JSON.stringify(S) };
  });
  chk(duplicates.cardState.disabled && /уже/i.test(duplicates.cardState.text) && duplicates.detail &&
    duplicates.detail.disabled && /уже/i.test(duplicates.detail.text) && duplicates.unchanged,
  'каталог и страница заранее показывают «Уже в этом дне», повтор не меняет состояние', duplicates);

  const rest = await page.evaluate(async () => {
    sheetClose(); dayOf(today()).t = 'rest'; dayOf(today()).ex = [];
    libPick = today(); tab = 'ex'; paintLib();
    const banner = document.getElementById('lpickT').textContent;
    const before = JSON.stringify(S);
    libAdd('Dumbbell_Bench_Press', today());
    const note = document.getElementById('noteT').textContent;
    await openLib('Dumbbell_Bench_Press'); await Promise.resolve();
    const detail = document.querySelector('#shB [data-libadd]');
    const detailState = detail && { disabled: detail.disabled, text: document.getElementById('shB').textContent };
    sheetClose(); sel = today(); openExPicker();
    const pickerText = document.getElementById('shB').textContent;
    document.querySelector('#shB [data-addex="Жим гантелей лёжа"]').click();
    const input = document.getElementById('exq'); input.value = 'Личное в отдыхе'; input.dispatchEvent(new Event('input'));
    const custom = document.querySelector('#shB [data-myex="Грудь"]'); if (custom) custom.click();
    return { unchanged: before === JSON.stringify(S), note, detailState, pick: libPick, banner, pickerText };
  });
  chk(rest.unchanged && /отдых/i.test(rest.note) && /недел/i.test(rest.note) && rest.detailState &&
    rest.detailState.disabled && /отдых/i.test(rest.detailState.text) && /недел/i.test(rest.detailState.text),
  'день отдыха отказывается принимать упражнения и объясняет, где выбрать тренировочный день', { unchanged: rest.unchanged, note: rest.note, disabled: rest.detailState && rest.detailState.disabled });
  chk(/отдых/i.test(rest.banner) && /недел/i.test(rest.banner) && /отдых/i.test(rest.pickerText) && /недел/i.test(rest.pickerText),
    'оба окна выбора предупреждают о дне отдыха до нажатия на добавление', { banner: rest.banner });
  chk(errors.length === 0, 'каталог без ошибок JavaScript', errors);
  await browser.close(); process.exit(fails ? 1 : 0);
})().catch(e => { console.log('FATAL', e.message); process.exit(1); });
