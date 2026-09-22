const express = require('express');
const router = express.Router();
const stytchClient = require('../config/stytch');
const pool = require('../config/database');

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:5000';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// =====================================================
// POST /api/stytch/login
// Sends a magic link to the user's email
// =====================================================
router.post('/login', async function(req, res) {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    console.log(`[Stytch] Sending magic link to: ${email}`);
    console.log(`[Stytch] Redirect URL: ${BACKEND_URL}/api/stytch/authenticate`);

    const response = await stytchClient.magicLinks.email.loginOrCreate({
      email: email,
      login_magic_link_url: `${BACKEND_URL}/api/stytch/authenticate`,
      signup_magic_link_url: `${BACKEND_URL}/api/stytch/authenticate`,
    });

    console.log(`[Stytch] Magic link sent. user_id: ${response.user_id}`);

    res.json({
      success: true,
      message: 'Magic link sent. Check your email.',
      user_id: response.user_id,
    });
  } catch (error) {
    console.error('[Stytch] Login error:', error);

    // Stytch errors often have a `error_type` and `error_message`
    const message = error.error_message || error.message || 'Failed to send magic link';

    res.status(500).json({
      success: false,
      message: message,
      error_type: error.error_type || null,
    });
  }
});

// =====================================================
// GET /api/stytch/authenticate
// User lands here after clicking the magic link.
// Validates the token, upserts the user, and redirects
// to the frontend with the session JWT.
// =====================================================
router.get('/authenticate', async function(req, res) {
  try {
    const { token, stytch_token_type } = req.query;

    console.log(`[Stytch] Authenticate hit. token_type: ${stytch_token_type}`);

    if (!token) {
      console.error('[Stytch] Missing token in query params');
      return res.status(400).send('Missing token');
    }

    const response = await stytchClient.magicLinks.authenticate({
      token: token,
      session_duration_minutes: 60 * 24 * 7, // 7 days
    });

    const stytchUserId = response.user_id;

    // Stytch returns emails as objects with `email` (and sometimes `email_address`)
    const emailObj = response.user.emails && response.user.emails[0];
    const email = emailObj ? (emailObj.email || emailObj.email_address) : null;

    console.log(`[Stytch] Authenticated user_id: ${stytchUserId}, email: ${email}`);

    if (!email) {
      console.error('[Stytch] No email found on user object');
      return res.status(500).send('Authentication failed: no email returned from Stytch');
    }

    // Upsert user into PostgreSQL
    await pool.query(
      `INSERT INTO users (stytch_user_id, email, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (stytch_user_id) DO UPDATE SET email = EXCLUDED.email`,
      [stytchUserId, email]
    );

    console.log(`[Stytch] User upserted in DB. Redirecting to frontend...`);

    const sessionJwt = response.session_jwt;
    res.redirect(`${FRONTEND_URL}/auth/callback?session_jwt=${sessionJwt}`);
  } catch (error) {
    console.error('[Stytch] Authenticate error:', error);
    const message = error.error_message || error.message || 'Authentication failed';
    res.status(500).send('Authentication failed: ' + message);
  }
});

module.exports = router;