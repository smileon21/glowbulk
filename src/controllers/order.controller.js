const pool = require('../config/db');

// ==========================================
// GET CUSTOMER ORDERS
// ==========================================
const getMyOrders = async (req, res) => {
  try {
    const customerId = req.user.id;

    const result = await pool.query(
      `
      SELECT 
        o.*,
        u.first_name,
        u.last_name,
        u.email
      FROM orders o
      LEFT JOIN users u 
        ON o.customer_id = u.id
      WHERE o.customer_id = $1
      ORDER BY o.created_at DESC
      `,
      [customerId]
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('Get my orders error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load your orders'
    });
  }
};


// ==========================================
// GET ALL ORDERS
// Marketing/Admin
// ==========================================
const getAllOrders = async (req, res) => {
  try {

    const result = await pool.query(
      `
      SELECT 
        o.*,
        u.first_name,
        u.last_name,
        u.email
      FROM orders o
      LEFT JOIN users u
        ON o.customer_id = u.id
      ORDER BY o.created_at DESC
      `
    );

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {

    console.error('Get all orders error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to load orders'
    });
  }
};


// ==========================================
// CONFIRM PAYMENT
// MARKETING / ADMIN ONLY
// ==========================================
const confirmPayment = async (req, res) => {

  try {

    const orderId = req.params.id;
    const staffId = req.user.id;

    const { notes } = req.body;

    const result = await pool.query(
      `
      UPDATE orders
      SET
        payment_status = 'confirmed',
        status = 'payment_confirmed',
        payment_verified_by = $1,
        payment_verified_at = CURRENT_TIMESTAMP,
        payment_notes = $2
      WHERE id = $3
      AND status = 'pending_payment'
      RETURNING *
      `,
      [
        staffId,
        notes || 'Payment manually verified',
        orderId
      ]
    );

    if (result.rows.length === 0) {

      return res.status(404).json({
        success: false,
        message: 'Order not found or payment has already been confirmed'
      });

    }

    res.json({
      success: true,
      message: 'Payment confirmed successfully',
      data: result.rows[0]
    });

  } catch (error) {

    console.error('Confirm payment error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to confirm payment'
    });

  }
};


// ==========================================
// UPDATE ORDER STATUS
// ==========================================
const updateOrderStatus = async (req, res) => {

  try {

    const orderId = req.params.id;
    const { status } = req.body;

    const allowedStatuses = [
      'pending_payment',
      'payment_confirmed',
      'processing',
      'completed',
      'cancelled'
    ];

    if (!allowedStatuses.includes(status)) {

      return res.status(400).json({
        success: false,
        message: 'Invalid order status'
      });

    }

    let query;
    let values;

    if (status === 'completed') {

      query = `
        UPDATE orders
        SET
          status = $1,
          completed_at = CURRENT_TIMESTAMP
        WHERE id = $2
        RETURNING *
      `;

      values = [status, orderId];

    } else {

      query = `
        UPDATE orders
        SET status = $1
        WHERE id = $2
        RETURNING *
      `;

      values = [status, orderId];
    }

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {

      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });

    }

    res.json({
      success: true,
      message: `Order status changed to ${status}`,
      data: result.rows[0]
    });

  } catch (error) {

    console.error('Update order status error:', error);

    res.status(500).json({
      success: false,
      message: 'Failed to update order status'
    });

  }
};


module.exports = {
  getMyOrders,
  getAllOrders,
  confirmPayment,
  updateOrderStatus
};