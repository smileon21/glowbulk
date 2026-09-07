const pool = require('../config/database');

// Generate order number with format: ORD-YYYYMMDD-XXXX
const generateOrderNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
  return `ORD-${year}${month}${day}-${random}`;
};

// Create order from accepted quotation with all fields
const createOrderFromQuotation = async (quotationId, userId, orderData = {}) => {
  const getQuotationQuery = 'SELECT * FROM quotations WHERE id = $1';
  const quotationResult = await pool.query(getQuotationQuery, [quotationId]);
  const quotation = quotationResult.rows[0];
  
  if (!quotation) {
    throw new Error('Quotation not found');
  }
  
  if (quotation.status !== 'accepted') {
    throw new Error('Quotation must be accepted to create an order');
  }
  
  const checkOrderQuery = 'SELECT * FROM orders WHERE quotation_id = $1';
  const checkResult = await pool.query(checkOrderQuery, [quotationId]);
  if (checkResult.rows.length > 0) {
    throw new Error('Order already exists for this quotation');
  }
  
  const orderNumber = generateOrderNumber();
  
  const query = `
    INSERT INTO orders (
      quotation_id, 
      customer_id, 
      created_by,
      order_number,
      fuel_type, 
      quantity, 
      unit,
      unit_price, 
      total_amount, 
      tax_amount, 
      grand_total,
      delivery_address,
      delivery_city,
      delivery_state,
      delivery_country,
      delivery_postal_code,
      preferred_delivery_date,
      preferred_delivery_time,
      purchase_order_number,
      status, 
      payment_status,
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
    RETURNING *
  `;
  
  const values = [
    quotationId, 
    quotation.customer_id, 
    userId,
    orderNumber,
    quotation.fuel_type,
    quotation.quantity,
    quotation.unit || 'L',
    quotation.unit_price,
    quotation.total_amount || quotation.total,
    quotation.tax_amount || quotation.tax || 0,
    quotation.grand_total,
    orderData.delivery_address || quotation.delivery_address || quotation.deliveryAddress,
    orderData.delivery_city || quotation.delivery_city || quotation.deliveryCity,
    orderData.delivery_state || quotation.delivery_state || quotation.deliveryState,
    orderData.delivery_country || quotation.delivery_country || quotation.deliveryCountry,
    orderData.delivery_postal_code || quotation.delivery_postal_code || quotation.deliveryPostalCode,
    orderData.preferred_delivery_date || null,
    orderData.preferred_delivery_time || null,
    orderData.purchase_order_number || null,
    'pending_payment',
    'pending',
    orderData.notes || null
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Get order by ID with customer and user details
const getOrderById = async (id) => {
  const query = `
    SELECT o.*, 
           u.first_name, u.last_name, u.email,
           c.company_name,
           q.quotation_number
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN quotations q ON o.quotation_id = q.id
    WHERE o.id = $1
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Get orders by customer ID
const getOrdersByCustomer = async (customerId) => {
  const query = `
    SELECT o.*, q.quotation_number
    FROM orders o
    LEFT JOIN quotations q ON o.quotation_id = q.id
    WHERE o.customer_id = $1 
    ORDER BY o.created_at DESC
  `;
  const result = await pool.query(query, [customerId]);
  return result.rows;
};

// Get orders by user ID (created_by)
const getOrdersByUserId = async (userId) => {
  const query = `
    SELECT o.*, 
           c.company_name,
           q.quotation_number
    FROM orders o
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN quotations q ON o.quotation_id = q.id
    WHERE o.created_by = $1
    ORDER BY o.created_at DESC
  `;
  const result = await pool.query(query, [userId]);
  return result.rows;
};

// Get all orders (for marketing/admin)
const getAllOrders = async () => {
  const query = `
    SELECT o.*, 
           u.first_name, u.last_name, u.email,
           c.company_name,
           q.quotation_number
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    LEFT JOIN quotations q ON o.quotation_id = q.id
    ORDER BY o.created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
};

// Update order status
const updateOrderStatus = async (id, status, notes = null) => {
  const query = `
    UPDATE orders 
    SET status = $1, 
        notes = COALESCE($2, notes),
        updated_at = CURRENT_TIMESTAMP,
        completed_at = CASE WHEN $1 = 'completed' THEN CURRENT_TIMESTAMP ELSE completed_at END
    WHERE id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [status, notes, id]);
  return result.rows[0];
};

// Update payment status with verification
const updatePaymentStatus = async (id, paymentStatus, verifiedBy, notes) => {
  const checkQuery = 'SELECT * FROM orders WHERE id = $1';
  const checkResult = await pool.query(checkQuery, [id]);
  
  if (checkResult.rows.length === 0) {
    return null;
  }
  
  const verifiedById = parseInt(verifiedBy);
  if (isNaN(verifiedById)) {
    throw new Error('Invalid user ID for payment verification');
  }
  
  const query = `
    UPDATE orders 
    SET 
      payment_status = $1,
      payment_verified_by = $2,
      payment_verified_at = CURRENT_TIMESTAMP,
      payment_notes = $3,
      status = 'payment_confirmed',
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING *
  `;
  
  const values = [paymentStatus, verifiedById, notes || 'Payment confirmed by marketing', id];
  const result = await pool.query(query, values);
  return result.rows[0];
};

// Add purchase order file
const addPurchaseOrderFile = async (id, filename, path) => {
  const query = `
    UPDATE orders 
    SET purchase_order_filename = $1,
        purchase_order_path = $2,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [filename, path, id]);
  return result.rows[0];
};

// Add payment proof
const addPaymentProof = async (id, filename, path) => {
  const query = `
    UPDATE orders 
    SET payment_proof_filename = $1,
        payment_proof_path = $2,
        payment_status = 'proof_uploaded',
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [filename, path, id]);
  return result.rows[0];
};

// Get orders pending payment verification
const getPendingPaymentOrders = async () => {
  const query = `
    SELECT o.*, 
           u.first_name, u.last_name, u.email,
           c.company_name
    FROM orders o
    LEFT JOIN users u ON o.created_by = u.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE o.payment_status = 'pending' OR o.payment_status = 'proof_uploaded'
    ORDER BY o.created_at ASC
  `;
  const result = await pool.query(query);
  return result.rows;
};

// Get order by order number
const getOrderByNumber = async (orderNumber) => {
  const query = 'SELECT * FROM orders WHERE order_number = $1';
  const result = await pool.query(query, [orderNumber]);
  return result.rows[0];
};

// Update order delivery details
const updateOrderDelivery = async (id, deliveryData) => {
  const {
    delivery_address,
    delivery_city,
    delivery_state,
    delivery_country,
    delivery_postal_code,
    preferred_delivery_date,
    preferred_delivery_time
  } = deliveryData;
  
  const query = `
    UPDATE orders 
    SET 
      delivery_address = COALESCE($1, delivery_address),
      delivery_city = COALESCE($2, delivery_city),
      delivery_state = COALESCE($3, delivery_state),
      delivery_country = COALESCE($4, delivery_country),
      delivery_postal_code = COALESCE($5, delivery_postal_code),
      preferred_delivery_date = COALESCE($6, preferred_delivery_date),
      preferred_delivery_time = COALESCE($7, preferred_delivery_time),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *
  `;
  
  const values = [
    delivery_address,
    delivery_city,
    delivery_state,
    delivery_country,
    delivery_postal_code,
    preferred_delivery_date,
    preferred_delivery_time,
    id
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
};

module.exports = {
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
  updateOrderDelivery,
  generateOrderNumber
};