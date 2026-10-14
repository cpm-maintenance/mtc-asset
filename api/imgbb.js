// Vercel serverless — ImgBB upload proxy
// The ImgBB API key stays in the server env and is never inlined into the client bundle.

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const key = process.env.IMGBB_API_KEY;
  if (!key) return res.status(500).json({ error: 'IMGBB_API_KEY not set' });

  // Body: { image: <raw base64, no data: prefix>, name?: <string> }
  const { image, name } = req.body || {};
  if (!image) return res.status(400).json({ error: 'image required' });

  try {
    const form = new FormData();
    form.append('key', key);
    form.append('image', image);
    if (name) form.append('name', name);

    const r = await fetch('https://api.imgbb.com/1/upload', { method: 'POST', body: form });
    const j = await r.json();
    // Pass the upstream payload through untouched so the client sees the same shape as before.
    return res.status(j.success ? 200 : 502).json(j);
  } catch (e) {
    return res.status(502).json({ error: e.message });
  }
}
