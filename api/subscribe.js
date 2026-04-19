// POST /api/subscribe
// Body: { subscription, reminderTime: "HH:MM", timezone: IANA }
// Stores or updates the subscription in KV, keyed by a hash of the endpoint.

import { kv } from '@vercel/kv';
import {
  endpointHash,
  readBody,
  isValidSubscription,
  isValidTimeString,
  isValidTimezone,
} from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
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
  const existing = await kv.get(key);
  const record = {
    endpoint: subscription.endpoint,
    keys: subscription.keys,
    reminderTime,
    timezone,
    lastSentDay: existing?.lastSentDay ?? null,
    createdAt: existing?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await kv.set(key, record);
  return res.status(200).json({ ok: true });
}
