const jwt = require('jsonwebtoken');
const { findUserById } = require('../models/user.model');

// Routes a user may call while they still must change a temporary password
const PASSWORD_CHANGE_ALLOWED = ['/api/auth/me', '/api/auth/change-password'];

const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Please login first.'
      });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Loaded from the database on every request, so a block applies on the next click
    const user = await findUserById(decoded.id);
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found.'
      });
    }

    if (!user.is_active) {
      const reason = user.blocked_reason
        ? ` Reason: ${user.blocked_reason}.`
        : '';
      return res.status(403).json({
        success: false,
        code: 'ACCOUNT_BLOCKED',
        message: `Your account has been blocked.${reason} Please contact IT support.`
      });
    }

    // Temporary password: only allow the password-change routes until it is changed
    if (user.must_change_password) {
      const path = req.originalUrl.split('?')[0];
      if (!PASSWORD_CHANGE_ALLOWED.includes(path)) {
        return res.status(403).json({
          success: false,
          code: 'PASSWORD_CHANGE_REQUIRED',
          message: 'You must change your temporary password before continuing.'
        });
      }
    }

    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token. Please login again.'
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expired. Please login again.'
      });
    }
    console.error('Authentication error:', error);
    return res.status(500).json({
      success: false,
      message: 'Authentication error.'
    });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Not authenticated.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Requires role: ${roles.join(', ')}`
      });
    }

    next();
  };
};

module.exports = {
  authenticate,
  authorize
};