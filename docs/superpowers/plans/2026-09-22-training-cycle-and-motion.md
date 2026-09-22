# Training Cycle and Motion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make calendar weeks truthful without losing journal data, verify training/load behavior, then polish both themes with fast accessible motion.

**Architecture:** Keep the existing single-file PWA and its local-only state format. Separate pure calendar-week computation from workout completion counts. Add regression suites around state and rendered UI before changing code. Keep visual changes in CSS and narrow render/event hooks, with no new animation library.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js, playwright-core/Chromium, existing `test/run.js` suite runner.

**Spec:** `docs/superpowers/specs/2026-09-22-training-cycle-and-motion-design.md`

## Global Constraints

- Preserve the existing `sys-gym-v3` journal; no destructive migration or automatic import.
- Keep both themes feature-equivalent; «Клеймо» retains restrained copper accents.
- `prefers-reduced-motion: reduce` disables decorative motion without hiding information.
- Real user-device storage is inaccessible from the repository; do not report it as restored.
- Date, session completion, working load and logged sets must remain consistent across day, history, calendar, cycle and progress views.

## Review Focus

- A week with only two sessions still shows the next calendar week on Monday; Task 1 test.
- A closed historical session retains its date, log and completion flag after reload; Task 2 test.
- Invalid or future start dates cannot hang week computation; Task 1 test.
- Manually set working loads are not overwritten by automatic recommendations; Task 3 test.
- Rapid tab changes and reduced-motion settings do not leave invisible or unclickable content; Task 5 test.

---

### Task 1: Calendar week and cycle numbering

**Files:** Modify `index.html:3327-3370`, `index.html:4743-4768`; create `test/suites/calendarcycle.js`; update old cycle assertions in `test/suites/cikl.js` and `test/suites/plan.js` if they encode the former 3-session gate.

**Interfaces:** Consume `planStart()`, `mondayOf(ds)`, `at(ds)`, `weekCounts()`. Produce `planWeek(ds): positive integer` as elapsed calendar weeks since plan start plus one; `cycIdx(ds)` remains `(planWeek(ds)-1)%CYCLE.length`. `doneThisWeek(ds)` remains informational.

- [ ] Write a failing browser test using the existing `test/suites/cikl.js` harness pattern: set `S.start='2026-09-14'`, mark `S.rec['2026-09-17'].wo=1` and `S.rec['2026-09-19'].wo=1`, invalidate `wkCache`, then assert `planWeek('2026-09-20')===1`, `planWeek('2026-09-21')===2`, `cycIdx('2026-09-21')===1`, and that no record changed.
- [ ] Run `node test/run.js calendarcycle`; expect a failure showing week 1 on 21 September.
- [ ] Replace the `weekCounts()`-gated loop in `planWeek()` with a bounded calendar difference from `mondayOf(planStart())`; retain invalid-date defense. Rewrite `paintCycle()` text so 2/4 reports attendance without saying the phase repeats.
- [ ] Run `node test/run.js calendarcycle cikl plan zavis`; resolve stale expectations only when they encode the intentionally changed rule. Commit `fix: use calendar weeks for training cycle`.

### Task 2: Journal history and completion integrity

**Files:** Modify `index.html:4273-4285` only if a bypass is reproducible; create `test/suites/historycycle.js`; inspect `index.html:4359-4368` and `index.html:5030-5046` without rewriting saved records.

**Interfaces:** Consume `recRW(ds)`, `dayOf(ds)`, `paintHistory()`, `render()`. Preserve `S.rec[ds].log`, `.wo`, and date keys byte-for-byte across a calendar boundary and reload.

- [ ] Write a failing regression using an isolated state fixture with finished workouts on 17 and 19 September; assert both appear in `#hist [data-day]` after reload, with their original log/`wo` data intact. Include one non-complete click path against `#fin` and verify it cannot mark `wo=1`.
- [ ] Run `node test/run.js historycycle`; if history already passes, keep the regression as a preservation guard and report that no history code change is required. If the completion path fails, add the same completeness predicate at handler entry as the UI uses.
- [ ] Run `node test/run.js historycycle den perenos mvdone istoriya persist celost`; commit `test: guard historical workouts and completion` (or `fix:` if code changed).

