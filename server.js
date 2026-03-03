const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve the static frontend explicitly
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// CRITICAL: Parse incoming binary streams up to 100MB
app.post('/api/publish', express.raw({ type: '*/*', limit: '100mb' }), async (req, res) => {
    // Extract headers sent by the frontend
    const apiKey = req.headers['x-roblox-api-key'];
    const universeId = req.headers['x-universe-id'];
    const placeId = req.headers['x-place-id'];
    const contentType = req.headers['content-type'] || 'application/octet-stream';

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

    const url = `https://apis.roblox.com/universes/v1/${universeId}/places/${placeId}/versions?versionType=Published`;

    try {
        // Proxy the request to Roblox Open Cloud API
        const robloxRes = await fetch(url, {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': contentType,
                // CRITICAL: Roblox rejects streams missing exact Content-Length
                'Content-Length': req.body.length.toString()
            },
            body: req.body
        });

        const responseText = await robloxRes.text();
        let jsonResponse;
        
        try {
            // Safely parse Roblox response
            jsonResponse = JSON.parse(responseText);
        } catch (e) {
            jsonResponse = { message: responseText };
        }

        // Return exact status & data back to frontend
        return res.status(robloxRes.status).json(jsonResponse);

    } catch (error) {
        console.error('Proxy Error:', error);
        return res.status(500).json({ 
            error: 'Failed to reach Roblox API', 
            details: error.message 
        });
    }
});

// Express 5 Native Error Handling Middleware
// This catches any unhandled errors cleanly and sends JSON back
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
