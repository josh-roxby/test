// Shared helpers for API routes.

import { createHash } from 'node:crypto';
import { Redis } from '@upstash/redis';

// The Vercel/Upstash Marketplace integration namespaces env vars with the
// store name (e.g. "tempostorage_KV_REST_API_URL"). Accept either the
// canonical names or any suffix-matching prefixed variant.
function findEnv(suffixes, excludeContains = []) {
  // Exact matches first.
  for (const name of suffixes) {
    if (process.env[name]) return process.env[name];
  }
  // Then anything whose key ends with one of the expected suffixes.
  for (const [key, value] of Object.entries(process.env)) {
    if (!value) continue;
    if (excludeContains.some((x) => key.includes(x))) continue;
    if (suffixes.some((s) => key.endsWith(s))) return value;
  }
  return '';
}

const redisUrl = findEnv(['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL']);
const redisToken = findEnv(
  ['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN'],
  ['READ_ONLY'],
);

if (!redisUrl || !redisToken) {
  console.error(
    'Redis env vars missing. Available KV/UPSTASH/REDIS keys:',
    Object.keys(process.env).filter((k) => /KV|UPSTASH|REDIS/i.test(k)).join(', ') || '(none)',
  );
}

export const kv = new Redis({ url: redisUrl, token: redisToken });

// Accept either a plain email or a full URL for VAPID_SUBJECT — the web-push
// library requires a "mailto:" or "https://" scheme, so prepend "mailto:" for
// bare email addresses.
export function vapidSubject() {
  const subj = (process.env.VAPID_SUBJECT || '').trim();
  if (!subj) return '';
  if (/^(mailto:|https?:\/\/)/i.test(subj)) return subj;
  if (subj.includes('@')) return `mailto:${subj}`;
  return subj; // leave as-is; web-push will surface its own error
}

// Upstash auto-serialises objects, but cold-starts occasionally return a raw
// string. Tolerate both forms so callers always see a parsed record.
export async function kvGetJson(key) {
  const raw = await kv.get(key);
  if (raw == null) return null;
  if (typeof raw === 'string') {
    try { return JSON.parse(raw); } catch { return null; }
  }
  return raw;
}

export async function kvSetJson(key, value) {
  // Stringify explicitly so stored shape is predictable across SDK versions.
  await kv.set(key, JSON.stringify(value));
}

export function endpointHash(endpoint) {
  return createHash('sha256').update(endpoint).digest('hex').slice(0, 32);
}

export function readBody(req) {
  // Vercel Node runtime parses JSON bodies automatically when Content-Type is
  // application/json. Fall back to manual parse just in case.
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { return null; }
  }
  return null;
}

export function pad2(n) {
  return String(n).padStart(2, '0');
}

export function isValidTimeString(s) {
  return typeof s === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(s);
}

export function isValidTimezone(tz) {
  if (typeof tz !== 'string' || !tz) return false;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function isValidSubscription(sub) {
  return !!(sub && typeof sub === 'object'
    && typeof sub.endpoint === 'string' && sub.endpoint.startsWith('http')
    && sub.keys && typeof sub.keys.p256dh === 'string' && typeof sub.keys.auth === 'string');
}

// Resolve "now" as parts in an IANA timezone, for comparing against reminderTime.
export function nowInTimezone(date, tz) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit',
  }).formatToParts(date);
  const map = {};
  for (const p of parts) if (p.type !== 'literal') map[p.type] = p.value;
  const hour = map.hour === '24' ? '00' : map.hour;
  return {
    ymd: `${map.year}-${map.month}-${map.day}`,
    hm: `${hour}:${map.minute}`,
  };
}

export function withinMinutes(nowHM, targetHM, window) {
  const [nh, nm] = nowHM.split(':').map(Number);
  const [th, tm] = targetHM.split(':').map(Number);
  const n = nh * 60 + nm;
  const t = th * 60 + tm;
  let diff = Math.abs(n - t);
  if (diff > 720) diff = 1440 - diff; // wrap around midnight
  return diff <= window;
}
