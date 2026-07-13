module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { app_id, headings, contents, data, icon, included_segments } = req.body;
  const apiKey = process.env.ONESIGNAL_API_KEY;

  if (!apiKey) return res.status(500).json({ error: 'ONESIGNAL_API_KEY not set' });

  try {
    const r = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${apiKey}`,
      },
      body: JSON.stringify({
        app_id, headings, contents,
        included_segments: included_segments || ['All'],
        data: data || {},
        chrome_web_icon: icon || '/logo.png',
        firefox_icon: icon || '/logo.png',
        safari_icon: icon || '/logo.png',
        url: data?.url || '/',
        priority: 10,
      }),
    });
    const result = await r.json();
    res.json({ ok: true, result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
};
