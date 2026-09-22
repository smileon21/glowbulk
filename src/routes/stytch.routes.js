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
      email: email.toLowerCase().trim(),
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
// to the frontend with the session JWT/Token.
// =====================================================
router.get('/authenticate', async function(req, res) {
  try {
    const { token, stytch_token_type } = req.query;

    console.log(`[Stytch] Authenticate hit. token_type: ${stytch_token_type}`);

    if (!token) {
      console.error('[Stytch] Missing token in query params');
      return res.status(400).redirect(`${FRONTEND_URL}/login?error=missing_token`);
    }

    const response = await stytchClient.magicLinks.authenticate({
      token: token,
      session_duration_minutes: 60 * 24 * 7, // 7 days
    });

    const stytchUserId = response.user_id;

    // Safely parse the primary email address
    const emailObj = response.user.emails && response.user.emails[0];
    const rawEmail = emailObj ? (emailObj.email || emailObj.email_address) : null;
    const email = rawEmail ? rawEmail.toLowerCase().trim() : null;

    console.log(`[Stytch] Authenticated user_id: ${stytchUserId}, email: ${email}`);

    if (!email) {
      console.error('[Stytch] No email found on user object');
      return res.redirect(`${FRONTEND_URL}/login?error=no_email_returned`);
    }

    // Robust Upsert: Handles unique constraint on either `stytch_user_id` OR `email`
    await pool.query(
      `INSERT INTO users (stytch_user_id, email, created_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (email) 
       DO UPDATE SET stytch_user_id = EXCLUDED.stytch_user_id`,
      [stytchUserId, email]
    );

    console.log(`[Stytch] User upserted in DB. Redirecting to frontend...`);

    // Fallback to session_token if session_jwt is not generated
    const sessionToken = response.session_jwt || response.session_token;

    res.redirect(`${FRONTEND_URL}/auth/callback?session_jwt=${sessionToken}`);
  } catch (error) {
    console.error('[Stytch] Authenticate error:', error);
    const message = encodeURIComponent(error.error_message || error.message || 'Authentication failed');
    res.redirect(`${FRONTEND_URL}/login?error=${message}`);
  }
});

module.exports = router;