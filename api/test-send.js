// POST /api/test-send
// Body: { endpoint: string }
// Looks up the subscription for this endpoint and fires an immediate test push.
// Used by the Settings "Test notification" panel to verify the stack end-to-end.

import webpush from 'web-push';
import { kv, kvGetJson, endpointHash, readBody, vapidSubject } from './_lib.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const body = readBody(req);
  if (!body?.endpoint || typeof body.endpoint !== 'string') {
    return res.status(400).json({ error: 'missing endpoint' });
  }

  const key = `sub:${endpointHash(body.endpoint)}`;
  const sub = await kvGetJson(key);
  if (!sub) return res.status(404).json({ error: 'subscription not found' });

  if (!process.env.VAPID_PRIVATE_KEY || !process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_SUBJECT) {
    return res.status(500).json({ error: 'VAPID env not configured' });
  }

  webpush.setVapidDetails(
    vapidSubject(),
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY,
  );

  const payload = JSON.stringify({
    title: 'Tempo test 🧪',
    body: 'If you can see this, push is working.',
    url: '/',
    tag: 'tempo-test',
  });

  try {
    await webpush.sendNotification({ endpoint: sub.endpoint, keys: sub.keys }, payload);
    return res.status(200).json({ ok: true });
  } catch (err) {
    if (err?.statusCode === 410 || err?.statusCode === 404) {
      await kv.del(key);
      return res.status(410).json({ error: 'subscription expired' });
    }
    console.error('test-send push error', err);
    return res.status(502).json({ error: 'push failed', statusCode: err?.statusCode });
  }
}
