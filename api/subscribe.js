// POST /api/subscribe
// Body: { subscription, reminderTime: "HH:MM", timezone: IANA }
// Stores or updates the subscription in KV, keyed by a hash of the endpoint.

import {
  kv, kvGetJson, kvSetJson,
  endpointHash,
  readBody,
  isValidSubscription,
  isValidTimeString,
  isValidTimezone,
  clientIp,
  rateLimit,
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

  const { subscription, reminderTime, timezone } = body;
  if (!isValidSubscription(subscription)) {
    return res.status(400).json({ error: 'invalid subscription' });
  }
  if (!isValidTimeString(reminderTime)) {
    return res.status(400).json({ error: 'invalid reminderTime (expected HH:MM)' });
  }
  if (!isValidTimezone(timezone)) {
    return res.status(400).json({ error: 'invalid timezone (expected IANA)' });
  }

  const key = `sub:${endpointHash(subscription.endpoint)}`;
  const existing = await kvGetJson(key);
  const record = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    reminderTime,
    timezone,
    lastSentDay: existing?.lastSentDay ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kvSetJson(key, record);
  return res.status(200).json({ ok: true });
}
