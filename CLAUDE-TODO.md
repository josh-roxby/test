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

# Phase 4 — Real push notifications (Vercel serverless + GitHub Actions cron)

**Branch:** `feat/phase-4`

**External setup (done):** Upstash Redis via Vercel · `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` / `TICK_SECRET` in Vercel env · `TICK_SECRET` in GitHub repo secrets.

**Architecture:** `@vercel/kv` stores one record per device endpoint, signed with VAPID via `web-push`, triggered every 15 min by GitHub Actions cron hitting `/api/tick?secret=…`. Timezone-aware, ±7-min window, dedup via `lastSentDay`.

## Block 18 — Backend
- [x] 18a. `package.json` + deps: `web-push`, `@vercel/kv`
- [x] 18b. `/api/subscribe.js` — POST, upsert sub in KV
- [x] 18c. `/api/unsubscribe.js` — POST, remove sub
- [x] 18d. `/api/tick.js` — GET (secret-gated), scan, filter due, send, cleanup
- [x] 18e. `/api/vapid-public.js` — GET public key for client
- [x] 18f. `/api/test-send.js` — POST, fires an immediate test push to the caller's endpoint

## Block 19 — Service worker handlers
- [x] 19a. `push` event → `registration.showNotification`
- [x] 19b. `notificationclick` → focus app, open check-in
- [x] 19c. `pushsubscriptionchange` → re-subscribe on backend
- [x] 19d. Bump SW `VERSION`

## Block 20 — Client subscribe helpers
- [x] 20a. Fetch `VAPID_PUBLIC_KEY` from `/api/vapid-public`
- [x] 20b. `requestNotificationPermission()`
- [x] 20c. `subscribeToPush()`
- [x] 20d. `unsubscribeFromPush()`
- [x] 20e. `urlBase64ToUint8Array()` util

## Block 21 — Settings UI: Daily reminders
- [x] 21a. Extend settings schema + back-compat
- [x] 21b. Settings section: toggle, time picker, timezone, device status
- [x] 21c. Enable flow (permission → subscribe → POST)
- [x] 21d. Disable flow (unsubscribe → POST)
- [x] 21e. States: denied / unsupported / pending / connected
- [x] 21f. Test notification panel: "Send now" + delay picker (5s / 30s / 1m / 5m / 15m)

## Block 22 — Cron + E2E
- [x] 22a. `.github/workflows/reminder-tick.yml` — `*/15 * * * *`
- [ ] 22b. Trigger cron manually once to verify
- [ ] 22c. E2E on phone (subscribe → time → push → tap); remove vapid-gen workflow

## Block 23 — Polish
- [x] 23a. Dedup via `lastSentDay` (landed with Block 18)
- [x] 23b. 410/404 cleanup (landed with Block 18)
- [x] 23c. Rate-limit `/api/subscribe`
- [x] 23d. Settings copy: platform caveats
- [x] 23e. Server-side logging in `/api/tick` (landed with Block 18)

---

# Phase 5 (first pass) — Theme + time-of-day buckets

**Branch:** `feat/theme-and-buckets`

- [x] Light/Dark/System theme toggle in Settings
- [x] CSS variable overrides for light theme (`[data-theme="light"]`)
- [x] Theme-color meta kept in sync with resolved theme
- [x] `matchMedia('prefers-color-scheme')` listener for live "System" switching
- [x] `REMINDER_BUCKETS` (morning / noon / afternoon / evening / night, ending at 10pm)
- [x] Server: `reminderBucketDue` using deterministic random offset per user per day
- [x] Server: `/api/subscribe` accepts `bucket` (or legacy `reminderTime`)
- [x] Server: `/api/tick` prefers bucket logic, falls back to legacy HH:MM
- [x] Client: bucket card picker replaces time input
- [x] Client: `subscribeToPush(bucket, tz)` sends bucket to backend
- [x] Back-compat: legacy subs keep working; new subs save bucket

---

# Phase 5 — Entry flow (E-block)

**Branch:** `feat/phase-5-entry-flow`

- [x] E-M. Habit templates (Morning / Sleep / Focus / Kindness) shown in Habits empty state
- [x] E-P. Habit reorder — `order` field + up/down arrows in Manage; sorted lists everywhere
- [x] E-N. Quick-log pill on Today (tick / +1) with Undo toast; card body still opens detail
- [x] E-O. Swipe gestures on Today habit cards (right = log, left = clear) with color hint
- [x] E-Q. Photo on diary via IndexedDB (auto-downscale to 1200px, included in export/import, cleared by Danger Zone)

