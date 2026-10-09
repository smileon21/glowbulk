// src/services/notification.service.js
// Creates in-app notifications (the bell). Other channels (browser pop-ups) are added in Step 5.

const pool = require('../config/database');

// Staff roles that receive "staff" notifications
const STAFF_ROLES = ['admin', 'marketing'];

/** Save one notification for one user (users.id). */
async function createNotification({ userId, type, title, message, link = null }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, type, title, message, link]
  );
  return rows[0];
}

/** Notify one user. */
async function notifyUser(payload) {
  return createNotification(payload);
}

/** Notify every active staff member (admin). */
async function notifyStaff({ type, title, message, link = null }) {
  const { rows } = await pool.query(
    'SELECT id FROM users WHERE role = ANY($1) AND is_active = TRUE',
    [STAFF_ROLES]
  );
  await Promise.all(
    rows.map((u) => notifyUser({ userId: u.id, type, title, message, link }))
  );
}

/**
 * Notify a customer. Your tables link requests/quotations/orders to customers.id,
 * so we first look up the customer's user account (customers.user_id).
 */
async function notifyCustomer(customerId, { type, title, message, link = null }) {
  const { rows } = await pool.query(
    'SELECT user_id FROM customers WHERE id = $1',
    [customerId]
  );
  if (!rows[0] || !rows[0].user_id) return;
  await notifyUser({ userId: rows[0].user_id, type, title, message, link });
}

module.exports = { STAFF_ROLES, createNotification, notifyUser, notifyStaff, notifyCustomer };