const pool = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');

const {
  createUser,
  findUserByEmail,
  blockUser,
  unblockUser,
  setTemporaryPassword,
  updateUserEmail
} = require('../models/user.model');
const { logActivity } = require('../utils/activityLog');

// Staff roles IT can create. 'admin' is stored in the database and shown as "IT" on screen.
const STAFF_ROLES = ['admin', 'marketing', 'pricing', 'finance'];

// Accounts with this many failed sign-ins (or currently locked) show up as suspicious
const SUSPICIOUS_ATTEMPTS = 3;

// =====================================================
// HELPERS
// =====================================================

const parseId = (value) => {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
};

const fullName = (u) => `${u.first_name || ''} ${u.last_name || ''}`.trim();

// Random temporary password without look-alike characters (no 0/O, 1/l/I)
const TEMP_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
const generateTemporaryPassword = (length = 12) => {
  for (;;) {
    let password = '';
    for (let i = 0; i < length; i++) {
      password += TEMP_ALPHABET[crypto.randomInt(TEMP_ALPHABET.length)];
    }
    if (/[A-Z]/.test(password) && /[a-z]/.test(password) && /\d/.test(password)) {
      return password;
    }
  }
};

// Load a user together with lock state
const getTarget = async (id) => {
  const result = await pool.query(
    `SELECT id, first_name, last_name, email, role, is_active, blocked_reason,
            (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS is_locked
     FROM users WHERE id = $1`,
    [id]
  );
  return result.rows[0];
};

const serverError = (res, label, error, message) => {
  console.error(`${label}:`, error);
  return res.status(500).json({ success: false, message });
};

// =====================================================
// DASHBOARD
// =====================================================

const getDashboardStats = async (req, res) => {
  try {
    const counts = await pool.query(`
      SELECT
        COUNT(*)::int AS total_users,
        COUNT(*) FILTER (WHERE role = 'admin')::int AS admins,
        COUNT(*) FILTER (WHERE role = 'marketing')::int AS marketing,
        COUNT(*) FILTER (WHERE role = 'pricing')::int AS pricing,
        COUNT(*) FILTER (WHERE role = 'finance')::int AS finance,
        COUNT(*) FILTER (WHERE is_active = false)::int AS blocked,
        COUNT(*) FILTER (WHERE locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP)::int AS locked
      FROM users
    `);
    const customersResult = await pool.query('SELECT COUNT(*)::int AS count FROM customers');
    const failedResult = await pool.query(`
      SELECT COUNT(*)::int AS count FROM activity_log
      WHERE action = 'LOGIN_FAILED' AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
    `);

    const c = counts.rows[0];

    res.json({
      success: true,
      data: {
        totalUsers: c.total_users,
        admins: c.admins,
        marketing: c.marketing,
        pricing: c.pricing,
        finance: c.finance,
        customers: customersResult.rows[0].count,
        blockedUsers: c.blocked,
        lockedUsers: c.locked,
        failedLogins24h: failedResult.rows[0].count
      }
    });
  } catch (error) {
    return serverError(res, 'Error fetching dashboard stats', error, 'Error fetching dashboard stats');
  }
};

// =====================================================
// USER LIST  (?role=staff|admin|marketing|...&status=active|blocked&search=...)
// =====================================================

const getSystemUsers = async (req, res) => {
  try {
    const { role, status, search } = req.query;
    const where = [];
    const values = [];

    if (role === 'staff') {
      values.push(STAFF_ROLES);
      where.push(`u.role = ANY($${values.length})`);
    } else if (role) {
      values.push(role);
      where.push(`u.role = $${values.length}`);
    }

    if (status === 'active') where.push('u.is_active = true');
    if (status === 'blocked' || status === 'inactive') where.push('u.is_active = false');

    if (search) {
      values.push(`%${search}%`);
      const n = values.length;
      where.push(`(u.first_name ILIKE $${n} OR u.last_name ILIKE $${n} OR u.email ILIKE $${n})`);
    }

    const query = `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.role,
        u.created_at AS joined_date,
        u.is_active,
        u.last_login,
        u.blocked_reason,
        u.blocked_at,
        u.must_change_password,
        COALESCE(u.failed_login_attempts, 0) AS failed_login_attempts,
        (u.locked_until IS NOT NULL AND u.locked_until > CURRENT_TIMESTAMP) AS is_locked,
        CASE WHEN u.role = 'customer' THEN c.company_name ELSE NULL END AS company_name
      FROM users u
      LEFT JOIN customers c ON u.id = c.user_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY u.created_at DESC
    `;

    const result = await pool.query(query, values);

    const formattedUsers = result.rows.map((user) => ({
      ...user,
      name: fullName(user),
      status: user.is_active ? 'active' : 'inactive',
      is_blocked: !user.is_active
    }));

    res.json({ success: true, data: formattedUsers });
  } catch (error) {
    return serverError(res, 'Error fetching system users', error, 'Error fetching system users');
  }
};

