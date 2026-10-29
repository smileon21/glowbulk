const pool = require('../config/database');

// Marketing may edit a sent (or just-accepted) quotation for this long after it was sent
const EDIT_WINDOW_MINUTES = 15;

// Rounding helpers: prices keep up to 4 decimals (a 2.5 cent discount gives 1.475),
// money totals keep 2 decimals
const round4 = (n) => Math.round(Number(n) * 10000) / 10000;
const round2 = (n) => Math.round(Number(n) * 100) / 100;

// Price per litre after the customer's discount.
// basePrice is the day's price in dollars, discountCents is cents per litre.
const priceAfterDiscount = (basePrice, discountCents) =>
  round4(Number(basePrice) - (Number(discountCents) || 0) / 100);

// Name shown as "Prepared by": the name typed by the quote writer (prepared_by) comes first.
// Older quotations have no typed name, so they fall back to the account that created them.
// Expects the quotations table as "q" and the creator's users row as "cu".
const CREATOR_NAME = `COALESCE(
  NULLIF(TRIM(q.prepared_by), ''),
  NULLIF(TRIM(CONCAT(cu.first_name, ' ', cu.last_name)), ''),
  'Glow Petroleum'
) AS created_by_name`;

// Create a new quotation
const createQuotation = async (quotationData) => {
  const {
    fuelRequestId,
    customerId,
    quotationNumber,
    fuelType,
    quantity,
    unit,
    unitPrice,            // price per litre AFTER the discount
    totalAmount,          // quantity x unitPrice
    basePrice,            // the day's price, before the discount
    discountCentsPerLitre, // copied from the customer at the moment of quoting
    customerCategory,      // copied from the customer at the moment of quoting
    validUntil,
    deliveryTerms,
    paymentTerms,
    createdBy,
    preparedBy,
    notes,
    status = 'sent'
  } = quotationData;

  const query = `
    INSERT INTO quotations (
      fuel_request_id, customer_id, quotation_number,
      fuel_type, quantity, unit,
      unit_price, total_amount, tax_rate, tax_amount, grand_total,
      valid_until, delivery_terms, payment_terms,
      created_by, notes, status, prepared_by,
      base_price, discount_cents_per_litre, customer_category
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING *
  `;

  // Tax feature removed. grand_total is forced to equal total_amount.
  // tax_rate and tax_amount columns kept dormant for DB compatibility.
  const grandTotal = totalAmount;

  const values = [
    fuelRequestId, customerId, quotationNumber,
    fuelType, quantity, unit,
    unitPrice, totalAmount, 0, 0, grandTotal,
    validUntil, deliveryTerms, paymentTerms,
    createdBy, notes, status, preparedBy,
    basePrice, discountCentsPerLitre, customerCategory
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// Get quotation by ID
const getQuotationById = async (id) => {
  const result = await pool.query(
    `SELECT q.*, ${CREATOR_NAME}
     FROM quotations q
     LEFT JOIN users cu ON cu.id = q.created_by
     WHERE q.id = $1`,
    [id]
  );
  return result.rows[0];
};

// Get quotations by customer ID
const getQuotationsByCustomer = async (customerId) => {
  const result = await pool.query(
    `SELECT q.*, ${CREATOR_NAME}
     FROM quotations q
     LEFT JOIN users cu ON cu.id = q.created_by
     WHERE q.customer_id = $1
     ORDER BY q.created_at DESC`,
    [customerId]
  );
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
  // u = the customer's user (first_name / last_name are the CUSTOMER's name),
  // cu = the staff member who created the quotation (account behind created_by)
  const query = `
    SELECT q.*, u.first_name, u.last_name, c.company_name,
           fr.fuel_type AS request_fuel_type, ${CREATOR_NAME}
    FROM quotations q
    JOIN customers c ON q.customer_id = c.id
    JOIN users u ON c.user_id = u.id
    JOIN fuel_requests fr ON q.fuel_request_id = fr.id
    LEFT JOIN users cu ON cu.id = q.created_by
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

// Update quotation details (plain update, used for drafts only)
const updateQuotation = async (id, quotationData) => {
  const {
    unitPrice,
    totalAmount,
    validUntil,
    deliveryTerms,
    paymentTerms,
    notes
  } = quotationData;

  // Tax feature removed. grand_total is forced to equal total_amount.
  const grandTotal = totalAmount;

  const query = `
    UPDATE quotations 
    SET 
      unit_price = $1,
      total_amount = $2,
      tax_rate = 0,
      tax_amount = 0,
      grand_total = $3,
      valid_until = $4,
      delivery_terms = $5,
      payment_terms = $6,
      notes = $7,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $8
    RETURNING *
  `;

  const values = [
    unitPrice, totalAmount, grandTotal,
    validUntil, deliveryTerms, paymentTerms, notes,
    id
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// ==========================================
// 15-MINUTE EDIT WITH VERSION HISTORY
// ==========================================

// Edit a SENT or ACCEPTED quotation inside the edit window.
// If the quotation was already accepted, the acceptance is cancelled and the
// quotation goes back to 'sent', so the customer must accept the new version.
// An accepted quotation that already has an order can no longer be edited.
//
// The edit changes the DAY'S PRICE (base price). The discount saved on the quotation
// is kept, so the customer's later discount changes never touch an old quote.
//
// Everything happens in one transaction with the row locked, so an edit and a
// customer accepting at the same moment can never both succeed.
//
// editor = { id, name }  (id = the logged-in account, name = the name the person typed)
// data = { basePrice, deliveryTerms, paymentTerms, notes, reason }
// Returns { ok: true, quotation, previous, version, wasAccepted }
//      or { ok: false, code, message }
const editSentQuotation = async (id, data, editor) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // The window and expiry are judged by the database clock, not the browser's
    const found = await client.query(
      `SELECT *,
         (now() <= COALESCE(sent_at, created_at) + make_interval(mins => $2::int)) AS in_window,
         (now() >= COALESCE(expires_at, COALESCE(sent_at, created_at) + interval '72 hours')) AS is_expired
       FROM quotations
       WHERE id = $1
       FOR UPDATE`,
      [id, EDIT_WINDOW_MINUTES]
    );

    if (found.rows.length === 0) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_FOUND', message: 'Quotation not found.' };
    }

    const q = found.rows[0];

    if (!['sent', 'accepted'].includes(q.status)) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'NOT_EDITABLE', message: `This quotation is '${q.status}' and can no longer be edited.` };
    }
    if (q.is_expired) {
      await client.query('ROLLBACK');
      return { ok: false, code: 'EXPIRED', message: 'This quotation has expired.' };
    }
    if (!q.in_window) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'EDIT_WINDOW_CLOSED',
        message: `The ${EDIT_WINDOW_MINUTES}-minute edit window has ended. Withdraw this quotation and send a new one.`
      };
    }

    // An accepted quotation can only be edited until the customer places an order from it
    const wasAccepted = q.status === 'accepted';
    if (wasAccepted) {
      const order = await client.query(
        'SELECT 1 FROM orders WHERE quotation_id = $1 LIMIT 1',
        [q.id]
      );
      if (order.rows.length > 0) {
        await client.query('ROLLBACK');
        return {
          ok: false,
          code: 'ORDER_EXISTS',
          message: 'The customer has already placed an order from this quotation, so it can no longer be edited.'
        };
      }
    }

    // The server does the maths. Quantity comes from the customer's request and is not editable.
    // The discount is the one saved on this quotation (older quotations have none, so 0).
    const discountCents = Number(q.discount_cents_per_litre) || 0;
    const newBasePrice = Number(data.basePrice);
    const newUnitPrice = priceAfterDiscount(newBasePrice, discountCents);

    if (!(newUnitPrice > 0)) {
      await client.query('ROLLBACK');
      return {
        ok: false,
        code: 'PRICE_TOO_LOW',
        message: `The discount of ${discountCents} cents per litre is more than or equal to the day's price. Enter a higher price.`
      };
    }

    const newTotal = round2(Number(q.quantity) * newUnitPrice);

    // First edit ever: save the original as version 1 so history is complete
    const hasVersions = await client.query(
      'SELECT 1 FROM quotation_versions WHERE quotation_id = $1 LIMIT 1',
      [q.id]
    );
    if (hasVersions.rows.length === 0) {
      // Version 1 was written by the person who typed their name on the quote
      const creator = await client.query(
        'SELECT first_name, last_name, email FROM users WHERE id = $1',
        [q.created_by]
      );
      const c = creator.rows[0] || {};
      const accountName = `${c.first_name || ''} ${c.last_name || ''}`.trim() || c.email || 'Unknown';
      const creatorName = (q.prepared_by && q.prepared_by.trim()) || accountName;
      await client.query(
        `INSERT INTO quotation_versions
           (quotation_id, version_no, quantity, unit_price, total_amount,
            delivery_terms, payment_terms, notes, changed_by, changed_by_name, changed_at, reason)
         VALUES ($1, 1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'Original quotation')`,
        [q.id, q.quantity, q.unit_price, q.total_amount,
         q.delivery_terms, q.payment_terms, q.notes,
         q.created_by, creatorName, q.sent_at || q.created_at]
      );
    }

    const newDelivery = data.deliveryTerms !== undefined ? data.deliveryTerms : q.delivery_terms;
    const newPayment = data.paymentTerms !== undefined ? data.paymentTerms : q.payment_terms;
    const newNotes = data.notes !== undefined ? data.notes : q.notes;

    const nextVersion = (q.current_version || 1) + 1;

    const previous = {
      base_price: q.base_price,
      discount_cents_per_litre: q.discount_cents_per_litre,
      unit_price: q.unit_price,
      total_amount: q.total_amount,
      delivery_terms: q.delivery_terms,
      payment_terms: q.payment_terms,
      notes: q.notes
    };

    // Tag the history entry when this edit cancelled a customer's acceptance
    const historyReason = wasAccepted ? `${data.reason} (acceptance cancelled)` : data.reason;

    await client.query(
      `INSERT INTO quotation_versions
         (quotation_id, version_no, quantity, unit_price, total_amount,
          delivery_terms, payment_terms, notes,
          changed_by, changed_by_name, reason, old_values)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
      [q.id, nextVersion, q.quantity, newUnitPrice, newTotal,
       newDelivery, newPayment, newNotes,
       editor.id, editor.name, historyReason, JSON.stringify(previous)]
    );

    // Tax feature is removed, so grand_total always equals total_amount.
    // status goes back to 'sent' and the acceptance is cleared, so the customer
    // has to accept the new version.
    const updated = await client.query(
      `UPDATE quotations
       SET unit_price = $1,
           total_amount = $2,
           grand_total = $2,
           delivery_terms = $3,
           payment_terms = $4,
           notes = $5,
           current_version = $6,
           base_price = $7,
           status = 'sent',
           accepted_date = NULL,
           accepted_version = NULL,
           edited = TRUE,
           edited_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $8
       RETURNING *`,
      [newUnitPrice, newTotal, newDelivery, newPayment, newNotes, nextVersion, newBasePrice, q.id]
    );

    await client.query('COMMIT');
    return { ok: true, quotation: updated.rows[0], previous, version: nextVersion, wasAccepted };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Accept a quotation, but only the exact version the customer saw.
// One atomic UPDATE: if an edit is in progress, this waits for it and then
// finds the version has changed, so it matches nothing.
// Returns the updated row, or null when nothing could be accepted.
const acceptQuotationVersion = async (id, version) => {
  const result = await pool.query(
    `UPDATE quotations
     SET status = 'accepted',
         accepted_date = CURRENT_TIMESTAMP,
         accepted_version = $2,
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $1
       AND status = 'sent'
       AND current_version = $2
       AND now() < COALESCE(expires_at, COALESCE(sent_at, created_at) + interval '72 hours')
     RETURNING *`,
    [id, version]
  );
  return result.rows[0] || null;
};

// Full edit history of one quotation, newest first (staff only)
const getQuotationVersions = async (quotationId) => {
  const result = await pool.query(
    'SELECT * FROM quotation_versions WHERE quotation_id = $1 ORDER BY version_no DESC',
    [quotationId]
  );
  return result.rows;
};

module.exports = {
  EDIT_WINDOW_MINUTES,
  round2,
  round4,
  priceAfterDiscount,
  createQuotation,
  getQuotationById,
  getQuotationsByCustomer,
  getQuotationsByFuelRequest,
  getAllQuotations,
  updateQuotationStatus,
  updateQuotation,
  editSentQuotation,
  acceptQuotationVersion,
  getQuotationVersions
};