const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the frontend
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Parse incoming binary streams up to 100MB
app.post('/api/publish', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
  const apiKey = req.headers['x-roblox-api-key'];
  const universeId = req.headers['x-universe-id'];
  const placeId = req.headers['x-place-id'];

  if (!apiKey || !universeId || !placeId) {
    return res.status(400).json({
      error: 'Missing required headers: x-roblox-api-key, x-universe-id, x-place-id'
    });
  }

  if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
    return res.status(400).json({
      error: 'Request body must be a valid, non-empty binary file buffer.'
    });
  }

  // IMPORTANT: correct endpoint path includes /universes/{universeId}
  const url = `https://apis.roblox.com/universes/v1/universes/${universeId}/places/${placeId}/versions?versionType=Published`;

  try {
    const robloxRes = await fetch(url, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        // IMPORTANT: Roblox expects a raw binary stream upload
        'Content-Type': 'application/octet-stream',
        'Accept': 'application/json'
      },
      body: req.body
    });

    const responseText = await robloxRes.text();

    let jsonResponse;
    try {
      jsonResponse = JSON.parse(responseText);
    } catch {
      jsonResponse = { message: responseText };
    }

    return res.status(robloxRes.status).json(jsonResponse);
  } catch (error) {
    console.error('Proxy Error:', error);
    return res.status(500).json({
      error: 'Failed to reach Roblox API',
      details: error.message
    });
  }
});

// Express error handler
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err);
  res.status(err.status || 500).json({
    error: 'Internal Server Error',
    details: err.message
  });
});

app.listen(PORT, () => {
  console.log(`Roblox Publisher proxy running on port ${PORT}`);
});