// =====================================================
// OWN PROFILE
// =====================================================

const formatProfile = (user) => ({
  id: user.id,
  name: `${user.first_name} ${user.last_name}`,
  first_name: user.first_name,
  last_name: user.last_name,
  email: user.email,
  role: user.role,
  joined_date: user.joined_date,
  status: user.status ? 'active' : 'inactive'
});

const getAdminProfile = async (req, res) => {
  try {
    const query = `
      SELECT id, first_name, last_name, email, role,
             created_at AS joined_date, is_active AS status
      FROM users
      WHERE id = $1 AND role = 'admin'
    `;
    const result = await pool.query(query, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin profile not found' });
    }

    res.json({ success: true, data: formatProfile(result.rows[0]) });
  } catch (error) {
    return serverError(res, 'Error fetching admin profile', error, 'Error fetching admin profile');
  }
};

const updateAdminProfile = async (req, res) => {
  try {
    const { name, email, first_name, last_name } = req.body;

    let firstName = first_name;
    let lastName = last_name;

    if (name && !first_name && !last_name) {
      const nameParts = name.split(' ');
      firstName = nameParts[0] || '';
      lastName = nameParts.slice(1).join(' ') || '';
    }

    const normalizedEmail = email.trim().toLowerCase();

    const existing = await findUserByEmail(normalizedEmail);
    if (existing && existing.id !== req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Another account already uses this email'
      });
    }

    const query = `
      UPDATE users
      SET first_name = $1, last_name = $2, email = $3, updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND role = 'admin'
      RETURNING id, first_name, last_name, email, role,
                created_at AS joined_date, is_active AS status
    `;
    const result = await pool.query(query, [firstName, lastName, normalizedEmail, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Admin profile not found' });
    }

    await logActivity({
      actor: req.user,
      action: 'PROFILE_UPDATED',
      targetType: 'user',
      targetId: req.user.id,
      oldValues: { name: fullName(req.user), email: req.user.email },
      newValues: { name: `${firstName} ${lastName}`.trim(), email: normalizedEmail },
      details: 'IT updated their own profile',
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Admin profile updated successfully',
      data: formatProfile(result.rows[0])
    });
  } catch (error) {
    return serverError(res, 'Error updating admin profile', error, 'Error updating admin profile');
  }
};

// =====================================================
// CREATE STAFF ACCOUNT  (temporary password shown once)
// =====================================================

const createStaffUser = async (req, res) => {
  try {
    const firstName = req.body.firstName.trim();
    const lastName = req.body.lastName.trim();
    const email = req.body.email.trim().toLowerCase();
    const { role } = req.body;
    const phone = req.body.phone ? String(req.body.phone).trim() : null;

    const existing = await findUserByEmail(email);
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists'
      });
    }

    const temporaryPassword = generateTemporaryPassword();

    const user = await createUser({
      firstName,
      lastName,
      email,
      password: temporaryPassword,
      role,
      phone
    });

    await pool.query('UPDATE users SET must_change_password = true WHERE id = $1', [user.id]);

    await logActivity({
      actor: req.user,
      action: 'USER_CREATED',
      targetType: 'user',
      targetId: user.id,
      newValues: { name: `${firstName} ${lastName}`, email, role },
      details: `Created ${role} account for ${email}`,
      ip: req.ip
    });

    // The password is shown once and never stored in readable form
    res.set('Cache-Control', 'no-store');
    res.status(201).json({
      success: true,
      message: 'Account created. Give the temporary password to the person; it is shown only once.',
      data: {
        id: user.id,
        name: `${firstName} ${lastName}`,
        first_name: firstName,
        last_name: lastName,
        email: user.email,
        role: user.role,
        temporaryPassword
      }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'A user with this email already exists' });
    }
    return serverError(res, 'Error creating staff user', error, 'Error creating account');
  }
};

// =====================================================
// RESET STAFF PASSWORD  (new temporary password shown once)
// =====================================================

const resetStaffPassword = async (req, res) => {
  try {
    const id = parseId(req.params.userId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

    if (id === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Use the Security page to change your own password'
      });
    }

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if (!STAFF_ROLES.includes(target.role)) {
      return res.status(400).json({
        success: false,
        message: 'Customers reset their own password with the forgot-password link'
      });
    }

    const temporaryPassword = generateTemporaryPassword();
    const hashed = await bcrypt.hash(temporaryPassword, 10);
    await setTemporaryPassword(id, hashed);

    await logActivity({
      actor: req.user,
      action: 'PASSWORD_RESET_BY_IT',
      targetType: 'user',
      targetId: id,
      newValues: { must_change_password: true },
      details: `Reset password for ${fullName(target)} (${target.email})`,
      ip: req.ip
    });

    res.set('Cache-Control', 'no-store');
    res.json({
      success: true,
      message: 'Password reset. Give the temporary password to the person; it is shown only once.',
      data: { id, email: target.email, temporaryPassword }
    });
  } catch (error) {
    return serverError(res, 'Error resetting staff password', error, 'Error resetting password');
  }
};