### Task 3: Working weights and progression boundaries

**Files:** Modify `index.html:2846-2881` or `index.html:4193-4240` only for reproduced faults; create `test/suites/loadcycle.js`.

**Interfaces:** Consume `weightFor(e, IN, ds)`, `maybeProgress(l,p,w)`, `startWeight(name)`, `rampOf(ds)`; preserve `e.fixed` override and saved session loads.

- [ ] Add a test that sets a manual `e.w` with `e.fixed=1`, invokes `deriveWeights()`, and asserts no overwrite; then assert a session at 90% cycle intensity does not advance working load, while all completed top-range sets at full load advance exactly once. Include the second-failure lowering path.
- [ ] Run `node test/run.js loadcycle`; distinguish passing preservation checks from a failing defect. Change only the function whose failure is reproduced.
- [ ] Run `node test/run.js loadcycle setka progr spad sverka razgr`; commit `test: lock working-load progression boundaries` (or `fix:` if required).

### Task 4: Optional lighter training volume

**Files:** Modify `index.html` state defaults/migration and settings UI near `index.html:5348-5420`; modify `setsOf()` near `index.html:3363`; create `test/suites/volumechoice.js`.

**Interfaces:** Add `S.volumeMode` with values `'standard' | 'light'`, default `'standard'` for existing journals. `setsOf(ds,base,j)` uses the choice only for future displayed prescriptions; stored `S.rec[ds].log` is never trimmed.

- [ ] Write tests that standard mode preserves current set counts, light mode reduces prescription for future workouts, and toggling modes leaves completed 17/19 September set logs unchanged. Check that a reload retains the choice.
- [ ] Run `node test/run.js volumechoice`; expect failure because the choice does not exist.
- [ ] Add a clearly labeled two-option control in settings; limit light mode to a small, explicit reduction of prescribed working sets, never fewer than two for an exercise. Do not change the weight/intensity multipliers or auto-select light mode based on guesswork.
- [ ] Run `node test/run.js volumechoice obyem den mig celost persist`; commit `feat: offer lighter training volume`.

### Task 5: Visual polish and accessible motion

**Files:** Modify CSS and narrow render hooks in `index.html:1-2090` and tab/card rendering near `index.html:7240`; create `test/suites/motion.js`; add an original optimized asset under `img/` only if CSS cannot achieve the approved effect; update visual screenshots only after manual inspection.

**Interfaces:** No state schema change. Motion uses CSS transform/opacity with short durations and the existing `prefers-reduced-motion` rule; controls remain usable before animations finish.

- [ ] Write browser checks at mobile widths for both themes: tabs remain clickable during rapid changes, content is visible after transition, no horizontal overflow, and computed animation/transition durations are zero under `reducedMotion:'reduce'`.
- [ ] Run `node test/run.js motion`; expect at least one missing-motion assertion to fail before changes.
- [ ] Add restrained card/tab entrance, pressed-state feedback, progress-fill polish, and theme-specific panel borders: cool layered HUD lines in «Система», dark etched/copper edges in «Клеймо». Use the approved references for mood only, never copied frames or characters; avoid continuous animation and expensive layout properties. Inspect 320 px and 390 px screenshots in both themes, including long names and open sheets.
- [ ] Run `node test/run.js motion parity palitra contrast contrast2 fit skroll paltsy`; commit `feat: polish motion and mobile surfaces`.

### Task 6: Release verification and independent review

**Files:** No product changes unless review finds a reproduced defect; update only relevant test or code files for such defects.

**Interfaces:** The merged app preserves the `sys-gym-v3` data contract and passes the full existing suite plus new suites.

- [ ] Run `npm test` and record actual suite/check totals and any failures. Run a fresh independent code review against `origin/main`, then fix confirmed findings with regression tests and rerun affected/full checks.
- [ ] Serve the candidate locally and manually exercise a fresh journal and a copied historical fixture in Chromium: week 2 on 22 September, 17/19 history, standard/light volume, both themes, reduced motion, narrow viewport, export/reload. Cross-check the same date and working load in day, history, calendar, cycle and progress views.
- [ ] Push a PR, wait for CI and Pages safety checks, merge only when green, then verify the deployed page loads the new version. Do not claim that the user's iPhone local data was imported or verified.
