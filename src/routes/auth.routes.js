const express = require('express');
const router = express.Router();

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { body, validationResult } = require('express-validator');

const {
  createUser,
  findUserByEmail,
  findUserById,
  findUserByIdWithPassword,
  updateLastLogin,
  setTwoFactorOtp,
  getTwoFactorOtp,
  clearTwoFactorOtp,
  enableTwoFactor,
  disableTwoFactor,
  setResetToken,
  findUserByResetToken,
  clearResetToken,
  updatePassword,
  recordFailedLogin
} = require('../models/user.model');

const {
  sendPasswordResetEmail
} = require('../utils/email');

const { sendStytchOtp, verifyStytchOtp } = require('../utils/stytch');
const { logActivity } = require('../utils/activityLog');

const {
  authenticate,
  authorize
} = require('../middleware/auth.middleware');

const pool = require('../config/database');

// Lock policy: after this many wrong passwords the account is locked for a while
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_MINUTES = 15;


// =====================================================
// HELPERS
// =====================================================

// Issue JWT + build login response shape
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
      phone: user.phone,
      mustChangePassword: !!user.must_change_password
    }
  };
};

// Message shown to a blocked person
const blockedMessage = (user) => {
  const reason = user.blocked_reason ? ` Reason: ${user.blocked_reason}.` : '';
  return `Your account has been blocked.${reason} Please contact IT support.`;
};

// Is the account currently locked? Also clears an expired lock so the counter starts fresh.
const checkLock = async (userId) => {
  const result = await pool.query(
    `SELECT (locked_until IS NOT NULL AND locked_until > CURRENT_TIMESTAMP) AS locked,
            (locked_until IS NOT NULL AND locked_until <= CURRENT_TIMESTAMP) AS expired,
            CEIL(EXTRACT(EPOCH FROM (locked_until - CURRENT_TIMESTAMP)) / 60)::int AS minutes_left
     FROM users WHERE id = $1`,
    [userId]
  );
  const row = result.rows[0] || {};

  if (row.expired) {
    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1',
      [userId]
    );
  }

  return { locked: !!row.locked, minutesLeft: row.minutes_left || 1 };
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

      // Unknown email: log it so IT can see guessing attempts
      if (!user) {
        await logActivity({
          action: 'LOGIN_FAILED',
          details: `Unknown email: ${email}`,
          ip: req.ip
        });
        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Temporarily locked after too many wrong passwords
      const lock = await checkLock(user.id);
      if (lock.locked) {
        return res.status(429).json({
          success: false,
          code: 'ACCOUNT_LOCKED',
          message: `Too many failed attempts. Try again in ${lock.minutesLeft} minute(s) or contact IT support.`
        });
      }

      // Wrong password: count it, flag it, lock if the limit is reached
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        const result = await recordFailedLogin(user.id, MAX_FAILED_ATTEMPTS, LOCK_MINUTES);
        const attempts = result ? result.failed_login_attempts : 0;

        await logActivity({
          action: 'LOGIN_FAILED',
          targetType: 'user',
          targetId: user.id,
          details: `Wrong password for ${user.email} (attempt ${attempts})`,
          ip: req.ip
        });

        if (attempts >= MAX_FAILED_ATTEMPTS) {
          await logActivity({
            action: 'ACCOUNT_LOCKED',
            targetType: 'user',
            targetId: user.id,
            details: `${user.email} locked for ${LOCK_MINUTES} minutes after ${attempts} failed sign-ins`,
            ip: req.ip
          });
          return res.status(429).json({
            success: false,
            code: 'ACCOUNT_LOCKED',
            message: `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`
          });
        }

        return res.status(401).json({
          success: false,
          message: 'Invalid email or password'
        });
      }

      // Correct password but the account is blocked: say so clearly.
      // (Checked after the password so strangers can't probe which accounts are blocked.)
      if (user.is_active === false) {
        await logActivity({
          action: 'LOGIN_BLOCKED',
          targetType: 'user',
          targetId: user.id,
          details: `Blocked account tried to sign in: ${user.email}`,
          ip: req.ip
        });
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_BLOCKED',
          message: blockedMessage(user)
        });
      }

      if (!process.env.JWT_SECRET) {
        console.error('JWT_SECRET is missing');
        return res.status(500).json({
          success: false,
          message: 'Server authentication configuration is missing'
        });
      }

      // === 2FA CHECK — uses Stytch OTP ===
      if (user.two_factor_enabled) {
        try {
          const emailId = await sendStytchOtp(user.email);
          await setTwoFactorOtp(user.id, emailId);
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

      if (user.role !== 'customer') {
        await logActivity({
          actor: user,
          action: 'LOGIN_SUCCESS',
          targetType: 'user',
          targetId: user.id,
          ip: req.ip
        });
      }

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
// VERIFY OTP — uses Stytch
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

      const user = await findUserByIdWithPassword(userId);
      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // A person blocked between password and code entry must not get in
      if (user.is_active === false) {
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_BLOCKED',
          message: blockedMessage(user)
        });
      }

      const emailId = await getTwoFactorOtp(userId);
      if (!emailId) {
        return res.status(401).json({
          success: false,
          message: 'No pending verification for this account'
        });
      }

      const isValid = await verifyStytchOtp(emailId, code);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          message: 'Invalid or expired verification code'
        });
      }

      await clearTwoFactorOtp(userId);
      await updateLastLogin(user.id);

      if (user.role !== 'customer') {
        await logActivity({
          actor: user,
          action: 'LOGIN_SUCCESS',
          targetType: 'user',
          targetId: user.id,
          details: 'Signed in with two-factor verification',
          ip: req.ip
        });
      }

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
// RESEND OTP — uses Stytch
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

    if (user.is_active === false) {
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BLOCKED',
        message: blockedMessage(user)
      });
    }

    const emailId = await sendStytchOtp(user.email);
    await setTwoFactorOtp(user.id, emailId);

    return res.json({ success: true, message: 'A new code has been sent to your email' });
  } catch (error) {
    console.error('RESEND OTP ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error resending code' });
  }
});