// =====================================================
// CHANGE STAFF EMAIL  (duplicate checked)
// =====================================================

const changeStaffEmail = async (req, res) => {
  try {
    const id = parseId(req.params.userId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

    const newEmail = req.body.email.trim().toLowerCase();

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if (!STAFF_ROLES.includes(target.role)) {
      return res.status(400).json({ success: false, message: 'Only staff emails can be changed here' });
    }

    if (newEmail === target.email) {
      return res.status(400).json({ success: false, message: 'That is already their email' });
    }

    const existing = await findUserByEmail(newEmail);
    if (existing && existing.id !== id) {
      return res.status(400).json({ success: false, message: 'Another account already uses this email' });
    }

    const updated = await updateUserEmail(id, newEmail);

    await logActivity({
      actor: req.user,
      action: 'EMAIL_CHANGED',
      targetType: 'user',
      targetId: id,
      oldValues: { email: target.email },
      newValues: { email: newEmail },
      details: `Changed email for ${fullName(target)}`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Email updated',
      data: { ...updated, name: fullName(updated) }
    });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'Another account already uses this email' });
    }
    return serverError(res, 'Error changing email', error, 'Error changing email');
  }
};

// =====================================================
// BLOCK / UNBLOCK  (any account, customers included)
// A block applies on the person's next request: the middleware checks the database each time.
// =====================================================

const blockAccount = async (req, res) => {
  try {
    const id = parseId(req.params.userId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot block your own account' });
    }

    const reason = String(req.body.reason || '').trim();
    if (reason.length < 3) {
      return res.status(400).json({ success: false, message: 'A reason is required to block an account' });
    }

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    if (target.is_active === false) {
      return res.status(400).json({ success: false, message: 'This account is already blocked' });
    }

    const updated = await blockUser(id, reason, req.user.id);

    await logActivity({
      actor: req.user,
      action: 'USER_BLOCKED',
      targetType: 'user',
      targetId: id,
      oldValues: { is_active: true },
      newValues: { is_active: false, blocked_reason: reason },
      details: `Blocked ${fullName(target)} (${target.email}, ${target.role})`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Account blocked. It stops working on their next action.',
      data: { ...updated, name: fullName(updated), status: 'inactive' }
    });
  } catch (error) {
    return serverError(res, 'Error blocking account', error, 'Error blocking account');
  }
};

