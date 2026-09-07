const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  getDashboardStats,
  getSystemUsers,
  getAdminProfile,
  updateAdminProfile,
  updateUserStatus,
  deleteUser
} = require('../controllers/admin.controller');

// All admin routes require authentication and admin role
router.use(authenticate, authorize('admin'));

// Get admin profile
router.get('/profile', getAdminProfile);

// Update admin profile
router.put('/profile', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  await updateAdminProfile(req, res);
});

// Get dashboard stats
router.get('/dashboard/stats', getDashboardStats);

// Get all system users
router.get('/users', getSystemUsers);

// Update user status
router.put('/users/:userId/status', [
  body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
], async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      errors: errors.array()
    });
  }
  await updateUserStatus(req, res);
});

// Delete user
router.delete('/users/:userId', deleteUser);

module.exports = router;