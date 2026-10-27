const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
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
} = require('../controllers/admin.controller');

// Returns the first validation error as `message`, plus the full list as `errors`
const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: errors.array()[0].msg,
      errors: errors.array()
    });
  }
  next();
};

// All admin (IT) routes require authentication and the admin role
router.use(authenticate, authorize('admin'));

// ---------- Own profile ----------
router.get('/profile', getAdminProfile);

router.put('/profile', [
  body('name').notEmpty().withMessage('Name is required'),
  body('email').isEmail().withMessage('Valid email is required')
], validate, updateAdminProfile);

// ---------- Dashboard ----------
router.get('/dashboard/stats', getDashboardStats);
router.get('/suspicious-activity', getSuspiciousActivity);

// ---------- Activity log ----------
router.get('/activity-log', getActivityLog);

// ---------- Users ----------
// List: ?role=staff|admin|marketing|pricing|finance|customer&status=active|blocked&search=text
router.get('/users', getSystemUsers);

// Create a staff account (temporary password returned once)
router.post('/users', [
  body('firstName').trim().notEmpty().withMessage('First name is required'),
  body('lastName').trim().notEmpty().withMessage('Last name is required'),
  body('email').trim().isEmail().withMessage('Valid email is required'),
  body('role')
    .isIn(['admin', 'marketing', 'pricing', 'finance'])
    .withMessage('Role must be IT, marketing, pricing or finance')
], validate, createStaffUser);

// Reset a staff password (new temporary password returned once)
router.put('/users/:userId/reset-password', resetStaffPassword);

// Change a staff email
router.put('/users/:userId/email', [
  body('email').trim().isEmail().withMessage('Valid email is required')
], validate, changeStaffEmail);

// Block / unblock any account, customers included
router.put('/users/:userId/block', [
  body('reason').trim().isLength({ min: 3, max: 500 }).withMessage('A reason (3 to 500 characters) is required')
], validate, blockAccount);

router.put('/users/:userId/unblock', unblockAccount);

// Old activate/deactivate endpoint, kept for the current AdminManagement page
router.put('/users/:userId/status', [
  body('status').isIn(['active', 'inactive']).withMessage('Status must be active or inactive')
], validate, updateUserStatus);

// Delete user
router.delete('/users/:userId', deleteUser);

module.exports = router;