// src/services/notification.service.js
// Creates in-app notifications (bell) AND fires Web Push to subscribed browsers.

const pool = require('../config/database');
const webpush = require('web-push');

// Staff roles that receive "staff" notifications
const STAFF_ROLES = ['admin', 'marketing'];

// ---- Web Push setup (uses VAPID keys from .env) ----
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@glowpetroleum.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('[push] VAPID keys missing — push notifications disabled');
}

/**
 * Send a push to every subscription belonging to this user.
 * Runs in the background; failures never bubble up to the caller.
 */
async function sendPushToUser(userId, { title, message, link }) {
  if (!process.env.VAPID_PUBLIC_KEY) return;

  let subs = [];
  try {
    const { rows } = await pool.query(
      'SELECT id, endpoint, p256dh, auth_key FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    subs = rows;
  } catch (err) {
    console.error('[push] lookup failed', err.message);
    return;
  }

  const payload = JSON.stringify({
    title: title || 'GlowBulk',
    body: message || '',
    link: link || '/'
  });

  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification(
        {
          endpoint: s.endpoint,
          keys: { p256dh: s.p256dh, auth: s.auth_key }
        },
        payload
      );
    } catch (err) {
      // 404 or 410 = subscription is dead (browser uninstalled / blocked). Delete it.
      if (err.statusCode === 404 || err.statusCode === 410) {
        pool.query('DELETE FROM push_subscriptions WHERE id = $1', [s.id]).catch(() => {});
      } else {
        console.error('[push] send failed', err.statusCode || '', err.message);
      }
    }
  }));
}

/** Save one notification for one user, and push it to their subscribed browsers. */
async function createNotification({ userId, type, title, message, link = null }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (user_id, type, title, message, link)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id`,
    [userId, type, title, message, link]
  );

  // Fire-and-forget: don't await, so the API response isn't held up.
  sendPushToUser(userId, { title, message, link }).catch(() => {});

  return rows[0];
}

/** Notify one user. */
async function notifyUser(payload) {
  return createNotification(payload);
}

/** Notify every active staff member (admin + marketing). */
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

module.exports = {
  STAFF_ROLES,
  createNotification,
  notifyUser,
  notifyStaff,
  notifyCustomer,
  sendPushToUser
};