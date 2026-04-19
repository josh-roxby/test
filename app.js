// Tempo — habit & mood tracker (PWA)
// Built in small, incremental blocks. See CLAUDE-TODO.md.

// ---- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'tempo-v1';

const DEFAULT_STATE = {
  version: 1,
  habits: [],
  logs: {},
  countdowns: [],
  settings: {
    rolloverHour: 3,
  },
};

function defaultState() {
  return JSON.parse(JSON.stringify(DEFAULT_STATE));
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return {
      ...defaultState(),
      ...parsed,
      settings: { ...defaultState().settings, ...(parsed.settings || {}) },
    };
  } catch {
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (err) {
    console.error('Failed to save state', err);
  }
}

let state = load();

// ---- Constants --------------------------------------------------------------

const PALETTE = [
  '#7c9cff', '#8ad1ff', '#5eead4', '#86efac',
  '#fde047', '#fbbf24', '#fb923c', '#f87171',
  '#f472b6', '#c084fc', '#a78bfa', '#94a3b8',
];

const HABIT_TYPES = [
  { id: 'tick',    label: 'Tick',    hint: 'Did or didn\'t' },
  { id: 'count',   label: 'Count',   hint: 'e.g. 4 walks' },
  { id: 'percent', label: 'Percent', hint: '0–100%' },
];

const MOOD_OPTIONS = [
  { value: 1, emoji: '😞', caption: 'rough' },
  { value: 2, emoji: '😕', caption: 'meh' },
  { value: 3, emoji: '😐', caption: 'okay' },
  { value: 4, emoji: '🙂', caption: 'good' },
  { value: 5, emoji: '😄', caption: 'great' },
];

const SLEEP_FACES = [
  { value: 1, emoji: '😩', caption: 'awful' },
  { value: 2, emoji: '😕', caption: 'poor'  },
  { value: 3, emoji: '😐', caption: 'okay'  },
  { value: 4, emoji: '🙂', caption: 'good'  },
  { value: 5, emoji: '😴', caption: 'great' },
];

const DIARY_CAP = 140;

const CHECKIN_STEPS = ['sleep', 'mood', 'prompt', 'habits', 'diary'];
// + an implicit 'summary' step after all of the above.

const COUNTDOWN_AUTO_ARCHIVE_MS = 24 * 60 * 60 * 1000; // auto-archive 24h past target

const COUNTDOWN_THEMES = [
  { id: 'sunset',    label: 'Sunset'    },
  { id: 'ocean',     label: 'Ocean'     },
  { id: 'forest',    label: 'Forest'    },
  { id: 'aurora',    label: 'Aurora'    },
  { id: 'peach',     label: 'Peach'     },
  { id: 'lavender',  label: 'Lavender'  },
  { id: 'neon',      label: 'Neon'      },
  { id: 'mono',      label: 'Mono'      },
  { id: 'candy',     label: 'Candy'     },
  { id: 'confetti',  label: 'Confetti'  },
  { id: 'snowfall',  label: 'Snowfall'  },
  { id: 'tropical',  label: 'Tropical'  },
  { id: 'midnight',  label: 'Midnight'  },
  { id: 'rose',      label: 'Rose gold' },
  { id: 'sage',      label: 'Sage'      },
  { id: 'polka',     label: 'Polka'     },
];

const FACTS = [
  'Honey never spoils — archaeologists have found edible pots 3,000 years old.',
  'A day on Venus is longer than its year.',
  'Octopuses have three hearts and blue blood.',
  'The Eiffel Tower grows about 15 cm taller in summer.',
  'Bananas are berries; strawberries aren\'t.',
  'A group of flamingos is called a flamboyance.',
  'Cows have best friends and get stressed when separated.',
  'Wombat poop is cube-shaped.',
  'Sharks existed before trees.',
  'There are more stars in the universe than grains of sand on Earth.',
  'Sea otters hold hands when they sleep so they don\'t drift apart.',
  'Your stomach gets a new lining every few days.',
  'A blue whale\'s heart is the size of a small car.',
  'Butterflies taste with their feet.',
  'The shortest war in history lasted 38 minutes.',
  'Antarctica is the largest desert on Earth.',
  'Sloths can hold their breath longer than dolphins.',
  'A jiffy is an actual unit of time (1/100th of a second).',
  'Koalas have fingerprints nearly identical to humans.',
  'The fastest fish can outswim a running cheetah.',
];

const PROMPTS = [
  'What from last week are you most proud of?',
  'What drained you most this week? Can you protect against it?',
  'One small win from the past 7 days — what was it?',
  'Did you spend time the way you wanted to this week?',
  'Who do you want to thank from last week?',
  'What did you learn about yourself recently?',
  'Which habit felt easiest this week? Why?',
  'Which habit felt hardest? What got in the way?',
  'One moment from last week you\'d replay — which?',
  'What\'s one thing you\'d do differently next week?',
  'How did you take care of yourself this week?',
  'What surprised you in the last few days?',
];

function uid() {
  return 'h_' + Math.random().toString(36).slice(2, 10);
}

function habitMeta(habit) {
  if (habit.type === 'tick') {
    return habit.kind === 'good' ? 'Daily tick' : 'Avoid daily';
  }
  if (habit.type === 'count') {
    const unit = habit.unit ? ' ' + habit.unit : '';
    return `${habit.kind === 'good' ? 'Target' : 'Limit'}: ${habit.target}${unit}`;
  }
  if (habit.type === 'percent') {
    return `${habit.kind === 'good' ? 'Target' : 'Limit'}: ${habit.target}%`;
  }
  return '';
}

// ---- Habit state / intensity / streak ---------------------------------------

function habitValueForDay(habit, dayKey) {
  const log = state.logs[dayKey];
  if (!log || !log.habits) return undefined;
  return log.habits[habit.id];
}

// "Success" for this day: for good habits, did they hit the target?
// For bad habits, did they stay at/under the limit?
function isHabitDoneForDay(habit, dayKey) {
  const v = habitValueForDay(habit, dayKey);
  if (v === undefined) return false;
  if (habit.type === 'tick') {
    return habit.kind === 'good' ? !!v : !v;
  }
  const n = Number(v) || 0;
  if (habit.kind === 'good') return n >= habit.target;
  return n <= habit.target;
}

// 0..1 "how much of the thing happened", used to shade heatmap cells.
function habitIntensityForDay(habit, dayKey) {
  const v = habitValueForDay(habit, dayKey);
  if (v === undefined) return 0;
  if (habit.type === 'tick') return v ? 1 : 0;
  const n = Number(v) || 0;
  if (habit.type === 'percent') return Math.max(0, Math.min(1, n / 100));
  const target = habit.target || 1;
  return Math.max(0, Math.min(1, n / target));
}

function currentStreak(habit) {
  const today = currentDayKey();
  const creationDay = habit.createdAt
    ? dayKeyFromDate(new Date(habit.createdAt))
    : null;
  let day = today;
  // If today isn't logged yet, don't penalise — start from yesterday.
  if (habitValueForDay(habit, day) === undefined) day = daysAgo(day, 1);
  let streak = 0;
  for (let i = 0; i < 400; i++) {
    if (creationDay && day < creationDay) break;
    if (!isHabitDoneForDay(habit, day)) break;
    streak++;
    day = daysAgo(day, 1);
  }
  return streak;
}

function ensureTodayLog() {
  const key = currentDayKey();
  if (!state.logs[key]) {
    const seed = strHash(key);
    const isReflect = seed % 2 === 0;
    state.logs[key] = {
      mood: null,
      note: '',
      promptKind: isReflect ? 'reflect' : 'fact',
      promptText: isReflect
        ? PROMPTS[seed % PROMPTS.length]
        : FACTS[seed % FACTS.length],
      habits: {},
      sleep: null,                                 // { quality:1–5, hours:number|null }
      diary: null,                                 // { good:string, challenge:string }
      steps: { mood: false, prompt: false, habits: false, sleep: false, diary: false },
      completedAt: null,
    };
  } else {
    // Backfill shape for older logs so future reads are safe.
    const log = state.logs[key];
    if (!log.steps) log.steps = { mood: !!log.mood, prompt: false, habits: false };
    if (log.steps.sleep === undefined) log.steps.sleep = false;
    if (log.steps.diary === undefined) log.steps.diary = false;
    if (!log.habits) log.habits = {};
    if (log.sleep === undefined) log.sleep = null;
    if (log.diary === undefined) log.diary = null;
    if (log.promptText == null) {
      const seed = strHash(key);
      const isReflect = seed % 2 === 0;
      log.promptKind = isReflect ? 'reflect' : 'fact';
      log.promptText = isReflect
        ? PROMPTS[seed % PROMPTS.length]
        : FACTS[seed % FACTS.length];
    }
  }
  return state.logs[key];
}

function nextIncompleteStep() {
  const log = state.logs[currentDayKey()];
  if (!log) return 0;
  for (let i = 0; i < CHECKIN_STEPS.length; i++) {
    if (!log.steps?.[CHECKIN_STEPS[i]]) return i;
  }
  return null;
}

// ---- Countdown helpers ------------------------------------------------------

function countdownUid() {
  return 'c_' + Math.random().toString(36).slice(2, 10);
}

function countdownTargetDate(c) {
  return new Date(c.target);
}

function countdownMillisRemaining(c, now = new Date()) {
  return countdownTargetDate(c).getTime() - now.getTime();
}

// "upcoming" | "happened" (target passed but < 24h ago) | "past" | "archived"
function countdownStatus(c, now = new Date()) {
  if (c.archivedAt) return 'archived';
  const delta = countdownMillisRemaining(c, now);
  if (delta > 0) return 'upcoming';
  if (delta > -COUNTDOWN_AUTO_ARCHIVE_MS) return 'happened';
  return 'past';
}

