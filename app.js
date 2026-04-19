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

function renderHome() {
  return h('div', { class: 'view' },
    h('h1', 'Today'),
    h('p', 'Home view — coming soon. You\'ll see your habits and mood here.'),
  );
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
