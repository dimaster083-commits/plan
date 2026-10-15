# 1.4.8.8.8 — BUG-0033, 15.10.2026

База `2e9b27da3dfb1a5c63d39d9c6e7d475fa676711d`, опубликованная v7.
Текущий main повторно проверен `git ls-remote`, он совпал с базой.
Работа в существующем изолированном gym-audit-20261013, ветка
`fix/release-1.4.8.8.8`; основной пользовательский dirty checkout не менялся.

## Объём

Только память transient foodUiRaw. Не новая функция, не редизайн и не
миграция. Удалённый raw не был записан в журнал; ускорение не измерялось.
Пользователь одобрил небольшой остаточный пункт после публикации текущего.

Coalesced timeout0 после paintFood/undoDrop/освобождения tapFood удаляет ключи,
которых нет в текущих рационах всех дат, действующей Undo-sidecar, временной
click-sidecar или baseline действительно активного connected поля.
Синхронная очистка опасна: offerUndo сначала вызывает undoDrop и лишь затем
ставит новый record; undoNow сначала вызывает undoDrop и затем возвращает S
и identities. Отложенный проход видит итог передачи владения.
Обычный случай без raw не обходит архив. Схема S, экспорт, формулы и CSS прежние.

## TDD и независимый review

Новая `test/suites/food-draft-cleanup-oct15.js` использует реальные Chrome,
таймеры, UI и localStorage в синтетических профилях. Размер Map проверяется
только для доказательства освобождения памяти; остальные проверки — точный
raw/aria-invalid, валидные граммы, суммы, UI и диск.

1. `--red-only` на нетронутом v7:2/2 RED, exit1. На320/390 удалённый raw
   оставался size1 после реальных7с Undo, без последующего paint.
2. После минимального исправления focused:4 набора/252 проверки, exit0,122с.
   cleanup14/14, food-main64/64, undo-form-origin114/114, undo-modal60/60.
3. Ранее работавший независимый агент diagnose_draft_cleanup_v8 нашёл P3:
   обычный paintFood непосредственно перед native askY.click ставит prune
   перед capture-fallback; prune видит tapFood, fallback затем снимает его
   без новой проверки. Без fake timers, actual Chromium390.
4. Root добавил постоянный case и получил `--handoff-only`:2/2 RED, exit1,
   на320/390. После trigger в конце capture-fallback:2/2 GREEN, exit0.
   Полная новая suite теперь16 случаев.
5. Независимый повтор после поправки на320/390: size0, undo/tap=false,
   pending=null, сохранённые/показанные граммы125, JS errors0, exit0.
   Reviewer не обнаружил новых actionable замечаний в точечном diff.
6. Полный окончательный `npm test -- -j 3`:167 наборов/2449 проверок,
   exit0,810с. Cleanup16/16, Food64/64, undo-form114/114, undo-modal60/60,
   storage14/14. После этого runtime и тесты не менялись.

Покрытие новой suite: удаление и настоящий expiry без repaint, Undo до expiry,
detached focused field, соседний дубль и другая дата, неравная копия с Undo
и expiry, буквально равная копия без journal Undo, очереди capture handoff.
Предыдущие64 Food-проверки сохраняют empty raw/redraw/Tab и native IDB Undo.

Новый агент cleanup_regression_v8 упёрся в usage limit до работы; тесты
написал и выполнил root. Независимое review действительно продолжил старый
агент, но это не несколько новых успешно завершённых аудитов.

## Команды

NODE_PATH указывает на bundled node_modules, CHROME — системный Chrome.

```text
node test/suites/food-draft-cleanup-oct15.js --red-only
node test/run.js food-draft-cleanup-oct15 food-main-draft-oct14 undo-form-origin-oct14 undo-modal-oct13 -j 3
node test/suites/food-draft-cleanup-oct15.js --handoff-only
npm test -- -j 3
node test/audits/1.4.8.8.8/delivery.cjs
```

Последняя команда проверяет фактические served bytes текущего checkout,
активированный cache182, журнал/еду/native photo offline, прежние v7 UI
и новый cleanup на320/390. Её успех и CI записываются только после выполнения.

Предварительный HTTP smoke по http://127.0.0.1:8739/ завершён exit0:
все перечисленные ветви, activated cache182 и offline exact journal/photo/food.
Canonical LF SHA256: index c7add42c0d08469446863080d391443f7f88f1b42f8c04cc2735cbc417d47366,
CSS7756ade37f774f759bce8271e6a8256039ead549b16c60be025ae472661aff65,
SW6c2791239f955ecdc37650ae1163198cc6c2649f35dc4a38481657a343de2857.
Локальный smoke не доказывает доставку GitHub Pages; её проверка отдельно.

## Границы

Не проверены физические телефоны, Safari, большой реальный архив владельца;
прогноз повышения скорости не выдаётся за измерение. Raw остаётся session-only.
LIMIT-002/003/004 не решены этой правкой. Тесты не гарантия всех сочетаний кнопок.