const unblockAccount = async (req, res) => {
  try {
    const id = parseId(req.params.userId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    // Unblock also clears a temporary lock from failed sign-ins
    if (target.is_active !== false && !target.is_locked) {
      return res.status(400).json({ success: false, message: 'This account is not blocked' });
    }

    const updated = await unblockUser(id);

    await logActivity({
      actor: req.user,
      action: 'USER_UNBLOCKED',
      targetType: 'user',
      targetId: id,
      oldValues: {
        is_active: target.is_active !== false,
        blocked_reason: target.blocked_reason,
        locked: !!target.is_locked
      },
      newValues: { is_active: true },
      details: `Unblocked ${fullName(target)} (${target.email}, ${target.role})`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: 'Account unblocked',
      data: { ...updated, name: fullName(updated), status: 'active' }
    });
  } catch (error) {
    return serverError(res, 'Error unblocking account', error, 'Error unblocking account');
  }
};

// Old activate/deactivate endpoint, kept for the current AdminManagement page
const updateUserStatus = (req, res) => {
  if (req.body.status === 'active') return unblockAccount(req, res);
  req.body.reason = req.body.reason || 'Deactivated by IT';
  return blockAccount(req, res);
};

// =====================================================
// DELETE USER
// =====================================================

const deleteUser = async (req, res) => {
  try {
    const id = parseId(req.params.userId);
    if (!id) return res.status(400).json({ success: false, message: 'Invalid user id' });

    if (id === req.user.id) {
      return res.status(400).json({ success: false, message: 'You cannot delete your own account' });
    }

    const target = await getTarget(id);
    if (!target) return res.status(404).json({ success: false, message: 'User not found' });

    await pool.query('DELETE FROM users WHERE id = $1', [id]);

    await logActivity({
      actor: req.user,
      action: 'USER_DELETED',
      targetType: 'user',
      targetId: id,
      oldValues: { name: fullName(target), email: target.email, role: target.role },
      details: `Deleted ${fullName(target)} (${target.email}, ${target.role})`,
      ip: req.ip
    });

    res.json({
      success: true,
      message: `User ${fullName(target)} deleted successfully`,
      data: { id, first_name: target.first_name, last_name: target.last_name, email: target.email }
    });
  } catch (error) {
    // Foreign key: the person has orders, quotations, etc. Blocking is the safe alternative.
    if (error.code === '23503') {
      return res.status(400).json({
        success: false,
        message: 'This user has related records and cannot be deleted. Block the account instead.'
      });
    }
    return serverError(res, 'Error deleting user', error, 'Error deleting user');
  }
};

// =====================================================
// ACTIVITY LOG
// ?page=1&limit=25&action=USER_BLOCKED&actorId=3&targetType=user&targetId=7&search=text&from=2026-10-01&to=2026-10-31
// =====================================================

const getActivityLog = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 25, 1), 100);
    const offset = (page - 1) * limit;

    const { action, actorId, targetType, targetId, search, from, to } = req.query;

    if ((from && Number.isNaN(Date.parse(from))) || (to && Number.isNaN(Date.parse(to)))) {
      return res.status(400).json({ success: false, message: 'Invalid date filter' });
    }

    const where = [];
    const values = [];
    const add = (sql, value) => {
      values.push(value);
      where.push(sql.replace(/\$n/g, `$${values.length}`));
    };

    if (action) add('action = $n', action);
    if (actorId && parseId(actorId)) add('actor_id = $n', parseId(actorId));
    if (targetType) add('target_type = $n', targetType);
    if (targetId && parseId(targetId)) add('target_id = $n', parseId(targetId));
    if (from) add('created_at >= $n::date', from);
    if (to) add("created_at < ($n::date + INTERVAL '1 day')", to);
    if (search) {
      add('(actor_name ILIKE $n OR details ILIKE $n OR action ILIKE $n)', `%${search}%`);
    }

    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const totalResult = await pool.query(
      `SELECT COUNT(*)::int AS count FROM activity_log ${whereSql}`,
      values
    );

    const rowsResult = await pool.query(
      `SELECT id, actor_id, actor_name, actor_role, action, target_type, target_id,
              old_values, new_values, details, ip_address, created_at
       FROM activity_log
       ${whereSql}
       ORDER BY created_at DESC, id DESC
       LIMIT ${limit} OFFSET ${offset}`,
      values
    );

    const actionsResult = await pool.query(
      'SELECT DISTINCT action FROM activity_log ORDER BY action'
    );

    const total = totalResult.rows[0].count;

    res.json({
      success: true,
      data: rowsResult.rows,
      actions: actionsResult.rows.map((r) => r.action),
      pagination: { page, limit, total, totalPages: Math.max(Math.ceil(total / limit), 1) }
    });
  } catch (error) {
    return serverError(res, 'Error fetching activity log', error, 'Error fetching activity log');
  }
};

// =====================================================
// SUSPICIOUS ACTIVITY  (failed sign-ins flagged to IT)
// =====================================================

const getSuspiciousActivity = async (req, res) => {
  try {
    const flagged = await pool.query(
      `SELECT id, first_name, last_name, email, role, is_active,
              COALESCE(failed_login_attempts, 0) AS failed_login_attempts,
              last_failed_login, locked_until,
              (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS is_locked
       FROM users
       WHERE COALESCE(failed_login_attempts, 0) >= $1
          OR (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP)
       ORDER BY last_failed_login DESC NULLS LAST`,
      [SUSPICIOUS_ATTEMPTS]
    );

    const recent = await pool.query(
      `SELECT id, action, target_id, details, ip_address, created_at
       FROM activity_log
       WHERE action IN ('LOGIN_FAILED', 'ACCOUNT_LOCKED', 'LOGIN_BLOCKED')
         AND created_at > CURRENT_TIMESTAMP - INTERVAL '24 hours'
       ORDER BY created_at DESC
       LIMIT 50`
    );

    res.json({
      success: true,
      data: {
        flaggedAccounts: flagged.rows.map((u) => ({ ...u, name: fullName(u) })),
        recentEvents: recent.rows
      }
    });
  } catch (error) {
    return serverError(res, 'Error fetching suspicious activity', error, 'Error fetching suspicious activity');
  }
};

module.exports = {
  getDashboardStats,
  getSystemUsers,
  getAdminProfile,
  updateAdminProfile,
  createStaffUser,
  resetStaffPassword,
  changeStaffEmail,
  blockAccount,
  unblockAccount,
  updateUserStatus,
  deleteUser,
  getActivityLog,
  getSuspiciousActivity
};