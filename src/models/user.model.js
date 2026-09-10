const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// Create a new user
const createUser = async (userData) => {
  const { firstName, lastName, email, password, role = 'customer', phone } = userData;
  
  const hashedPassword = await bcrypt.hash(password, 10);
  
  const query = `
    INSERT INTO users (first_name, last_name, email, password, role, phone)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING id, first_name, last_name, email, role, phone, created_at
  `;
  
  const values = [firstName, lastName, email, hashedPassword, role, phone];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Find user by email (includes password + 2FA fields — used for login)
const findUserByEmail = async (email) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  return result.rows[0];
};

// Find user by ID (public-safe fields only)
const findUserById = async (id) => {
  const query = `
    SELECT id, first_name, last_name, email, role, phone, is_active,
           two_factor_enabled, created_at
    FROM users WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Find user by ID including password (internal use only — e.g. disabling 2FA)
const findUserByIdWithPassword = async (id) => {
  const query = 'SELECT * FROM users WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Update last login time
const updateLastLogin = async (id) => {
  const query = 'UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1';
  await pool.query(query, [id]);
};

// Get all users (admin only)
const getAllUsers = async () => {
  const query = 'SELECT id, first_name, last_name, email, role, phone, is_active, created_at FROM users ORDER BY created_at DESC';
  const result = await pool.query(query);
  return result.rows;
};

// Update user
const updateUser = async (id, userData) => {
  const { firstName, lastName, phone, role, isActive } = userData;
  const query = `
    UPDATE users 
    SET first_name = $1, last_name = $2, phone = $3, role = $4, is_active = $5, updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING id, first_name, last_name, email, role, phone, is_active
  `;
  const values = [firstName, lastName, phone, role, isActive, id];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// ===== 2FA HELPERS =====

// Save a fresh OTP + expiry (5 min) for a user
const setTwoFactorOtp = async (id, otp) => {
  const query = `
    UPDATE users
    SET two_factor_otp = $1,
        two_factor_otp_expires = CURRENT_TIMESTAMP + INTERVAL '5 minutes'
    WHERE id = $2
  `;
  await pool.query(query, [otp, id]);
};

// Check a submitted OTP against the stored one for a user
const checkTwoFactorOtp = async (id, code) => {
  const query = `
    SELECT two_factor_otp, two_factor_otp_expires
    FROM users WHERE id = $1
  `;
  const result = await pool.query(query, [id]);
  const user = result.rows[0];

  if (!user || !user.two_factor_otp) return false;
  if (user.two_factor_otp !== code) return false;
  if (new Date(user.two_factor_otp_expires) < new Date()) return false;

  return true;
};

// Clear OTP fields after successful verification
const clearTwoFactorOtp = async (id) => {
  const query = `
    UPDATE users
    SET two_factor_otp = NULL, two_factor_otp_expires = NULL
    WHERE id = $1
  `;
  await pool.query(query, [id]);
};

// Turn 2FA on for a user
const enableTwoFactor = async (id) => {
  const query = `
    UPDATE users
    SET two_factor_enabled = true, two_factor_otp = NULL, two_factor_otp_expires = NULL
    WHERE id = $1
  `;
  await pool.query(query, [id]);
};

// Turn 2FA off for a user
const disableTwoFactor = async (id) => {
  const query = `
    UPDATE users
    SET two_factor_enabled = false, two_factor_otp = NULL, two_factor_otp_expires = NULL
    WHERE id = $1
  `;
  await pool.query(query, [id]);
};

// ===== PASSWORD RESET HELPERS =====

// Save a reset token + expiry (1 hour) for a user
const setResetToken = async (id, token) => {
  const query = `
    UPDATE users
    SET reset_token = $1,
        reset_token_expires = CURRENT_TIMESTAMP + INTERVAL '1 hour'
    WHERE id = $2
  `;
  await pool.query(query, [token, id]);
};

// Find user by reset token (must be valid and not expired)
const findUserByResetToken = async (token) => {
  const query = `
    SELECT * FROM users
    WHERE reset_token = $1
      AND reset_token_expires > CURRENT_TIMESTAMP
  `;
  const result = await pool.query(query, [token]);
  return result.rows[0];
};

// Clear reset token after use
const clearResetToken = async (id) => {
  const query = `
    UPDATE users
    SET reset_token = NULL,
        reset_token_expires = NULL
    WHERE id = $1
  `;
  await pool.query(query, [id]);
};

// Update user's password
const updatePassword = async (id, hashedPassword) => {
  const query = `
    UPDATE users
    SET password = $1,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
  `;
  await pool.query(query, [hashedPassword, id]);
};

// ===== NOTIFICATION HELPERS =====

// Get all active admin emails (for email notifications)
const getAllAdminEmails = async () => {
  const query = `
    SELECT email, first_name, last_name
    FROM users
    WHERE role = 'admin' AND is_active = true
    ORDER BY created_at ASC
  `;
  const result = await pool.query(query);
  return result.rows;
};

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByIdWithPassword,
  updateLastLogin,
  getAllUsers,
  updateUser,
  setTwoFactorOtp,
  checkTwoFactorOtp,
  clearTwoFactorOtp,
  enableTwoFactor,
  disableTwoFactor,
  setResetToken,
  findUserByResetToken,
  clearResetToken,
  updatePassword,
  getAllAdminEmails
};