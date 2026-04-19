// Returns the VAPID public key so the client can subscribe without hardcoding it.

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'method not allowed' });
  }
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(500).json({ error: 'VAPID_PUBLIC_KEY not configured' });
  }
  res.setHeader('Cache-Control', 'public, max-age=3600');
  return res.status(200).json({ publicKey });
}