// =====================================================
// 2FA — SEND SETUP CODE — uses Stytch
// =====================================================
router.post('/2fa/send-setup-otp', authenticate, async (req, res) => {
  try {
    const user = await findUserByIdWithPassword(req.user.id);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const emailId = await sendStytchOtp(user.email);
    await setTwoFactorOtp(user.id, emailId);

    return res.json({ success: true, message: 'Verification code sent to your email' });
  } catch (error) {
    console.error('2FA SETUP OTP ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error sending verification code' });
  }
});


// =====================================================
// 2FA — CONFIRM ENABLE — uses Stytch
// =====================================================
router.post('/2fa/enable', authenticate, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Code is required' });
    }

    const emailId = await getTwoFactorOtp(req.user.id);
    if (!emailId) {
      return res.status(401).json({ success: false, message: 'No pending verification found' });
    }

    const isValid = await verifyStytchOtp(emailId, code);
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
// 2FA — DISABLE
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
// CHANGE PASSWORD (signed-in user)
// Also the way a person replaces the temporary password IT gave them.
// =====================================================
router.post(
  '/change-password',
  authenticate,
  [
    body('currentPassword').notEmpty().withMessage('Current password is required'),
    body('newPassword').isLength({ min: 8 }).withMessage('New password must be at least 8 characters')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: errors.array()[0].msg,
          errors: errors.array()
        });
      }

      const { currentPassword, newPassword } = req.body;

      const user = await findUserByIdWithPassword(req.user.id);
      if (!user) {
        return res.status(404).json({ success: false, message: 'User not found' });
      }

      const isMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isMatch) {
        return res.status(401).json({ success: false, message: 'Current password is incorrect' });
      }

      const sameAsOld = await bcrypt.compare(newPassword, user.password);
      if (sameAsOld) {
        return res.status(400).json({
          success: false,
          message: 'New password must be different from the current one'
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await updatePassword(user.id, hashedPassword); // also clears must_change_password

      await logActivity({
        actor: req.user,
        action: 'PASSWORD_CHANGED',
        targetType: 'user',
        targetId: user.id,
        oldValues: { must_change_password: !!user.must_change_password },
        newValues: { must_change_password: false },
        details: 'User changed their own password',
        ip: req.ip
      });

      return res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
      console.error('CHANGE PASSWORD ERROR:', error);
      return res.status(500).json({ success: false, message: 'Error changing password' });
    }
  }
);


// =====================================================
// FORGOT PASSWORD
// =====================================================
router.post(
  '/forgot-password',
  [
    body('email').trim().isEmail().withMessage('Please provide a valid email')
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Please provide a valid email'
        });
      }

      const email = req.body.email.trim().toLowerCase();
      const user = await findUserByEmail(email);

      if (!user) {
        return res.json({
          success: true,
          message: 'If an account exists with this email, a reset link has been sent.'
        });
      }

      const resetToken = crypto.randomBytes(32).toString('hex');
      await setResetToken(user.id, resetToken);

      const frontendUrl = process.env.FRONTEND_URL || 'https://glowbulk.vercel.app';
      const resetLink = frontendUrl + '/reset-password?token=' + resetToken;

      try {
        await sendPasswordResetEmail(user.email, resetLink);
      } catch (emailError) {
        console.error('Error sending reset email:', emailError);
        return res.status(500).json({
          success: false,
          message: 'Unable to send reset email. Please try again.'
        });
      }

      return res.json({
        success: true,
        message: 'If an account exists with this email, a reset link has been sent.'
      });

    } catch (error) {
      console.error('FORGOT PASSWORD ERROR:', error);
      return res.status(500).json({
        success: false,
        message: 'Error processing request'
      });
    }
  }
);


// =====================================================
// RESET PASSWORD (from the emailed link)
// =====================================================
router.post(
  '/reset-password',
  [
    body('token').notEmpty().withMessage('Token is required'),
    body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
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

      const { token, newPassword } = req.body;

      const user = await findUserByResetToken(token);
      if (!user) {
        return res.status(400).json({
          success: false,
          message: 'Invalid or expired reset link'
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      await updatePassword(user.id, hashedPassword);
      await clearResetToken(user.id);

      await logActivity({
        actor: user,
        action: 'PASSWORD_RESET_BY_LINK',
        targetType: 'user',
        targetId: user.id,
        details: 'Password reset using the emailed link',
        ip: req.ip
      });

      return res.json({
        success: true,
        message: 'Password reset successfully. You can now log in.'
      });

    } catch (error) {
      console.error('RESET PASSWORD ERROR:', error);
      return res.status(500).json({
        success: false,
        message: 'Error resetting password'
      });
    }
  }
);


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
// GET ALL USERS — ADMIN ONLY
// =====================================================
router.get('/users', authenticate, authorize('admin'), async (req, res) => {
  try {
    const query = `
      SELECT id, first_name, last_name, email, role, phone, is_active, last_login, created_at
      FROM users
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query);
    return res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('ERROR FETCHING USERS:', error);
    return res.status(500).json({ success: false, message: 'Error fetching users' });
  }
});


module.exports = router;
