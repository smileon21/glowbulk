const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  createFuelRequest,
  getFuelRequestsByCustomer,
  getFuelRequestById,
  getAllFuelRequests,
  updateFuelRequestStatus,
  updateFuelRequest
} = require('../models/fuelRequest.model');
const { getCustomerByUserId } = require('../models/customer.model');
const pool = require('../config/database');

// Customer: Create fuel request
router.post('/', authenticate, [
  body('fuelType').notEmpty().withMessage('Fuel type is required'),
  body('quantity').isNumeric().withMessage('Quantity must be a number'),
  body('preferredDeliveryDate').notEmpty().withMessage('Delivery date is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Get customer profile
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found. Please create your profile first.'
      });
    }

    const fuelRequest = await createFuelRequest({
      customerId: customer.id,
      ...req.body
    });

    res.status(201).json({
      success: true,
      message: 'Fuel request submitted successfully',
      data: fuelRequest
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error creating fuel request',
      error: error.message
    });
  }
});

// Customer: Get my fuel requests
router.get('/my-requests', authenticate, async (req, res) => {
  try {
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    const requests = await getFuelRequestsByCustomer(customer.id);
    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching fuel requests',
      error: error.message
    });
  }
});

// Marketing/Admin: Get all fuel requests
router.get('/all', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const requests = await getAllFuelRequests();
    res.json({
      success: true,
      count: requests.length,
      data: requests
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching fuel requests',
      error: error.message
    });
  }
});

// =============================================
// NEW: Get fuel requests available for quotation
// =============================================
router.get('/available-for-quote', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const query = `
      SELECT fr.*, u.first_name, u.last_name, c.company_name 
      FROM fuel_requests fr
      JOIN customers c ON fr.customer_id = c.id
      JOIN users u ON c.user_id = u.id
      WHERE fr.status = 'pending' 
        AND NOT EXISTS (
          SELECT 1 FROM quotations q 
          WHERE q.fuel_request_id = fr.id 
            AND q.status IN ('draft', 'sent', 'accepted')
        )
      ORDER BY fr.created_at DESC
    `;
    const result = await pool.query(query);
    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching available fuel requests:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching available fuel requests',
      error: error.message
    });
  }
});

// Get single fuel request
router.get('/:id', authenticate, async (req, res) => {
  try {
    const request = await getFuelRequestById(req.params.id);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fuel request not found'
      });
    }

    // Check if user has access
    const customer = await getCustomerByUserId(req.user.id);
    if (req.user.role === 'customer' && request.customer_id !== customer?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error fetching fuel request',
      error: error.message
    });
  }
});

// Update fuel request status (Marketing/Admin only)
router.put('/:id/status', authenticate, authorize('admin', 'marketing'), [
  body('status').isIn(['pending', 'quoted', 'accepted', 'rejected', 'expired']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const request = await updateFuelRequestStatus(req.params.id, req.body.status);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fuel request not found'
      });
    }

    res.json({
      success: true,
      message: 'Fuel request status updated',
      data: request
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error updating fuel request status',
      error: error.message
    });
  }
});

// DELETE: Delete fuel request
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const requestId = req.params.id;
    
    // Get the fuel request
    const request = await getFuelRequestById(requestId);
    if (!request) {
      return res.status(404).json({
        success: false,
        message: 'Fuel request not found'
      });
    }

    // Check if user owns this request (customer) or is admin
    const customer = await getCustomerByUserId(req.user.id);
    
    // If customer, check if they own it
    if (req.user.role === 'customer') {
      if (!customer || request.customer_id !== customer.id) {
        return res.status(403).json({
          success: false,
          message: 'You can only delete your own fuel requests'
        });
      }
      
      // Only allow deletion if status is 'pending'
      if (request.status !== 'pending') {
        return res.status(400).json({
          success: false,
          message: 'Only pending requests can be deleted'
        });
      }
    }

    // Admin/Marketing can delete any request
    const query = 'DELETE FROM fuel_requests WHERE id = $1 RETURNING id';
    const result = await pool.query(query, [requestId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Fuel request not found'
      });
    }

    res.json({
      success: true,
      message: 'Fuel request deleted successfully',
      data: { id: parseInt(requestId) }
    });
  } catch (error) {
    console.error('Delete fuel request error:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting fuel request',
      error: error.message
    });
  }
});

module.exports = router;