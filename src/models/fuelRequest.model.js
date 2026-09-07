const pool = require('../config/database');

// Create a new fuel request
const createFuelRequest = async (requestData) => {
  const {
    customerId,
    fuelType,
    quantity,
    unit = 'Liters',
    deliveryAddress,
    deliveryCity,
    deliveryState,
    deliveryCountry,
    deliveryPostalCode,
    preferredDeliveryDate,
    preferredDeliveryTime,
    specialInstructions,
    priority = 'normal',
    assignedTo,
    notes
  } = requestData;

  const query = `
    INSERT INTO fuel_requests (
      customer_id, fuel_type, quantity, unit,
      delivery_address, delivery_city, delivery_state, delivery_country, delivery_postal_code,
      preferred_delivery_date, preferred_delivery_time,
      special_instructions, priority, assigned_to, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
    RETURNING *
  `;

  const values = [
    customerId, fuelType, quantity, unit,
    deliveryAddress, deliveryCity, deliveryState, deliveryCountry, deliveryPostalCode,
    preferredDeliveryDate, preferredDeliveryTime,
    specialInstructions, priority, assignedTo, notes
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// Get fuel requests by customer ID
const getFuelRequestsByCustomer = async (customerId) => {
  const query = 'SELECT * FROM fuel_requests WHERE customer_id = $1 ORDER BY created_at DESC';
  const result = await pool.query(query, [customerId]);
  return result.rows;
};

// Get fuel request by ID
const getFuelRequestById = async (id) => {
  const query = 'SELECT * FROM fuel_requests WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// Get all fuel requests (for marketing)
const getAllFuelRequests = async () => {
  const query = `
    SELECT fr.*, u.first_name, u.last_name, c.company_name 
    FROM fuel_requests fr
    JOIN customers c ON fr.customer_id = c.id
    JOIN users u ON c.user_id = u.id
    ORDER BY fr.created_at DESC
  `;
  const result = await pool.query(query);
  return result.rows;
};

// Update fuel request status
const updateFuelRequestStatus = async (id, status) => {
  const query = `
    UPDATE fuel_requests 
    SET status = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [status, id]);
  return result.rows[0];
};

// Update fuel request
const updateFuelRequest = async (id, requestData) => {
  const {
    fuelType,
    quantity,
    unit,
    deliveryAddress,
    deliveryCity,
    deliveryState,
    deliveryCountry,
    deliveryPostalCode,
    preferredDeliveryDate,
    preferredDeliveryTime,
    specialInstructions,
    priority,
    assignedTo,
    notes
  } = requestData;

  const query = `
    UPDATE fuel_requests 
    SET 
      fuel_type = $1,
      quantity = $2,
      unit = $3,
      delivery_address = $4,
      delivery_city = $5,
      delivery_state = $6,
      delivery_country = $7,
      delivery_postal_code = $8,
      preferred_delivery_date = $9,
      preferred_delivery_time = $10,
      special_instructions = $11,
      priority = $12,
      assigned_to = $13,
      notes = $14,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $15
    RETURNING *
  `;

  const values = [
    fuelType, quantity, unit,
    deliveryAddress, deliveryCity, deliveryState, deliveryCountry, deliveryPostalCode,
    preferredDeliveryDate, preferredDeliveryTime,
    specialInstructions, priority, assignedTo, notes,
    id
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
};

// Delete fuel request
const deleteFuelRequest = async (id) => {
  const query = 'DELETE FROM fuel_requests WHERE id = $1 RETURNING id';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

module.exports = {
  createFuelRequest,
  getFuelRequestsByCustomer,
  getFuelRequestById,
  getAllFuelRequests,
  updateFuelRequestStatus,
  updateFuelRequest,
  deleteFuelRequest
};