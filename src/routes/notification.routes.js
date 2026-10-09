// src/routes/notification.routes.js
const express = require('express');
const pool = require('../config/database');
// Adjust this path to your real auth middleware file name (the one that exports `authenticate`)
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticate);

// GET /api/notifications  -> latest 30 + unread count for the logged-in user
router.get('/', async (req, res) => {
  try {
    const list = await pool.query(
      `SELECT id, type, title, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [req.user.id]
    );
    const count = await pool.query(
      'SELECT COUNT(*)::int AS n FROM notifications WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ success: true, data: list.rows, unread: count.rows[0].n });
  } catch (error) {
    console.error('Error loading notifications:', error);
    res.status(500).json({ success: false, message: 'Could not load notifications' });
  }
});

// PUT /api/notifications/read-all  (declared before '/:id/read')
router.put('/read-all', async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({ success: false, message: 'Could not update notifications' });
  }
});

// PUT /api/notifications/:id/read
router.put('/:id/read', async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id)) {
    return res.status(400).json({ success: false, message: 'Invalid notification id' });
  }
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2',
      [id, req.user.id]
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({ success: false, message: 'Could not update notification' });
  }
});

module.exports = router;