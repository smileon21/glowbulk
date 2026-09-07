const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const { authenticate, authorize } = require('../middleware/auth.middleware');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const {
  createOrderFromQuotation,
  getOrderById,
  getOrdersByCustomer,
  getOrdersByUserId,
  getAllOrders,
  updateOrderStatus,
  updatePaymentStatus,
  addPurchaseOrderFile,
  addPaymentProof,
  getPendingPaymentOrders,
  getOrderByNumber,
  updateOrderDelivery
} = require('../models/order.model');
const { getCustomerByUserId } = require('../models/customer.model');
const { getQuotationById } = require('../models/quotation.model');
const { updateFuelRequestStatus } = require('../models/fuelRequest.model');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/purchase-orders/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'PO-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'));
    }
  }
});

// Configure multer for payment proof uploads
const proofStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/payment-proofs/';
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'PROOF-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const proofUpload = multer({ 
  storage: proofStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only PDF, JPG, JPEG, and PNG files are allowed'));
    }
  }
});

// Customer: Create order from accepted quotation with all fields
router.post('/create', authenticate, [
  body('quotationId').isInt().withMessage('Quotation ID is required'),
  body('purchaseOrderNumber').optional().isString(),
  body('preferredDeliveryDate').optional().isString(),
  body('preferredDeliveryTime').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { 
      quotationId, 
      purchaseOrderNumber, 
      preferredDeliveryDate, 
      preferredDeliveryTime,
      notes,
      delivery_address,
      delivery_city,
      delivery_state,
      delivery_country,
      delivery_postal_code
    } = req.body;

    // Get customer profile
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    // Get quotation
    const quotation = await getQuotationById(quotationId);
    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    // Check if quotation belongs to this customer
    if (quotation.customer_id !== customer.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied. This quotation does not belong to you.'
      });
    }

    // Check if quotation is accepted
    if (quotation.status !== 'accepted') {
      return res.status(400).json({
        success: false,
        message: 'Quotation must be accepted before creating an order'
      });
    }

    // Prepare order data
    const orderData = {
      delivery_address: delivery_address || quotation.delivery_address || quotation.deliveryAddress,
      delivery_city: delivery_city || quotation.delivery_city || quotation.deliveryCity,
      delivery_state: delivery_state || quotation.delivery_state || quotation.deliveryState,
      delivery_country: delivery_country || quotation.delivery_country || quotation.deliveryCountry,
      delivery_postal_code: delivery_postal_code || quotation.delivery_postal_code || quotation.deliveryPostalCode,
      preferred_delivery_date: preferredDeliveryDate,
      preferred_delivery_time: preferredDeliveryTime,
      purchase_order_number: purchaseOrderNumber,
      notes: notes
    };

    // Create order
    const order = await createOrderFromQuotation(quotationId, req.user.id, orderData);
    
    // Update fuel request status
    if (quotation.fuel_request_id) {
      await updateFuelRequestStatus(quotation.fuel_request_id, 'ordered');
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully',
      data: order
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating order'
    });
  }
});

// Customer: Upload Purchase Order file
router.post('/upload-po/:orderId', authenticate, upload.single('poFile'), async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to upload files for this order'
      });
    }

    const filePath = `/uploads/purchase-orders/${req.file.filename}`;
    
    // Update order with file
    const updatedOrder = await addPurchaseOrderFile(orderId, req.file.filename, filePath);

    res.json({
      success: true,
      message: 'Purchase Order uploaded successfully',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error uploading PO:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading purchase order',
      error: error.message
    });
  }
});

// Customer: Upload Payment Proof
router.post('/upload-proof/:orderId', authenticate, proofUpload.single('proofFile'), async (req, res) => {
  try {
    const { orderId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const order = await getOrderById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user owns this order
    if (order.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to upload files for this order'
      });
    }

    const filePath = `/uploads/payment-proofs/${req.file.filename}`;
    
    // Update order with payment proof
    const updatedOrder = await addPaymentProof(orderId, req.file.filename, filePath);

    res.json({
      success: true,
      message: 'Payment proof uploaded successfully',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error uploading payment proof:', error);
    res.status(500).json({
      success: false,
      message: 'Error uploading payment proof',
      error: error.message
    });
  }
});

// Customer: Get my orders
router.get('/my-orders', authenticate, async (req, res) => {
  try {
    const customer = await getCustomerByUserId(req.user.id);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer profile not found'
      });
    }

    const orders = await getOrdersByCustomer(customer.id);
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Customer: Update delivery details
router.put('/:orderId/delivery', authenticate, [
  body('delivery_address').optional().isString(),
  body('delivery_city').optional().isString(),
  body('delivery_state').optional().isString(),
  body('delivery_country').optional().isString(),
  body('delivery_postal_code').optional().isString(),
  body('preferred_delivery_date').optional().isString(),
  body('preferred_delivery_time').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { orderId } = req.params;
    const order = await getOrderById(orderId);
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    if (order.created_by !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'You are not authorized to update this order'
      });
    }

    const updatedOrder = await updateOrderDelivery(orderId, req.body);

    res.json({
      success: true,
      message: 'Delivery details updated successfully',
      data: updatedOrder
    });

  } catch (error) {
    console.error('Error updating delivery details:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating delivery details',
      error: error.message
    });
  }
});

// Marketing/Admin: Get all orders
router.get('/all', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const orders = await getAllOrders();
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders',
      error: error.message
    });
  }
});

// Marketing/Admin: Get pending payment orders
router.get('/pending-payment', authenticate, authorize('admin', 'marketing'), async (req, res) => {
  try {
    const orders = await getPendingPaymentOrders();
    res.json({
      success: true,
      count: orders.length,
      data: orders
    });
  } catch (error) {
    console.error('Error fetching pending payments:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching pending payment orders',
      error: error.message
    });
  }
});

// Get single order by ID
router.get('/:id', authenticate, async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Check if user has access
    const customer = await getCustomerByUserId(req.user.id);
    if (req.user.role === 'customer' && order.customer_id !== customer?.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    res.json({
      success: true,
      data: order
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching order',
      error: error.message
    });
  }
});

// Marketing/Admin: Update order status
router.put('/:id/status', authenticate, authorize('admin', 'marketing'), [
  body('status').isIn(['pending_payment', 'payment_confirmed', 'processing', 'completed', 'cancelled']).withMessage('Invalid status'),
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const order = await updateOrderStatus(req.params.id, req.body.status, req.body.notes);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order status updated',
      data: order
    });
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating order status',
      error: error.message
    });
  }
});

// Marketing/Admin: Confirm payment
router.put('/:id/confirm-payment', authenticate, authorize('admin', 'marketing'), [
  body('notes').optional().isString()
], async (req, res) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update payment status to confirmed
    const updatedOrder = await updatePaymentStatus(
      req.params.id,
      'confirmed',
      req.user.id,
      req.body.notes || `Payment confirmed by ${req.user.first_name} ${req.user.last_name}`
    );

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('Error confirming payment:', error);
    res.status(500).json({
      success: false,
      message: 'Error confirming payment',
      error: error.message
    });
  }
});

module.exports = router;