// For annual recurring countdowns whose target has passed, bump target forward
// by whole years until it's in the future. Called once per render.
function bumpAnnualCountdowns(now = new Date()) {
  let changed = false;
  for (const c of state.countdowns) {
    if (c.archivedAt) continue;
    if (c.recurring !== 'annual') continue;
    const target = countdownTargetDate(c);
    if (target.getTime() > now.getTime()) continue;
    const bumped = new Date(target);
    while (bumped.getTime() <= now.getTime()) {
      bumped.setFullYear(bumped.getFullYear() + 1);
    }
    c.target = bumped.toISOString();
    changed = true;
  }
  if (changed) save();
}

// Auto-archive non-recurring countdowns whose target passed more than 24h ago.
function autoArchiveCountdowns(now = new Date()) {
  let changed = false;
  for (const c of state.countdowns) {
    if (c.archivedAt) continue;
    if (c.recurring === 'annual') continue;
    const target = countdownTargetDate(c);
    if (now.getTime() - target.getTime() > COUNTDOWN_AUTO_ARCHIVE_MS) {
      c.archivedAt = now.toISOString();
      changed = true;
    }
  }
  if (changed) save();
}

// Runs on each render that touches countdowns.
function reconcileCountdowns(now = new Date()) {
  bumpAnnualCountdowns(now);
  autoArchiveCountdowns(now);
}

function sortedUpcomingCountdowns() {
  return state.countdowns
    .filter((c) => !c.archivedAt)
    .slice()
    .sort((a, b) => countdownTargetDate(a).getTime() - countdownTargetDate(b).getTime());
}

function sortedArchivedCountdowns() {
  return state.countdowns
    .filter((c) => c.archivedAt)
    .slice()
    .sort((a, b) => new Date(b.archivedAt).getTime() - new Date(a.archivedAt).getTime());
}

function formatCountdownRemaining(c, now = new Date()) {
  const status = countdownStatus(c, now);
  if (status === 'archived') return 'archived';
  if (status === 'happened') return '🎉 happened';
  if (status === 'past') return 'past';
  const delta = countdownMillisRemaining(c, now);
  const days = Math.floor(delta / (24 * 3600 * 1000));
  const hours = Math.floor((delta % (24 * 3600 * 1000)) / (3600 * 1000));
  const mins = Math.floor((delta % (3600 * 1000)) / (60 * 1000));
  if (days >= 7) return `${days} days`;
  if (days >= 1) return `${days}d ${hours}h`;
  if (hours >= 1) return `${hours}h ${mins}m`;
  if (mins >= 1)  return `${mins}m`;
  return '< 1m';
}

function formatCountdownTargetLabel(c) {
  const d = countdownTargetDate(c);
  return d.toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }) + ' · ' + d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

function todayStateText(habit) {
  const v = habitValueForDay(habit, currentDayKey());
  if (v === undefined) return '—';
  if (habit.type === 'tick') return v ? '✓' : '—';
  if (habit.type === 'count') {
    const unit = habit.unit ? ' ' + habit.unit : '';
    return `${v}/${habit.target}${unit}`;
  }
  if (habit.type === 'percent') return `${v}%`;
  return '';
}

// ---- Day helpers ------------------------------------------------------------

function pad2(n) {
  return String(n).padStart(2, '0');
}

function dayKeyFromDate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseDayKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// Returns the day key for "today", shifting the clock back by the rollover hour
// so that, e.g., 02:30 with rolloverHour=3 still counts as the previous day.
function currentDayKey(now = new Date()) {
  const rollover = state.settings?.rolloverHour ?? 3;
  const shifted = new Date(now.getTime() - rollover * 3600 * 1000);
  return dayKeyFromDate(shifted);
}

function daysAgo(key, n) {
  const d = parseDayKey(key);
  d.setDate(d.getDate() - n);
  return dayKeyFromDate(d);
}

// djb2 — small deterministic hash for seeded daily picks (fun facts / prompts).
function strHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

// ---- DOM helpers ------------------------------------------------------------

function qs(sel, root = document) {
  return root.querySelector(sel);
}

function qsa(sel, root = document) {
  return Array.from(root.querySelectorAll(sel));
}

// Tiny hyperscript-style builder.
// h('div', {class:'x', onClick: fn}, 'text', h('span', 'child'))
// Second arg may be an attrs object OR a child (string/Node) for ergonomics.
function h(tag, attrs, ...children) {
  const node = typeof tag === 'string' ? document.createElement(tag) : tag;
  const isAttrs =
    attrs != null &&
    typeof attrs === 'object' &&
    !(attrs instanceof Node) &&
    !Array.isArray(attrs);
  if (isAttrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(node.style, v);
      else if (k === 'dataset' && typeof v === 'object') Object.assign(node.dataset, v);
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2).toLowerCase(), v);
      } else if (v === true) {
        node.setAttribute(k, '');
      } else {
        node.setAttribute(k, String(v));
      }
    }
  } else if (attrs != null) {
    children.unshift(attrs);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    node.appendChild(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return node;
}

// SVG element builder (uses the SVG namespace so attrs like viewBox work).
function svgEl(tag, attrs, ...children) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      el.setAttribute(k, String(v));
    }
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c)) : c);
  }
  return el;
}

let toastTimer = null;
function toast(message, ms = 2000) {
  let el = qs('#toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

// ---- Router -----------------------------------------------------------------

const ROUTES = new Set([
  'home', 'habits', 'diary', 'countdowns', 'reports', 'settings',
]);
let route = 'home';

function go(next) {
  if (!ROUTES.has(next)) next = 'home';
  route = next;
  render();
}

function render() {
  const app = qs('#app');
  app.replaceChildren();
  if (route === 'habits') app.appendChild(renderManage());
  else if (route === 'diary') app.appendChild(renderDiary());
  else if (route === 'countdowns') app.appendChild(renderCountdowns());
  else if (route === 'reports') app.appendChild(renderReports());
  else if (route === 'settings') app.appendChild(renderSettings());
  else app.appendChild(renderHome());
  updateTabbar();
  updateGear();
}

function updateTabbar() {
  const tabbar = qs('#tabbar');
  tabbar.hidden = false;
  qsa('.tab', tabbar).forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.route === route);
  });
}

function wireTabbar() {
  qsa('#tabbar .tab').forEach((btn) => {
    btn.addEventListener('click', () => go(btn.dataset.route));
  });
}

function updateGear() {
  const gear = qs('#gear');
  if (!gear) return;
  const onSettings = route === 'settings';
  gear.classList.toggle('active', onSettings);
  if (onSettings) gear.setAttribute('aria-current', 'page');
  else gear.removeAttribute('aria-current');
}

function wireGear() {
  const gear = qs('#gear');
  if (!gear) return;
  gear.addEventListener('click', () => {
    go(route === 'settings' ? 'home' : 'settings');
  });
}

// ---- View stubs -------------------------------------------------------------

// ---- Home + heatmap ---------------------------------------------------------

function renderHome() {
  const view = h('div', { class: 'view' });

  const displayDate = new Date().toLocaleDateString(undefined, {
    weekday: 'long', month: 'long', day: 'numeric',
  });
  view.appendChild(h('h1', 'Today'));
  view.appendChild(h('p', { class: 'muted', style: { marginBottom: '16px' } }, displayDate));

  // Check-in status card
  const incomplete = nextIncompleteStep();
  const log = state.logs[currentDayKey()];
  const anyStepDone = !!log && Object.values(log.steps || {}).some(Boolean);

  if (incomplete !== null) {
    view.appendChild(h('button', {
      class: 'primary block',
      style: { marginBottom: '16px' },
      onClick: () => openCheckIn(),
    }, anyStepDone ? 'Resume check-in' : 'Start today\'s check-in'));
  } else if (log) {
    const moodFace = MOOD_OPTIONS.find((m) => m.value === log.mood);
    const sleepFace = log.sleep?.quality
      ? SLEEP_FACES.find((s) => s.value === log.sleep.quality) : null;
    const row = h('div', { class: 'row', style: { gap: '16px' } });
    if (sleepFace) {
      row.appendChild(h('div', null,
        h('div', { class: 'small muted' }, 'slept'),
        h('div', { style: { fontSize: '1.2rem', marginTop: '2px' } },
          `${sleepFace.emoji} ${sleepFace.caption}`),
      ));
    }
    if (moodFace) {
      row.appendChild(h('div', null,
        h('div', { class: 'small muted' }, 'mood'),
        h('div', { style: { fontSize: '1.2rem', marginTop: '2px' } },
          `${moodFace.emoji} ${moodFace.caption}`),
      ));
    }
    view.appendChild(h('div', { class: 'summary', style: { marginBottom: '16px' } },
      h('div', { class: 'row between', style: { alignItems: 'flex-start' } },
        row,
        h('button', {
          class: 'ghost small',
          onClick: () => openCheckIn(0),
        }, 'Edit'),
      ),
    ));
  }

  // Next upcoming countdown (peek strip)
  const nextCountdown = sortedUpcomingCountdowns()[0];
  if (nextCountdown) {
    view.appendChild(renderCountdownTile(nextCountdown, {
      style: { marginBottom: '16px', minHeight: '90px' },
      onClick: () => go('countdowns'),
    }));
  }

  const active = state.habits.filter((x) => !x.archivedAt);

  if (active.length === 0) {
    view.appendChild(h('div', { class: 'summary', style: { marginTop: '8px' } },
      h('h2', { style: { color: 'var(--text)', fontSize: '1.15rem', margin: '0 0 6px' } },
        'Welcome to Tempo'),
      h('p', { style: { margin: '0 0 14px' } },
        'Track habits you want to build and break, log your mood daily, and watch patterns emerge on a private heatmap. Everything stays on this device.'),
      h('button', {
        class: 'primary block',
        onClick: () => go('habits'),
      }, 'Add your first habit'),
    ));
    return view;
  }

  const good = active.filter((x) => x.kind === 'good');
  const bad  = active.filter((x) => x.kind === 'bad');

  if (good.length) view.appendChild(renderHomeSection('Build', 'good', good));
  if (bad.length)  view.appendChild(renderHomeSection('Break', 'bad', bad));

  return view;
}

