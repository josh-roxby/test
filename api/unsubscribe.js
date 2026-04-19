// POST /api/unsubscribe
// Body: { endpoint: string }
// Deletes the subscription for this endpoint if present.

import { kv, endpointHash, readBody } from './_lib.js';

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
  await kv.del(key);
  return res.status(200).json({ ok: true });
}
