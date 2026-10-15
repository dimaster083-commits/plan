# Точечный clipboard-кандидат1.4.8.8.9, 15.10.2026

База5bc3db5175bab600334d424dd8e21a79b6f3e44c, веткаfix/release-1.4.8.8.9
в существующем linked worktree gym-audit-20261013. Пользователь явно
подтвердил только вопрос «поздний отказ не меняет закрытое/новое окно,
не забирает фокус; в текущем Разборе один обновляемый ручной блок».
Предыдущий более широкий пакет целиком не принят; BUG-0036–0039 открыты.

## Причина и минимальный фикс

copySummary до исправления безусловно append/select после await-refusal.
Окно за время ожидания могло смениться; каждый отказ добавлял новый блок.
Теперь transient request sequence, исходная sheet identity и исходная кнопка
проверяются вместе с currentModal. Более новая подсказка поверх той же
шторки тоже защищена. Поздние ответы не меняют чужой UI/уведомление.

Readonly textarea с доступной подписью создаётся однажды в исходном Разборе.
Повторное явное нажатие обновляет её снимок текста без select/focus;
актуальный отказ выделяет его для ручного копирования. Нормальный success
не создаёт textarea; актуальный success сохраняет уведомление. Реальный API
по-прежнему получает снимок buildSummary, снятый непосредственно при нажатии.

S, текст buildSummary, расчёты, CSS и миграции не изменены; cache183.

## TDD и проверка

Агент summary_copy_tests_v9 владел только новой suite; root — runtime/docs.
API-double только navigator.clipboard.writeText внутри отдельных synthetic
Chrome профилей; реальный буфер владельца не читается/не записывается.
App/render/buildSummary настоящие. Транспортный exact-text invariant
дополнен независимыми literal-маркерами180см/80→81кг/цель90 и секциями.

- До app-правки agent RED106 ожиданий/26fail; hint12/6; mixed success40/4.
- Root сам повторил окончательный RED-subset158/36 и отдельно mixed40/4,
  exit1. Ожидаемые assert failures, без ошибок обвязки/uncaught errors.
- После минимальной правки root `node test/run.js summary-copy-oct15
  ui-controls-oct06 undo-form-origin-oct14 -j 3`:3 набора/401 check,
  exit0,76с. Summary246/246, UI41/41, Undo114/114.
- Независимый review review_summary_copy_v9 завершён: actionable0,
  READY по согласованному коду. Дополнительный Chrome probe320/390:
  10 сценариев/40 check/0fail,exit0, реальные UI и управляемый только API.
  Проверены askText/openPick с raw, оба mixed-order исхода, detached source,
  exactS/localStorage/sessionStorage sentinel, focus/top/lock/aria-label.
  Это результаты review, не второй полный release-прогон.

## Сбой первого полного прогона: только bootstrap тестовых часов

Первый полный прогон остановлен после красного confirmation-priority-oct14:
320 «deferred backup cannot interleave wipe gates; full wipe reloads empty
profile» — clock.pauseAt Cannot fast-forward to the past. Один из26 сценариев
не завершился; suite показала25 успешных проверок и1failure.
Это не завершённый fullsuite и не результат финального release-прогона.

Причина подтверждена на пустой странице до загрузки приложения: install
в TIME, затем180мс настоящей задержки и pauseAt того же TIME дают тот же
ошибочный переход назад. Install за сутки до TIME, та же задержка, pauseAt
TIME дают точно1791856800000. Clock между двумя API-командами идёт вперёд;
это соответствует [официальному примеру Playwright](https://playwright.dev/docs/clock#consistent-time-and-timers).

В fresh этой suite изменён только начальный anchor на TIME−86400000 до goto,
затем pauseAt прежнего TIME и новая строгая проверка Date.now. Все26 сценариев,
ассерты точных дат, границы Undo и действия сохранены. Runtime не менялся.
Совместный повтор `confirmation-priority-oct14 summary-copy-oct15 -j 2`:
2 набора/272 проверки, exit0,74с; confirmation26/26,42с, summary246/246,74с.
Независимый review bootstrap:5 проверок/0fail с задержкой до pauseAt,
goto/reload и runFor280; точный TIME и TIME+280 подтверждены.
Окончательный повтор `npm test -- -j 3`:168 наборов/2695 проверок,
exit0,889с, «всё зелёное». Summary246/246,79с; confirmation26/26,43с;
food-main64/64,122с; cleanup16/16,88с; Undo114/114,50с; storage14/14,10с.
Между запуском и завершением не менялись runtime и постоянные suites.

Review также нашёл ту же пару install/pauseAt в delivery v7/v8/v9 до goto.
В этой вызываемой цепочке применён тот же anchor за сутки до прежней цели
и добавлен строгий Date.now assert. V6 с resume не затронут. Прежние результаты
v7/v8 остаются историческими; новая цепочка будет проверена отдельно.
Независимый review этих трёх diff: READY, сценарии/проверки не ослаблены.

Suite покрывает11 случаев на320/390: denied/current snapshot, missingAPI,
sequential failures, closed/newMeasure/same-title reopen, hint overlay,
out-of-order refusals, normal success, fail→success updated block,
late success/new form. Проверяются raw87,5, фокус/scroll lock/DOM и точные
memory/disk snapshots. Это не тест реального iOS clipboard permission prompt.

## Доставка и границы

`test/audits/1.4.8.8.9/delivery.cjs` переиспользует byte/activated-worker/offline
v8+v7, добавляет actual served clipboard fallback и поздний отказ при новой
форме на320/390. Результат на реальном Pages будет указан после выполнения.

Предварительный localhost8740 прогон delivery.cjs завершён exit0: все
перечисленные ветви, activated183, exact offline journal/food/photo и
новые clipboard случаи на320/390. Canonical LF SHA256:
index004c5626e760d52558a895a3a14b9183725d824983a073e2e17f20bf04b2530a,
CSS7756ade37f774f759bce8271e6a8256039ead549b16c60be025ae472661aff65,
SW78fec19e2d2a17684d4d969e8cfac54378d79499b81852f62ef29ab0bf10f4e1.
Localhost не доказывает доставку GitHub Pages; после публикации проверка отдельно.
После исправления bootstrap вся локальная цепочка delivery повторена exit0:
canonical bytes, activated183/offline, прежние v7/v8 UI и оба новых clipboard
сценария на320/390. JS errors нет; runtime-хэши остались теми же.

Исследовательские food/workout probes этого же каталога намеренно остаются
RED по открытым BUG-0036–0038, async-month — BUG-0039. Это отдельные материалы
аудита, не обещание отсутствия багов при зелёной обычной regression suite.
Не проверены физические устройства/Safari/большой личный архив; LIMIT-002–004
этой правкой не пересматриваются. Это снимок протокола перед отправкой:
публикация, GitHub CI и actual Pages требуют отдельного подтверждения.