function renderHomeSection(title, kindClass, habits) {
  return h('section', { class: 'section' },
    h('div', { class: `section-head ${kindClass}` },
      h('span', { class: 'dot' }),
      title,
    ),
    h('div', { class: 'habit-list' },
      habits.map((habit) => renderHomeHabitCard(habit)),
    ),
  );
}

function renderHomeHabitCard(habit) {
  const today = currentDayKey();
  const done = isHabitDoneForDay(habit, today);
  const streak = currentStreak(habit);

  const card = h('div', {
      class: `habit ${habit.kind}${done ? ' done' : ''}`,
      style: { '--habit-color': habit.color },
    },
    h('div', { class: 'stripe' }),
    h('div', null,
      h('div', { class: 'title' }, habit.title),
      h('div', { class: 'meta' }, habitMeta(habit)),
      streak > 0
        ? h('div', { style: { marginTop: '4px' } },
            h('span', { class: 'streak' },
              `🔥 ${streak}-day ${habit.kind === 'good' ? 'streak' : 'clean streak'}`),
          )
        : null,
    ),
    h('div', { class: 'state' }, todayStateText(habit)),
  );

  const wrapper = h('div');
  wrapper.appendChild(card);
  wrapper.appendChild(renderHeatmap(habit));
  return wrapper;
}

function renderHeatmap(habit) {
  const WEEKS = 12;
  const todayKey = currentDayKey();
  const todayDate = parseDayKey(todayKey);
  const dow = todayDate.getDay();
  const startOfThisWeek = new Date(
    todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate() - dow,
  );
  const startOfGrid = new Date(startOfThisWeek);
  startOfGrid.setDate(startOfThisWeek.getDate() - (WEEKS - 1) * 7);

  const grid = h('div', {
    class: 'heatmap',
    style: { '--habit-color': habit.color },
    'aria-label': `${habit.title} last ${WEEKS} weeks`,
  });

  for (let w = 0; w < WEEKS; w++) {
    for (let d = 0; d < 7; d++) {
      const cellDate = new Date(startOfGrid);
      cellDate.setDate(startOfGrid.getDate() + w * 7 + d);
      if (cellDate > todayDate) {
        grid.appendChild(h('div', { class: 'cell', style: { visibility: 'hidden' } }));
        continue;
      }
      const dayKey = dayKeyFromDate(cellDate);
      const intensity = habitIntensityForDay(habit, dayKey);
      const level = intensity === 0 ? 0 : Math.max(1, Math.ceil(intensity * 4));
      const cls =
        'cell' +
        (level ? ` l${level}` : '') +
        (dayKey === todayKey ? ' today' : '');
      grid.appendChild(h('div', {
        class: cls,
        title: dayKey + (intensity > 0 ? ` · ${Math.round(intensity * 100)}%` : ''),
      }));
    }
  }
  return grid;
}

// ---- Manage: list + edit ----------------------------------------------------

// null = list view; 'new' = new-habit form; '<id>' = edit form for that habit.
let editingHabitId = null;

function startNewHabit() { editingHabitId = 'new'; render(); }
function startEditHabit(id) { editingHabitId = id; render(); }
function cancelEdit() { editingHabitId = null; render(); }

function renderManage() {
  if (editingHabitId !== null) return renderHabitEdit();

  const view = h('div', { class: 'view' });

  view.appendChild(h('div', { class: 'row between', style: { marginBottom: '8px' } },
    h('h1', 'Habits'),
    h('button', { class: 'primary', onClick: startNewHabit }, '+ New'),
  ));

  const active = state.habits.filter((x) => !x.archivedAt);
  const archived = state.habits.filter((x) => x.archivedAt);

  if (active.length === 0 && archived.length === 0) {
    view.appendChild(h('div', { class: 'stack', style: { marginTop: '24px' } },
      h('p', 'No habits yet. Tap "+ New" to add one.'),
      h('p', { class: 'small muted' },
        'Good habits you want to build (like "Morning walk") and bad habits you want to break (like "Doomscrolling") both live here.'),
      h('p', { class: 'small muted' },
        'Tracking types — Tick (did or didn\'t), Count (e.g. 4 walks), Percent (e.g. 90% urges logged).'),
    ));
    return view;
  }

  const good = active.filter((x) => x.kind === 'good');
  const bad = active.filter((x) => x.kind === 'bad');

  if (good.length) view.appendChild(renderManageSection('Build', 'good', good));
  if (bad.length)  view.appendChild(renderManageSection('Break', 'bad', bad));
  if (archived.length) view.appendChild(renderManageSection('Archived', '', archived));

  return view;
}

function renderManageSection(title, kindClass, habits) {
  return h('section', { class: 'section' },
    h('div', { class: `section-head ${kindClass}` },
      h('span', { class: 'dot' }),
      title,
    ),
    h('div', { class: 'habit-list' },
      habits.map((habit) => renderManageHabitCard(habit)),
    ),
  );
}

function renderManageHabitCard(habit) {
  return h('div', {
      class: `habit ${habit.kind}${habit.archivedAt ? ' archived' : ''}`,
      style: { '--habit-color': habit.color },
      onClick: () => startEditHabit(habit.id),
      role: 'button',
      tabindex: '0',
    },
    h('div', { class: 'stripe' }),
    h('div', null,
      h('div', { class: 'title' }, habit.title),
      h('div', { class: 'meta' }, habitMeta(habit)),
    ),
    h('div', { class: 'state' }, '›'),
  );
}

function renderSegmented(options, value, onChange) {
  const seg = h('div', { class: 'segmented' });
  let current = value;
  function paint() {
    seg.replaceChildren();
    options.forEach((opt) => {
      const btn = h('button', {
        class: current === opt.id ? 'on' : '',
        onClick: () => { current = opt.id; paint(); onChange(opt.id); },
        type: 'button',
      }, opt.label);
      seg.appendChild(btn);
    });
  }
  paint();
  return seg;
}

function renderHabitEdit() {
  const isNew = editingHabitId === 'new';
  const existing = isNew ? null : state.habits.find((x) => x.id === editingHabitId);
  if (!isNew && !existing) {
    editingHabitId = null;
    return renderManage();
  }

  const draft = isNew ? {
    id: uid(),
    title: '',
    description: '',
    kind: 'good',
    type: 'tick',
    target: 1,
    unit: '',
    color: PALETTE[0],
    createdAt: new Date().toISOString(),
    archivedAt: null,
  } : { ...existing };

  const view = h('div', { class: 'view' });

  view.appendChild(h('div', { class: 'row between', style: { marginBottom: '8px' } },
    h('button', { class: 'ghost', onClick: cancelEdit }, '← Back'),
    h('h1', { style: { fontSize: '1.15rem' } }, isNew ? 'New habit' : 'Edit habit'),
    h('span', { style: { width: '64px' } }),
  ));

  // Title
  view.appendChild(h('label', 'Title'));
  const titleInput = h('input', {
    type: 'text', maxlength: 60, placeholder: 'Morning walk',
  });
  titleInput.value = draft.title;
  titleInput.addEventListener('input', () => { draft.title = titleInput.value; });
  view.appendChild(titleInput);

  // Description
  view.appendChild(h('label', 'Description (optional)'));
  const descInput = h('textarea', {
    maxlength: 400, placeholder: 'Why does this matter to you?',
  });
  descInput.value = draft.description;
  descInput.addEventListener('input', () => { draft.description = descInput.value; });
  view.appendChild(descInput);

  // Kind (good / bad)
  view.appendChild(h('label', 'Kind'));
  view.appendChild(renderSegmented(
    [
      { id: 'good', label: 'Build (good)' },
      { id: 'bad',  label: 'Break (bad)'  },
    ],
    draft.kind,
    (v) => { draft.kind = v; },
  ));

  // Qty type
  view.appendChild(h('label', 'Tracking'));
  const targetContainer = h('div', { class: 'stack' });
  view.appendChild(renderSegmented(
    HABIT_TYPES.map((t) => ({ id: t.id, label: t.label })),
    draft.type,
    (v) => { draft.type = v; refreshTargetFields(); },
  ));
  view.appendChild(targetContainer);

  function refreshTargetFields() {
    targetContainer.replaceChildren();

    if (draft.type === 'count') {
      if (!draft.target || draft.target < 1) draft.target = 1;
      targetContainer.appendChild(h('label', 'Target count + unit'));
      const row = h('div', { class: 'row', style: { gap: '8px' } });
      const targetIn = h('input', { type: 'number', min: 1, step: 1, inputmode: 'numeric', style: 'flex:1' });
      targetIn.value = draft.target;
      targetIn.addEventListener('input', () => {
        draft.target = Math.max(1, Number(targetIn.value) || 1);
      });
      const unitIn = h('input', { type: 'text', maxlength: 16, placeholder: 'walks', style: 'flex:1' });
      unitIn.value = draft.unit || '';
      unitIn.addEventListener('input', () => { draft.unit = unitIn.value; });
      row.appendChild(targetIn);
      row.appendChild(unitIn);
      targetContainer.appendChild(row);
    } else if (draft.type === 'percent') {
      if (!draft.target || draft.target < 1 || draft.target > 100) draft.target = 100;
      targetContainer.appendChild(h('label', 'Target percentage (1–100)'));
      const targetIn = h('input', { type: 'number', min: 1, max: 100, step: 1, inputmode: 'numeric' });
      targetIn.value = draft.target;
      targetIn.addEventListener('input', () => {
        const n = Number(targetIn.value) || 100;
        draft.target = Math.min(100, Math.max(1, n));
      });
      targetContainer.appendChild(targetIn);
    } else {
      targetContainer.appendChild(h('p', { class: 'small muted', style: { margin: '4px 2px 0' } },
        'Tick tracks whether you did it today — no target needed.'));
    }
  }
  refreshTargetFields();

  // Color palette
  view.appendChild(h('label', 'Color'));
  const palette = h('div', { class: 'palette' });
  function paintPalette() {
    palette.replaceChildren();
    PALETTE.forEach((color) => {
      palette.appendChild(h('div', {
        class: 'swatch' + (color === draft.color ? ' selected' : ''),
        style: { background: color },
        role: 'button',
        'aria-label': `Color ${color}`,
        tabindex: '0',
        onClick: () => { draft.color = color; paintPalette(); },
      }));
    });
  }
  paintPalette();
  view.appendChild(palette);

  // Actions
  const actions = h('div', { class: 'stack', style: { marginTop: '24px' } });
  actions.appendChild(h('button', {
    class: 'primary block',
    onClick: () => saveHabitDraft(draft, isNew),
  }, 'Save'));

  if (!isNew) {
    if (existing.archivedAt) {
      actions.appendChild(h('button', {
        class: 'block ghost',
        onClick: () => unarchiveHabit(existing.id),
      }, 'Unarchive'));
    } else {
      actions.appendChild(h('button', {
        class: 'block ghost',
        onClick: () => archiveHabit(existing.id),
      }, 'Archive'));
    }
    actions.appendChild(h('button', {
      class: 'block danger',
      onClick: () => deleteHabitConfirm(existing.id),
    }, 'Delete permanently'));
  }
  view.appendChild(actions);

  return view;
}

