const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const {
  EDIT_WINDOW_MINUTES,
  round2,
  priceAfterDiscount,
  createQuotation,
  getQuotationById,
  getQuotationsByCustomer,
  getAllQuotations,
  updateQuotationStatus,
  editSentQuotation,
  acceptQuotationVersion,
  getQuotationVersions
} = require('../models/quotation.model');
const { getCustomerByUserId, getCustomerById } = require('../models/customer.model');
const { getFuelRequestById, updateFuelRequestStatus } = require('../models/fuelRequest.model');
const { notifyStaff, notifyCustomer } = require('../services/notification.service');
const { logActivity } = require('../utils/activityLog');

// A quotation stays valid for this many hours after it is sent
const QUOTE_VALIDITY_HOURS = 72;

// Staff = marketing, pricing, finance (read-only; writes are marketing-only)
const STAFF = ['marketing', 'pricing', 'finance'];

// Generate quotation number
const generateQuotationNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `Q-${year}${month}${day}-${random}`;
};

// ==========================================
// ACTIVITY LOG
// ==========================================
// The marketing team shares one login, so the person's typed name goes into the log
// text. The log entry itself still records the shared account as the actor.
// Never breaks the request if logging fails.
const logQuoteActivity = async (req, { action, quotation, oldValues, newValues, details }) => {
  try {
    await logActivity({
      actor: req.user,
      action,
      targetType: 'quotation',
      targetId: quotation.id,
      oldValues: oldValues || null,
      newValues: newValues || null,
      details,
      ip: req.ip
    });
  } catch (err) {
    console.error('Quotation activity log failed:', err.message);
  }
};

// Company name if there is one, otherwise the contact person
const customerLabel = (customer) =>
  customer.company_name || customer.contact_person_name || `customer #${customer.id}`;

// ==========================================
// 72-HOUR EXPIRY
// ==========================================

// True when a 'sent' quotation has run out of time.
// Uses expires_at when the column exists, otherwise sent_at / created_at + 72 hours.
const isQuotationExpired = (quotation) => {
  if (quotation.status !== 'sent') return false;

  let end;
  if (quotation.expires_at) {
    end = new Date(quotation.expires_at).getTime();
  } else {
    const start = new Date(quotation.sent_at || quotation.created_at).getTime();
    end = start + QUOTE_VALIDITY_HOURS * 3600000;
  }

  if (isNaN(end)) return false;
  return Date.now() >= end;
};

// Marks a quotation (and its fuel request) as expired in the database
const markExpired = async (quotation) => {
  await updateQuotationStatus(quotation.id, 'expired');
  try {
    await updateFuelRequestStatus(quotation.fuel_request_id, 'expired');
  } catch (err) {
    // Never block the customer if the fuel request status can't be changed
    console.error('Could not mark fuel request as expired:', err.message);
  }
};

// Used by the list endpoints: any overdue 'sent' quotation is expired on the spot,
// so the database stays correct without needing a scheduled job
const expireOverdue = async (quotations) => {
  for (const quotation of quotations) {
    if (isQuotationExpired(quotation)) {
      try {
        await markExpired(quotation);
        quotation.status = 'expired';
      } catch (err) {
        console.error('Auto-expire failed for quotation', quotation.id, err.message);
      }
    }
  }
  return quotations;
};

// Tell the customer their quotation is ready (never breaks the request if it fails)
const notifyQuotationReady = (quotation) => {
  notifyCustomer(quotation.customer_id, {
    type: 'quotation_ready',
    title: 'New response from Glow Petroleum',
    message: `Your quotation ${quotation.quotation_number} is ready. It is valid for ${QUOTE_VALIDITY_HOURS} hours.`,
    link: '/quotations'
  }).catch((err) => console.error('Quotation notification failed:', err));
};

