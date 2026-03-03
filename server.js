const express = require('express');
const path    = require('path');

const app  = express();
const PORT = process.env.PORT || 3000;

// ── Serve the frontend ──────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'roblox-publisher.html'));
});

// ── Accept raw binary & XML bodies up to 100 MB ────────────────────────────
app.use('/api/publish', express.raw({
  type: ['application/octet-stream', 'application/xml'],
  limit: '100mb',
}));

// ── Proxy endpoint ──────────────────────────────────────────────────────────
app.post('/api/publish', async (req, res) => {
  const apiKey     = req.headers['x-roblox-api-key'];
  const universeId = req.headers['x-universe-id'];
  const placeId    = req.headers['x-place-id'];
  const contentType = req.headers['content-type'] || 'application/octet-stream';

  // Validate required headers
  if (!apiKey || !universeId || !placeId) {
    return res.status(400).json({
      error: 'Missing required headers: x-roblox-api-key, x-universe-id, x-place-id',
    });
  }

  if (!req.body || req.body.length === 0) {
    return res.status(400).json({ error: 'Request body is empty.' });
  }

  const robloxUrl =
    `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=Published`;

  try {
    const robloxRes = await fetch(robloxUrl, {
      method:  'POST',
      headers: {
        'x-api-key':    apiKey,
        'Content-Type': contentType,
      },
      body: req.body,
    });

    const responseText = await robloxRes.text();

    // Forward Roblox's status and body straight back to the client
    res.status(robloxRes.status)
       .set('Content-Type', 'application/json')
       .send(responseText);

  } catch (err) {
    console.error('Roblox API fetch error:', err);
    res.status(502).json({ error: `Proxy error: ${err.message}` });
  }
});

// ── Start ───────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Roblox Place Publisher running on port ${PORT}`);
});