function saveHabitDraft(draft, isNew) {
  const title = draft.title.trim();
  if (!title) { toast('Please enter a title'); return; }
  draft.title = title;
  draft.description = (draft.description || '').trim();
  if (draft.type !== 'count') draft.unit = '';

  if (isNew) {
    state.habits.push(draft);
  } else {
    const i = state.habits.findIndex((x) => x.id === draft.id);
    if (i >= 0) state.habits[i] = draft;
  }
  save();
  editingHabitId = null;
  render();
  toast(isNew ? 'Habit added' : 'Saved');
}

function archiveHabit(id) {
  const habit = state.habits.find((x) => x.id === id);
  if (!habit) return;
  habit.archivedAt = new Date().toISOString();
  save();
  editingHabitId = null;
  render();
  toast('Archived');
}

function unarchiveHabit(id) {
  const habit = state.habits.find((x) => x.id === id);
  if (!habit) return;
  habit.archivedAt = null;
  save();
  editingHabitId = null;
  render();
  toast('Unarchived');
}

function deleteHabitConfirm(id) {
  const habit = state.habits.find((x) => x.id === id);
  if (!habit) return;
  const ok = confirm(`Delete "${habit.title}" and all its history permanently?`);
  if (!ok) return;
  state.habits = state.habits.filter((x) => x.id !== id);
  for (const key of Object.keys(state.logs)) {
    if (state.logs[key]?.habits) delete state.logs[key].habits[id];
  }
  save();
  editingHabitId = null;
  render();
  toast('Deleted');
}

// ---- Diary tab --------------------------------------------------------------

function diaryStepIndex() {
  return CHECKIN_STEPS.indexOf('diary');
}

function renderDiary() {
  const view = h('div', { class: 'view' });
  view.appendChild(h('h1', 'Diary'));
  view.appendChild(h('p', { class: 'muted', style: { marginBottom: '16px' } },
    `140-char snapshots of each day.`));

  const allDays = Object.keys(state.logs).sort().reverse();
  const daysWithDiary = allDays.filter((day) => {
    const d = state.logs[day]?.diary;
    return d && (d.good || d.challenge);
  });

  const todayKey = currentDayKey();
  const todayLog = state.logs[todayKey];
  const todayHasDiary = !!(todayLog?.diary && (todayLog.diary.good || todayLog.diary.challenge));

  if (!todayHasDiary) {
    view.appendChild(h('button', {
      class: 'primary block',
      style: { marginBottom: '16px' },
      onClick: () => openCheckIn(diaryStepIndex()),
    }, 'Write today\'s entry'));
  }

  if (daysWithDiary.length === 0) {
    view.appendChild(h('div', { class: 'summary' },
      h('h2', { style: { color: 'var(--text)', fontSize: '1.15rem', margin: '0 0 6px' } },
        'Nothing yet'),
      h('p', { style: { margin: 0 } },
        'Each day you check in, jot down one good thing and one challenge. They\'ll appear here as a timeline.'),
    ));
    return view;
  }

  const list = h('div', { class: 'stack' });
  for (const day of daysWithDiary) list.appendChild(renderDiaryCard(day));
  view.appendChild(list);

  return view;
}

function renderDiaryCard(dayKey) {
  const log = state.logs[dayKey];
  const diary = log.diary;
  const date = parseDayKey(dayKey);
  const todayKey = currentDayKey();
  const isToday = dayKey === todayKey;
  const displayDate = isToday
    ? 'Today'
    : date.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  const moodFace = log.mood ? MOOD_OPTIONS.find((m) => m.value === log.mood) : null;
  const sleepFace = log.sleep?.quality
    ? SLEEP_FACES.find((s) => s.value === log.sleep.quality) : null;

  const card = h('article', { class: 'prompt-card', style: { marginBottom: '10px' } });

  card.appendChild(h('div', {
    class: 'row between',
    style: { marginBottom: '10px', alignItems: 'center' },
  },
    h('div', { class: 'kicker' }, displayDate),
    h('div', { class: 'row', style: { gap: '8px', fontSize: '0.95rem' } },
      sleepFace ? h('span', { title: `slept ${sleepFace.caption}` }, sleepFace.emoji) : null,
      moodFace ? h('span', { title: `felt ${moodFace.caption}` }, moodFace.emoji) : null,
    ),
  ));

  if (diary.good) {
    card.appendChild(h('p', {
      style: { margin: '0 0 6px', color: 'var(--text)', lineHeight: 1.45 },
    }, h('span', { class: 'kicker' }, 'Good'), ' ', diary.good));
  }
  if (diary.challenge) {
    card.appendChild(h('p', {
      style: { margin: 0, color: 'var(--text)', lineHeight: 1.45 },
    }, h('span', { class: 'kicker' }, 'Challenge'), ' ', diary.challenge));
  }

  if (isToday) {
    card.appendChild(h('div', {
      class: 'row',
      style: { justifyContent: 'flex-end', marginTop: '10px' },
    },
      h('button', {
        class: 'ghost small',
        onClick: () => openCheckIn(diaryStepIndex()),
      }, 'Edit'),
    ));
  }

  return card;
}

// ---- Countdowns tab ---------------------------------------------------------

// null = list view; 'new' = create form; '<id>' = edit form.
let editingCountdownId = null;

function startNewCountdown() { editingCountdownId = 'new'; render(); }
function startEditCountdown(id) { editingCountdownId = id; render(); }
function cancelCountdownEdit() { editingCountdownId = null; render(); }

function isoToDatetimeLocal(iso) {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  } catch { return ''; }
}

function datetimeLocalToIso(local) {
  if (!local) return null;
  const d = new Date(local);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}

function renderCountdowns() {
  reconcileCountdowns();
  if (editingCountdownId !== null) return renderCountdownEdit();

  const view = h('div', { class: 'view' });
  view.appendChild(h('div', {
    class: 'row between', style: { marginBottom: '8px' },
  },
    h('h1', 'Coming up'),
    h('button', { class: 'primary', onClick: startNewCountdown }, '+ New'),
  ));

  const upcoming = sortedUpcomingCountdowns();
  const archived = sortedArchivedCountdowns();

  if (upcoming.length === 0 && archived.length === 0) {
    view.appendChild(h('div', { class: 'summary', style: { marginTop: '8px' } },
      h('h2', { style: { color: 'var(--text)', fontSize: '1.15rem', margin: '0 0 6px' } },
        'No countdowns yet'),
      h('p', { style: { margin: '0 0 14px' } },
        'Track birthdays, holidays, milestones, deadlines — whatever you\'re counting toward. Each gets its own vibe.'),
      h('button', { class: 'primary block', onClick: startNewCountdown },
        'Add your first countdown'),
    ));
    return view;
  }

  if (upcoming.length > 0) {
    view.appendChild(h('div', { class: 'section-head', style: { margin: '12px 0 8px' } },
      'Upcoming'));
    const grid = h('div', { class: 'stack' });
    upcoming.forEach((c) => grid.appendChild(renderCountdownTile(c)));
    view.appendChild(grid);
  }

  if (archived.length > 0) {
    view.appendChild(h('div', { class: 'section-head', style: { margin: '20px 0 8px' } },
      'Archived'));
    const grid = h('div', { class: 'stack' });
    archived.forEach((c) => grid.appendChild(renderCountdownTile(c)));
    view.appendChild(grid);
  }

  return view;
}

function renderCountdownTile(c, opts = {}) {
  const themeClass = `theme-${c.theme || 'mono'}`;
  const kicker =
    c.recurring === 'annual' ? 'Annual' :
    c.archivedAt ? 'Archived' :
    (c.description || '');

  return h('div', {
      class: `countdown-tile ${themeClass}`,
      style: opts.style,
      onClick: opts.onClick || (() => startEditCountdown(c.id)),
      role: 'button',
      tabindex: '0',
      'aria-label': `${c.title}: ${formatCountdownRemaining(c)}`,
    },
    h('div', null,
      kicker ? h('div', { class: 'c-sub' }, kicker) : null,
      h('div', { class: 'c-title' }, c.title),
    ),
    h('div', null,
      h('div', { class: 'c-remaining' }, formatCountdownRemaining(c)),
      h('div', { class: 'c-target' }, formatCountdownTargetLabel(c)),
    ),
  );
}