---

# Phase 5 — Onboarding + custom confirm drawer

**Branch:** `feat/phase-5-onboarding`

- [x] `settings.onboarded` state (`null` = first visit, `false` = mid-tutorial, `true` = done); back-compat grandfathers existing users to `true`
- [x] Welcome screen for `onboarded === null`: "I'm new" vs "I have a backup"
- [x] Import-from-welcome flow (pipe through `handleImport`)
- [x] Onboarding tutorial sheet: intro → theme → reminders → install → backup → done
- [x] PWA-only enforcement post-onboarding (renders install gate if not standalone)
- [x] `beforeinstallprompt` capture + inline "Install now" button
- [x] `deleteAllData` resets `onboarded` to `false` → re-runs tutorial
- [x] "Show tutorial again" button in Settings
- [x] `showConfirm({ title, body, primary, primaryDanger })` promise-based drawer
- [x] All native `confirm()` calls replaced (habit delete, countdown delete, template install, import, delete-all)

---

# Phase 3 — Home refinement, At a glance, Fast wins

**Branch:** `feat/phase-3-build`

**Locked decisions:**
- Heatmap moves off Today into a **Habit detail view** (tap a habit card to open). Today shows compact rows (name · today's value · streak).
- **Home stats card** at bottom of Today: rotating cute copy showing 2–3 numbers.
- **2×2 glanceable tiles** on Today (Diary · Habits · Countdowns · Reports) with data previews, not just buttons.
- **"At a glance" Wrapped-style modal** on Reports with Week/Month toggle.
- **Reminder in-app nudge** (Block 16) kept as a fallback for users who haven't granted push permission — complementary to the real push from Phase 4, not a replacement.
- **Fast wins**: extend toast with action button → Undo archive/delete on habits + countdowns. Monthly backup nudge on Settings.

## Block 13 — Habit detail view + compact Today rows
- [x] 13a. New `habit-detail` route + `viewingHabitId` state + `viewHabit(id)`
- [x] 13b. `renderHabitDetail`: header, meta chips (kind/type/target), today's value, current streak + longest streak, heatmap, Edit button
- [x] 13c. Wire Today habit card taps → `viewHabit(habit.id)`
- [x] 13d. Compact Today habit row (no meta line, no heatmap); move heatmap to detail view
- [x] 13e. Back button returns to home

## Block 14 — Home stats card + 2×2 glanceable tiles
- [x] 14a. Stats helpers (totalDaysOnTempo, totalCheckIns, totalDiaryEntries, bestStreakAllTime)
- [x] 14b. Rotating stats card copy
- [x] 14c. Diary preview tile (last good snippet or CTA)
- [x] 14d. Habits preview tile (X of Y done + progress)
- [x] 14e. Countdowns preview tile (next event)
- [x] 14f. Reports preview tile (7-day mood sparkline)
- [x] 14g. 2×2 grid CSS + narrow fallback
- [x] 14h. Tighten check-in status card

## Block 15 — "At a glance" (Wrapped-style) modal
- [x] 15a. Aggregators (peak mood day, hardest day, best sleep, top habit, longest streak, diary moment)
- [x] 15b. Modal shell + stage nav
- [x] 15c. Stage renderers
- [x] 15d. Week / Month toggle
- [x] 15e. Access button on Reports header
- [x] 15f. Animation polish

## Block 16 — In-app reminder nudge (fallback for no-push users)
- [x] 16a. Sticky banner on Today past `settings.reminder.time` when check-in incomplete (only if push is NOT active)
- [x] 16b. Dismiss-for-today button on the banner
- [x] 16c. Badging API (`navigator.setAppBadge(1)`) when check-in incomplete past reminder
- [x] 16d. Settings copy explaining push vs in-app fallback

## Block 17 — Fast wins: undo + backup nudge
- [x] 17a. Extend `toast(message, { action, onAction, duration })` with inline action button
- [x] 17b. Undo for habit archive / soft-delete
- [x] 17c. Undo for countdown archive / delete
- [x] 17d. `settings.lastExportAt` timestamp on export
- [x] 17e. Monthly backup nudge banner on Settings

---

# Phase 5 — Remaining feature plan (trimmed)

Only the sub-features we're actually pursuing. Dropped from plan (archived): C (QR transfer), G (Year heatmap), I (Gratitude rotating), K (Mood tags), R (Onboarding tour — done via Phase 5 onboarding), S (Calendar view), T (Typography). Entry-flow block (M–Q) built; Q (photo) will be removed in Phase 6.

## Shareability

**A. Share-a-report URL**
- [ ] A-1. Base64-URL encoder/decoder helpers (`encodeShareState`, `decodeShareState`)
- [ ] A-2. Compact wrapped payload: `{range, stats subset, version}` — only fields the read-only view needs
- [ ] A-3. Boot-time `?share=…` detector: if present, open read-only Wrapped and skip normal render
- [ ] A-4. Read-only Wrapped modal variant (no local state writes; "Open Tempo" CTA instead of Done)
- [ ] A-5. "Share" button on the Outro stage of the normal Wrapped modal
- [ ] A-6. `navigator.share({ url, title })` with clipboard fallback
- [ ] A-7. URL length budget check; friendly "shared snapshot is ~Xkb" note

**B. Shareable wrapped card (image)**
- [ ] B-1. `<canvas>` composer: title, big stat, emoji, Tempo watermark
- [ ] B-2. Resolve fonts + colors from CSS vars so card matches current theme
- [ ] B-3. "Save image" button on Outro stage; triggers PNG download
- [ ] B-4. `navigator.share({ files })` when supported on Android

## Insights

**D. Correlations panel**
- [ ] D-1. Pearson correlation helper + `correlateSeries(a, b)` utility
- [ ] D-2. Pair detector: mood↔sleepQuality, mood↔sleepHours, mood↔each habit, sleepQuality↔each habit
- [ ] D-3. Threshold: only surface pairs with `|r| >= 0.35` AND `>= 30` overlapping days
- [ ] D-4. Human phrasing generator ("You sleep ~0.6 points better on walk days")
- [ ] D-5. New sub-tab or panel on Reports ("Insights")
- [ ] D-6. Empty-state copy when not enough data

**E. Pattern nudges**
- [ ] E-1. Rolling-average detector ("mood 7-day avg up vs previous 7 days by X")
- [ ] E-2. Day-of-week distribution detector ("Mondays are your hardest day")
- [ ] E-3. Streak-at-risk check ("2 days since meditation")
- [ ] E-4. Nudge card on Today (below habit list, above stats)
- [ ] E-5. Dismiss/hide individual nudge for N days

**F. Streak milestones**
- [ ] F-1. Detect 7 / 30 / 100 / 365 crossings on render per habit
- [ ] F-2. Store `celebratedMilestones: { habitId: [7, 30, …] }` on habit record
- [ ] F-3. Full-screen confetti moment (CSS keyframes + SVG particles)
- [ ] F-4. Milestone card with habit title + message; "Keep going" to dismiss
- [ ] F-5. One celebration per day max

## Content & reflection

**H. Weekly review**
- [ ] H-1. Aggregator `weeklyReviewStats(weekStartKey)` (best day, hardest day, habit of the week, diary highlight)
- [ ] H-2. Modal modeled on Wrapped; stages scoped to the week
- [ ] H-3. Auto-offer once per week on Sunday evening (past reminder) — dismissible
- [ ] H-4. Access button on Reports header alongside "At a glance"
- [ ] H-5. Optional "save as diary entry" action

**J. Diary search**
- [ ] J-1. Search input at top of Diary tab (debounced 200ms)
- [ ] J-2. Case-insensitive filter over `good + challenge` text
- [ ] J-3. Highlight matches in snippets
- [ ] J-4. "X of Y entries" count

**L. Custom reflection prompts**
- [ ] L-1. Settings section "Your prompts" (add/edit/remove)
- [ ] L-2. Persist in `state.customPrompts[]`
- [ ] L-3. Merge with built-ins in daily rotation
- [ ] L-4. Export/import includes custom prompts

> Note: L's merge-with-daily-rotation interacts with Phase 6 (which turns the prompt step into a pure fun-fact display). If Phase 6 ships first, L becomes "edit the fun-fact bank" or we revisit scope.

---

# Phase 6 — Simpler daily flow (breath / mood / fact / journal / breath)

**Branch:** (TBD — `feat/phase-6-flow` when building)

**Core decisions:**
- **Remove photo / IndexedDB feature** entirely (rolls back Phase 5 Q). Less scope, less to maintain.
- **Remove reflection prompts from the flow**. The prompt step becomes a **pure fun-fact display card** — no input, no "how does this make you feel?". It's a visual break between inputs.
- **Sleep moves out of the check-in flow** — logged via a dedicated widget on Today (quick-access face picker + hours).
- **Habits move out of the check-in flow** — already quick-loggable from Today (pill tap + swipe from Phase 5 E). No habits step in check-in.
- **New daily check-in flow** (5 stages):
  1. **Breath-in** — 5-second pleasant radial countdown timer; auto-advances.
  2. **Mood** — 5-face picker (same as today).
  3. **Fun fact** — display-only card that breaks the input flow gently.
  4. **Journal** — one good thing + one challenge/learning (140-char cap each).
  5. **Breath-out** — 5-second radial timer, same aesthetic as intro.
- **Rationale**: the current flow is long (6 steps). Concentrating on breath + reflection makes the ritual feel more mindful. Habits and sleep live where you actually interact with them (Today), not inside a ceremony.

## Block 24 — Remove photo + IndexedDB feature
- [ ] 24-1. Remove photo input from diary step (`renderDiaryPhotoField`)
- [ ] 24-2. Remove thumbnail rendering from diary timeline cards
- [ ] 24-3. Remove `_photos` embedding in export; skip photo keys on import (graceful for old backups)
- [ ] 24-4. Keep `clearAllPhotos()` reachable from `deleteAllData()` so legacy photos still clear
- [ ] 24-5. Delete `diary-photo-preview` / `diary-photo-thumb` CSS
- [ ] 24-6. Strip `diary.hasPhoto` field on save (or leave as a no-op field — decide)

## Block 25 — Radial breath timer component
- [ ] 25-1. `renderBreathTimer({ seconds, onDone, label })` helper → returns a centered SVG
- [ ] 25-2. Radial fill animation via `stroke-dashoffset` on an `<circle>` over `seconds` duration
- [ ] 25-3. Pulsing outer ring + subtle scale breathing animation
- [ ] 25-4. Tap-to-skip support (optional — default on for accessibility)
- [ ] 25-5. CSS keyframes + reduced-motion fallback

## Block 26 — Rework check-in flow
- [ ] 26-1. Redefine `CHECKIN_STEPS = ['breathIn', 'mood', 'fact', 'journal', 'breathOut']`
- [ ] 26-2. Rename/refit `ensureTodayLog` steps shape; back-compat with old step names (treat as done/skip)
- [ ] 26-3. New `renderBreathInStep` using the timer (auto-advance)
- [ ] 26-4. Keep `renderMoodStep` (essentially unchanged)
- [ ] 26-5. New `renderFactStep` — display-only fun fact card, Next button
- [ ] 26-6. Keep `renderJournalStep` (rename from diary-step, same 140-char good + challenge)
- [ ] 26-7. New `renderBreathOutStep` — timer + summary line ("see you tomorrow")
- [ ] 26-8. Remove `renderSleepStep`, `renderHabitsStep`, `renderPromptStep` (retire from the flow)
- [ ] 26-9. Update `renderSummaryStep` → fold into breathOut's closing or drop entirely
- [ ] 26-10. Reduce prompts bank to fun facts only; drop reflection-prompt list

## Block 27 — Sleep widget on Today
- [ ] 27-1. Small sleep card on Today (above or near habits): shows last night's value or "Log sleep"
- [ ] 27-2. Tap → inline bottom sheet with 5-face picker + optional hours input
- [ ] 27-3. Persists to `state.logs[today].sleep`; fires toast with Undo
- [ ] 27-4. Reports (Sleep sub-tab) continues to work against same data

## Block 28 — Habits confirmed Today-only
- [ ] 28-1. No habits step in the flow — verified
- [ ] 28-2. Summary screen (if kept) shows habit progress from Today state
- [ ] 28-3. Quick-log + swipe already cover interaction (Phase 5 E)

## Block 29 — Wrapped / Reports consistency
- [ ] 29-1. Wrapped still reads sleep + habits from their own sources (no change needed)
- [ ] 29-2. Remove "reflection prompt" card style from wrapped stages if referenced
- [ ] 29-3. Confirm completion tracking on Today still surfaces via `nextIncompleteStep`
