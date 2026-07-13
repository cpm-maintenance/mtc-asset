const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

// --- CONFIG ---
const ONE_SIGNAL_API_KEY = process.env.ONESIGNAL_API_KEY;

app.use(cors());
app.use(express.json());

app.post('/push', async (req, res) => {
  try {
    if (!ONE_SIGNAL_API_KEY) {
      return res.status(500).json({ error: 'ONESIGNAL_API_KEY not set' });
    }

    const { app_id, headings, contents, data, icon } = req.body;

    const response = await fetch('https://onesignal.com/api/v1/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Key ${ONE_SIGNAL_API_KEY}`,
      },
      body: JSON.stringify({
        app_id,
        headings,
        contents,
        included_segments: req.body.included_segments || ['All'],
        data: data || {},
        icon: icon || '/logo.png',
        chrome_web_icon: icon || '/logo.png',
        firefox_icon: icon || '/logo.png',
        safari_icon: icon || '/logo.png',
        web_url: data?.url || '/',
        url: data?.url || '/',
        priority: 10,
      }),
    });

    const result = await response.json();
    console.log('[Push] Sent:', result);
    res.json({ ok: true, result });
  } catch (e) {
    console.error('[Push] Error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(PORT, () => {
  console.log(`Push proxy running on port ${PORT}`);
  console.log(`API key set: ${ONE_SIGNAL_API_KEY ? 'YES' : 'NO'}`);
});
