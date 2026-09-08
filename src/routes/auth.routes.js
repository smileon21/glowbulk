const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const {
  createUser,
  findUserByEmail,
  updateLastLogin,
  findUserById
} = require('../models/user.model');

const {
  authenticate,
  authorize
} = require('../middleware/auth.middleware');

const pool = require('../config/database');


// =====================================================
// REGISTER
// =====================================================

router.post(
  '/register',
  [
    body('firstName')
      .trim()
      .notEmpty()
      .withMessage('First name is required'),

    body('lastName')
      .trim()
      .notEmpty()
      .withMessage('Last name is required'),

    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email'),

    body('password')
      .isLength({ min: 6 })
      .withMessage('Password must be at least 6 characters')
  ],

  async (req, res) => {

    try {

      // Validate request
      const errors = validationResult(req);

      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }


      // Get data
      const firstName = req.body.firstName.trim();
      const lastName = req.body.lastName.trim();
      const email = req.body.email.trim().toLowerCase();
      const password = req.body.password;
      const phone = req.body.phone || null;


      // IMPORTANT:
      // Customers should not be able to register themselves as admin.
      const role = 'customer';


      // Check existing user
      const existingUser = await findUserByEmail(email);

      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }


      // Create user
      const user = await createUser({
        firstName,
        lastName,
        email,
        password,
        role,
        phone
      });


      return res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: user
      });

    } catch (error) {

      console.error('REGISTER ERROR:', error);

      return res.status(500).json({
        success: false,
        message: 'Error registering user',
        error: process.env.NODE_ENV === 'development'
          ? error.message
          : undefined
      });
    }
  }
);


// =====================================================
// LOGIN
// =====================================================

router.post(
  '/login',

  [
    body('email')
      .trim()
      .isEmail()
      .withMessage('Please provide a valid email'),

    body('password')
      .notEmpty()
      .withMessage('Password is required')
  ],

  async (req, res) => {

    try {

      // Validate request
      const errors = validationResult(req);

      if (!errors.isEmpty()) {

        return res.status(400).json({
          success: false,
          message: 'Invalid login details',
          errors: errors.array()
        });

      }


      // Clean login information
      const email = req.body.email.trim().toLowerCase();
      const password = req.body.password;


      console.log('LOGIN ATTEMPT:', email);


      // Find user
      const user = await findUserByEmail(email);


      // User does not exist
      if (!user) {

        console.log('LOGIN FAILED: User not found');

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }


      console.log(
        'USER FOUND:',
        user.id,
        user.email,
        user.role
      );


      // Check active status
      if (user.is_active === false) {

        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }


      // Check password
      const isMatch = await bcrypt.compare(
        password,
        user.password
      );


      if (!isMatch) {

        console.log('LOGIN FAILED: Password does not match');

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }


      // Update last login
      await updateLastLogin(user.id);


      // Make sure JWT_SECRET exists
      if (!process.env.JWT_SECRET) {

        console.error('JWT_SECRET is missing');

        return res.status(500).json({
          success: false,
          message: 'Server authentication configuration is missing'
        });
      }


      // Create token
      const token = jwt.sign(
        {
          id: user.id,
          email: user.email,
          role: user.role
        },

        process.env.JWT_SECRET,

        {
          expiresIn: process.env.JWT_EXPIRE || '7d'
        }
      );


      console.log('LOGIN SUCCESS:', user.email);


      // Send response
      return res.status(200).json({

        success: true,

        message: 'Login successful',

        data: {

          token,

          user: {
            id: user.id,
            firstName: user.first_name,
            lastName: user.last_name,
            email: user.email,
            role: user.role,
            phone: user.phone
          }

        }

      });

    } catch (error) {

      console.error('LOGIN ERROR:', error);

      return res.status(500).json({

        success: false,

        message: 'Error logging in',

        error:
          process.env.NODE_ENV === 'development'
            ? error.message
            : undefined

      });
    }
  }
);


// =====================================================
// CURRENT USER
// =====================================================

router.get(
  '/me',
  authenticate,

  async (req, res) => {

    try {

      const user = await findUserById(req.user.id);


      if (!user) {

        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }


      return res.json({
        success: true,
        data: user
      });

    } catch (error) {

      console.error('ERROR FETCHING USER:', error);

      return res.status(500).json({
        success: false,
        message: 'Error fetching user profile'
      });
    }
  }
);


// =====================================================
// GET ALL USERS - ADMIN ONLY
// =====================================================

router.get(
  '/users',
  authenticate,
  authorize('admin'),

  async (req, res) => {

    try {

      const query = `
        SELECT
          id,
          first_name,
          last_name,
          email,
          role,
          phone,
          is_active,
          last_login,
          created_at
        FROM users
        ORDER BY created_at DESC
      `;


      const result = await pool.query(query);


      const formattedUsers = result.rows.map(user => ({

        id: user.id,

        firstName: user.first_name,

        lastName: user.last_name,

        name: `${user.first_name} ${user.last_name}`,

        email: user.email,

        role: user.role,

        phone: user.phone,

        isActive: user.is_active,

        lastLogin: user.last_login,

        createdAt: user.created_at

      }));


      return res.json({

        success: true,

        data: formattedUsers

      });

    } catch (error) {

      console.error('ERROR FETCHING USERS:', error);

      return res.status(500).json({

        success: false,

        message: 'Error fetching users'

      });
    }
  }
);


module.exports = router;