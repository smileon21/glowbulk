const pool = require('../config/database');

// Create a new customer
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

// Update customer
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

module.exports = {
  createCustomer,
  getCustomerByUserId,
  getCustomerById,
  getAllCustomers,
  updateCustomer
};