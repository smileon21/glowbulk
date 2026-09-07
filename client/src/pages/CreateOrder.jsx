import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';

const CreateOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  
  const [quotation, setQuotation] = useState(null);
  const [orderData, setOrderData] = useState({
    quotationId: '',
    purchaseOrderNumber: '',
    preferredDeliveryDate: '',
    preferredDeliveryTime: '',
    delivery_address: '',
    delivery_city: '',
    delivery_state: '',
    delivery_country: '',
    delivery_postal_code: '',
    notes: ''
  });
  const [poFile, setPoFile] = useState(null);

  // Helper function to safely parse numbers
  const safeParseNumber = (value) => {
    if (value === null || value === undefined || value === '') return 0;
    const num = parseFloat(value);
    return isNaN(num) ? 0 : num;
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const quotationId = params.get('quotationId');
    
    if (quotationId) {
      fetchQuotation(quotationId);
    } else {
      setError('No quotation selected. Please select a quotation first.');
      setLoading(false);
    }
  }, [location]);

  const fetchQuotation = async (quotationId) => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };
      
      const response = await axios.get(``${API_URL}/api/quotations/${quotationId}`, config);
      if (response.data.success) {
        const quote = response.data.data;
        setQuotation(quote);
        setOrderData(prev => ({
          ...prev,
          quotationId: quotationId,
          delivery_address: quote.delivery_address || quote.deliveryAddress || '',
          delivery_city: quote.delivery_city || quote.deliveryCity || '',
          delivery_state: quote.delivery_state || quote.deliveryState || '',
          delivery_country: quote.delivery_country || quote.deliveryCountry || '',
          delivery_postal_code: quote.delivery_postal_code || quote.deliveryPostalCode || ''
        }));
      }
    } catch (error) {
      console.error('Error fetching quotation:', error);
      setError('Error loading quotation details');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setOrderData({
      ...orderData,
      [e.target.name]: e.target.value
    });
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a PDF, JPG, or PNG file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setPoFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const config = {
        headers: { 'Authorization': `Bearer ${token}` }
      };
      
      const submitData = {
        quotationId: parseInt(orderData.quotationId),
        purchaseOrderNumber: orderData.purchaseOrderNumber || null,
        preferredDeliveryDate: orderData.preferredDeliveryDate || null,
        preferredDeliveryTime: orderData.preferredDeliveryTime || null,
        delivery_address: orderData.delivery_address || null,
        delivery_city: orderData.delivery_city || null,
        delivery_state: orderData.delivery_state || null,
        delivery_country: orderData.delivery_country || null,
        delivery_postal_code: orderData.delivery_postal_code || null,
        notes: orderData.notes || null
      };

      const orderResponse = await axios.post(
        '`${API_URL}/api/orders/create',
        submitData,
        config
      );

      if (orderResponse.data.success) {
        const order = orderResponse.data.data;
        
        if (poFile) {
          const formData = new FormData();
          formData.append('poFile', poFile);
          
          await axios.post(
            ``${API_URL}/api/orders/upload-po/${order.id}`,
            formData,
            {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'multipart/form-data'
              }
            }
          );
        }

        setMessage(` Order created successfully!\nOrder Number: ${order.order_number}\n📌 Status: Pending Payment`);
        
        setTimeout(() => {
          navigate('/orders');
        }, 3000);
      }
    } catch (error) {
      console.error('Error creating order:', error);
      setError(error.response?.data?.message || 'Error creating order');
    } finally {
      setSubmitting(false);
    }
  };

  const goBack = () => {
    navigate('/quotations');
  };

  if (loading) {
    return <div className="loading">Loading quotation details...</div>;
  }

  if (!quotation && !loading) {
    return (
      <div className="create-order-container">
        <div className="error-message">
          <h3>No Quotation Selected</h3>
          <p>Please select an accepted quotation to create an order.</p>
          <button className="glow-btn" onClick={goBack} style={{ width: 'auto', marginTop: '15px' }}>
            View Quotations
          </button>
        </div>
      </div>
    );
  }

  // Safely parse numbers for display
  const total = safeParseNumber(quotation?.total_amount || quotation?.total);
  const tax = safeParseNumber(quotation?.tax_amount || quotation?.tax);
  const grandTotal = safeParseNumber(quotation?.grand_total || (total + tax));
  const unitPrice = safeParseNumber(quotation?.unit_price);
  const quantity = safeParseNumber(quotation?.quantity);

  return (
    <div className="create-order-container">
      <h2>Create Order</h2>
      <p className="sub-text">Review and confirm your order details</p>

      {message && <div className="success-message" style={{ whiteSpace: 'pre-line' }}>{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="create-order-form">
        {/* Quotation Information */}
        <div className="form-section">
          <h3>Quotation Information</h3>
          <div className="info-grid">
            <div className="info-item">
              <span className="label">Quotation Number</span>
              <span className="value">{quotation?.quotation_number || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="label">Fuel Type</span>
              <span className="value">{quotation?.fuel_type || 'N/A'}</span>
            </div>
            <div className="info-item">
              <span className="label">Quantity</span>
              <span className="value">{quantity} {quotation?.unit || 'L'}</span>
            </div>
            <div className="info-item">
              <span className="label">Unit Price</span>
              <span className="value">${unitPrice.toFixed(2)}</span>
            </div>
            <div className="info-item">
              <span className="label">Subtotal</span>
              <span className="value">${total.toFixed(2)}</span>
            </div>
            <div className="info-item">
              <span className="label">Tax</span>
              <span className="value">${tax.toFixed(2)}</span>
            </div>
            <div className="info-item highlight">
              <span className="label">Grand Total</span>
              <span className="value grand-total">${grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Delivery Information */}
        <div className="form-section">
          <h3>Delivery Information</h3>
          <div className="form-group">
            <label className="glow-label">Delivery Address</label>
            <input
              type="text"
              name="delivery_address"
              className="glow-input"
              placeholder="Street address"
              value={orderData.delivery_address}
              onChange={handleChange}
            />
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">City</label>
              <input
                type="text"
                name="delivery_city"
                className="glow-input"
                placeholder="City"
                value={orderData.delivery_city}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Province/State</label>
              <input
                type="text"
                name="delivery_state"
                className="glow-input"
                placeholder="Province/State"
                value={orderData.delivery_state}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">Country</label>
              <input
                type="text"
                name="delivery_country"
                className="glow-input"
                placeholder="Country"
                value={orderData.delivery_country}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Postal Code</label>
              <input
                type="text"
                name="delivery_postal_code"
                className="glow-input"
                placeholder="Postal Code"
                value={orderData.delivery_postal_code}
                onChange={handleChange}
              />
            </div>
          </div>
          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">Preferred Delivery Date</label>
              <input
                type="date"
                name="preferredDeliveryDate"
                className="glow-input"
                value={orderData.preferredDeliveryDate}
                onChange={handleChange}
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Preferred Delivery Time</label>
              <input
                type="time"
                name="preferredDeliveryTime"
                className="glow-input"
                value={orderData.preferredDeliveryTime}
                onChange={handleChange}
              />
            </div>
          </div>
        </div>

        {/* Business Information */}
        <div className="form-section">
          <h3>Business Information</h3>
          <div className="form-group">
            <label className="glow-label">Purchase Order Number</label>
            <input
              type="text"
              name="purchaseOrderNumber"
              className="glow-input"
              placeholder="Enter your PO number"
              value={orderData.purchaseOrderNumber}
              onChange={handleChange}
            />
          </div>
          <div className="form-group">
            <label className="glow-label">Upload Purchase Order (Optional)</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="glow-input"
              onChange={handleFileChange}
            />
            <small style={{ color: '#6b7280', fontSize: '12px' }}>PDF, JPG, PNG (Max 5MB)</small>
            {poFile && <span className="file-name">📎 {poFile.name}</span>}
          </div>
          <div className="form-group">
            <label className="glow-label">Additional Notes</label>
            <textarea
              name="notes"
              className="glow-input"
              rows="3"
              placeholder="Any additional information..."
              value={orderData.notes}
              onChange={handleChange}
              style={{ resize: 'vertical' }}
            />
          </div>
        </div>

        {/* Order Summary */}
        <div className="order-summary">
          <div className="summary-total">
            <span>Grand Total</span>
            <span className="total-amount">${grandTotal.toFixed(2)}</span>
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button 
              type="button" 
              className="glow-btn glow-btn-secondary"
              onClick={goBack}
              style={{ width: 'auto', padding: '14px 30px' }}
            >
              Cancel
            </button>
            <button 
              type="submit" 
              className="glow-btn order-btn"
              disabled={submitting}
            >
              {submitting ? 'Creating Order...' : 'Place Order'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default CreateOrder;
