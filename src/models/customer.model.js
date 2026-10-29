const pool = require('../config/database');

// Create a new customer (full profile, used by the profile page for older accounts)
const createCustomer = async (customerData) => {
  const {
    userId,
    company_name,
    company_registration,
    billing_address,
    billing_city,
    billing_state,
    billing_country,
    billing_postal_code,
    delivery_address,
    delivery_city,
    delivery_state,
    delivery_country,
    delivery_postal_code,
    tax_number,
    industry,
    contact_person_name,
    contact_person_email,
    contact_person_phone,
    preferred_fuel_types,
    credit_limit = 0,
    notes
  } = customerData;

  const query = `
    INSERT INTO customers (
      user_id, company_name, company_registration,
      billing_address, billing_city, billing_state, billing_country, billing_postal_code,
      delivery_address, delivery_city, delivery_state, delivery_country, delivery_postal_code,
      tax_number, industry,
      contact_person_name, contact_person_email, contact_person_phone,
      preferred_fuel_types, credit_limit, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
    RETURNING *
  `;

  const values = [
    userId,
    company_name,
    company_registration,
    billing_address,
    billing_city,
    billing_state,
    billing_country,
    billing_postal_code,
    delivery_address,
    delivery_city,
    delivery_state,
    delivery_country,
    delivery_postal_code,
    tax_number,
    industry,
    contact_person_name,
    contact_person_email,
    contact_person_phone,
    preferred_fuel_types || [],
    credit_limit,
    notes
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createCustomer:', error);
    throw error;
  }
};