function renderCountdownEdit() {
  const isNew = editingCountdownId === 'new';
  const existing = isNew ? null : state.countdowns.find((c) => c.id === editingCountdownId);
  if (!isNew && !existing) {
    editingCountdownId = null;
    return renderCountdowns();
  }

  const defaultTarget = new Date();
  defaultTarget.setDate(defaultTarget.getDate() + 7);
  defaultTarget.setHours(12, 0, 0, 0);

  const draft = isNew ? {
    id: countdownUid(),
    title: '',
    description: '',
    target: defaultTarget.toISOString(),
    theme: COUNTDOWN_THEMES[0].id,
    recurring: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
  } : { ...existing };

  const view = h('div', { class: 'view' });

  view.appendChild(h('div', { class: 'row between', style: { marginBottom: '8px' } },
    h('button', { class: 'ghost', onClick: cancelCountdownEdit }, '← Back'),
    h('h1', { style: { fontSize: '1.15rem' } }, isNew ? 'New countdown' : 'Edit countdown'),
    h('span', { style: { width: '64px' } }),
  ));

  // Title
  view.appendChild(h('label', 'Title'));
  const titleIn = h('input', {
    type: 'text', maxlength: 60, placeholder: "Dad's birthday",
  });
  titleIn.value = draft.title;
  titleIn.addEventListener('input', () => { draft.title = titleIn.value; });
  view.appendChild(titleIn);

  // Description
  view.appendChild(h('label', 'Description (optional)'));
  const descIn = h('input', {
    type: 'text', maxlength: 200, placeholder: 'Dinner at the Italian place',
  });
  descIn.value = draft.description || '';
  descIn.addEventListener('input', () => { draft.description = descIn.value; });
  view.appendChild(descIn);

  // Target datetime
  view.appendChild(h('label', 'Date & time'));
  const dtIn = h('input', { type: 'datetime-local' });
  dtIn.value = isoToDatetimeLocal(draft.target);
  dtIn.addEventListener('input', () => {
    const iso = datetimeLocalToIso(dtIn.value);
    if (iso) draft.target = iso;
  });
  view.appendChild(dtIn);

  // Days-from-now shortcut
  view.appendChild(h('label', 'Or days from now'));
  const daysIn = h('input', {
    type: 'number', min: 0, max: 3650, step: 1, inputmode: 'numeric',
    placeholder: '42',
  });
  daysIn.addEventListener('input', () => {
    const n = Number(daysIn.value);
    if (!Number.isFinite(n) || n < 0) return;
    const d = new Date();
    d.setDate(d.getDate() + n);
    d.setHours(12, 0, 0, 0);
    draft.target = d.toISOString();
    dtIn.value = isoToDatetimeLocal(draft.target);
  });
  view.appendChild(daysIn);

  // Recurring
  view.appendChild(h('label', 'Recurring'));
  view.appendChild(renderSegmented(
    [
      { id: 'one',    label: 'One-off'        },
      { id: 'annual', label: 'Annual (birthday)' },
    ],
    draft.recurring === 'annual' ? 'annual' : 'one',
    (v) => { draft.recurring = v === 'annual' ? 'annual' : null; },
  ));

  // Theme picker
  view.appendChild(h('label', 'Theme'));
  const grid = h('div', {
    class: 'palette',
    style: { gridTemplateColumns: 'repeat(4, 1fr)' },
  });
  function paintThemes() {
    grid.replaceChildren();
    COUNTDOWN_THEMES.forEach((t) => {
      grid.appendChild(h('div', {
        class: `theme-swatch theme-${t.id}` + (draft.theme === t.id ? ' selected' : ''),
        role: 'button',
        'aria-label': `Theme ${t.label}`,
        tabindex: '0',
        title: t.label,
        onClick: () => { draft.theme = t.id; paintThemes(); },
      }));
    });
  }
  paintThemes();
  view.appendChild(grid);

  // Actions
  const actions = h('div', { class: 'stack', style: { marginTop: '24px' } });
  actions.appendChild(h('button', {
    class: 'primary block',
    onClick: () => saveCountdownDraft(draft, isNew),
  }, 'Save'));

  if (!isNew) {
    if (existing.archivedAt) {
      actions.appendChild(h('button', {
        class: 'block ghost',
        onClick: () => unarchiveCountdown(existing.id),
      }, 'Unarchive'));
    } else {
      actions.appendChild(h('button', {
        class: 'block ghost',
        onClick: () => archiveCountdown(existing.id),
      }, 'Archive'));
    }
    actions.appendChild(h('button', {
      class: 'block danger',
      onClick: () => deleteCountdownConfirm(existing.id),
    }, 'Delete permanently'));
  }
  view.appendChild(actions);

  return view;
}

function saveCountdownDraft(draft, isNew) {
  const title = (draft.title || '').trim();
  if (!title) { toast('Please enter a title'); return; }
  draft.title = title;
  draft.description = (draft.description || '').trim();
  const target = new Date(draft.target);
  if (isNaN(target.getTime())) { toast('Please pick a valid date'); return; }

  if (isNew) {
    state.countdowns.push(draft);
  } else {
    const i = state.countdowns.findIndex((c) => c.id === draft.id);
    if (i >= 0) state.countdowns[i] = draft;
  }
  save();
  editingCountdownId = null;
  render();
  toast(isNew ? 'Countdown added' : 'Saved');
}

function archiveCountdown(id) {
  const c = state.countdowns.find((x) => x.id === id);
  if (!c) return;
  c.archivedAt = new Date().toISOString();
  save();
  editingCountdownId = null;
  render();
  toast('Archived');
}

function unarchiveCountdown(id) {
  const c = state.countdowns.find((x) => x.id === id);
  if (!c) return;
  c.archivedAt = null;
  save();
  editingCountdownId = null;
  render();
  toast('Unarchived');
}

function deleteCountdownConfirm(id) {
  const c = state.countdowns.find((x) => x.id === id);
  if (!c) return;
  if (!confirm(`Delete "${c.title}"?`)) return;
  state.countdowns = state.countdowns.filter((x) => x.id !== id);
  save();
  editingCountdownId = null;
  render();
  toast('Deleted');
}

// ---- Reports tab ------------------------------------------------------------

let reportsSubTab = 'overview';   // 'overview' | 'mood' | 'sleep' | 'habits'
let reportsRange  = 'week';       // 'week' | 'month'

function rangeDayCount(range) {
  return range === 'month' ? 30 : 7;
}

function rangeDayKeys(range) {
  const n = rangeDayCount(range);
  const today = currentDayKey();
  const keys = [];
  for (let i = n - 1; i >= 0; i--) keys.push(daysAgo(today, i));
  return keys;
}

function rangeLabels(range) {
  const days = rangeDayKeys(range);
  return days.map((key, i) => {
    const d = parseDayKey(key);
    if (range === 'week') {
      return d.toLocaleDateString(undefined, { weekday: 'narrow' });
    }
    // month: first, every 5th, and last index get a day-number label; others blank
    const n = days.length;
    const showIdx = new Set([0, Math.floor(n / 4), Math.floor(n / 2), Math.floor(3 * n / 4), n - 1]);
    return showIdx.has(i) ? d.toLocaleDateString(undefined, { day: 'numeric' }) : '';
  });
}

function moodSeries(range) {
  return rangeDayKeys(range).map((key) => state.logs[key]?.mood ?? null);
}

function sleepQualitySeries(range) {
  return rangeDayKeys(range).map((key) => state.logs[key]?.sleep?.quality ?? null);
}

function sleepHoursSeries(range) {
  return rangeDayKeys(range).map((key) => state.logs[key]?.sleep?.hours ?? null);
}

function completionSeries(range) {
  const active = state.habits.filter((x) => !x.archivedAt);
  return rangeDayKeys(range).map((key) => {
    if (active.length === 0) return null;
    const done = active.filter((ht) => isHabitDoneForDay(ht, key)).length;
    return Math.round((done / active.length) * 100);
  });
}

function hasAnyValue(arr) {
  return arr.some((v) => v != null);
}

