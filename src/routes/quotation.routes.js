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
const { notifyStaff, notifyCustomer } = require('../services/notification.service');

// Generate quotation number
const generateQuotationNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `Q-${year}${month}${day}-${random}`;
};

// Tell the customer their quotation is ready (never breaks the request if it fails)
const notifyQuotationReady = (quotation) => {
  notifyCustomer(quotation.customer_id, {
    type: 'quotation_ready',
    title: 'New response from Glow Petroleum',
    message: `Your quotation ${quotation.quotation_number} is ready.`,
    link: '/quotations'
  }).catch((err) => console.error('Quotation notification failed:', err));
};

// Tell all staff how the customer responded (never breaks the request if it fails)
const notifyQuotationResponse = (quotation, customer, accepted) => {
  const who = customer.company_name || customer.contact_person_name || 'A customer';
  notifyStaff({
    type: accepted ? 'quotation_accepted' : 'quotation_rejected',
    title: accepted ? 'Quotation accepted' : 'Quotation rejected',
    message: `${who} ${accepted ? 'accepted' : 'rejected'} quotation ${quotation.quotation_number}.`,
    link: '/quotations'
  }).catch((err) => console.error('Quotation response notification failed:', err));
};

// Marketing/Admin: Create quotation
router.post('/', authenticate, authorize('admin', 'marketing'), [
  body('fuelRequestId').isNumeric().withMessage('Fuel request ID is required'),
  body('unitPrice').isNumeric().withMessage('Unit price is required'),
  body('validUntil').notEmpty().withMessage('Valid until date is required')
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

    // ==========================================
    // PRICING — no tax, no grand total
    // ==========================================
    const quantity = parseFloat(fuelRequest.quantity) || 0;
    const unitPrice = parseFloat(req.body.unitPrice) || 0;
    const totalAmount = quantity * unitPrice;

    const quotation = await createQuotation({
      fuelRequestId: fuelRequest.id,
      customerId: fuelRequest.customer_id,
      quotationNumber: generateQuotationNumber(),
      fuelType: fuelRequest.fuel_type,
      quantity: fuelRequest.quantity,
      unit: fuelRequest.unit,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      validUntil: req.body.validUntil,
      deliveryTerms: req.body.deliveryTerms,
      paymentTerms: req.body.paymentTerms,
      createdBy: req.user.id,
      notes: req.body.notes,
      status: req.body.status || 'draft'
    });

    // Update fuel request status to quoted
    await updateFuelRequestStatus(fuelRequest.id, 'quoted');

    // If quotation was created with status 'sent', notify the customer
    if (quotation.status === 'sent') {
      notifyQuotationReady(quotation);
    }

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
    await updateFuelRequestStatus(quotation.fuel_request_id, 'accepted');

    // Notify all staff about the acceptance
    notifyQuotationResponse(updatedQuotation, customer, true);

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
    await updateFuelRequestStatus(quotation.fuel_request_id, 'rejected');

    // Notify all staff about the rejection
    notifyQuotationResponse(updatedQuotation, customer, false);

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

    // Get original quotation to know if status is changing to 'sent'
    const originalQuotation = await getQuotationById(req.params.id);
    if (!originalQuotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    const quotation = await updateQuotationStatus(req.params.id, req.body.status);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // If status changed to 'sent', update fuel request and notify the customer
    if (req.body.status === 'sent') {
      await updateFuelRequestStatus(quotation.fuel_request_id, 'quoted');

      // Only notify if the quotation wasn't already 'sent' before
      if (originalQuotation.status !== 'sent') {
        notifyQuotationReady(quotation);
      }
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