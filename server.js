const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the frontend HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'roblox-publisher.html'));
});

// Parse ALL incoming requests as a raw Buffer, ignoring what the browser tags it as
app.use('/api/publish', express.raw({ type: '*/*', limit: '100mb' }));

app.post('/api/publish', async (req, res) => {
  const apiKey = req.headers['x-roblox-api-key'];
  const universeId = req.headers['x-universe-id'];
  const placeId = req.headers['x-place-id'];
  const contentType = req.headers['content-type'] || 'application/octet-stream';

  if (!apiKey || !universeId || !placeId) {
    return res.status(400).json({ error: 'Missing required headers' });
  }

  // Ensure the body is actually a raw buffer and not empty
  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({ error: 'File buffer is empty or invalid. Browser failed to send the file.' });
  }

  const robloxUrl = `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=Published`;

  try {
    const robloxRes = await fetch(robloxUrl, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'Content-Type': contentType,
        'Content-Length': req.body.length // CRITICAL FIX: Roblox requires this for binary files!
      },
      body: req.body,
    });

    const responseText = await robloxRes.text();

    res.status(robloxRes.status)
       .set('Content-Type', 'application/json')
       .send(responseText);

  } catch (err) {
    console.error('Roblox API fetch error:', err);
    res.status(502).json({ error: `Proxy error: ${err.message}` });
  }
});

app.listen(PORT, () => {
  console.log(`Roblox Place Publisher running on port ${PORT}`);
});