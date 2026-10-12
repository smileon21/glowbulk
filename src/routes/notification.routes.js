
const express = require('express');
const pool = require('../config/database');
const { authenticate } = require('../middleware/auth.middleware');

const router = express.Router();

// All notification routes require an authenticated user.
router.use(authenticate);

// GET /api/notifications
// Get the latest 30 notifications and unread count for the logged-in user.
router.get('/', async (req, res) => {
  try {
    const userId = req.user.id;

    const list = await pool.query(
      `SELECT id, type, title, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 30`,
      [userId]
    );

    const count = await pool.query(
      `SELECT COUNT(*)::int AS n
       FROM notifications
       WHERE user_id = $1 AND is_read = FALSE`,
      [userId]
    );

    res.json({
      success: true,
      data: list.rows,
      unread: count.rows[0].n
    });
  } catch (error) {
    console.error('Error loading notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Could not load notifications'
    });
  }
});

// PUT /api/notifications/read-all
// Mark all of the logged-in user's notifications as read.
router.put('/read-all', async (req, res) => {
  try {
    await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE user_id = $1 AND is_read = FALSE`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'All notifications marked as read'
    });
  } catch (error) {
    console.error('Error marking notifications read:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update notifications'
    });
  }
});

// PUT /api/notifications/:id/read
// Mark one notification as read.
router.put('/:id/read', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification id'
    });
  }

  try {
    const result = await pool.query(
      `UPDATE notifications
       SET is_read = TRUE
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('Error marking notification read:', error);
    res.status(500).json({
      success: false,
      message: 'Could not update notification'
    });
  }
});

// DELETE /api/notifications/:id
// Delete one notification belonging to the logged-in user.
router.delete('/:id', async (req, res) => {
  const id = Number(req.params.id);

  if (!Number.isSafeInteger(id) || id <= 0) {
    return res.status(400).json({
      success: false,
      message: 'Invalid notification id'
    });
  }

  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE id = $1 AND user_id = $2
       RETURNING id`,
      [id, req.user.id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully',
      id: result.rows[0].id
    });
  } catch (error) {
    console.error('Error deleting notification:', error);
    res.status(500).json({
      success: false,
      message: 'Could not delete notification'
    });
  }
});

// DELETE /api/notifications
// Delete all notifications belonging to the logged-in user.
router.delete('/', async (req, res) => {
  try {
    const result = await pool.query(
      `DELETE FROM notifications
       WHERE user_id = $1`,
      [req.user.id]
    );

    res.json({
      success: true,
      message: 'All notifications deleted successfully',
      deletedCount: result.rowCount
    });
  } catch (error) {
    console.error('Error deleting all notifications:', error);
    res.status(500).json({
      success: false,
      message: 'Could not delete notifications'
    });
  }
});

module.exports = router;
