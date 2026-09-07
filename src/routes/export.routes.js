const express = require('express');
const router = express.Router();
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { 
  exportCustomers, 
  exportMonthlyReport,
  exportMonthlyOrdersReport 
} = require('../controllers/export.controller');

// All export routes require authentication and admin/marketing role
router.use(authenticate, authorize('admin', 'marketing'));

// Export all customers to Excel
router.get('/customers', exportCustomers);

// Export monthly customer report
router.get('/monthly-report', exportMonthlyReport);

// Export monthly orders report
router.get('/monthly-orders-report', exportMonthlyOrdersReport);

module.exports = router;