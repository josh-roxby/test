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
- [x] 10a. Countdowns list view: upcoming sorted soonest-first, archived collapsed below
- [x] 10b. Themed tile component (background from theme preset, title, remaining time)
- [x] 10c. Edit form: title, description, date/time OR "days from now", theme picker, annual toggle
- [x] 10d. Save / archive / delete + annual auto-bump on render if past
- [x] 10e. Today-view peek: top upcoming countdown strip above habits

## Block 11 — Reports tab
- [x] 11a. `renderReports` + sub-tab nav (Overview / Mood / Sleep / Habits)
- [x] 11b. Week / Month toggle (state scoped to Reports)
- [x] 11c. SVG line-chart helper (axes, dots, line, week/month x-labels, 1–5 y-scale)
- [x] 11d. Overview: mood + sleep + completion-rate lines on one chart
- [x] 11e. Mood sub-tab: dedicated chart + min/avg/max pills
- [x] 11f. Sleep sub-tab: dedicated chart (quality + hours overlay if hours logged)
- [x] 11g. Habits sub-tab: per-habit view (reuse heatmap for tick, line for count/percent with target line)

## Block 12 — Polish
- [x] 12a. Gear icon a11y + focus-visible
- [x] 12b. Empty states for Diary, Countdowns, Reports
- [x] 12c. Diary char counters (e.g. `112/140`, red at >= 140)
- [x] 12d. Mobile: 5-tab spacing audit, label sizing
- [x] 12e. End-to-end smoke test + commit + deploy notes

---

# Phase 3 — Home refinement, At-a-glance, Reminders, Fast wins

**Branch:** `feat/phase-3`

**Decisions locked:**
- Heatmap moves off Today into a new **Habit detail view** reached by tapping a habit card; Today shows compact rows (name · today's value · streak).
- **Home stats card** at bottom of Today: rotating/cute copy showing 2–3 numbers (days on Tempo, current streaks, totals). No gamification.
- **2×2 glanceable tile grid** on Today: Diary (last entry snippet), Habits (X of Y done), Countdowns (next event + time), Reports (mini mood sparkline). Replaces/tightens the existing summary card.
- **"At a glance" (Wrapped-style)** multi-stage animated modal accessible from Reports; Week/Month toggle. No auto-prompt in v1.
- **Reminder time** in settings (HH:MM) + Badging API red dot + in-app sticky banner when app opens past reminder with check-in incomplete. Real push notifications deferred to a Phase 4 (serverless backend discussion).
- **Fast wins**: extend toast to support actions → Undo archive/delete on habits & countdowns (5s window). Monthly backup nudge (dismissible banner on Settings if no export in 30d).

---

## Block 13 — Habit detail view + tighter Today habit rows
- [ ] 13a. New route `habit-detail` (or in-app subview state) with `viewingHabitId`
- [ ] 13b. `renderHabitDetail`: title, description, kind/type/target chips, heatmap, streak + longest streak, today's value, edit button
- [ ] 13c. Tap a habit on Today → open detail view (instead of no-op)
- [ ] 13d. Compact Today habit row: color stripe · title · today's value · streak pill (no meta line, no heatmap inline)
- [ ] 13e. Back button → returns to previous route

## Block 14 — Home stats card + 2×2 glanceable tiles
- [ ] 14a. Stats helpers: `totalDaysOnTempo`, `totalCheckIns`, `totalDiaryEntries`, `bestStreakAllTime`
- [ ] 14b. Rotating stats card (picks 2–3 stats, copy varies: "🗓 47 days on Tempo · 🔥 12-day streak · 📖 23 entries")
- [ ] 14c. Diary preview tile (latest entry "good" snippet or "Write today's entry")
- [ ] 14d. Habits preview tile ("3 of 5 done today" + tiny progress bar)
- [ ] 14e. Countdowns preview tile (next upcoming title + remaining)
- [ ] 14f. Reports preview tile (inline 7-day mood mini-sparkline via `svgLineChart`)
- [ ] 14g. CSS grid layout (2×2, responsive; single column on very narrow)
- [ ] 14h. Tighten check-in status card (side-by-side sleep/mood pills, one-line)

## Block 15 — "At a glance" (Wrapped-style) modal
- [ ] 15a. Aggregators: peak mood day, hardest day, best sleep day, most-used habit, longest streak in range, total entries, favourite prompt
- [ ] 15b. Modal shell (scrim + sheet) + stage nav (swipe or tap-to-advance + dots indicator)
- [ ] 15c. Stage renderers: Intro · Mood peak · Sleep · Habit highlight · Streak · Diary moment · Outro
- [ ] 15d. Week / Month toggle at top of modal (recomputes stages)
- [ ] 15e. Access: "✨ At a glance" button on Reports header
- [ ] 15f. Animation polish (fade/slide between stages, subtle emoji/background on each)

## Block 16 — Reminder time + in-app nudge (no backend)
- [ ] 16a. `settings.reminder = { enabled: bool, time: 'HH:MM' }` with default off; back-compat in `load`
- [ ] 16b. Settings UI: toggle + `<input type="time">`
- [ ] 16c. On app open: if past reminder time today and check-in incomplete, show sticky banner above Today with primary CTA
- [ ] 16d. App icon badge via `navigator.setAppBadge(1)` when app is active and check-in incomplete past reminder (clear on completion)
- [ ] 16e. Settings copy explaining this is an in-app nudge (real push comes in Phase 4)

## Block 17 — Fast wins: undo toasts + backup nudge
- [ ] 17a. Extend `toast(message, { action, onAction, duration })` with an inline action button
- [ ] 17b. Undo for habit archive + soft-delete (holds pre-delete snapshot for 5s)
- [ ] 17c. Undo for countdown archive + delete
- [ ] 17d. `settings.lastExportAt` timestamp; update on successful export
- [ ] 17e. Monthly backup nudge banner on Settings if `lastExportAt` null or > 30 days; dismissible for session

---

## Workflow (same as before)
1. Pick next unchecked task.
2. Commit on `feat/phase-3`, prefix with task id (e.g. `13a: habit detail route`).
3. Push.
4. Tick the box in this file; commit + push the tick.
5. Return for next "go".