// Created at registration. Always starts as 'pending' (column default).
const createCustomerFromRegistration = async ({
  userId,
  accountType,
  companyName,
  companyRegistration,
  address,
  contactName,
  contactEmail,
  contactPhone
}) => {
  try {
    const result = await pool.query(
      `INSERT INTO customers (
         user_id, account_type, company_name, company_registration,
         billing_address, contact_person_name, contact_person_email, contact_person_phone
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id`,
      [
        userId,
        accountType,
        companyName,
        companyRegistration,
        address,
        contactName,
        contactEmail,
        contactPhone
      ]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in createCustomerFromRegistration:', error);
    throw error;
  }
};

// Get customer by user ID
const getCustomerByUserId = async (userId) => {
  const query = 'SELECT * FROM customers WHERE user_id = $1';
  try {
    const result = await pool.query(query, [userId]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getCustomerByUserId:', error);
    throw error;
  }
};

// Get customer by ID
const getCustomerById = async (id) => {
  const query = 'SELECT * FROM customers WHERE id = $1';
  try {
    const result = await pool.query(query, [id]);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in getCustomerById:', error);
    throw error;
  }
};

// Get all customers
const getAllCustomers = async () => {
  const query = 'SELECT * FROM customers ORDER BY created_at DESC';
  try {
    const result = await pool.query(query);
    return result.rows;
  } catch (error) {
    console.error('Database error in getAllCustomers:', error);
    throw error;
  }
};

// Customers waiting for marketing to verify them (oldest first)
const getPendingCustomers = async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM customers
       WHERE verification_status = 'pending'
       ORDER BY created_at ASC`
    );
    return result.rows;
  } catch (error) {
    console.error('Database error in getPendingCustomers:', error);
    throw error;
  }
};

// Customer self-edit: ONLY these fields can ever be changed this way.
// Verification status, category, discount and credit limit are deliberately not here.
const PROFILE_FIELDS = [
  'company_name',
  'company_registration',
  'industry',
  'tax_number',
  'contact_person_name',
  'contact_person_email',
  'contact_person_phone',
  'billing_address',
  'billing_city',
  'billing_state',
  'billing_country',
  'billing_postal_code',
  'preferred_fuel_types'
];

const updateCustomerProfile = async (id, data) => {
  const sets = [];
  const values = [];

  PROFILE_FIELDS.forEach((field) => {
    if (data[field] !== undefined) {
      values.push(data[field]);
      sets.push(`${field} = $${values.length}`);
    }
  });

  if (sets.length === 0) {
    return getCustomerById(id);
  }

  values.push(id);

  try {
    const result = await pool.query(
      `UPDATE customers
       SET ${sets.join(', ')}, updated_at = CURRENT_TIMESTAMP
       WHERE id = $${values.length}
       RETURNING *`,
      values
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateCustomerProfile:', error);
    throw error;
  }
};

// Staff update (kept for internal use, e.g. credit limit by finance later).
// Not exposed to customers.
const updateCustomer = async (id, customerData) => {
  const {
    company_name,
    company_registration,
    billing_address,
    billing_city,
    billing_state,
    billing_country,
    billing_postal_code,
    delivery_address,
    delivery_city,
    delivery_state,
    delivery_country,
    delivery_postal_code,
    tax_number,
    industry,
    contact_person_name,
    contact_person_email,
    contact_person_phone,
    preferred_fuel_types,
    status,
    credit_limit,
    notes
  } = customerData;

  const query = `
    UPDATE customers
    SET
      company_name = $1,
      company_registration = $2,
      billing_address = $3,
      billing_city = $4,
      billing_state = $5,
      billing_country = $6,
      billing_postal_code = $7,
      delivery_address = $8,
      delivery_city = $9,
      delivery_state = $10,
      delivery_country = $11,
      delivery_postal_code = $12,
      tax_number = $13,
      industry = $14,
      contact_person_name = $15,
      contact_person_email = $16,
      contact_person_phone = $17,
      preferred_fuel_types = $18,
      status = $19,
      credit_limit = $20,
      notes = $21,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $22
    RETURNING *
  `;

  const values = [
    company_name,
    company_registration,
    billing_address,
    billing_city,
    billing_state,
    billing_country,
    billing_postal_code,
    delivery_address,
    delivery_city,
    delivery_state,
    delivery_country,
    delivery_postal_code,
    tax_number,
    industry,
    contact_person_name,
    contact_person_email,
    contact_person_phone,
    preferred_fuel_types || [],
    status,
    credit_limit,
    notes,
    id
  ];

  try {
    const result = await pool.query(query, values);
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateCustomer:', error);
    throw error;
  }
};

// Marketing approves a customer and sets category + discount (cents per litre)
const verifyCustomer = async (id, { category, discountCentsPerLitre, verifiedBy }) => {
  try {
    const result = await pool.query(
      `UPDATE customers
       SET verification_status = 'verified',
           category = $1,
           discount_cents_per_litre = $2,
           verified_by = $3,
           verified_at = CURRENT_TIMESTAMP,
           rejection_reason = NULL,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [category, discountCentsPerLitre, verifiedBy, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in verifyCustomer:', error);
    throw error;
  }
};

// Marketing rejects a customer with a reason
const rejectCustomer = async (id, { reason, rejectedBy }) => {
  try {
    const result = await pool.query(
      `UPDATE customers
       SET verification_status = 'rejected',
           rejection_reason = $1,
           verified_by = $2,
           verified_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $3
       RETURNING *`,
      [reason, rejectedBy, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in rejectCustomer:', error);
    throw error;
  }
};

// Change a customer's discount later
const updateCustomerDiscount = async (id, discountCentsPerLitre) => {
  try {
    const result = await pool.query(
      `UPDATE customers
       SET discount_cents_per_litre = $1, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2
       RETURNING *`,
      [discountCentsPerLitre, id]
    );
    return result.rows[0];
  } catch (error) {
    console.error('Database error in updateCustomerDiscount:', error);
    throw error;
  }
};

module.exports = {
  createCustomer,
  createCustomerFromRegistration,
  getCustomerByUserId,
  getCustomerById,
  getAllCustomers,
  getPendingCustomers,
  updateCustomerProfile,
  updateCustomer,
  verifyCustomer,
  rejectCustomer,
  updateCustomerDiscount
};