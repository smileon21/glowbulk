import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const Quotations = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [fuelRequests, setFuelRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedQuote, setSelectedQuote] = useState(null);
  
  const [formData, setFormData] = useState({
    fuelRequestId: '',
    unitPrice: '',
    taxRate: '15', // Default tax rate percentage (e.g. 15%)
    validUntil: '',
    deliveryTerms: '',
    paymentTerms: '',
    notes: '',
    status: 'sent'
  });

  const userRole = localStorage.getItem('userRole');
  const isStaff = userRole === 'admin' || userRole === 'marketing';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      let quotesResponse;
      if (isStaff) {
        quotesResponse = await axios.get('`${API_URL}/api/quotations/all');
      } else {
        quotesResponse = await axios.get('`${API_URL}/api/quotations/my-quotations');
      }

      if (quotesResponse.data.success) {
        setQuotations(quotesResponse.data.data);
      }

      if (isStaff) {
        const requestsResponse = await axios.get('`${API_URL}/api/fuel-requests/available-for-quote');
        if (requestsResponse.data.success) {
          setFuelRequests(requestsResponse.data.data);
        }
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Error loading data');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  // --- Dynamic Calculation Logic ---
  const selectedFuelRequest = fuelRequests.find(
    (req) => req.id.toString() === formData.fuelRequestId.toString()
  );

  const quantity = selectedFuelRequest ? parseFloat(selectedFuelRequest.quantity) || 0 : 0;
  const unitPrice = parseFloat(formData.unitPrice) || 0;
  const taxRate = parseFloat(formData.taxRate) || 0;

  const subtotal = quantity * unitPrice;
  const taxAmount = (subtotal * taxRate) / 100;
  const grandTotal = subtotal + taxAmount;
  // ---------------------------------

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      // Payload includes calculated financial totals
      const payload = {
        ...formData,
        subtotal: subtotal.toFixed(2),
        taxAmount: taxAmount.toFixed(2),
        grandTotal: grandTotal.toFixed(2)
      };

      const response = await axios.post('`${API_URL}/api/quotations', payload);

      if (response.data.success) {
        const statusText = formData.status === 'sent' ? ' and sent to customer' : '';
        setMessage(`Quotation created successfully${statusText}!`);
        setShowForm(false);
        setFormData({
          fuelRequestId: '',
          unitPrice: '',
          taxRate: '15',
          validUntil: '',
          deliveryTerms: '',
          paymentTerms: '',
          notes: '',
          status: 'sent'
        });
        fetchData();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error creating quotation');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id, status) => {
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      const response = await axios.put(
        ``${API_URL}/api/quotations/${id}/status`,
        { status }
      );

      if (response.data.success) {
        setMessage(`Quotation ${status} successfully!`);
        setSelectedQuote(null);
        fetchData();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error updating status');
    }
  };

  const acceptQuotation = async (id) => {
    if (!window.confirm('Accept this quotation?')) return;
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.put(``${API_URL}/api/quotations/${id}/accept`);
      if (response.data.success) {
        setMessage('Quotation accepted successfully!');
        setSelectedQuote(null);
        fetchData();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error accepting quotation');
    }
  };

  const rejectQuotation = async (id) => {
    if (!window.confirm('Reject this quotation?')) return;
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.put(``${API_URL}/api/quotations/${id}/reject`);
      if (response.data.success) {
        setMessage('Quotation rejected');
        setSelectedQuote(null);
        fetchData();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error rejecting quotation');
    }
  };

  // Navigate to Create Order page
  const handleCreateOrder = (quotationId) => {
    navigate(`/create-order?quotationId=${quotationId}`);
  };

  const getStatusBadge = (status) => {
    const statusMap = {
      'draft': { color: '#6c757d', text: 'Draft' },
      'sent': { color: '#17a2b8', text: 'Sent' },
      'accepted': { color: '#28a745', text: 'Accepted' },
      'rejected': { color: '#dc3545', text: 'Rejected' },
      'expired': { color: '#ffc107', text: 'Expired' }
    };
    const s = statusMap[status] || { color: '#6c757d', text: status };
    return <span className="status-badge" style={{ background: s.color }}>{s.text}</span>;
  };

  const formatCurrency = (amount) => {
    if (!amount) return '$0.00';
    return '$' + Number(amount).toFixed(2);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="quotations-page">
      <div className="page-header">
        <h2>Quotations</h2>
        {isStaff && (
          <button className="glow-btn" onClick={() => setShowForm(!showForm)}>
            {showForm ? 'Cancel' : '+ New Quotation'}
          </button>
        )}
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {/* Create Quotation Form */}
      {showForm && isStaff && (
        <div className="quotation-form glow-card">
          <h3>Create Quotation</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="glow-label">Select Fuel Request *</label>
              <select
                name="fuelRequestId"
                className="glow-input"
                value={formData.fuelRequestId}
                onChange={handleChange}
                required
              >
                <option value="">Select a fuel request...</option>
                {fuelRequests.length === 0 ? (
                  <option value="" disabled>No available fuel requests</option>
                ) : (
                  fuelRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.fuel_type} - {request.quantity} {request.unit} - {request.company_name || 'Customer'}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="glow-label">Unit Price ($) *</label>
                <input
                  type="number"
                  name="unitPrice"
                  className="glow-input"
                  value={formData.unitPrice}
                  onChange={handleChange}
                  required
                  placeholder="e.g., 1.50"
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="glow-label">Tax Rate (%) *</label>
                <input
                  type="number"
                  name="taxRate"
                  className="glow-input"
                  value={formData.taxRate}
                  onChange={handleChange}
                  required
                  placeholder="e.g., 15"
                  step="0.01"
                  min="0"
                />
              </div>

              <div className="form-group">
                <label className="glow-label">Valid Until *</label>
                <input
                  type="date"
                  name="validUntil"
                  className="glow-input"
                  value={formData.validUntil}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            {/* Dynamic Total Summary Panel */}
            <div className="calculation-summary">
              <p><strong>Subtotal:</strong> ${subtotal.toFixed(2)} ({quantity} units @ ${unitPrice || 0}/unit)</p>
              <p><strong>Tax ({taxRate}%):</strong> ${taxAmount.toFixed(2)}</p>
              <p className="grand-total-line">
                <strong>Grand Total:</strong> ${grandTotal.toFixed(2)}
              </p>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="glow-label">Delivery Terms</label>
                <input
                  type="text"
                  name="deliveryTerms"
                  className="glow-input"
                  value={formData.deliveryTerms}
                  onChange={handleChange}
                  placeholder="e.g., Delivery within 3 business days"
                />
              </div>
              <div className="form-group">
                <label className="glow-label">Payment Terms</label>
                <input
                  type="text"
                  name="paymentTerms"
                  className="glow-input"
                  value={formData.paymentTerms}
                  onChange={handleChange}
                  placeholder="e.g., Payment within 7 days of invoice"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="glow-label">Notes</label>
              <textarea
                name="notes"
                className="glow-input"
                value={formData.notes}
                onChange={handleChange}
                rows="3"
                placeholder="Any additional notes..."
              />
            </div>

            <div className="form-group">
              <label className="glow-label">Status *</label>
              <select
                name="status"
                className="glow-input"
                value={formData.status}
                onChange={handleChange}
                required
              >
                <option value="draft">Draft</option>
                <option value="sent">Send to Customer</option>
              </select>
            </div>

            <button type="submit" className="glow-btn" disabled={fuelRequests.length === 0}>
              {fuelRequests.length === 0 
                ? 'No Requests Available' 
                : formData.status === 'sent' ? 'Create & Send' : 'Create Draft'}
            </button>
          </form>
        </div>
      )}

      {/* Quotations List */}
      <div className="quotations-list">
        {quotations.length === 0 ? (
          <div className="glow-card no-content">
            <p>No quotations yet.</p>
          </div>
        ) : (
          <div className="quotations-grid">
            {quotations.map((quote) => (
              <div
                key={quote.id}
                className="quote-card glow-card"
                onClick={() => setSelectedQuote(quote)}
                style={{ cursor: 'pointer' }}
              >
                <div className="quote-header">
                  <h3> {quote.quotation_number}</h3>
                  {getStatusBadge(quote.status)}
                </div>
                <div className="quote-details">
                  <p><strong>Fuel Type:</strong> {quote.fuel_type}</p>
                  <p><strong>Quantity:</strong> {quote.quantity} {quote.unit}</p>
                  <p><strong>Grand Total:</strong> {formatCurrency(quote.grand_total)}</p>
                  <p><strong>Valid Until:</strong> {new Date(quote.valid_until).toLocaleDateString()}</p>
                </div>
                <div className="quote-footer">
                  <small>Created: {new Date(quote.created_at).toLocaleDateString()}</small>
                  <span className="stat-btn">View Details →</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quotation Detail Modal */}
      {selectedQuote && (
        <div className="modal-overlay" onClick={() => setSelectedQuote(null)}>
          <div className="modal-content glow-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3> {selectedQuote.quotation_number}</h3>
              <button className="modal-close" onClick={() => setSelectedQuote(null)}>✕</button>
            </div>

            <div className="modal-status-row">
              {getStatusBadge(selectedQuote.status)}
            </div>

            <div className="modal-details">
              {selectedQuote.company_name && (
                <div className="modal-detail-item">
                  <span className="detail-label">Customer</span>
                  <span className="detail-value">{selectedQuote.company_name}</span>
                </div>
              )}
              <div className="modal-detail-item">
                <span className="detail-label">Fuel Type</span>
                <span className="detail-value">{selectedQuote.fuel_type}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Quantity</span>
                <span className="detail-value">{selectedQuote.quantity} {selectedQuote.unit}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Unit Price</span>
                <span className="detail-value">{formatCurrency(selectedQuote.unit_price)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Subtotal</span>
                <span className="detail-value">{formatCurrency(selectedQuote.subtotal || selectedQuote.total_amount)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Tax</span>
                <span className="detail-value">{formatCurrency(selectedQuote.tax_amount || selectedQuote.tax)}</span>
              </div>
              <div className="modal-detail-item modal-detail-highlight">
                <span className="detail-label">Grand Total</span>
                <span className="detail-value">{formatCurrency(selectedQuote.grand_total)}</span>
              </div>
              {selectedQuote.valid_until && (
                <div className="modal-detail-item">
                  <span className="detail-label">Valid Until</span>
                  <span className="detail-value">{new Date(selectedQuote.valid_until).toLocaleDateString()}</span>
                </div>
              )}
            </div>

            <div className="modal-actions">
              {/* Staff Actions */}
              {selectedQuote.status === 'draft' && isStaff && (
                <button className="glow-btn" onClick={() => updateStatus(selectedQuote.id, 'sent')}>
                   Send to Customer
                </button>
              )}
              {(selectedQuote.status === 'draft' || selectedQuote.status === 'sent') && isStaff && (
                <button className="glow-btn glow-btn-secondary" onClick={() => updateStatus(selectedQuote.id, 'expired')}>
                  Expire
                </button>
              )}

              {/* Customer Actions */}
              {selectedQuote.status === 'sent' && userRole === 'customer' && (
                <>
                  <button className="glow-btn" onClick={() => acceptQuotation(selectedQuote.id)}>
                     Accept Quotation
                  </button>
                  <button className="glow-btn glow-btn-secondary" onClick={() => rejectQuotation(selectedQuote.id)}>
                     Reject
                  </button>
                </>
              )}

              {/* Create Order Button - Show when quotation is accepted */}
              {selectedQuote.status === 'accepted' && userRole === 'customer' && (
                <button 
                  className="glow-btn" 
                  onClick={() => handleCreateOrder(selectedQuote.id)}
                  style={{ background: '#059669' }}
                >
                   Create Order
                </button>
              )}

              {/* View Order Button - If order already exists */}
              {selectedQuote.status === 'accepted' && userRole === 'customer' && selectedQuote.has_order && (
                <button 
                  className="glow-btn glow-btn-secondary" 
                  onClick={() => navigate('/orders')}
                >
                  View Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
