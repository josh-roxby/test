// POST /api/subscribe
// Body: { subscription, bucket?, reminderTime?, timezone }
// Stores or updates the subscription in KV, keyed by a hash of the endpoint.
// Accepts either a time-of-day `bucket` (preferred) or legacy `reminderTime`.

import {
  kv, kvGetJson, kvSetJson,
  endpointHash,
  readBody,
  isValidSubscription,
  isValidTimeString,
  isValidTimezone,
  clientIp,
  rateLimit,
  REMINDER_BUCKETS,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }

  // Rate limit by IP: 10 subscribe attempts per 10 min window.
  const ip = clientIp(req);
  const limit = await rateLimit(`rate:subscribe:${ip}`, { limit: 10, windowSec: 600 });
  if (!limit.ok) {
    res.setHeader('Retry-After', '60');
    return res.status(429).json({ error: 'too many requests, try again later' });
  }

  const body = readBody(req);
  if (!body) return res.status(400).json({ error: 'invalid JSON body' });

  const { subscription, bucket, reminderTime, timezone } = body;
  if (!isValidSubscription(subscription)) {
    return res.status(400).json({ error: 'invalid subscription' });
  }
  if (!isValidTimezone(timezone)) {
    return res.status(400).json({ error: 'invalid timezone (expected IANA)' });
  }
  if (!bucket && !reminderTime) {
    return res.status(400).json({ error: 'missing bucket or reminderTime' });
  }
  if (bucket && !REMINDER_BUCKETS[bucket]) {
    return res.status(400).json({ error: 'invalid bucket' });
  }
  if (reminderTime && !isValidTimeString(reminderTime)) {
    return res.status(400).json({ error: 'invalid reminderTime (expected HH:MM)' });
  }

  const key = `sub:${endpointHash(subscription.endpoint)}`;
  const existing = await kvGetJson(key);
  const record = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    bucket: bucket || existing?.bucket || null,
    reminderTime: reminderTime || existing?.reminderTime || null,
    timezone,
    lastSentDay: existing?.lastSentDay ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kvSetJson(key, record);
  return res.status(200).json({ ok: true });
}
