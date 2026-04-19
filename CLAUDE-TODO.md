# CLAUDE-TODO.md

Working task list for the Tempo habit + mood PWA, broken into small chunks so each streams reliably. Mark tasks `[x]` as they complete and push after each one.

**Branch:** `feat/habit-mood-pwa`

**Stack:** plain HTML/CSS/JS, localStorage, PWA (manifest + service worker), hosted on Vercel.

**Key decisions (locked):**
- 5-point emoji mood faces, swipe-card fun style
- Multi-step check-in: mood → daily prompt (reflection OR fun fact, random per day) → habits → summary
- Habit qty types: tick / count-toward-target / percent
- Good vs bad: separate Build/Break sections, green/red accents
- 12-color curated palette
- 3am local rollover
- Reprompt unfinished check-in steps
- Streaks shown per good habit
- Archive (soft-delete) habits
- Export/import JSON in settings
- No notifications in v1 (Android user)

---

## Block 1 — Skeleton + PWA shell
- [x] 1a. `app.js`: storage layer (`load` / `save`, default state, `STORAGE_KEY`)
- [x] 1b. `app.js`: day helpers (`currentDayKey` with 3am rollover, `daysAgo`, `strHash`)
- [x] 1c. `app.js`: DOM helper `h()` + `toast()` + `qs()`
- [x] 1d. `app.js`: router (`route` state, `go()`, `render()`, tabbar wiring, empty view stubs)
- [x] 1e. `manifest.json` + `icon.svg`
- [x] 1f. `service-worker.js` (cache-first shell) + registration in `app.js`

## Block 2 — Habits CRUD
- [x] 2a. Manage list view: empty state + habit card list
- [x] 2b. Edit form shell: title, description, good/bad segmented
- [x] 2c. Edit form qty type: tick/count/percent segmented + target + unit fields
- [x] 2d. Color palette picker
- [x] 2e. Save / archive / delete actions wired to state

## Block 3 — Home + heatmaps
- [x] 3a. Home view layout: Build + Break sections, habit rows
- [x] 3b. Heatmap renderer (12 weeks, intensity by value/target, inverse for bad)
- [x] 3c. Streak calculation + pill
- [x] 3d. Today's state indicator per habit (done / not done)

## Block 4 — Check-in flow
- [x] 4a. Modal sheet shell + progress bar + step navigation
- [x] 4b. Step 1: mood picker (5 faces + captions)
- [x] 4c. Step 2: daily prompt card (seeded pick from facts/reflection bank)
- [x] 4d. Step 3: habits checklist (inputs per qty type)
- [x] 4e. Step 4: summary screen
- [x] 4f. Auto-open logic: first visit of day + resume at next incomplete step

## Block 5 — Settings + polish
- [x] 5a. Settings view: rollover hour slider
- [x] 5b. Export JSON (download)
- [x] 5c. Import JSON (file picker + validation)
- [x] 5d. Empty-state copy + onboarding nudge
- [x] 5e. Final polish: toasts, focus styles, SW update check

---

## Workflow

1. Claude picks the next unchecked task.
2. Writes code + commits on `feat/habit-mood-pwa` with a message prefixed by the task id (e.g. `1a: storage layer`).
3. Pushes to origin.
4. Updates this file to tick the box, commits+pushes the tick.
5. Returns to user for the "go next" prompt.
