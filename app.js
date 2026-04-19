// Tempo — habit & mood tracker (PWA)
// Built in small, incremental blocks. See CLAUDE-TODO.md.

// ---- Storage ----------------------------------------------------------------

const STORAGE_KEY = 'tempo-v1';

const DEFAULT_STATE = {
  version: 1,
  habits: [],
  logs: {},
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
      steps: { mood: false, prompt: false, habits: false },
      completedAt: null,
    };
  } else {
    // Backfill shape for older logs so steps check is safe.
    const log = state.logs[key];
    if (!log.steps) log.steps = { mood: !!log.mood, prompt: false, habits: false };
    if (!log.habits) log.habits = {};
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
  if (!log.steps?.mood) return 0;
  if (!log.steps?.prompt) return 1;
  if (!log.steps?.habits) return 2;
  return null;
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

const ROUTES = new Set(['home', 'manage', 'settings']);
let route = 'home';

function go(next) {
  if (!ROUTES.has(next)) next = 'home';
  route = next;
  render();
}

function render() {
  const app = qs('#app');
  app.replaceChildren();
  if (route === 'manage') app.appendChild(renderManage());
  else if (route === 'settings') app.appendChild(renderSettings());
  else app.appendChild(renderHome());
  updateTabbar();
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
  if (incomplete !== null) {
    view.appendChild(h('button', {
      class: 'primary block',
      style: { marginBottom: '16px' },
      onClick: () => openCheckIn(),
    }, log && log.steps?.mood ? 'Resume check-in' : 'Start today\'s check-in'));
  } else if (log) {
    const face = MOOD_OPTIONS.find((m) => m.value === log.mood);
    view.appendChild(h('div', { class: 'summary', style: { marginBottom: '16px' } },
      h('div', { class: 'row between' },
        h('div', null,
          h('div', { class: 'small muted' }, 'Checked in'),
          h('div', { style: { fontSize: '1.2rem', marginTop: '2px' } },
            `${face?.emoji || '✨'} ${face?.caption || ''}`),
        ),
        h('button', {
          class: 'ghost small',
          onClick: () => openCheckIn(0),
        }, 'Edit'),
      ),
    ));
  }

  const active = state.habits.filter((x) => !x.archivedAt);

  if (active.length === 0) {
    view.appendChild(h('div', { class: 'stack', style: { marginTop: '24px' } },
      h('p', 'No habits yet.'),
      h('button', { class: 'primary', onClick: () => go('manage') }, 'Add your first habit'),
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

function renderSettings() {
  return h('div', { class: 'view' },
    h('h1', 'Settings'),
    h('p', 'Settings view — coming soon. Rollover hour, export/import, about.'),
  );
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
  checkInStep = startStep ?? (nextIncompleteStep() ?? 3);
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
  if (nextIncompleteStep() !== null) openCheckIn();
}

function nextStep() {
  const log = ensureTodayLog();
  if (checkInStep === 0) {
    if (!log.mood) { toast('Pick a mood first'); return; }
    log.steps.mood = true;
    save();
    checkInStep = 1;
  } else if (checkInStep === 1) {
    log.steps.prompt = true;
    save();
    checkInStep = 2;
  } else if (checkInStep === 2) {
    log.habits = { ...checkInHabitBuffer };
    log.steps.habits = true;
    log.completedAt = new Date().toISOString();
    save();
    checkInStep = 3;
  } else if (checkInStep === 3) {
    closeCheckIn(false);
    return;
  }
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

  const progress = h('div', { class: 'progress' });
  for (let i = 0; i < 4; i++) {
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
  if (checkInStep === 0) body.appendChild(renderMoodStep());
  else if (checkInStep === 1) body.appendChild(renderPromptStep());
  else if (checkInStep === 2) body.appendChild(renderHabitsStep());
  else body.appendChild(renderSummaryStep());
  sheet.appendChild(body);

  const footer = h('footer');
  if (checkInStep > 0 && checkInStep < 3) {
    footer.appendChild(h('button', { class: 'ghost', onClick: prevStep }, 'Back'));
  }
  footer.appendChild(h('span', { class: 'grow' }));
  const nextLabel =
    checkInStep === 2 ? 'Finish' :
    checkInStep === 3 ? 'Done' : 'Next';
  footer.appendChild(h('button', { class: 'primary', onClick: nextStep }, nextLabel));
  sheet.appendChild(footer);

  scrim.appendChild(sheet);
  document.body.appendChild(scrim);
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
  const face = log.mood ? MOOD_OPTIONS.find((m) => m.value === log.mood) : null;
  const habitCount = Object.keys(log.habits || {}).length;
  const doneCount = state.habits.filter(
    (ht) => !ht.archivedAt && isHabitDoneForDay(ht, currentDayKey()),
  ).length;

  wrap.appendChild(h('div', { class: 'summary' },
    h('div', { class: 'mood' }, face ? face.emoji : '✨'),
    h('div', { style: { marginTop: '4px', color: 'var(--text)' } },
      face ? face.caption : 'logged'),
    h('p', { class: 'small muted', style: { marginTop: '12px', marginBottom: 0 } },
      `${habitCount} habit${habitCount === 1 ? '' : 's'} logged · ${doneCount} on track today.`),
  ));

  wrap.appendChild(h('p', { style: { marginTop: '16px' } },
    'Nice — see you tomorrow.'));
  return wrap;
}

// ---- Service worker ---------------------------------------------------------

function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.warn('Service worker registration failed:', err);
    });
  });
}

// ---- Init -------------------------------------------------------------------

function init() {
  wireTabbar();
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
