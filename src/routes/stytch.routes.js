const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
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
// Validates the token, upserts the user, issues YOUR app JWT,
// and redirects to the frontend with both tokens.
// =====================================================
router.get('/authenticate', async function(req, res) {
  try {
    const { token, stytch_token_type } = req.query;

    console.log(`[Stytch] Authenticate hit. token_type: ${stytch_token_type}`);

    if (!token) {
      console.error('[Stytch] Missing token in query params');
      return res.redirect(`${FRONTEND_URL}/login?error=missing_token`);
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

    // =====================================================
    // STEP 1: Find or create the user in your own DB
    // =====================================================
    let userResult = await pool.query(
      'SELECT * FROM users WHERE email = $1 OR stytch_user_id = $2 LIMIT 1',
      [email, stytchUserId]
    );

    let user;

    if (userResult.rows.length === 0) {
      // New user — create them with 'customer' role by default.
      // Adjust column list below to match your real users table.
      const insertResult = await pool.query(
        `INSERT INTO users (email, stytch_user_id, role, created_at)
         VALUES ($1, $2, 'customer', NOW())
         RETURNING *`,
        [email, stytchUserId]
      );
      user = insertResult.rows[0];
      console.log(`[Stytch] Created new user id=${user.id}`);
    } else {
      user = userResult.rows[0];

      // Link stytch_user_id if missing
      if (!user.stytch_user_id) {
        await pool.query(
          'UPDATE users SET stytch_user_id = $1 WHERE id = $2',
          [stytchUserId, user.id]
        );
        user.stytch_user_id = stytchUserId;
        console.log(`[Stytch] Linked existing user id=${user.id} to Stytch`);
      } else {
        console.log(`[Stytch] Found existing user id=${user.id}`);
      }
    }

    // =====================================================
    // STEP 2: Issue YOUR OWN JWT (matches auth.middleware.js)
    // =====================================================
    const jwtPayload = {
      id: user.id,
      email: user.email,
      role: user.role,
      first_name: user.first_name || null,
      last_name: user.last_name || null,
    };

    const appJwt = jwt.sign(jwtPayload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRE || '7d',
    });

    console.log(`[Stytch] Issued app JWT for user id=${user.id}. Redirecting...`);

    // =====================================================
    // STEP 3: Redirect to frontend with BOTH tokens
    // - session_jwt: Stytch session (for future Stytch API calls)
    // - app_jwt: your app JWT (for /api/* calls)
    // =====================================================
    const sessionToken = response.session_jwt || response.session_token;

    res.redirect(
      `${FRONTEND_URL}/auth/callback?app_jwt=${appJwt}&session_jwt=${sessionToken}`
    );
  } catch (error) {
    console.error('[Stytch] Authenticate error:', error);
    const message = encodeURIComponent(error.error_message || error.message || 'Authentication failed');
    res.redirect(`${FRONTEND_URL}/login?error=${message}`);
  }
});

module.exports = router;