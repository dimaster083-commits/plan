# BUG-0027/0028 — приоритет подтверждений и отложенная копия

Исправлено 14.10.2026 в `fix/release-1.4.8.8.7`, исходный HEAD
`fd4c868685d2509fa2bceeb416179162cd9f8fb3`. Изменения ограничены тремя
участками `index.html`: общий вопрос, вход в вопрос нативного импорта,
напоминание при запуске. Полный сброс, его две ступени, защита двойного
тапа, фиксация даты сброса и экспорт оставлены в своих прежних обработчиках.
Миграция/ключ кэша не менялись. CSS и другие области runtime — зона
параллельных задач, в эту правку не входят.

Предшествующее воспроизведение и причины: `confirmations.md` рядом.
Постоянная suite: `test/suites/confirmation-priority-oct14.js`.

## Поведение после исправления

Открытый `ask`/`askText` сохраняет callback, вопрос, значение поля и фокус.
Параллельный запрос общего вопроса получает явный определённый отказ
(`false`/`null`) вместо потери resolver. В текущем окне появляется
ненавязчивый текст со статусом `role=status`, `aria-live=polite`.

Поздний нативный импорт во время открытого вопроса завершает обработчик
без подмены `S` и показывает: «Сейчас открыт другой вопрос. После ответа
выбери файл копии снова». Повторный осознанный выбор файла проходит
обычную проверку и своё подтверждение. Импорт не ставится в FIFO между
первой и второй ступенью полного сброса. Открытый черновик имени шаблона
также сохраняется и успешно записывается после ответа на свой вопрос.

Напоминание ждёт отсутствия активных окон, первичной настройки и живого
Undo. Пока они открыты, `bkAsk` не меняется. Проверка повторяется через
500 мс; когда помех больше нет, заново проверяются три тренировки,
давность копии и предыдущего напоминания. Новая реально скачанная копия
или недостаточное число тренировок отменяют уже отложенное напоминание.
Если условия ещё выполнены, вопрос появляется и его «ДА» скачивает
настоящий JSON. Семисекундный Undo не укорачивается служебным `save()`.

Первая ступень сброса → «ДА» → вторая ступень остаётся непрерывной
foreground-цепочкой: продолжение `await` запускается до следующего
отложенного таймера. Быстрое повторное «ДА» по-прежнему не проходит обе
ступени. Два осознанных подтверждения перезагружают пустой тестовый
профиль; поздний импорт старой страницы к нему не добавляется.

## RED → GREEN

До первой правки runtime добавлена и целиком запущена постоянная suite.
Настоящий Chrome/Playwright-core, отдельные синтетические контексты
320×568 и 390×844, `Asia/Vladivostok`, фиксированная дата 13.10.2026.
Нативный FileReader читает настоящий файл fixture; тест задерживает
только доставку `onload`, чтобы однозначно проверить обе ступени сброса
и текстовый вопрос. Ожидания значений/имён/объёмов заданы литералами.
Экспорт проверяется чтением настоящего download stream, не имитацией
клика или Blob. Пользовательский профиль не открывался, фото-архив пустой.

- RED на исходном runtime: **26 checks, 24 failures**, exit 1.
  На обеих ширинах обычное напоминание/экспорт прошли; 12 остальных
  сценариев падали на фактической замене вопроса/ввода, утрате Undo,
  преждевременном `bkAsk` или коллизии позднего импорта.
- Первый прогон после runtime: **26 checks, 4 failures**.
  Они выявили две ошибки ожидания теста: подавленный повторный click
  уже перевёл фокус pointerdown-ом на `askY`, который и надо сохранить;
  Playwright вернул явное поле `value:undefined` у pending-result.
  Ожидания исправлены без ослабления требования: перед поздним чтением
  отдельно проверяется ожидаемый фокус (`askN` в первой ступени,
  `askY` после повторного нажатия во второй), после чтения — тот же фокус.
- Последний полный прогон новой suite: **26 checks, 0 failures**, exit 0.
- Существующие focused-регрессии: `ui-controls-oct06` **41 checks**,
  `reset-date-oct10` **22 checks**, суммарно **63**, exit 0.
- `node --check test/suites/confirmation-priority-oct14.js`: exit 0.

Проверены сохранность точного журнала и reload после отмены,
сохранения имени, Undo, импорта и скачивания копии; определённое
завершение каждого наблюдаемого Promise; безопасный повтор импорта;
отсутствие отложенного вопроса после полного стирания. Ошибок JavaScript
в новой suite нет. Контексты и браузеры закрыты.

Полный набор не запускался этим владельцем правки: основной агент
выполняет его после объединения всех согласованных изменений v7.
Это scoped GREEN, не отдельное заявление о готовности всего релиза.

