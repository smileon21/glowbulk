const pool = require('../config/database');

// Create a new quotation
const createQuotation = async (quotationData) => {
  const {
    fuelRequestId,
    customerId,
    quotationNumber,
    fuelType,
    quantity,
    unit,
    unitPrice,
    totalAmount, // Subtotal
    taxRate = 0,
    taxAmount = 0,
    grandTotal,
    validUntil,
    deliveryTerms,
    paymentTerms,
    createdBy,
    notes,
    status = 'sent'
  } = quotationData;

  const query = `
    INSERT INTO quotations (
      fuel_request_id, customer_id, quotation_number,
      fuel_type, quantity, unit,
      unit_price, total_amount, tax_rate, tax_amount, grand_total,
      valid_until, delivery_terms, payment_terms,
      created_by, notes, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
    RETURNING *
  `;

  const values = [
    fuelRequestId, customerId, quotationNumber,
    fuelType, quantity, unit,
    unitPrice, totalAmount, taxRate, taxAmount, grandTotal,
    validUntil, deliveryTerms, paymentTerms,
    createdBy, notes, status
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// Get quotation by ID
const getQuotationById = async (id) => {
  const query = 'SELECT * FROM quotations WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Get quotations by customer ID
const getQuotationsByCustomer = async (customerId) => {
  const query = 'SELECT * FROM quotations WHERE customer_id = $1 ORDER BY created_at DESC';
  const result = await pool.query(query, [customerId]);
  return result.rows;
};

// Get quotations by fuel request ID
const getQuotationsByFuelRequest = async (fuelRequestId) => {
  const query = 'SELECT * FROM quotations WHERE fuel_request_id = $1 ORDER BY created_at DESC';
  const result = await pool.query(query, [fuelRequestId]);
  return result.rows;
};

// Get all quotations (for marketing/admin)
const getAllQuotations = async () => {
  const query = `
    SELECT q.*, u.first_name, u.last_name, c.company_name, fr.fuel_type as request_fuel_type
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    JOIN users u ON c.user_id = u.id
    JOIN fuel_requests fr ON q.fuel_request_id = fr.id
    ORDER BY q.created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
};

// Update quotation status
const updateQuotationStatus = async (id, status) => {
  const checkQuery = 'SELECT * FROM quotations WHERE id = $1';
  const checkResult = await pool.query(checkQuery, [id]);
  
  if (checkResult.rows.length === 0) {
    return null;
  }
  
  let query = 'UPDATE quotations SET status = $1, updated_at = CURRENT_TIMESTAMP';
  if (status === 'accepted') {
    query = 'UPDATE quotations SET status = $1, accepted_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP';
  }
  
  query += ' WHERE id = $2 RETURNING *';
  const result = await pool.query(query, [status, id]);
  return result.rows[0];
};

// Update quotation details
const updateQuotation = async (id, quotationData) => {
  const {
    unitPrice,
    totalAmount,
    taxRate,
    taxAmount,
    grandTotal,
    validUntil,
    deliveryTerms,
    paymentTerms,
    notes
  } = quotationData;

  const query = `
    UPDATE quotations 
    SET 
      unit_price = $1,
      total_amount = $2,
      tax_rate = $3,
      tax_amount = $4,
      grand_total = $5,
      valid_until = $6,
      delivery_terms = $7,
      payment_terms = $8,
      notes = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10
    RETURNING *
  `;

  const values = [
    unitPrice, totalAmount, taxRate, taxAmount, grandTotal,
    validUntil, deliveryTerms, paymentTerms, notes,
    id
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

module.exports = {
  createQuotation,
  getQuotationById,
  getQuotationsByCustomer,
  getQuotationsByFuelRequest,
  getAllQuotations,
  updateQuotationStatus,
  updateQuotation
};