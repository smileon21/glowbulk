import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Orders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedOrder, setSelectedOrder] = useState(null);
  const navigate = useNavigate();

  const userRole = localStorage.getItem('userRole');
  const isStaff = userRole === 'admin' || userRole === 'marketing';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };

      let response;
      if (isStaff) {
        response = await axios.get('http://localhost:5000/api/orders/all', config);
      } else {
        response = await axios.get('http://localhost:5000/api/orders/my-orders', config);
      }

      if (response.data.success) {
        setOrders(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching orders:', error);
      setError('Error loading orders');
    } finally {
      setLoading(false);
    }
  };

  const confirmPayment = async (id) => {
    if (!window.confirm('Confirm payment for this order?')) return;

    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };
      
      const response = await axios.put(
        `http://localhost:5000/api/orders/${id}/confirm-payment`,
        { notes: 'Payment verified in company bank account' },
        config
      );

      if (response.data.success) {
        setMessage('Payment confirmed successfully!');
        fetchOrders();
        setSelectedOrder(null);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error confirming payment');
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };
      
      const response = await axios.put(
        `http://localhost:5000/api/orders/${id}/status`,
        { status },
        config
      );

      if (response.data.success) {
        setMessage(`Order ${status} successfully!`);
        fetchOrders();
        setSelectedOrder(null);
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error updating order status');
    }
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'pending_payment': { color: '#E8A33D', text: 'Pending Payment' },
      'payment_confirmed': { color: '#2f7ea8', text: 'Payment Confirmed' },
      'processing': { color: '#6f42c1', text: 'Processing' },
      'completed': { color: '#2f7a3f', text: 'Completed' },
      'cancelled': { color: '#8f0000', text: 'Cancelled' }
    };
    const s = statusMap[status] || { color: '#6b7280', text: status };
    return <span className="status-badge" style={{ background: s.color }}>{s.text}</span>;
  };

  const getPaymentStatusBadge = (status) => {
    const statusMap = {
      'pending': { color: '#E8A33D', text: 'Pending' },
      'confirmed': { color: '#2f7a3f', text: 'Confirmed' },
      'proof_uploaded': { color: '#4f46e5', text: 'Proof Uploaded' }
    };
    const s = statusMap[status] || { color: '#6b7280', text: status };
    return <span className="status-badge" style={{ background: s.color }}>{s.text}</span>;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-ZW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return '$' + Number(amount).toFixed(2);
  };

  if (loading) {
    return <div className="loading">Loading manifest...</div>;
  }

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>Orders</h2>
        <div style={{ display: 'flex', gap: '10px' }}>
          {isStaff && (
            <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/pending-payments')}>
              View Pending Payments
            </button>
          )}
          <button 
            className="glow-btn" 
            onClick={() => navigate('/create-order')}
          >
            + Create Order
          </button>
        </div>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="orders-list">
        {orders.length === 0 ? (
          <div className="glow-card no-content">
            <p>No orders yet.</p>
            {!isStaff && (
              <p>Accept a quotation to create an order.</p>
            )}
            <button 
              className="glow-btn" 
              onClick={() => navigate('/quotations')}
              style={{ width: 'auto', marginTop: '15px' }}
            >
              View Quotations
            </button>
          </div>
        ) : (
          <div className="orders-grid">
            {orders.map((order) => (
              <div
                key={order.id}
                className="order-card"
                onClick={() => setSelectedOrder(order)}
                style={{ cursor: 'pointer' }}
              >
                <div className="order-header">
                  <h3> {order.order_number}</h3>
                  {getStatusBadge(order.status)}
                </div>
                <div className="order-details">
                  <p><strong>Fuel Type:</strong> {order.fuel_type}</p>
                  <p><strong>Quantity:</strong> {order.quantity} {order.unit}</p>
                  <p><strong>Grand Total:</strong> {formatCurrency(order.grand_total)}</p>
                  <p><strong>Payment:</strong> {getPaymentStatusBadge(order.payment_status)}</p>
                  {order.company_name && (
                    <p><strong>Company:</strong> {order.company_name}</p>
                  )}
                </div>
                <div className="order-footer">
                  <small>Created: {formatDate(order.created_at)}</small>
                  <span className="stat-btn">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="modal-overlay" onClick={() => setSelectedOrder(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3> {selectedOrder.order_number}</h3>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>

            <div className="modal-status-row">
              {getStatusBadge(selectedOrder.status)}
              <span>Payment: {getPaymentStatusBadge(selectedOrder.payment_status)}</span>
            </div>

            <div className="modal-details">
              {selectedOrder.company_name && (
                <div className="modal-detail-item">
                  <span className="detail-label">Customer</span>
                  <span className="detail-value">{selectedOrder.company_name}</span>
                </div>
              )}
              <div className="modal-detail-item">
                <span className="detail-label">Fuel Type</span>
                <span className="detail-value">{selectedOrder.fuel_type}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Quantity</span>
                <span className="detail-value">{selectedOrder.quantity} {selectedOrder.unit}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Unit Price</span>
                <span className="detail-value">{formatCurrency(selectedOrder.unit_price)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Total Amount</span>
                <span className="detail-value">{formatCurrency(selectedOrder.total_amount)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Tax Amount</span>
                <span className="detail-value">{formatCurrency(selectedOrder.tax_amount)}</span>
              </div>
              <div className="modal-detail-item modal-detail-highlight">
                <span className="detail-label">Grand Total</span>
                <span className="detail-value">{formatCurrency(selectedOrder.grand_total)}</span>
              </div>
              
              {/* Delivery Information */}
              {selectedOrder.delivery_address && (
                <>
                  <div className="modal-detail-item">
                    <span className="detail-label">Delivery Address</span>
                    <span className="detail-value">{selectedOrder.delivery_address}</span>
                  </div>
                  {selectedOrder.delivery_city && (
                    <div className="modal-detail-item">
                      <span className="detail-label">City</span>
                      <span className="detail-value">{selectedOrder.delivery_city}</span>
                    </div>
                  )}
                  {selectedOrder.delivery_country && (
                    <div className="modal-detail-item">
                      <span className="detail-label">Country</span>
                      <span className="detail-value">{selectedOrder.delivery_country}</span>
                    </div>
                  )}
                  {selectedOrder.preferred_delivery_date && (
                    <div className="modal-detail-item">
                      <span className="detail-label">Preferred Delivery</span>
                      <span className="detail-value">{formatDate(selectedOrder.preferred_delivery_date)} {selectedOrder.preferred_delivery_time}</span>
                    </div>
                  )}
                </>
              )}

              {selectedOrder.purchase_order_number && (
                <div className="modal-detail-item">
                  <span className="detail-label">PO Number</span>
                  <span className="detail-value">{selectedOrder.purchase_order_number}</span>
                </div>
              )}

              <div className="modal-detail-item">
                <span className="detail-label">Status</span>
                <span className="detail-value">{selectedOrder.status}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Payment Status</span>
                <span className="detail-value">{selectedOrder.payment_status}</span>
              </div>
              {selectedOrder.payment_verified_at && (
                <div className="modal-detail-item">
                  <span className="detail-label">Payment Verified</span>
                  <span className="detail-value">{formatDate(selectedOrder.payment_verified_at)}</span>
                </div>
              )}
              {selectedOrder.payment_notes && (
                <div className="modal-detail-item modal-detail-notes">
                  <span className="detail-label">Payment Notes</span>
                  <span className="detail-value">{selectedOrder.payment_notes}</span>
                </div>
              )}
              {selectedOrder.notes && (
                <div className="modal-detail-item modal-detail-notes">
                  <span className="detail-label">Notes</span>
                  <span className="detail-value">{selectedOrder.notes}</span>
                </div>
              )}
              <div className="modal-detail-item">
                <span className="detail-label">Created</span>
                <span className="detail-value">{formatDate(selectedOrder.created_at)}</span>
              </div>
              {selectedOrder.completed_at && (
                <div className="modal-detail-item">
                  <span className="detail-label">Completed</span>
                  <span className="detail-value">{formatDate(selectedOrder.completed_at)}</span>
                </div>
              )}
            </div>

            <div className="modal-actions">
              {/* Marketing/Admin Actions */}
              {selectedOrder.status === 'pending_payment' && isStaff && (
                <button className="glow-btn" onClick={() => confirmPayment(selectedOrder.id)}>
                  Confirm Payment
                </button>
              )}
              {selectedOrder.status === 'payment_confirmed' && isStaff && (
                <button className="glow-btn" onClick={() => updateStatus(selectedOrder.id, 'processing')}>
                  Start Processing
                </button>
              )}
              {selectedOrder.status === 'processing' && isStaff && (
                <button className="glow-btn" onClick={() => updateStatus(selectedOrder.id, 'completed')}>
                  Mark as Completed
                </button>
              )}
              {(selectedOrder.status === 'pending_payment' || selectedOrder.status === 'payment_confirmed' || selectedOrder.status === 'processing') && isStaff && (
                <button 
                  className="glow-btn glow-btn-secondary" 
                  onClick={() => updateStatus(selectedOrder.id, 'cancelled')}
                >
                  Cancel Order
                </button>
              )}

              {/* Customer Actions */}
              {selectedOrder.status === 'pending_payment' && !isStaff && (
                <button 
                  className="glow-btn"
                  onClick={() => navigate(`/upload-proof/${selectedOrder.id}`)}
                >
                  Upload Payment Proof
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Orders;