## Точные собственные hunks

Вывод `git diff --unified=2 -- index.html` после scoped GREEN,
до интеграции изменений других владельцев:

```diff
@@ -4985,5 +4985,19 @@ document.addEventListener('change', e => {
 /* ---------- подтверждение ---------- */
 let askCb = null, askBack = null;
+function askBusy() { return !!askCb || $('ask').classList.contains('on'); }
+function askNotice(text) {
+  let status = $('askStatus');
+  if (!status) {
+    status = document.createElement('p'); status.id = 'askStatus';
+    status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
+    $('askI').before(status);
+  }
+  status.hidden = false; status.textContent = text;
+}
 function ask(text, yesLabel) {
+  if (askBusy()) {
+    askNotice('Сначала ответь на открытый вопрос, затем повтори действие.');
+    return Promise.resolve(false);
+  }
   askBack = document.activeElement;
   $('askT').textContent = text;
@@ -4996,4 +5010,8 @@ function ask(text, yesLabel) {
 }
 function askText(text, def) {
+  if (askBusy()) {
+    askNotice('Сначала ответь на открытый вопрос, затем повтори действие.');
+    return Promise.resolve(null);
+  }
   askBack = document.activeElement;
   $('askT').textContent = text;
@@ -5007,8 +5025,8 @@ function askText(text, def) {
 }
 function askClose(v) {
+  const cb = askCb, back = askBack; askCb = null; askBack = null;
   $('ask').classList.remove('on');
-  const back = askBack; askBack = null;
+  const status = $('askStatus'); if (status) { status.hidden = true; status.textContent = ''; }
   if (back && back.isConnected && back.getClientRects().length) back.focus({ preventScroll: true });
-  const cb = askCb; askCb = null;
   if (cb) cb(v);
 }
@@ -8617,4 +8635,10 @@ $('impFile').addEventListener('change', e => {
       const o = JSON.parse(fr.result);
       const next = importStateOf(o);
+      // Позднее чтение файла не перебивает чужой вопрос, в том числе две
+      // последовательные ступени полного сброса. Новый выбор — явное намерение.
+      if (askBusy()) {
+        askNotice('Сейчас открыт другой вопрос. После ответа выбери файл копии снова.');
+        return;
+      }
       // про фотографии говорим отдельно: они не стираются, а доливаются к нынешним
       if (!await ask('Журнал, веса и рацион будут заменены на то, что в копии — нынешние пропадут. '
@@ -12821,14 +12845,23 @@ if (!S.setup) setTimeout(openSetup, navigator.webdriver ? 700 : 1800);
    стереть. Есть что терять (три тренировки и больше), копии не было три
    недели — предлагаем сохранить одним нажатием, не чаще раза в неделю.
-   Условие проверяется сразу при запуске, а не по таймеру. */
+   После ожидания окна или отмены проверяем условие заново. */
 (function () {
-  const DAY = 864e5, now = Date.now();
-  const wos = Object.values(S.rec || {}).filter(r => r && r.wo).length;
-  if (!S.setup || wos < 3) return;
-  if (now - (S.bkAt || 0) < 21 * DAY || now - (S.bkAsk || 0) < 7 * DAY) return;
-  setTimeout(async () => {
+  const DAY = 864e5;
+  function due() {
+    const now = Date.now(), wos = Object.values(S.rec || {}).filter(r => r && r.wo).length;
+    return S.setup && wos >= 3 && now - (S.bkAt || 0) >= 21 * DAY && now - (S.bkAsk || 0) >= 7 * DAY;
+  }
+  if (!due()) return;
+  async function remind() {
+    // Служебная отметка копии не должна прерывать вопрос, сырой ввод или
+    // семь секунд отмены. Продолжение await откроет вторую ступень до таймера.
+    if (askBusy() || currentModal() || $('setup').classList.contains('on') || undoRec) {
+      setTimeout(remind, 500); return;
+    }
+    if (!due()) return;
     S.bkAsk = Date.now(); save();
     if (await ask('Копии прогресса не было больше трёх недель. Данные живут только в этом телефоне — сохранить копию сейчас?', 'СОХРАНИТЬ')) $('exp').click();
-  }, 2500);
+  }
+  setTimeout(remind, 2500);
 })();
```

## Команды проверки

```powershell
$env:NODE_PATH='C:/Users/ALFA-PROM/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules'
$env:CHROME='C:/Program Files/Google/Chrome/Application/chrome.exe'
node test/suites/confirmation-priority-oct14.js
node test/run.js ui-controls-oct06 reset-date-oct10 -j 2
node --check test/suites/confirmation-priority-oct14.js
```
