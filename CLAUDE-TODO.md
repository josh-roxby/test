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

---

# Phase 2 — Reports, Diary, Countdowns, Sleep

**Branch:** `feat/phase-2`

**Decisions locked:**
- Tabs: **Diary · Habits · Today · Countdowns · Reports** (Today centered)
- Settings moves to a **gear icon in the header** (accessible from every view)
- Check-in step order: Sleep → Mood → Prompt → Habits → Diary → Summary (6 steps, all skippable)
- Sleep: 5-face quality picker + optional hours (number)
- Diary: two 140-char entries per day (`good`, `challenge`) with live char counter
- Countdowns: CSS gradient/pattern themes (no bundled images), auto-archive 24h after target, recurring `annual` flag for birthdays
- Next 1 countdown shown as a strip on the Today view
- Reports: line charts for mood + sleep + habit completion rate (%), with Week / Month toggle (default Week); per-habit "success-over-time" heatmap for tick habits, line graph for count/percent habits

**Data model additions (back-compat):**
```
logs[dayKey] = {
  ...existing,
  sleep: { quality: 1–5, hours: number|null } | null,
  diary: { good: string, challenge: string } | null,
  steps: { mood, prompt, habits, sleep, diary },  // extended
}

state.countdowns = [
  { id, title, description, target: ISO, theme: string,
    recurring: 'annual' | null, archivedAt: ISO | null, createdAt: ISO }
]
```

## Block 6 — Data model + nav restructure
- [x] 6a. Extend log model (sleep, diary) + back-compat migration in `ensureTodayLog` / `load`
- [x] 6b. Add `countdowns: []` to default state, wire migration in `load`
- [x] 6c. Refactor `index.html` tabbar to 5 tabs (Diary / Habits / Today / Countdowns / Reports), add gear icon slot
- [x] 6d. Update `ROUTES`, `go()`, `render()` for new routes; move Settings out of tabbar; gear icon handler opens Settings route

## Block 7 — Check-in: Sleep + Diary steps
- [x] 7a. Sleep step: 5-face quality picker + optional hours input
- [x] 7b. Diary step: two textareas with live 140-char counters
- [x] 7c. Extend `nextIncompleteStep` + progress bar (6 dashes)
- [x] 7d. Re-order flow to Sleep → Mood → Prompt → Habits → Diary → Summary
- [x] 7e. Extend summary screen to surface sleep quality + diary snippets

## Block 8 — Diary tab
- [x] 8a. `renderDiary` route + list header
- [x] 8b. Timeline cards (date + good + challenge, newest first)
- [x] 8c. Empty state copy + CTA to start a check-in

## Block 9 — Countdowns data + themes
- [x] 9a. Countdown helpers (uid, sort by target, expiry check, annual-bump)
- [x] 9b. ~16 CSS gradient/pattern theme presets (sunset, ocean, confetti, snowfall, neon, mono, nature, polka…)
- [x] 9c. Time-remaining formatter (`7d 3h`, `today`, `🎉 happened`, `archived`)

## Block 10 — Countdowns tab
- [ ] 10a. Countdowns list view: upcoming sorted soonest-first, archived collapsed below
- [ ] 10b. Themed tile component (background from theme preset, title, remaining time)
- [ ] 10c. Edit form: title, description, date/time OR "days from now", theme picker, annual toggle
- [ ] 10d. Save / archive / delete + annual auto-bump on render if past
- [ ] 10e. Today-view peek: top upcoming countdown strip above habits

## Block 11 — Reports tab
- [ ] 11a. `renderReports` + sub-tab nav (Overview / Mood / Sleep / Habits)
- [ ] 11b. Week / Month toggle (state scoped to Reports)
- [ ] 11c. SVG line-chart helper (axes, dots, line, week/month x-labels, 1–5 y-scale)
- [ ] 11d. Overview: mood + sleep + completion-rate lines on one chart
- [ ] 11e. Mood sub-tab: dedicated chart + min/avg/max pills
- [ ] 11f. Sleep sub-tab: dedicated chart (quality + hours overlay if hours logged)
- [ ] 11g. Habits sub-tab: per-habit view (reuse heatmap for tick, line for count/percent with target line)

## Block 12 — Polish
- [ ] 12a. Gear icon a11y + focus-visible
- [ ] 12b. Empty states for Diary, Countdowns, Reports
- [ ] 12c. Diary char counters (e.g. `112/140`, red at >= 140)
- [ ] 12d. Mobile: 5-tab spacing audit, label sizing
- [ ] 12e. End-to-end smoke test + commit + deploy notes