// series: [{ values, color, dashed? }]
// yAxis:  { min, max, ticks? }
function svgLineChart({ series, labels, yAxis, height = 180 }) {
  const width = 340;
  const pad = { top: 14, right: 12, bottom: 22, left: 28 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const n = labels.length;
  const xs = (i) => pad.left + (n <= 1 ? plotW / 2 : (i / (n - 1)) * plotW);
  const ys = (v) => pad.top + plotH - ((v - yAxis.min) / (yAxis.max - yAxis.min)) * plotH;

  const svg = svgEl('svg', {
    viewBox: `0 0 ${width} ${height}`,
    width: '100%', height,
    class: 'chart', role: 'img',
    preserveAspectRatio: 'none',
  });

  // Y grid + labels
  const ticks = yAxis.ticks || [yAxis.min, (yAxis.min + yAxis.max) / 2, yAxis.max];
  for (const t of ticks) {
    const y = ys(t);
    svg.appendChild(svgEl('line', {
      x1: pad.left, x2: width - pad.right, y1: y, y2: y,
      stroke: 'var(--border)', 'stroke-width': 1,
    }));
    svg.appendChild(svgEl('text', {
      x: pad.left - 6, y: y + 3,
      'text-anchor': 'end',
      fill: 'var(--muted)',
      'font-size': 10,
    }, String(t)));
  }

  // X labels
  for (let i = 0; i < n; i++) {
    if (!labels[i]) continue;
    svg.appendChild(svgEl('text', {
      x: xs(i), y: height - 6,
      'text-anchor': 'middle',
      fill: 'var(--muted)',
      'font-size': 9,
    }, labels[i]));
  }

  // Series
  for (const s of series) {
    const color = s.color || 'var(--accent)';
    const segments = [];
    let seg = [];
    s.values.forEach((v, i) => {
      if (v == null) {
        if (seg.length) segments.push(seg);
        seg = [];
      } else {
        seg.push({ x: xs(i), y: ys(v) });
      }
    });
    if (seg.length) segments.push(seg);

    for (const part of segments) {
      if (part.length >= 2) {
        const d = part.map((p, i) =>
          `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
        const path = svgEl('path', {
          d, stroke: color, 'stroke-width': 2, fill: 'none',
          'stroke-linecap': 'round', 'stroke-linejoin': 'round',
        });
        if (s.dashed) path.setAttribute('stroke-dasharray', '4 4');
        svg.appendChild(path);
      }
      if (!s.dashed) {
        for (const p of part) {
          svg.appendChild(svgEl('circle', {
            cx: p.x, cy: p.y, r: 3, fill: color,
          }));
        }
      }
    }
  }

  return svg;
}

function chartCard(chart) {
  return h('div', {
    class: 'prompt-card',
    style: { padding: '10px', overflowX: 'auto' },
  }, chart);
}

function legendItem(color, label) {
  return h('span', { class: 'small', style: { display: 'inline-flex', alignItems: 'center', gap: '4px' } },
    h('span', { style: { color } }, '●'), label);
}

function renderReports() {
  const view = h('div', { class: 'view' });
  view.appendChild(h('h1', { style: { marginBottom: '8px' } }, 'Reports'));

  const noLogs = Object.keys(state.logs).length === 0;
  const noHabits = state.habits.length === 0;
  if (noLogs && noHabits) {
    view.appendChild(h('div', { class: 'summary' },
      h('h2', { style: { color: 'var(--text)', fontSize: '1.15rem', margin: '0 0 6px' } },
        'Nothing to chart yet'),
      h('p', { style: { margin: '0 0 14px' } },
        'Check in for a few days — mood, sleep, and habit trends will appear here as lines and heatmaps.'),
      h('button', { class: 'primary block', onClick: () => go('home') },
        'Go to today'),
    ));
    return view;
  }

  const tabs = h('div', { class: 'segmented', style: { marginBottom: '10px' } });
  for (const { id, label } of [
    { id: 'overview', label: 'Overview' },
    { id: 'mood',     label: 'Mood'     },
    { id: 'sleep',    label: 'Sleep'    },
    { id: 'habits',   label: 'Habits'   },
  ]) {
    tabs.appendChild(h('button', {
      class: reportsSubTab === id ? 'on' : '',
      onClick: () => { reportsSubTab = id; render(); },
      type: 'button',
    }, label));
  }
  view.appendChild(tabs);

  const range = h('div', {
    class: 'segmented',
    style: { marginBottom: '14px', maxWidth: '220px', marginLeft: 'auto' },
  });
  for (const { id, label } of [
    { id: 'week',  label: 'Week'  },
    { id: 'month', label: 'Month' },
  ]) {
    range.appendChild(h('button', {
      class: reportsRange === id ? 'on' : '',
      onClick: () => { reportsRange = id; render(); },
      type: 'button',
    }, label));
  }
  view.appendChild(range);

  if (reportsSubTab === 'mood')    view.appendChild(renderReportsMood());
  else if (reportsSubTab === 'sleep')  view.appendChild(renderReportsSleep());
  else if (reportsSubTab === 'habits') view.appendChild(renderReportsHabits());
  else view.appendChild(renderReportsOverview());

  return view;
}

function renderReportsOverview() {
  const wrap = h('div');
  const labels = rangeLabels(reportsRange);
  const moodVals  = moodSeries(reportsRange).map((v) => v == null ? null : v * 20);
  const sleepVals = sleepQualitySeries(reportsRange).map((v) => v == null ? null : v * 20);
  const compVals  = completionSeries(reportsRange);

  if (!hasAnyValue(moodVals) && !hasAnyValue(sleepVals) && !hasAnyValue(compVals)) {
    wrap.appendChild(h('p', { class: 'small muted' },
      'No data for this range yet — check in a few days to see trends.'));
    return wrap;
  }

  wrap.appendChild(h('div', {
    class: 'row', style: { gap: '14px', flexWrap: 'wrap', marginBottom: '8px' },
  },
    legendItem('#7c9cff', 'Mood'),
    legendItem('#c084fc', 'Sleep'),
    legendItem('#86efac', 'Completion'),
  ));

  wrap.appendChild(chartCard(svgLineChart({
    series: [
      { values: moodVals,  color: '#7c9cff' },
      { values: sleepVals, color: '#c084fc' },
      { values: compVals,  color: '#86efac' },
    ],
    labels,
    yAxis: { min: 0, max: 100, ticks: [0, 50, 100] },
    height: 200,
  })));

  wrap.appendChild(h('p', { class: 'small muted', style: { marginTop: '6px' } },
    'Mood and sleep scaled to 0–100 for comparison. Completion is the % of active habits you hit that day.'));

  return wrap;
}

function renderReportsMood() {
  const wrap = h('div');
  const labels = rangeLabels(reportsRange);
  const values = moodSeries(reportsRange);
  const valid = values.filter((v) => v != null);

  wrap.appendChild(renderStatsPills('mood', valid, values.length));

  if (valid.length === 0) {
    wrap.appendChild(h('p', { class: 'small muted' },
      'No mood logs in this range yet.'));
    return wrap;
  }

  wrap.appendChild(chartCard(svgLineChart({
    series: [{ values, color: '#7c9cff' }],
    labels,
    yAxis: { min: 1, max: 5, ticks: [1, 3, 5] },
    height: 180,
  })));
  return wrap;
}

function renderReportsSleep() {
  const wrap = h('div');
  const labels = rangeLabels(reportsRange);
  const quality = sleepQualitySeries(reportsRange);
  const hours = sleepHoursSeries(reportsRange);
  const validQ = quality.filter((v) => v != null);

  wrap.appendChild(renderStatsPills('sleep', validQ, quality.length));

  if (validQ.length === 0) {
    wrap.appendChild(h('p', { class: 'small muted' },
      'No sleep logs in this range yet.'));
    return wrap;
  }

  wrap.appendChild(h('div', { class: 'small muted', style: { margin: '0 0 4px' } },
    'Quality (1–5)'));
  wrap.appendChild(chartCard(svgLineChart({
    series: [{ values: quality, color: '#c084fc' }],
    labels,
    yAxis: { min: 1, max: 5, ticks: [1, 3, 5] },
    height: 160,
  })));

  if (hasAnyValue(hours)) {
    const maxH = Math.max(10, Math.ceil(Math.max(...hours.filter((v) => v != null))));
    wrap.appendChild(h('div', { class: 'small muted', style: { margin: '14px 0 4px' } },
      'Hours'));
    wrap.appendChild(chartCard(svgLineChart({
      series: [{ values: hours, color: '#60a5fa' }],
      labels,
      yAxis: { min: 0, max: maxH, ticks: [0, Math.floor(maxH / 2), maxH] },
      height: 160,
    })));
  }
  return wrap;
}

function renderStatsPills(kind, valid, total) {
  const pills = h('div', {
    class: 'row', style: { gap: '6px', flexWrap: 'wrap', marginBottom: '10px' },
  });
  if (valid.length === 0) {
    pills.appendChild(h('span', { class: 'pill' }, 'No data yet'));
    return pills;
  }
  const avg = (valid.reduce((a, b) => a + b, 0) / valid.length).toFixed(1);
  const hi  = Math.max(...valid);
  const lo  = Math.min(...valid);
  const bank = kind === 'mood' ? MOOD_OPTIONS : SLEEP_FACES;
  const faceOf = (v) => bank.find((m) => m.value === v)?.emoji || '';
  pills.appendChild(h('span', { class: 'pill' }, `avg ${avg}`));
  pills.appendChild(h('span', { class: 'pill' }, `best ${faceOf(hi)}`));
  pills.appendChild(h('span', { class: 'pill' }, `low ${faceOf(lo)}`));
  pills.appendChild(h('span', { class: 'pill' }, `${valid.length}/${total} days`));
  return pills;
}

function renderReportsHabits() {
  const wrap = h('div');
  const active = state.habits.filter((x) => !x.archivedAt);

  if (active.length === 0) {
    wrap.appendChild(h('p', { class: 'small muted' },
      'No habits to chart. Add a few in the Habits tab.'));
    return wrap;
  }

  for (const habit of active) wrap.appendChild(renderHabitReportCard(habit));
  return wrap;
}

function renderHabitReportCard(habit) {
  const card = h('article', {
    class: 'prompt-card',
    style: { marginBottom: '10px' },
  });

  card.appendChild(h('div', {
    class: 'row between', style: { marginBottom: '8px', alignItems: 'flex-start' },
  },
    h('div', null,
      h('div', { class: 'kicker' }, habit.kind === 'good' ? 'Build' : 'Break'),
      h('div', { class: 'c-title' }, habit.title),
      h('div', { class: 'small muted' }, habitMeta(habit)),
    ),
    currentStreak(habit) > 0
      ? h('span', { class: 'streak' },
          `🔥 ${currentStreak(habit)}-day ${habit.kind === 'good' ? 'streak' : 'clean'}`)
      : null,
  ));

  if (habit.type === 'tick') {
    card.appendChild(renderHeatmap(habit));
    return card;
  }

  const labels = rangeLabels(reportsRange);
  const days = rangeDayKeys(reportsRange);
  const values = days.map((key) => {
    const v = state.logs[key]?.habits?.[habit.id];
    return v == null ? null : Number(v);
  });
  const maxValRaw = Math.max(
    habit.target,
    ...values.filter((v) => v != null),
  );
  const yMax = habit.type === 'percent'
    ? 100
    : Math.max(Math.ceil(maxValRaw * 1.1), habit.target);
  const target = new Array(days.length).fill(habit.target);

  card.appendChild(chartCard(svgLineChart({
    series: [
      { values: target, color: 'var(--muted)', dashed: true },
      { values,         color: habit.color },
    ],
    labels,
    yAxis: { min: 0, max: yMax, ticks: [0, Math.round(yMax / 2), yMax] },
    height: 140,
  })));
  return card;
}

// ---- Settings ---------------------------------------------------------------

function renderSettings() {
  const view = h('div', { class: 'view' });
  view.appendChild(h('h1', 'Settings'));

  // --- Day rollover ---
  view.appendChild(h('h2', { style: { marginTop: '20px' } }, 'Day rollover'));
  view.appendChild(h('p', { class: 'small muted' },
    'The hour after midnight when a new day starts. Useful for late nights — a log at 2am still counts as the previous day.'));

  const hourLabel = h('span', null, `${state.settings.rolloverHour}:00`);
  view.appendChild(h('div', {
    class: 'row between',
    style: { marginTop: '12px', fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums' },
  },
    hourLabel,
    h('span', { class: 'small muted' }, '0:00 – 6:00'),
  ));

  const slider = h('input', {
    type: 'range', min: 0, max: 6, step: 1,
    'aria-label': 'Rollover hour',
    style: { width: '100%', minHeight: '32px' },
  });
  slider.value = state.settings.rolloverHour;
  slider.addEventListener('input', () => {
    hourLabel.textContent = `${slider.value}:00`;
  });
  slider.addEventListener('change', () => {
    state.settings.rolloverHour = Number(slider.value);
    save();
    toast(`Rollover set to ${slider.value}:00`);
  });
  view.appendChild(slider);

  // --- Your data ---
  view.appendChild(h('h2', { style: { marginTop: '28px' } }, 'Your data'));
  view.appendChild(h('p', { class: 'small muted' },
    'Everything lives on this device. Export to back up or move to another device.'));

  const stats = h('div', { class: 'prompt-card', style: { marginTop: '12px' } },
    h('div', { class: 'row between' },
      h('span', { class: 'small muted' }, 'Habits'),
      h('span', null, String(state.habits.length)),
    ),
    h('div', { class: 'row between', style: { marginTop: '4px' } },
      h('span', { class: 'small muted' }, 'Days logged'),
      h('span', null, String(Object.keys(state.logs).length)),
    ),
  );
  view.appendChild(stats);

  const actions = h('div', { class: 'stack', style: { marginTop: '12px' } });
  actions.appendChild(h('button', { class: 'block', onClick: exportJSON }, 'Export to JSON'));

  const fileInput = h('input', {
    type: 'file', accept: 'application/json,.json',
    style: { display: 'none' },
  });
  fileInput.addEventListener('change', (e) => {
    handleImport(e.target.files?.[0]);
    fileInput.value = '';
  });
  actions.appendChild(fileInput);
  actions.appendChild(h('button', {
    class: 'block',
    onClick: () => fileInput.click(),
  }, 'Import from JSON'));
  view.appendChild(actions);

  return view;
}

function exportJSON() {
  try {
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = h('a', {
      href: url,
      download: `tempo-backup-${currentDayKey()}.json`,
      style: { display: 'none' },
    });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast('Exported');
  } catch (err) {
    console.error(err);
    toast('Export failed');
  }
}

function handleImport(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onerror = () => toast('Could not read file');
  reader.onload = () => {
    let data;
    try {
      data = JSON.parse(reader.result);
    } catch {
      toast('Not a valid JSON file');
      return;
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      toast('Unexpected file shape');
      return;
    }
    if (!Array.isArray(data.habits) || typeof data.logs !== 'object' || data.logs === null) {
      toast('Missing habits or logs — not a Tempo backup');
      return;
    }
    const habitCount = data.habits.length;
    const dayCount = Object.keys(data.logs).length;
    const ok = confirm(
      `Import ${habitCount} habit${habitCount === 1 ? '' : 's'} and ${dayCount} day log${dayCount === 1 ? '' : 's'}?\n\nThis replaces your current data.`,
    );
    if (!ok) return;

    state = {
      ...defaultState(),
      ...data,
      settings: { ...defaultState().settings, ...(data.settings || {}) },
    };
    save();
    render();
    toast('Imported');
  };
  reader.readAsText(file);
}

// ---- Check-in flow ----------------------------------------------------------

let checkInOpen = false;
let checkInStep = 0;              // 0 mood, 1 prompt, 2 habits, 3 summary
let checkInDismissed = false;     // user tapped X — don't auto-reopen this session
let checkInHabitBuffer = {};      // pending values while on step 2

function openCheckIn(startStep = null) {
  ensureTodayLog();
  const log = state.logs[currentDayKey()];
  checkInHabitBuffer = { ...(log.habits || {}) };
  checkInOpen = true;
  checkInStep = startStep ?? (nextIncompleteStep() ?? CHECKIN_STEPS.length);
  renderCheckIn();
}

function closeCheckIn(dismiss = true) {
  checkInOpen = false;
  if (dismiss) checkInDismissed = true;
  const scrim = qs('.scrim');
  if (scrim) scrim.remove();
  render();
}

function maybeOpenCheckIn() {
  if (checkInOpen || checkInDismissed) return;
  // Skip auto-open for brand-new users so they see the welcome screen first.
  const hasAnyData = state.habits.length > 0 || Object.keys(state.logs).length > 0;
  if (!hasAnyData) return;
  if (nextIncompleteStep() !== null) openCheckIn();
}

function nextStep() {
  const log = ensureTodayLog();
  const name = CHECKIN_STEPS[checkInStep];

  if (name === 'sleep') {
    // Any state (including untouched) is fine — sleep is skippable.
    log.steps.sleep = true;
  } else if (name === 'mood') {
    if (!log.mood) { toast('Pick a mood first'); return; }
    log.steps.mood = true;
  } else if (name === 'prompt') {
    log.steps.prompt = true;
  } else if (name === 'habits') {
    log.habits = { ...checkInHabitBuffer };
    log.steps.habits = true;
  } else if (name === 'diary') {
    log.steps.diary = true;
    log.completedAt = new Date().toISOString();
  } else {
    // At summary — "Done" button.
    closeCheckIn(false);
    return;
  }

  save();
  checkInStep++;
  renderCheckIn();
}

function prevStep() {
  if (checkInStep > 0) {
    checkInStep--;
    renderCheckIn();
  }
}

function renderCheckIn() {
  const existing = qs('.scrim');
  if (existing) existing.remove();
  if (!checkInOpen) return;

  const scrim = h('div', { class: 'scrim', onClick: (e) => {
    if (e.target.classList.contains('scrim')) closeCheckIn();
  }});
  const sheet = h('div', { class: 'sheet' });

  const totalPips = CHECKIN_STEPS.length + 1; // + summary
  const progress = h('div', { class: 'progress' });
  for (let i = 0; i < totalPips; i++) {
    progress.appendChild(h('span', { class: i <= checkInStep ? 'active' : '' }));
  }

  sheet.appendChild(h('header', null,
    h('strong', 'Today\'s check-in'),
    progress,
    h('button', {
      class: 'ghost',
      style: { padding: '6px 10px', minHeight: '36px' },
      onClick: () => closeCheckIn(),
      'aria-label': 'Close',
    }, '✕'),
  ));

  const body = h('div', { class: 'body' });
  const name = CHECKIN_STEPS[checkInStep];
  if (name === 'sleep') body.appendChild(renderSleepStep());
  else if (name === 'mood') body.appendChild(renderMoodStep());
  else if (name === 'prompt') body.appendChild(renderPromptStep());
  else if (name === 'habits') body.appendChild(renderHabitsStep());
  else if (name === 'diary') body.appendChild(renderDiaryStep());
  else body.appendChild(renderSummaryStep());
  sheet.appendChild(body);

  const atSummary = checkInStep >= CHECKIN_STEPS.length;
  const atLastInput = checkInStep === CHECKIN_STEPS.length - 1;

  const footer = h('footer');
  if (checkInStep > 0 && !atSummary) {
    footer.appendChild(h('button', { class: 'ghost', onClick: prevStep }, 'Back'));
  }
  footer.appendChild(h('span', { class: 'grow' }));
  const nextLabel = atSummary ? 'Done' : atLastInput ? 'Finish' : 'Next';
  footer.appendChild(h('button', { class: 'primary', onClick: nextStep }, nextLabel));
  sheet.appendChild(footer);

  scrim.appendChild(sheet);
  document.body.appendChild(scrim);
}

function renderSleepStep() {
  const log = ensureTodayLog();
  if (!log.sleep) log.sleep = { quality: null, hours: null };

  const wrap = h('div', { class: 'step' });
  wrap.appendChild(h('h2', { style: { color: 'var(--text)', fontSize: '1.25rem', margin: '4px 0 4px' } },
    'How did you sleep?'));
  wrap.appendChild(h('p', { class: 'small muted', style: { marginBottom: '12px' } },
    'Pick a face. Hours are optional — skip anything.'));

  const grid = h('div', { class: 'mood-grid' });
  SLEEP_FACES.forEach((opt) => {
    grid.appendChild(h('button', {
      class: 'mood-btn' + (log.sleep.quality === opt.value ? ' selected' : ''),
      type: 'button',
      'aria-label': `Sleep ${opt.caption}`,
      onClick: () => {
        log.sleep.quality = opt.value;
        save();
        renderCheckIn();
      },
    }, opt.emoji));
  });
  wrap.appendChild(grid);

  const caption = log.sleep.quality
    ? SLEEP_FACES.find((s) => s.value === log.sleep.quality).caption
    : ' ';
  wrap.appendChild(h('div', { class: 'mood-caption' }, caption));

  wrap.appendChild(h('label', 'Hours (optional)'));
  const hoursIn = h('input', {
    type: 'number', min: 0, max: 24, step: 0.5,
    inputmode: 'decimal', placeholder: 'e.g. 7.5',
  });
  hoursIn.value = log.sleep.hours ?? '';
  hoursIn.addEventListener('input', () => {
    const raw = hoursIn.value;
    if (raw === '') {
      log.sleep.hours = null;
    } else {
      const n = Number(raw);
      log.sleep.hours = Number.isFinite(n) ? Math.min(24, Math.max(0, n)) : null;
    }
    save();
  });
  wrap.appendChild(hoursIn);

  return wrap;
}

function renderDiaryStep() {
  const log = ensureTodayLog();
  if (!log.diary) log.diary = { good: '', challenge: '' };

  const wrap = h('div', { class: 'step' });
  wrap.appendChild(h('h2', { style: { color: 'var(--text)', fontSize: '1.25rem', margin: '4px 0 4px' } },
    'One-sentence journal'));
  wrap.appendChild(h('p', { class: 'small muted', style: { marginBottom: '12px' } },
    `Optional. ${DIARY_CAP} chars each — keep it snappy.`));

  wrap.appendChild(renderDiaryField(log.diary, 'good', 'One good thing', 'e.g. Coffee with Alex was lovely.'));
  wrap.appendChild(renderDiaryField(log.diary, 'challenge', 'One challenge or learning', 'e.g. Struggled to focus after lunch.'));

  return wrap;
}

function renderDiaryField(diary, key, label, placeholder) {
  const wrap = h('div');
  wrap.appendChild(h('label', label));
  const ta = h('textarea', {
    maxlength: DIARY_CAP, rows: 2, placeholder,
    style: { minHeight: '64px' },
  });
  ta.value = diary[key] || '';
  const counter = h('div', {
    class: 'small muted',
    style: { textAlign: 'right', marginTop: '2px' },
  }, `${ta.value.length}/${DIARY_CAP}`);
  ta.addEventListener('input', () => {
    diary[key] = ta.value;
    const len = ta.value.length;
    counter.textContent = `${len}/${DIARY_CAP}`;
    counter.style.color = len >= DIARY_CAP
      ? 'var(--bad)'
      : (len >= DIARY_CAP - 20 ? '#fbbf24' : 'var(--muted)');
    save();
  });
  wrap.appendChild(ta);
  wrap.appendChild(counter);
  return wrap;
}

function renderMoodStep() {
  const log = ensureTodayLog();
  const wrap = h('div', { class: 'step' });
  wrap.appendChild(h('h2', { style: { color: 'var(--text)', fontSize: '1.25rem', margin: '4px 0 4px' } },
    'How\'s today feeling?'));
  wrap.appendChild(h('p', { class: 'small muted', style: { marginBottom: '12px' } },
    'Tap the face that fits best.'));

  const grid = h('div', { class: 'mood-grid' });
  MOOD_OPTIONS.forEach((opt) => {
    grid.appendChild(h('button', {
      class: 'mood-btn' + (log.mood === opt.value ? ' selected' : ''),
      type: 'button',
      'aria-label': opt.caption,
      onClick: () => { log.mood = opt.value; save(); renderCheckIn(); },
    }, opt.emoji));
  });
  wrap.appendChild(grid);

  const caption = log.mood
    ? MOOD_OPTIONS.find((m) => m.value === log.mood).caption
    : ' ';
  wrap.appendChild(h('div', { class: 'mood-caption' }, caption));

  return wrap;
}

function renderPromptStep() {
  const log = ensureTodayLog();
  const wrap = h('div', { class: 'step' });

  wrap.appendChild(h('div', { class: 'prompt-card' },
    h('div', { class: 'kicker' }, log.promptKind === 'reflect' ? 'Reflection' : 'Fun fact'),
    h('p', {
      style: { fontSize: '1.08rem', color: 'var(--text)', margin: '8px 0 0', lineHeight: '1.45' },
    }, log.promptText),
  ));

  wrap.appendChild(h('label',
    log.promptKind === 'reflect' ? 'Your answer (optional)' : 'Reaction or note (optional)'));
  const ta = h('textarea', {
    placeholder: log.promptKind === 'reflect'
      ? 'Type your reflection…'
      : 'What comes to mind?',
  });
  ta.value = log.note || '';
  ta.addEventListener('input', () => { log.note = ta.value; save(); });
  wrap.appendChild(ta);

  return wrap;
}

function renderHabitsStep() {
  const wrap = h('div', { class: 'step' });
  wrap.appendChild(h('h2', {
    style: { color: 'var(--text)', fontSize: '1.25rem', margin: '4px 0 4px' },
  }, 'Habits for today'));
  wrap.appendChild(h('p', { class: 'small muted', style: { marginBottom: '12px' } },
    'Check off what happened. Skip any you don\'t want to track today.'));

  const active = state.habits.filter((x) => !x.archivedAt);
  if (active.length === 0) {
    wrap.appendChild(h('p', 'No habits yet. Add some in the Habits tab.'));
    return wrap;
  }

  const good = active.filter((x) => x.kind === 'good');
  const bad  = active.filter((x) => x.kind === 'bad');

  if (good.length) {
    wrap.appendChild(h('div', {
      class: 'section-head good', style: { margin: '12px 0 8px' },
    }, h('span', { class: 'dot' }), 'Build'));
    good.forEach((habit) => wrap.appendChild(renderHabitCheckRow(habit)));
  }
  if (bad.length) {
    wrap.appendChild(h('div', {
      class: 'section-head bad', style: { margin: '12px 0 8px' },
    }, h('span', { class: 'dot' }), 'Break'));
    bad.forEach((habit) => wrap.appendChild(renderHabitCheckRow(habit)));
  }
  return wrap;
}

function renderHabitCheckRow(habit) {
  const row = h('div', {
    class: 'check-row',
    style: { '--habit-color': habit.color },
  });
  row.appendChild(h('div', { class: 'stripe' }));

  row.appendChild(h('div', null,
    h('div', { class: 'title' }, habit.title),
    h('div', { class: 'meta small muted' }, habitMeta(habit)),
  ));

  const value = checkInHabitBuffer[habit.id];

  if (habit.type === 'tick') {
    const box = h('button', {
      class: 'check-box' + (value ? ' on' : ''),
      type: 'button',
      'aria-pressed': value ? 'true' : 'false',
      onClick: () => {
        checkInHabitBuffer[habit.id] = !value;
        renderCheckIn();
      },
    }, value ? '✓' : '');
    row.appendChild(box);
  } else if (habit.type === 'count') {
    const input = h('input', {
      class: 'qty-input', type: 'number', min: 0, step: 1,
      inputmode: 'numeric', placeholder: '0',
    });
    input.value = value ?? '';
    input.addEventListener('input', () => {
      if (input.value === '') delete checkInHabitBuffer[habit.id];
      else checkInHabitBuffer[habit.id] = Math.max(0, Number(input.value) || 0);
    });
    row.appendChild(input);
  } else if (habit.type === 'percent') {
    const input = h('input', {
      class: 'qty-input', type: 'number', min: 0, max: 100, step: 1,
      inputmode: 'numeric', placeholder: '0',
    });
    input.value = value ?? '';
    input.addEventListener('input', () => {
      if (input.value === '') { delete checkInHabitBuffer[habit.id]; return; }
      checkInHabitBuffer[habit.id] = Math.min(100, Math.max(0, Number(input.value) || 0));
    });
    row.appendChild(input);
  }

  return row;
}

function renderSummaryStep() {
  const log = ensureTodayLog();
  const wrap = h('div', { class: 'step center' });
  const moodFace = log.mood ? MOOD_OPTIONS.find((m) => m.value === log.mood) : null;
  const sleepFace = log.sleep?.quality
    ? SLEEP_FACES.find((s) => s.value === log.sleep.quality) : null;
  const habitCount = Object.keys(log.habits || {}).length;
  const doneCount = state.habits.filter(
    (ht) => !ht.archivedAt && isHabitDoneForDay(ht, currentDayKey()),
  ).length;

  const faces = h('div', {
    class: 'row', style: { justifyContent: 'center', gap: '28px', alignItems: 'flex-start' },
  });
  if (sleepFace) {
    faces.appendChild(h('div', { style: { textAlign: 'center' } },
      h('div', { class: 'mood' }, sleepFace.emoji),
      h('div', { class: 'small muted' }, `sleep · ${sleepFace.caption}`),
    ));
  }
  if (moodFace) {
    faces.appendChild(h('div', { style: { textAlign: 'center' } },
      h('div', { class: 'mood' }, moodFace.emoji),
      h('div', { class: 'small muted' }, `mood · ${moodFace.caption}`),
    ));
  }
  if (!sleepFace && !moodFace) {
    faces.appendChild(h('div', { class: 'mood' }, '✨'));
  }

  wrap.appendChild(h('div', { class: 'summary' },
    faces,
    h('p', { class: 'small muted', style: { marginTop: '12px', marginBottom: 0 } },
      `${habitCount} habit${habitCount === 1 ? '' : 's'} logged · ${doneCount} on track today.`),
  ));

  if (log.diary && (log.diary.good || log.diary.challenge)) {
    const card = h('div', {
      class: 'prompt-card',
      style: { marginTop: '12px', textAlign: 'left' },
    });
    if (log.diary.good) {
      card.appendChild(h('p', { style: { margin: '0 0 6px', color: 'var(--text)', lineHeight: 1.45 } },
        h('span', { class: 'kicker' }, 'Good'), ' ', log.diary.good));
    }
    if (log.diary.challenge) {
      card.appendChild(h('p', { style: { margin: 0, color: 'var(--text)', lineHeight: 1.45 } },
        h('span', { class: 'kicker' }, 'Challenge'), ' ', log.diary.challenge));
    }
    wrap.appendChild(card);
  }

  wrap.appendChild(h('p', { style: { marginTop: '16px' } },
    'Nice — see you tomorrow.'));
  return wrap;
}

// ---- Service worker ---------------------------------------------------------

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js')
      .then((reg) => {
        reg.addEventListener('updatefound', () => {
          const installing = reg.installing;
          if (!installing) return;
          installing.addEventListener('statechange', () => {
            if (installing.state === 'installed' && navigator.serviceWorker.controller) {
              showUpdateToast(reg);
            }
          });
        });
      })
      .catch((err) => console.warn('Service worker registration failed:', err));
  });
}

let reloadingFromSW = false;
function showUpdateToast(reg) {
  let el = qs('#toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(el);
  }
  el.textContent = '';
  el.append(
    'Tempo just updated',
    h('button', {
      onClick: () => {
        if (reloadingFromSW) return;
        reloadingFromSW = true;
        try { reg.waiting?.postMessage({ type: 'SKIP_WAITING' }); } catch {}
        location.reload();
      },
    }, 'Reload'),
  );
  el.classList.add('show');
  clearTimeout(toastTimer); // persistent — user action required
}

// ---- Init -------------------------------------------------------------------

function init() {
  wireTabbar();
  wireGear();
  reconcileCountdowns();
  render();
  registerSW();
  maybeOpenCheckIn();
}

init();

// Expose for console debugging during development.
globalThis.__tempo = {
  get state() { return state; },
  save, load, STORAGE_KEY,
  currentDayKey, daysAgo, strHash,
  h, qs, qsa, toast,
  go, render,
};
