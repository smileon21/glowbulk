const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  createCustomer,
  getCustomerByUserId,
  getCustomerById,
  getAllCustomers,
  getPendingCustomers,
  updateCustomerProfile,
  verifyCustomer,
  rejectCustomer,
  updateCustomerDiscount
} = require('../models/customer.model');
const { logActivity } = require('../utils/activityLog');

// Business staff. IT ("admin") is deliberately not in this list.
const STAFF = ['marketing', 'pricing', 'finance'];

// Name shown in logs: company if there is one, otherwise the contact person
const customerLabel = (customer) =>
  customer.company_name || customer.contact_person_name || `customer #${customer.id}`;

// Create customer profile (authenticated user).
// Normally the profile is created at registration; this is only for older accounts without one.
router.post('/profile', authenticate, [
  body('contact_person_name').notEmpty().withMessage('Contact person name is required'),
  body('contact_person_email').isEmail().withMessage('Valid contact email is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Check if customer already exists
    const existingCustomer = await getCustomerByUserId(req.user.id);
    if (existingCustomer) {
      return res.status(400).json({
        success: false,
        message: 'Customer profile already exists'
      });
    }

    const customer = await createCustomer({
      userId: req.user.id,
      ...req.body
    });

    res.status(201).json({
      success: true,
      message: 'Customer profile created successfully',
      data: customer
    });
  } catch (error) {
    console.error('Error creating customer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating customer profile',
      error: error.message
    });
  }
});

// Get own customer profile
router.get('/profile/me', authenticate, async (req, res) => {
  try {
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer profile',
      error: error.message
    });
  }
});

// Update own customer profile.
// Only whitelisted fields are changed (see PROFILE_FIELDS in the model), so a customer
// can never change their own status, discount, category or credit limit.
router.put('/profile/me', authenticate, async (req, res) => {
  try {
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    const updatedCustomer = await updateCustomerProfile(customer.id, req.body);
    res.json({
      success: true,
      message: 'Customer profile updated successfully',
      data: updatedCustomer
    });
  } catch (error) {
    console.error('Error updating customer profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating customer profile',
      error: error.message
    });
  }
});

// Staff: Get all customers
router.get('/', authenticate, authorize(...STAFF), async (req, res) => {
  try {
    const customers = await getAllCustomers();
    res.json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customers',
      error: error.message
    });
  }
});

// Marketing: customers waiting for verification.
// Must stay above '/:id' or "pending" would be read as an id.
router.get('/pending', authenticate, authorize('marketing'), async (req, res) => {
  try {
    const customers = await getPendingCustomers();
    res.json({
      success: true,
      count: customers.length,
      data: customers
    });
  } catch (error) {
    console.error('Error fetching pending customers:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending customers'
    });
  }
});

// Staff: Get customer by ID
router.get('/:id', authenticate, authorize(...STAFF), async (req, res) => {
  try {
    const customer = await getCustomerById(req.params.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }
    res.json({
      success: true,
      data: customer
    });
  } catch (error) {
    console.error('Error fetching customer:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching customer',
      error: error.message
    });
  }
});

// Marketing: approve a customer, set category and discount (cents per litre)
router.post('/:id/verify', authenticate, authorize('marketing'), [
  body('category').isIn(['regular', 'long_term']).withMessage('Invalid category'),
  body('discountCentsPerLitre').isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100 cents per litre')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const before = await getCustomerById(req.params.id);
    if (!before) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = await verifyCustomer(req.params.id, {
      category: req.body.category,
      discountCentsPerLitre: req.body.discountCentsPerLitre,
      verifiedBy: req.user.id
    });

    await logActivity({
      actor: req.user,
      action: 'CUSTOMER_VERIFIED',
      targetType: 'customer',
      targetId: customer.id,
      oldValues: { verification_status: before.verification_status },
      newValues: {
        verification_status: 'verified',
        category: customer.category,
        discount_cents_per_litre: customer.discount_cents_per_litre
      },
      details: `Verified ${customerLabel(customer)}`,
      ip: req.ip
    });

    // TODO: send the customer an "account approved" notification here

    res.json({ success: true, message: 'Customer verified', data: customer });
  } catch (error) {
    console.error('Error verifying customer:', error);
    res.status(500).json({ success: false, message: 'Error verifying customer' });
  }
});

// Marketing: reject a customer
router.post('/:id/reject', authenticate, authorize('marketing'), [
  body('reason').trim().notEmpty().withMessage('Please give a reason')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const before = await getCustomerById(req.params.id);
    if (!before) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = await rejectCustomer(req.params.id, {
      reason: req.body.reason.trim(),
      rejectedBy: req.user.id
    });

    await logActivity({
      actor: req.user,
      action: 'CUSTOMER_REJECTED',
      targetType: 'customer',
      targetId: customer.id,
      oldValues: { verification_status: before.verification_status },
      newValues: { verification_status: 'rejected' },
      details: `Rejected ${customerLabel(customer)}: ${req.body.reason.trim()}`,
      ip: req.ip
    });

    res.json({ success: true, message: 'Customer rejected', data: customer });
  } catch (error) {
    console.error('Error rejecting customer:', error);
    res.status(500).json({ success: false, message: 'Error rejecting customer' });
  }
});

// Marketing: change a verified customer's discount later
router.put('/:id/discount', authenticate, authorize('marketing'), [
  body('discountCentsPerLitre').isFloat({ min: 0, max: 100 })
    .withMessage('Discount must be between 0 and 100 cents per litre')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    const before = await getCustomerById(req.params.id);
    if (!before) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    const customer = await updateCustomerDiscount(req.params.id, req.body.discountCentsPerLitre);

    await logActivity({
      actor: req.user,
      action: 'CUSTOMER_DISCOUNT_CHANGED',
      targetType: 'customer',
      targetId: customer.id,
      oldValues: { discount_cents_per_litre: before.discount_cents_per_litre },
      newValues: { discount_cents_per_litre: customer.discount_cents_per_litre },
      details: `Discount changed for ${customerLabel(customer)}`,
      ip: req.ip
    });

    res.json({ success: true, data: customer });
  } catch (error) {
    console.error('Error changing discount:', error);
    res.status(500).json({ success: false, message: 'Error changing discount' });
  }
});

module.exports = router;