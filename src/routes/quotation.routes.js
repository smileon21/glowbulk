const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  createQuotation,
  getQuotationById,
  getQuotationsByCustomer,
  getAllQuotations,
  updateQuotationStatus
} = require('../models/quotation.model');
const { getCustomerByUserId } = require('../models/customer.model');
const { getFuelRequestById, updateFuelRequestStatus } = require('../models/fuelRequest.model');

// Generate quotation number
const generateQuotationNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `Q-${year}${month}${day}-${random}`;
};

// Marketing/Admin: Create quotation
router.post('/', authenticate, authorize('admin', 'marketing'), [
  body('fuelRequestId').isNumeric().withMessage('Fuel request ID is required'),
  body('unitPrice').isNumeric().withMessage('Unit price is required'),
  body('validUntil').notEmpty().withMessage('Valid until date is required'),
  body('taxRate').optional().isNumeric().withMessage('Tax rate must be a valid number')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    // Get fuel request
    const fuelRequest = await getFuelRequestById(req.body.fuelRequestId);
    if (!fuelRequest) {
      return res.status(404).json({
        success: false,
        message: 'Fuel request not found'
      });
    }

    // Dynamic Calculations
    const quantity = parseFloat(fuelRequest.quantity) || 0;
    const unitPrice = parseFloat(req.body.unitPrice) || 0;
    
    // Accept taxRate from request body, default to 15% if not provided
    const taxRate = req.body.taxRate !== undefined && req.body.taxRate !== '' 
      ? parseFloat(req.body.taxRate) 
      : 15;

    const totalAmount = quantity * unitPrice; // Subtotal
    const taxAmount = totalAmount * (taxRate / 100);
    const grandTotal = totalAmount + taxAmount;

    const quotation = await createQuotation({
      fuelRequestId: fuelRequest.id,
      customerId: fuelRequest.customer_id,
      quotationNumber: generateQuotationNumber(),
      fuelType: fuelRequest.fuel_type,
      quantity: fuelRequest.quantity,
      unit: fuelRequest.unit,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      taxRate: taxRate,
      taxAmount: taxAmount,
      grandTotal: grandTotal,
      validUntil: req.body.validUntil,
      deliveryTerms: req.body.deliveryTerms,
      paymentTerms: req.body.paymentTerms,
      createdBy: req.user.id,
      notes: req.body.notes,
      status: req.body.status || 'draft'
    });

    // Update fuel request status to quoted
    await updateFuelRequestStatus(fuelRequest.id, 'quoted');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: quotation
    });
  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating quotation',
      error: error.message
    });
  }
});

// Customer: Get my quotations
router.get('/my-quotations', authenticate, async (req, res) => {
  try {
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    const quotations = await getQuotationsByCustomer(customer.id);
    res.json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error) {
    console.error('Get my quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotations',
      error: error.message
    });
  }
});

// Marketing/Admin: Get all quotations
router.get('/all', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const quotations = await getAllQuotations();
    res.json({
      success: true,
      count: quotations.length,
      data: quotations
    });
  } catch (error) {
    console.error('Get all quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotations',
      error: error.message
    });
  }
});

// Get single quotation
router.get('/:id', authenticate, async (req, res) => {
  try {
    const quotation = await getQuotationById(req.params.id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if user has access
    const customer = await getCustomerByUserId(req.user.id);
    if (req.user.role === 'customer' && quotation.customer_id !== customer?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: quotation
    });
  } catch (error) {
    console.error('Get quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotation',
      error: error.message
    });
  }
});

// Customer: Accept quotation
router.put('/:id/accept', authenticate, async (req, res) => {
  try {
    const quotation = await getQuotationById(req.params.id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if user owns this quotation
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    if (quotation.customer_id !== customer.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This quotation does not belong to you.'
      });
    }

    if (quotation.status !== 'sent') {
      return res.status(400).json({
        success: false,
        message: `Quotation cannot be accepted. Current status: '${quotation.status}'. Only 'sent' quotations can be accepted.`
      });
    }

    const updatedQuotation = await updateQuotationStatus(quotation.id, 'accepted');
    
    // Update fuel request status
    await updateFuelRequestStatus(quotation.fuel_request_id, 'accepted');

    res.json({
      success: true,
      message: 'Quotation accepted successfully',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('Accept quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error accepting quotation',
      error: error.message
    });
  }
});

// Customer: Reject quotation
router.put('/:id/reject', authenticate, async (req, res) => {
  try {
    const quotation = await getQuotationById(req.params.id);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if user owns this quotation
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    if (quotation.customer_id !== customer.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    if (quotation.status !== 'sent') {
      return res.status(400).json({
        success: false,
        message: `Quotation cannot be rejected. Current status: '${quotation.status}'`
      });
    }

    const updatedQuotation = await updateQuotationStatus(quotation.id, 'rejected');
    
    // Update fuel request status
    await updateFuelRequestStatus(quotation.fuel_request_id, 'rejected');

    res.json({
      success: true,
      message: 'Quotation rejected',
      data: updatedQuotation
    });
  } catch (error) {
    console.error('Reject quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error rejecting quotation',
      error: error.message
    });
  }
});

// Marketing/Admin: Update quotation status
router.put('/:id/status', authenticate, authorize('admin', 'marketing'), [
  body('status').isIn(['draft', 'sent', 'accepted', 'rejected', 'expired']).withMessage('Invalid status')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const quotation = await updateQuotationStatus(req.params.id, req.body.status);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // If status is sent, update fuel request status
    if (req.body.status === 'sent') {
      await updateFuelRequestStatus(quotation.fuel_request_id, 'quoted');
    }

    res.json({
      success: true,
      message: 'Quotation status updated',
      data: quotation
    });
  } catch (error) {
    console.error('Update quotation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating quotation status',
      error: error.message
    });
  }
});

module.exports = router;