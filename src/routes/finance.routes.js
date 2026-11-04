const express = require('express');
const router = express.Router();
const { body, param, validationResult } = require('express-validator');
const multer = require('multer');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const { uploadToSupabase } = require('../utils/supabaseUpload');
const {
  accountName,
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  setPaymentMethodActive,
  getValidTaxClearance,
  getLatestTaxClearance,
  getTaxClearanceHistory,
  addTaxClearance
} = require('../models/finance.model');

// Everyone who sees quotations and orders may read the payment details
const READERS = ['customer', 'marketing', 'pricing', 'finance'];

// Tax clearance certificate: PDF only
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB
  fileFilter: function(req, file, cb) {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('The tax clearance certificate must be a PDF file'));
    }
  }
});

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  }
  next();
};

const METHOD_TYPES = ['bank', 'mobile_money', 'cash', 'other'];

// Validators shared by add and edit
const methodValidators = [
  body('method_type').isIn(METHOD_TYPES).withMessage('Choose a valid payment method type'),
  body('title').trim().notEmpty().withMessage('Title is required').isLength({ max: 100 }),
  body('currency').optional({ nullable: true }).trim().isLength({ max: 10 }),
  body('bank_name').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('account_name').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('account_number').optional({ nullable: true }).trim().isLength({ max: 60 }),
  body('branch').optional({ nullable: true }).trim().isLength({ max: 100 }),
  body('swift_code').optional({ nullable: true }).trim().isLength({ max: 30 }),
  body('mobile_number').optional({ nullable: true }).trim().isLength({ max: 30 }),
  body('instructions').optional({ nullable: true }).trim().isLength({ max: 500 }),
  body('sort_order').optional({ nullable: true }).isInt().withMessage('Order must be a whole number'),
  body().custom(function(value) {
    if (value.method_type === 'bank' && (!value.bank_name || !value.account_number)) {
      throw new Error('A bank account needs a bank name and an account number');
    }
    if (value.method_type === 'mobile_money' && !value.mobile_number) {
      throw new Error('Mobile money needs a mobile number');
    }
    return true;
  }),
  handleValidation
];

// =====================================================
// PAYMENT METHODS
// =====================================================

// Active methods: shown to customers on quotations and when they pay
router.get('/payment-methods/active', authenticate, authorize(...READERS), async (req, res) => {
  try {
    const data = await getPaymentMethods(true);
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('Error fetching active payment methods:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment methods' });
  }
});

// All methods including switched-off ones: finance only
router.get('/payment-methods', authenticate, authorize('finance'), async (req, res) => {
  try {
    const data = await getPaymentMethods(false);
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('Error fetching payment methods:', error);
    res.status(500).json({ success: false, message: 'Error fetching payment methods' });
  }
});

router.post('/payment-methods', authenticate, authorize('finance'), methodValidators, async (req, res) => {
  try {
    const created = await createPaymentMethod(req.body, accountName(req.user));
    res.status(201).json({ success: true, message: 'Payment method added', data: created });
  } catch (error) {
    console.error('Error adding payment method:', error);
    res.status(500).json({ success: false, message: 'Error adding payment method' });
  }
});

router.put('/payment-methods/:id', authenticate, authorize('finance'), [
  param('id').isInt().withMessage('Invalid payment method ID'),
  ...methodValidators
], async (req, res) => {
  try {
    const updated = await updatePaymentMethod(req.params.id, req.body, accountName(req.user));
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }
    res.json({ success: true, message: 'Payment method updated', data: updated });
  } catch (error) {
    console.error('Error updating payment method:', error);
    res.status(500).json({ success: false, message: 'Error updating payment method' });
  }
});

// Switch a method on or off (nothing is deleted)
router.patch('/payment-methods/:id/active', authenticate, authorize('finance'), [
  param('id').isInt().withMessage('Invalid payment method ID'),
  body('is_active').isBoolean().withMessage('is_active must be true or false'),
  handleValidation
], async (req, res) => {
  try {
    const isActive = req.body.is_active === true || req.body.is_active === 'true';
    const updated = await setPaymentMethodActive(req.params.id, isActive, accountName(req.user));
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Payment method not found' });
    }
    res.json({ success: true, message: isActive ? 'Payment method switched on' : 'Payment method switched off', data: updated });
  } catch (error) {
    console.error('Error switching payment method:', error);
    res.status(500).json({ success: false, message: 'Error updating payment method' });
  }
});

// =====================================================
// TAX CLEARANCE
// =====================================================

// Customers and staff: the current certificate, or null once it has expired
router.get('/tax-clearance/current', authenticate, authorize(...READERS), async (req, res) => {
  try {
    const data = await getValidTaxClearance();
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('Error fetching tax clearance:', error);
    res.status(500).json({ success: false, message: 'Error fetching tax clearance' });
  }
});

// Finance: the current certificate even if expired, plus the history
router.get('/tax-clearance/latest', authenticate, authorize('finance'), async (req, res) => {
  try {
    const data = await getLatestTaxClearance();
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('Error fetching latest tax clearance:', error);
    res.status(500).json({ success: false, message: 'Error fetching tax clearance' });
  }
});

router.get('/tax-clearance/history', authenticate, authorize('finance'), async (req, res) => {
  try {
    const data = await getTaxClearanceHistory();
    res.json({ success: true, data: data });
  } catch (error) {
    console.error('Error fetching tax clearance history:', error);
    res.status(500).json({ success: false, message: 'Error fetching tax clearance history' });
  }
});

// Finance: upload a new certificate. The text fields come after multer has parsed the form.
router.post('/tax-clearance', authenticate, authorize('finance'), upload.single('certificateFile'), [
  body('certificateNumber')
    .trim()
    .notEmpty().withMessage('Enter the certificate number')
    .isLength({ max: 100 }).withMessage('Certificate number must be 100 characters or less'),
  body('expiryDate').isISO8601().withMessage('Enter a valid expiry date'),
  handleValidation
], async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Choose the certificate PDF to upload' });
    }

    // The expiry date must be today or later
    const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Africa/Harare' });
    if (req.body.expiryDate.slice(0, 10) < today) {
      return res.status(400).json({ success: false, message: 'The expiry date has already passed' });
    }

    const { url } = await uploadToSupabase(
      req.file.buffer,
      req.file.originalname,
      'tax-clearance',
      req.file.mimetype
    );

    const created = await addTaxClearance(
      req.body.certificateNumber,
      req.body.expiryDate.slice(0, 10),
      url,
      accountName(req.user)
    );

    res.status(201).json({ success: true, message: 'Tax clearance certificate uploaded', data: created });
  } catch (error) {
    console.error('Error uploading tax clearance:', error);
    res.status(500).json({ success: false, message: 'Error uploading tax clearance', error: error.message });
  }
});

module.exports = router;
