import express from 'express';
import fetch from 'node-fetch';
import cors from 'cors';

const app = express();
app.use(express.json());
app.use(cors());

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CLIENT_ID = '494172450205-daf4jjdss0u07gau3oge0unndfjvha0b.apps.googleusercontent.com';
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET; // set this in env, never commit it

// POST /google/oauth/exchange
app.post('/google/oauth/exchange', async (req, res) => {
  try {
    const { code, codeVerifier, redirectUri } = req.body;

    const params = new URLSearchParams({
      code,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET!,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier,
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const json = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).send(json.error_description || JSON.stringify(json));
    }

    const expiresIn = json.expires_in as number | undefined;
    const expiresAt = typeof expiresIn === 'number' ? Date.now() + expiresIn * 1000 : undefined;

    return res.json({
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt,
    });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Exchange failed');
  }
});

// POST /google/oauth/refresh
app.post('/google/oauth/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    const params = new URLSearchParams({
      refresh_token: refreshToken,
      client_id: CLIENT_ID,
      client_secret: CLIENT_SECRET!,
      grant_type: 'refresh_token',
    });

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    const json = await tokenRes.json();
    if (!tokenRes.ok) {
      return res.status(tokenRes.status).send(json.error_description || JSON.stringify(json));
    }

    const expiresIn = json.expires_in as number | undefined;
    const expiresAt = typeof expiresIn === 'number' ? Date.now() + expiresIn * 1000 : undefined;

    return res.json({
      accessToken: json.access_token,
      expiresAt,
    });
  } catch (e: any) {
    return res.status(500).send(e.message || 'Refresh failed');
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});