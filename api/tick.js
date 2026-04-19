// GET /api/tick?secret=<TICK_SECRET>
// Intended to be hit by GitHub Actions cron every 15 minutes.
// Scans all subscriptions, sends a reminder push to those whose local time
// falls within ±7 minutes of their reminderTime and who haven't been sent
// one today (per their local timezone).

import webpush from 'web-push';
import {
  kv, kvGetJson, kvSetJson,
  nowInTimezone, withinMinutes,
  reminderBucketDue,
  vapidSubject,
} from './_lib.js';

const WINDOW_MINUTES = 7;

export default async function handler(req, res) {
  const provided =
    req.query?.secret ||
    (req.headers?.authorization || '').replace(/^Bearer\s+/i, '');
  if (!provided || provided !== process.env.TICK_SECRET) {
    return res.status(401).json({ error: 'unauthorized' });
  }
  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return res.status(500).json({ error: 'VAPID env not configured' });
  }

  webpush.setVapidDetails(
    vapidSubject(),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const now = new Date();
  const result = { checked: 0, sent: 0, skipped: 0, deleted: 0, errors: [] };

  const keys = await kv.keys('sub:*');
  result.checked = keys.length;

  for (const key of keys) {
    const sub = await kvGetJson(key);
    if (!sub) continue;

    let local;
    try {
      local = nowInTimezone(now, sub.timezone);
    } catch {
      result.errors.push(`bad timezone: ${sub.timezone}`);
      continue;
    }

    if (sub.lastSentDay === local.ymd) { result.skipped++; continue; }

    // Prefer bucket logic when set (sub was created in the new UI); fall back
    // to the legacy ±7-min window for pre-bucket subscriptions.
    let due = false;
    if (sub.bucket) {
      due = reminderBucketDue(sub, local);
    } else if (sub.reminderTime) {
      due = withinMinutes(local.hm, sub.reminderTime, WINDOW_MINUTES);
    }
    if (!due) { result.skipped++; continue; }

    const payload = JSON.stringify({
      title: 'Tempo check-in',
      body: "Time for today's check-in 🌱",
      url: '/',
      tag: 'tempo-daily-reminder',
    });

    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
      await kvSetJson(key, { ...sub, lastSentDay: local.ymd });
      result.sent++;
    } catch (err) {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        await kv.del(key);
        result.deleted++;
      } else {
        result.errors.push(err?.statusCode || err?.message || 'push failed');
      }
    }
  }

  console.log('tick result', result);
  return res.status(200).json(result);
}