// Tell the customer their quotation was edited (never breaks the request if it fails).
// wasAccepted = the customer had already accepted, so that acceptance was cancelled.
const notifyQuotationEdited = (quotation, previous, wasAccepted) => {
  const money = (n) => Number(n).toFixed(2);
  notifyCustomer(quotation.customer_id, {
    type: 'quotation_edited',
    title: 'Your quotation was updated',
    message:
      `Quotation ${quotation.quotation_number} was updated (version ${quotation.current_version}). ` +
      `Unit price: ${money(previous.unit_price)} to ${money(quotation.unit_price)}. ` +
      `Total: ${money(previous.total_amount)} to ${money(quotation.total_amount)}. ` +
      (wasAccepted ? 'Your earlier acceptance was cancelled. ' : '') +
      'Please review the new version and accept it again.',
    link: '/quotations'
  }).catch((err) => console.error('Quotation edit notification failed:', err));
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

// Marketing: Create quotation
// The marketing person enters the DAY'S PRICE (basePrice). The server takes the customer's
// discount and category from the customer record, works out the price per litre
// (day's price minus discount) and saves all of it on the quotation.
router.post('/', authenticate, authorize('marketing'), [
  body('fuelRequestId').isNumeric().withMessage('Fuel request ID is required'),
  body('basePrice').isFloat({ gt: 0 }).withMessage("Today's price must be greater than 0"),
  body('preparedBy')
    .trim()
    .notEmpty().withMessage('Please enter your name before creating the quotation')
    .isLength({ max: 100 }).withMessage('Your name must be 100 characters or less')
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

    // The customer's saved category and discount (older accounts may have none: discount 0)
    const customer = await getCustomerById(fuelRequest.customer_id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // ==========================================
    // PRICING: day's price minus the customer's discount (no tax)
    // ==========================================
    const quantity = parseFloat(fuelRequest.quantity) || 0;
    const basePrice = parseFloat(req.body.basePrice);
    const discountCents = parseFloat(customer.discount_cents_per_litre) || 0;
    const unitPrice = priceAfterDiscount(basePrice, discountCents);

    if (!(unitPrice > 0)) {
      return res.status(400).json({
        success: false,
        message: `This customer's discount of ${discountCents} cents per litre is more than or equal to the price entered. Enter a higher price.`
      });
    }

    const totalAmount = round2(quantity * unitPrice);

    // Validity is always 72 hours: the server sets it, staff don't pick a date.
    // (The exact moment comes from sent_at / expires_at in the database.)
    const validUntil = new Date(Date.now() + QUOTE_VALIDITY_HOURS * 3600000)
      .toISOString()
      .slice(0, 10);

    const preparedBy = req.body.preparedBy.trim();

    const quotation = await createQuotation({
      fuelRequestId: fuelRequest.id,
      customerId: fuelRequest.customer_id,
      quotationNumber: generateQuotationNumber(),
      fuelType: fuelRequest.fuel_type,
      quantity: fuelRequest.quantity,
      unit: fuelRequest.unit,
      unitPrice: unitPrice,
      totalAmount: totalAmount,
      basePrice: basePrice,
      discountCentsPerLitre: discountCents,
      customerCategory: customer.category || null,
      validUntil: validUntil,
      deliveryTerms: req.body.deliveryTerms,
      paymentTerms: req.body.paymentTerms,
      createdBy: req.user.id,   // the logged-in (shared) account, kept for traceability
      preparedBy: preparedBy,   // the name typed by the person writing the quote
      notes: req.body.notes,
      status: req.body.status || 'draft'
    });

    // Update fuel request status to quoted
    await updateFuelRequestStatus(fuelRequest.id, 'quoted');

    // If quotation was created with status 'sent', notify the customer
    if (quotation.status === 'sent') {
      notifyQuotationReady(quotation);
    }

    await logQuoteActivity(req, {
      action: 'QUOTATION_CREATED',
      quotation,
      newValues: {
        base_price: basePrice,
        discount_cents_per_litre: discountCents,
        unit_price: unitPrice,
        total_amount: totalAmount,
        status: quotation.status
      },
      details: `${preparedBy} created quotation ${quotation.quotation_number} for ${customerLabel(customer)} (${quotation.status})`
    });

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

    const quotations = await expireOverdue(await getQuotationsByCustomer(customer.id));
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

// Staff: Get all quotations (pricing & finance dashboards use this too)
router.get('/all', authenticate, authorize(...STAFF), async (req, res) => {
  try {
    const quotations = await expireOverdue(await getAllQuotations());
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

// Marketing: the customer behind a fuel request, with category and discount.
// The quote form calls this when a fuel request is picked.
router.get('/customer-info/:fuelRequestId', authenticate, authorize('marketing'), async (req, res) => {
  try {
    const fuelRequest = await getFuelRequestById(req.params.fuelRequestId);
    if (!fuelRequest) {
      return res.status(404).json({ success: false, message: 'Fuel request not found' });
    }

    const customer = await getCustomerById(fuelRequest.customer_id);
    if (!customer) {
      return res.status(404).json({ success: false, message: 'Customer not found' });
    }

    res.json({
      success: true,
      data: {
        id: customer.id,
        account_type: customer.account_type,
        company_name: customer.company_name,
        company_registration: customer.company_registration,
        industry: customer.industry,
        tax_number: customer.tax_number,
        contact_person_name: customer.contact_person_name,
        contact_person_email: customer.contact_person_email,
        contact_person_phone: customer.contact_person_phone,
        billing_address: customer.billing_address,
        billing_city: customer.billing_city,
        billing_state: customer.billing_state,
        billing_country: customer.billing_country,
        verification_status: customer.verification_status,
        category: customer.category,
        discount_cents_per_litre: customer.discount_cents_per_litre
      }
    });
  } catch (error) {
    console.error('Get customer info error:', error);
    res.status(500).json({ success: false, message: 'Error loading customer details' });
  }
});

// ==========================================
// EDIT / VERSIONS (Marketing writes; staff reads)
// Must be declared BEFORE router.get('/:id')
// ==========================================

// Marketing: edit a sent or accepted quotation within the 15-minute window.
// The person edits the day's price; the discount saved on the quotation is kept.
// Editing an accepted quotation cancels the acceptance (customer must accept again).
router.put('/:id/edit', authenticate, authorize('marketing'), [
  body('basePrice').isFloat({ gt: 0 }).withMessage("Today's price must be greater than 0"),
  body('editedBy')
    .trim()
    .notEmpty().withMessage('Please enter your name before saving the edit')
    .isLength({ max: 100 }).withMessage('Your name must be 100 characters or less'),
  body('reason').trim().notEmpty().withMessage('A reason for the edit is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }

    // id = the shared account, name = the person who typed their name
    const editor = {
      id: req.user.id,
      name: req.body.editedBy.trim()
    };

    const result = await editSentQuotation(req.params.id, {
      basePrice: req.body.basePrice,
      deliveryTerms: req.body.deliveryTerms,
      paymentTerms: req.body.paymentTerms,
      notes: req.body.notes,
      reason: req.body.reason
    }, editor);

    if (!result.ok) {
      let status = 409;
      if (result.code === 'NOT_FOUND') status = 404;
      if (result.code === 'PRICE_TOO_LOW') status = 400;
      return res.status(status).json({ success: false, code: result.code, message: result.message });
    }

    await logQuoteActivity(req, {
      action: 'QUOTATION_EDITED',
      quotation: result.quotation,
      oldValues: result.previous,
      newValues: {
        base_price: result.quotation.base_price,
        unit_price: result.quotation.unit_price,
        total_amount: result.quotation.total_amount,
        version: result.version
      },
      details: `${editor.name} edited quotation ${result.quotation.quotation_number} (version ${result.version}): ${req.body.reason.trim()}`
    });

    // The acceptance was cancelled, so the fuel request goes back to 'quoted'
    if (result.wasAccepted) {
      try {
        await updateFuelRequestStatus(result.quotation.fuel_request_id, 'quoted');
      } catch (err) {
        // Never fail the edit because the fuel request status could not be reset
        console.error('Could not reset fuel request status after edit:', err.message);
      }
    }

    notifyQuotationEdited(result.quotation, result.previous, result.wasAccepted);

    res.json({
      success: true,
      message: result.wasAccepted
        ? `Quotation updated to version ${result.version}. The customer's acceptance was cancelled and they must accept again.`
        : `Quotation updated to version ${result.version}`,
      wasAccepted: result.wasAccepted,
      data: result.quotation
    });
  } catch (error) {
    console.error('Edit quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error editing quotation',
      error: error.message
    });
  }
});

// Staff: see the edit history of a quotation
router.get('/:id/versions', authenticate, authorize(...STAFF), async (req, res) => {
  try {
    const versions = await getQuotationVersions(req.params.id);
    res.json({ success: true, count: versions.length, data: versions });
  } catch (error) {
    console.error('Get quotation versions error:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching quotation history',
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

    if (isQuotationExpired(quotation)) {
      await markExpired(quotation);
      quotation.status = 'expired';
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

// Customer: Accept quotation (version-aware)
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

    const version = parseInt(req.body.version, 10);
    if (!Number.isInteger(version)) {
      return res.status(400).json({
        success: false,
        code: 'VERSION_REQUIRED',
        message: 'Please reload the quotation and try again.'
      });
    }

    // 72 hours passed: expire it and refuse the acceptance
    if (isQuotationExpired(quotation)) {
      await markExpired(quotation);
      return res.status(400).json({
        success: false,
        message: `This quotation has expired. Quotations are valid for ${QUOTE_VALIDITY_HOURS} hours. Please request a new quote.`
      });
    }

    // One atomic step: accepts only if it is still 'sent' AND still the version the customer saw
    const updatedQuotation = await acceptQuotationVersion(quotation.id, version);

    if (!updatedQuotation) {
      // Work out why, so the customer gets a clear message
      const latest = await getQuotationById(quotation.id);

      if (latest.status !== 'sent') {
        return res.status(400).json({
          success: false,
          message: `Quotation cannot be accepted. Current status: '${latest.status}'. Only 'sent' quotations can be accepted.`
        });
      }
      if (latest.current_version !== version) {
        return res.status(409).json({
          success: false,
          code: 'QUOTATION_UPDATED',
          currentVersion: latest.current_version,
          message: 'This quotation was just updated. Please review the new version before accepting.'
        });
      }
      return res.status(400).json({ success: false, message: 'This quotation can no longer be accepted.' });
    }

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

    // 72 hours passed: nothing left to reject, it is already expired
    if (isQuotationExpired(quotation)) {
      await markExpired(quotation);
      return res.status(400).json({
        success: false,
        message: 'This quotation has already expired.'
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

// Marketing: Update quotation status (Send / Expire).
// The person must type their name so the log shows who did it.
router.put('/:id/status', authenticate, authorize('marketing'), [
  body('status').isIn(['draft', 'sent', 'accepted', 'rejected', 'expired']).withMessage('Invalid status'),
  body('actorName')
    .trim()
    .notEmpty().withMessage('Please enter your name first')
    .isLength({ max: 100 }).withMessage('Your name must be 100 characters or less')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array(),
        message: errors.array()[0].msg
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

    // If status changed to 'sent', update fuel request and notify the customer.
    // The database stamps sent_at / expires_at at this moment, starting the 72 hours.
    if (req.body.status === 'sent') {
      await updateFuelRequestStatus(quotation.fuel_request_id, 'quoted');

      // Only notify if the quotation wasn't already 'sent' before
      if (originalQuotation.status !== 'sent') {
        notifyQuotationReady(quotation);
      }
    }

    const actorName = req.body.actorName.trim();
    const actionByStatus = {
      sent: 'QUOTATION_SENT',
      expired: 'QUOTATION_EXPIRED'
    };
    const verbByStatus = {
      sent: 'sent',
      expired: 'expired'
    };
    await logQuoteActivity(req, {
      action: actionByStatus[req.body.status] || 'QUOTATION_STATUS_CHANGED',
      quotation,
      oldValues: { status: originalQuotation.status },
      newValues: { status: quotation.status },
      details: `${actorName} ${verbByStatus[req.body.status] || 'changed the status of'} quotation ${quotation.quotation_number}` +
        (verbByStatus[req.body.status] ? '' : ` to ${req.body.status}`)
    });

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