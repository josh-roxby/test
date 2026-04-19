// Shared helpers for API routes.

import { createHash } from 'node:crypto';

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
