const pool = require('../config/database');

// "Today" in Zimbabwe (CAT), so a certificate expires at midnight local time
const TODAY_CAT = "(now() AT TIME ZONE 'Africa/Harare')::date";

// Name of the logged-in account, used for "confirmed by", "uploaded by" and so on
const accountName = (user) => {
  if (!user) return 'Unknown';
  const full = [user.first_name, user.last_name].filter(Boolean).join(' ').trim();
  return full || user.email || 'Unknown';
};

// ============================================================
// PAYMENT METHODS
// ============================================================

const METHOD_FIELDS = [
  'method_type', 'title', 'currency', 'bank_name', 'account_name', 'account_number',
  'branch', 'swift_code', 'mobile_number', 'instructions', 'sort_order'
];

const clean = (v) => {
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === '' ? null : s;
};

const getPaymentMethods = async (activeOnly) => {
  const result = await pool.query(
    'SELECT * FROM payment_methods ' +
    (activeOnly ? 'WHERE is_active = TRUE ' : '') +
    'ORDER BY is_active DESC, sort_order ASC, id ASC'
  );
  return result.rows;
};

const createPaymentMethod = async (data, updatedBy) => {
  const result = await pool.query(
    `INSERT INTO payment_methods (
       method_type, title, currency, bank_name, account_name, account_number,
       branch, swift_code, mobile_number, instructions, sort_order, updated_by
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING *`,
    [
      data.method_type,
      clean(data.title),
      clean(data.currency) || 'USD',
      clean(data.bank_name),
      clean(data.account_name),
      clean(data.account_number),
      clean(data.branch),
      clean(data.swift_code),
      clean(data.mobile_number),
      clean(data.instructions),
      parseInt(data.sort_order, 10) || 0,
      updatedBy
    ]
  );
  return result.rows[0];
};

const updatePaymentMethod = async (id, data, updatedBy) => {
  const result = await pool.query(
    `UPDATE payment_methods SET
       method_type = $1, title = $2, currency = $3, bank_name = $4, account_name = $5,
       account_number = $6, branch = $7, swift_code = $8, mobile_number = $9,
       instructions = $10, sort_order = $11, updated_by = $12, updated_at = now()
     WHERE id = $13
     RETURNING *`,
    [
      data.method_type,
      clean(data.title),
      clean(data.currency) || 'USD',
      clean(data.bank_name),
      clean(data.account_name),
      clean(data.account_number),
      clean(data.branch),
      clean(data.swift_code),
      clean(data.mobile_number),
      clean(data.instructions),
      parseInt(data.sort_order, 10) || 0,
      updatedBy,
      id
    ]
  );
  return result.rows[0];
};

const setPaymentMethodActive = async (id, isActive, updatedBy) => {
  const result = await pool.query(
    `UPDATE payment_methods
     SET is_active = $1, updated_by = $2, updated_at = now()
     WHERE id = $3
     RETURNING *`,
    [isActive, updatedBy, id]
  );
  return result.rows[0];
};

// ============================================================
// TAX CLEARANCE
// ============================================================

// What customers see: the current certificate, only while it has not expired
const getValidTaxClearance = async () => {
  const result = await pool.query(
    `SELECT id, certificate_number, expiry_date, file_url, uploaded_at
     FROM tax_clearances
     WHERE is_current = TRUE AND expiry_date >= ${TODAY_CAT}
     ORDER BY uploaded_at DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
};

// What finance sees: the current certificate even if it has expired
const getLatestTaxClearance = async () => {
  const result = await pool.query(
    `SELECT *, (expiry_date < ${TODAY_CAT}) AS is_expired,
            (expiry_date - ${TODAY_CAT}) AS days_left
     FROM tax_clearances
     WHERE is_current = TRUE
     ORDER BY uploaded_at DESC
     LIMIT 1`
  );
  return result.rows[0] || null;
};

const getTaxClearanceHistory = async () => {
  const result = await pool.query(
    'SELECT * FROM tax_clearances ORDER BY uploaded_at DESC'
  );
  return result.rows;
};

// The new certificate becomes current; older ones stay as history
const addTaxClearance = async (certificateNumber, expiryDate, fileUrl, uploadedBy) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('UPDATE tax_clearances SET is_current = FALSE WHERE is_current = TRUE');
    const result = await client.query(
      `INSERT INTO tax_clearances (certificate_number, expiry_date, file_url, is_current, uploaded_by)
       VALUES ($1, $2, $3, TRUE, $4)
       RETURNING *`,
      [certificateNumber, expiryDate, fileUrl, uploadedBy]
    );
    await client.query('COMMIT');
    return result.rows[0];
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// ============================================================
// REJECT A PROOF OF PAYMENT
// The proof is cleared so the customer can upload a new one.
// ============================================================

const rejectPayment = async (orderId, rejectedByName, reason) => {
  const result = await pool.query(
    `UPDATE orders
     SET
       payment_status = 'pending',
       payment_proof_filename = NULL,
       payment_proof_path = NULL,
       payment_notes = $1,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 AND status = 'pending_payment'
     RETURNING *`,
    ['Proof of payment rejected by ' + rejectedByName + ': ' + reason, orderId]
  );
  return result.rows[0];
};

module.exports = {
  METHOD_FIELDS,
  accountName,
  getPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  setPaymentMethodActive,
  getValidTaxClearance,
  getLatestTaxClearance,
  getTaxClearanceHistory,
  addTaxClearance,
  rejectPayment
};
