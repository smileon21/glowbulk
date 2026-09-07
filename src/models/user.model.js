const pool = require('../config/database');
const bcrypt = require('bcryptjs');

// Create a new user
const createUser = async (userData) => {
  const { firstName, lastName, email, password, role = 'customer', phone } = userData;
  
  // Hash the password
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

// Find user by email
const findUserByEmail = async (email) => {
  const query = 'SELECT * FROM users WHERE email = $1';
  const result = await pool.query(query, [email]);
  return result.rows[0];
};

// Find user by ID
const findUserById = async (id) => {
  const query = 'SELECT id, first_name, last_name, email, role, phone, is_active, created_at FROM users WHERE id = $1';
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

module.exports = {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLogin,
  getAllUsers,
  updateUser
};