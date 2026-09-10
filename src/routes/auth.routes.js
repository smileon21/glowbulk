const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');

const {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByIdWithPassword,
  updateLastLogin,
  setTwoFactorOtp,
  checkTwoFactorOtp,
  clearTwoFactorOtp,
  enableTwoFactor,
  disableTwoFactor
} = require('../models/user.model');

const { sendOtpEmail, generateOtp } = require('../utils/email');

const {
  authenticate,
  authorize
} = require('../middleware/auth.middleware');

const pool = require('../config/database');


// Helper to issue a JWT + build the login response shape
const issueLoginResponse = (user) => {
  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '7d' }
  );

  return {
    token,
    user: {
      id: user.id,
      firstName: user.first_name,
      lastName: user.last_name,
      email: user.email,
      role: user.role,
      phone: user.phone
    }
  };
};


// =====================================================
// REGISTER
// =====================================================

router.post(
  '/register',
  [
    body('firstName').trim().notEmpty().withMessage('First name is required'),
    body('lastName').trim().notEmpty().withMessage('Last name is required'),
    body('email').trim().isEmail().withMessage('Please provide a valid email'),
    body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: errors.array()
        });
      }

      const firstName = req.body.firstName.trim();
      const lastName = req.body.lastName.trim();
      const email = req.body.email.trim().toLowerCase();
      const password = req.body.password;
      const phone = req.body.phone || null;

      const role = 'customer';

      const existingUser = await findUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({
          success: false,
          message: 'User with this email already exists'
        });
      }

      const user = await createUser({ firstName, lastName, email, password, role, phone });

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
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
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
    body('email').trim().isEmail().withMessage('Please provide a valid email'),
    body('password').notEmpty().withMessage('Password is required')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid login details',
          errors: errors.array()
        });
      }

      const email = req.body.email.trim().toLowerCase();
      const password = req.body.password;

      const user = await findUserByEmail(email);

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (user.is_active === false) {
        return res.status(403).json({
          success: false,
          message: 'Account is deactivated. Please contact support.'
        });
      }

      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is missing');
        return res.status(500).json({
          success: false,
          message: 'Server authentication configuration is missing'
        });
      }

      // === 2FA CHECK ===
      if (user.two_factor_enabled) {
        const otp = generateOtp();
        await setTwoFactorOtp(user.id, otp);

        try {
          await sendOtpEmail(user.email, otp);
        } catch (emailError) {
          console.error('Error sending OTP email:', emailError);
          return res.status(500).json({
            success: false,
            message: 'Unable to send verification code. Please try again.'
          });
        }

        return res.status(200).json({
          success: true,
          message: 'Verification code sent to your email',
          data: {
            requiresTwoFactor: true,
            userId: user.id
          }
        });
      }

      // No 2FA — log in normally
      await updateLastLogin(user.id);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: issueLoginResponse(user)
      });
    } catch (error) {
      console.error('LOGIN ERROR:', error);
      return res.status(500).json({
        success: false,
        message: 'Error logging in',
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);


// =====================================================
// VERIFY OTP (completes login when 2FA is enabled)
// =====================================================

router.post(
  '/verify-otp',
  [
    body('userId').notEmpty().withMessage('User ID is required'),
    body('code').isLength({ min: 6, max: 6 }).withMessage('Code must be 6 digits')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Invalid request',
          errors: errors.array()
        });
      }

      const { userId, code } = req.body;

      const isValid = await checkTwoFactorOtp(userId, code);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      await clearTwoFactorOtp(userId);

      const user = await findUserByIdWithPassword(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      await updateLastLogin(user.id);

      return res.status(200).json({
        success: true,
        message: 'Login successful',
        data: issueLoginResponse(user)
      });
    } catch (error) {
      console.error('VERIFY OTP ERROR:', error);
      return res.status(500).json({
        success: false,
        message: 'Error verifying code'
      });
    }
  }
);


// =====================================================
// RESEND OTP
// =====================================================

router.post('/resend-otp', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, message: 'User ID is required' });
    }

    const user = await findUserByIdWithPassword(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = generateOtp();
    await setTwoFactorOtp(user.id, otp);
    await sendOtpEmail(user.email, otp);

    return res.json({ success: true, message: 'A new code has been sent to your email' });
  } catch (error) {
    console.error('RESEND OTP ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error resending code' });
  }
});


// =====================================================
// 2FA — SEND SETUP CODE (authenticated user enabling 2FA)
// =====================================================

router.post('/2fa/send-setup-otp', authenticate, async (req, res) => {
  try {
    const user = await findUserByIdWithPassword(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const otp = generateOtp();
    await setTwoFactorOtp(user.id, otp);
    await sendOtpEmail(user.email, otp);

    return res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('2FA SETUP OTP ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error sending verification code' });
  }
});


// =====================================================
// 2FA — CONFIRM ENABLE
// =====================================================

router.post('/2fa/enable', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const isValid = await checkTwoFactorOtp(req.user.id, code);
    if (!isValid) {
      return res.status(401).json({ success: false, message: 'Invalid or expired code' });
    }

    await enableTwoFactor(req.user.id);

    return res.json({ success: true, message: 'Two-factor authentication enabled' });
  } catch (error) {
    console.error('2FA ENABLE ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error enabling two-factor authentication' });
  }
});


// =====================================================
// 2FA — DISABLE (requires password confirmation)
// =====================================================

router.post('/2fa/disable', authenticate, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: 'Password is required' });
    }

    const user = await findUserByIdWithPassword(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Incorrect password' });
    }

    await disableTwoFactor(req.user.id);

    return res.json({ success: true, message: 'Two-factor authentication disabled' });
  } catch (error) {
    console.error('2FA DISABLE ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error disabling two-factor authentication' });
  }
});


// =====================================================
// CURRENT USER
// =====================================================

router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await findUserById(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }
    return res.json({ success: true, data: user });
  } catch (error) {
    console.error('ERROR FETCHING USER:', error);
    return res.status(500).json({ success: false, message: 'Error fetching user profile' });
  }
});


// =====================================================
// GET ALL USERS - ADMIN ONLY
// =====================================================

router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const query = `
      SELECT id, first_name, last_name, email, role, phone, is_active, last_login, created_at
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

    return res.json({ success: true, data: formattedUsers });
  } catch (error) {
    console.error('ERROR FETCHING USERS:', error);
    return res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});


module.exports = router;