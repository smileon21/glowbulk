const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  createCustomer,
  getCustomerByUserId,
  getCustomerById,
  getAllCustomers,
  updateCustomer
} = require('../models/customer.model');

// Create customer profile (authenticated user)
router.post('/profile', authenticate, [
  body('company_name').notEmpty().withMessage('Company name is required'),
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

// Update own customer profile
router.put('/profile/me', authenticate, async (req, res) => {
  try {
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    const updatedCustomer = await updateCustomer(customer.id, req.body);
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

// Admin: Get all customers
router.get('/', authenticate, authorize('admin', 'marketing'), async (req, res) => {
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

// Admin: Get customer by ID
router.get('/:id', authenticate, authorize('admin', 'marketing'), async (req, res) => {
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

module.exports = router;