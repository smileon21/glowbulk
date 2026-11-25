const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');

// Save (or refresh) a browser's push subscription for this user
router.post('/subscribe', authenticate, async (req, res) => {
  try {
    const { endpoint, keys } = req.body;
    if (!endpoint || !keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ success: false, message: 'Invalid subscription' });
    }

    // Upsert: same endpoint = same browser, update the user_id in case they logged in as someone else
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (endpoint) DO UPDATE
         SET user_id  = EXCLUDED.user_id,
             p256dh   = EXCLUDED.p256dh,
             auth_key = EXCLUDED.auth_key`,
      [req.user.id, endpoint, keys.p256dh, keys.auth]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('push subscribe error', err);
    res.status(500).json({ success: false });
  }
});

// Remove this browser's subscription (called on logout).
// Only the user who owns the subscription can remove it.
router.post('/unsubscribe', authenticate, async (req, res) => {
  try {
    const { endpoint } = req.body;
    if (!endpoint) {
      return res.status(400).json({ success: false, message: 'Endpoint is required' });
    }

    await pool.query(
      'DELETE FROM push_subscriptions WHERE endpoint = $1 AND user_id = $2',
      [endpoint, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('push unsubscribe error', err);
    res.status(500).json({ success: false });
  }
});

module.exports = router;