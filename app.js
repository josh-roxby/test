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

// Expose for console debugging during development.
globalThis.__tempo = {
  get state() { return state; },
  save, load, STORAGE_KEY,
  currentDayKey, daysAgo, strHash,
};
