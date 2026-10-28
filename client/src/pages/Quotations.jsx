import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { formatDate } from '../utils/format';

// A quotation stays valid for this many hours
const QUOTE_VALIDITY_HOURS = 72;
// Marketing can edit a sent (or just-accepted) quotation for this many minutes
const EDIT_WINDOW_MINUTES = 15;

const Quotations = () => {
  const navigate = useNavigate();
  const [quotations, setQuotations] = useState([]);
  const [fuelRequests, setFuelRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [selectedQuote, setSelectedQuote] = useState(null);
  // Set right after a customer accepts, so the success message can offer "Create Order"
  const [justAcceptedId, setJustAcceptedId] = useState(null);
  // Current time, refreshed every 10 seconds so countdowns stay live
  const [now, setNow] = useState(Date.now());

  // Edit-modal state (Marketing only)
  const [editQuote, setEditQuote] = useState(null);
  const [editForm, setEditForm] = useState({
    unitPrice: '', deliveryTerms: '', paymentTerms: '', notes: '', reason: ''
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [formData, setFormData] = useState({
    fuelRequestId: '',
    unitPrice: '',
    validUntil: '',
    deliveryTerms: '',
    paymentTerms: '',
    notes: '',
    preparedBy: '',
    status: 'sent'
  });

  const userRole = localStorage.getItem('userRole');
  // Marketing: creates, sends, edits quotations
  const isMarketing = userRole === 'marketing';
  // Staff: can view all quotations (pricing + finance dashboards use this too)
  const isStaff = ['marketing', 'pricing', 'finance'].includes(userRole);
  const isCustomer = userRole === 'customer';

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    var timer = setInterval(function() { setNow(Date.now()); }, 10000);
    return function() { clearInterval(timer); };
  }, []);

  const fetchData = async () => {
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      let quotesResponse;
      if (isStaff) {
        quotesResponse = await axios.get(API_BASE_URL + '/api/quotations/all');
      } else {
        quotesResponse = await axios.get(API_BASE_URL + '/api/quotations/my-quotations');
      }

      if (quotesResponse.data.success) {
        setQuotations(quotesResponse.data.data);
      }

      // Only Marketing needs the "available for quote" list
      if (isMarketing) {
        const requestsResponse = await axios.get(API_BASE_URL + '/api/fuel-requests/available-for-quote');
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

  const handleChange = function(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  var selectedFuelRequest = fuelRequests.find(function(req) {
    return req.id.toString() === formData.fuelRequestId.toString();
  });

  var quantity = selectedFuelRequest ? parseFloat(selectedFuelRequest.quantity) || 0 : 0;
  var unitPrice = parseFloat(formData.unitPrice) || 0;

  var subtotal = quantity * unitPrice;
  var grandTotal = subtotal;

  const handleSubmit = async function(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setJustAcceptedId(null);
    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      // Quotes are valid for 72 hours, so staff no longer pick a date
      var validUntilDate = new Date(Date.now() + QUOTE_VALIDITY_HOURS * 3600000);
      var pad = function(n) { return String(n).padStart(2, '0'); };
      var validUntilStr = validUntilDate.getFullYear() + '-' +
        pad(validUntilDate.getMonth() + 1) + '-' + pad(validUntilDate.getDate());

      var payload = {
        ...formData,
        preparedBy: formData.preparedBy.trim(),
        validUntil: validUntilStr,
        subtotal: subtotal.toFixed(2),
        taxAmount: '0.00',
        grandTotal: grandTotal.toFixed(2)
      };

      const response = await axios.post(API_BASE_URL + '/api/quotations', payload);

      if (response.data.success) {
        var statusText = formData.status === 'sent' ? ' and sent to customer' : '';
        setMessage('Quotation created successfully' + statusText + '!');
        setShowForm(false);
        setFormData({
          fuelRequestId: '',
          unitPrice: '',
          validUntil: '',
          deliveryTerms: '',
          paymentTerms: '',
          notes: '',
          preparedBy: '',
          status: 'sent'
        });
        fetchData();
      }
    } catch (error) {
      var data = error.response && error.response.data;
      setError(
        (data && data.errors && data.errors[0] && data.errors[0].msg) ||
        (data && data.message) ||
        'Error creating quotation'
      );
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async function(id, status) {
    setJustAcceptedId(null);
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      const response = await axios.put(
        API_BASE_URL + '/api/quotations/' + id + '/status',
        { status: status }
      );

      if (response.data.success) {
        setMessage('Quotation ' + status + ' successfully!');
        setSelectedQuote(null);
        fetchData();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error updating status');
    }
  };

  // Customer accepts a specific version they are looking at
  const acceptQuotation = async function(quote) {
    if (!window.confirm('Accept this quotation?')) return;
    setError('');
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      const response = await axios.put(
        API_BASE_URL + '/api/quotations/' + quote.id + '/accept',
        { version: quote.current_version || 1 }
      );
      if (response.data.success) {
        setMessage('Quotation accepted! You can now create your order.');
        setJustAcceptedId(quote.id);
        setSelectedQuote(null);
        fetchData();
      }
    } catch (error) {
      var data = error.response && error.response.data;
      setError((data && data.message) || 'Error accepting quotation');
      // Edited while the customer was looking: close the old view and reload the new one
      if (data && data.code === 'QUOTATION_UPDATED') {
        setSelectedQuote(null);
        fetchData();
      }
    }
  };

  const rejectQuotation = async function(id) {
    if (!window.confirm('Reject this quotation?')) return;
    setJustAcceptedId(null);
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      const response = await axios.put(API_BASE_URL + '/api/quotations/' + id + '/reject');
      if (response.data.success) {
        setMessage('Quotation rejected');
        setSelectedQuote(null);
        fetchData();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error rejecting quotation');
    }
  };

  const handleCreateOrder = function(quotationId) {
    navigate('/create-order?quotationId=' + quotationId);
  };

  // Accepted by the customer but no order placed yet
  const isReadyToOrder = function(quote) {
    return isCustomer && quote.status === 'accepted' && !quote.has_order;
  };

  const getStatusBadge = function(status) {
    var statusMap = {
      'draft': { color: '#6c757d', text: 'Draft' },
      'sent': { color: '#17a2b8', text: 'Sent' },
      'accepted': { color: '#28a745', text: 'Accepted' },
      'rejected': { color: '#dc3545', text: 'Rejected' },
      'expired': { color: '#ffc107', text: 'Expired' }
    };
    var s = statusMap[status] || { color: '#6c757d', text: status };
    return <span className="status-badge" style={{ background: s.color }}>{s.text}</span>;
  };

  var formatCurrency = function(amount) {
    if (!amount) return '$0.00';
    return '$' + Number(amount).toFixed(2);
  };

  // Date with time, e.g. "20 Oct 2026, 14:35"
  var formatDateTime = function(dateString) {
    if (!dateString) return 'Not specified';
    var date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false
    });
  };

  // When the 72-hour window ends: counted from when the quote was sent
  // (falls back to when it was created if the API has no sent_at field)
  var getExpiresAt = function(quote) {
    var start = new Date(quote.sent_at || quote.created_at);
    if (isNaN(start.getTime())) return null;
    return start.getTime() + QUOTE_VALIDITY_HOURS * 3600000;
  };

  // When the 15-minute edit window ends (Marketing only)
  var getEditEndsAt = function(quote) {
    var start = new Date(quote.sent_at || quote.created_at);
    if (isNaN(start.getTime())) return null;
    return start.getTime() + EDIT_WINDOW_MINUTES * 60000;
  };

  // Whole minutes left in the edit window, or 0 when it is closed.
  // Works for 'sent' quotations and for 'accepted' ones (editing cancels the acceptance).
  var editMinutesLeft = function(quote) {
    var st = getEffectiveStatus(quote);
    if (!isMarketing || (st !== 'sent' && st !== 'accepted')) return 0;
    var end = getEditEndsAt(quote);
    if (end === null || now >= end) return 0;
    return Math.max(1, Math.ceil((end - now) / 60000));
  };

  // A quote that was sent but ran out of time counts as expired
  var getEffectiveStatus = function(quote) {
    if (quote.status === 'sent') {
      var end = getExpiresAt(quote);
      if (end !== null && now >= end) return 'expired';
    }
    return quote.status;
  };

  // "2d 5h", "5h 20m" or "40m"
  var formatTimeLeft = function(ms) {
    var totalMinutes = Math.max(0, Math.floor(ms / 60000));
    var days = Math.floor(totalMinutes / 1440);
    var hours = Math.floor((totalMinutes % 1440) / 60);
    var minutes = totalMinutes % 60;
    if (days > 0) return days + 'd ' + hours + 'h';
    if (hours > 0) return hours + 'h ' + minutes + 'm';
    return minutes + 'm';
  };

  // Countdown shown on quotes still waiting for an answer
  var getExpiryNote = function(quote) {
    if (quote.status !== 'sent') return null;
    var end = getExpiresAt(quote);
    if (end === null) return null;
    var left = end - now;
    if (left <= 0) return { text: 'Expired', tone: 'late' };
    // Less than 24 hours left = urgent
    return {
      text: 'Expires in ' + formatTimeLeft(left),
      tone: left < 24 * 3600000 ? 'soon' : 'ok'
    };
  };

  // Value for the "Expires" rows (card and details window)
  var getExpiresLabel = function(quote) {
    if (quote.status === 'draft') return 'Starts when sent';
    var end = getExpiresAt(quote);
    return end === null ? 'Not specified' : formatDateTime(end);
  };

  // ----- Edit modal handlers (Marketing only) -----

  var openEdit = function(quote) {
    setEditError('');
    setEditForm({
      unitPrice: quote.unit_price,
      deliveryTerms: quote.delivery_terms || '',
      paymentTerms: quote.payment_terms || '',
      notes: quote.notes || '',
      reason: ''
    });
    setEditQuote(quote);
    setSelectedQuote(null);
  };

  var handleEditChange = function(e) {
    setEditForm({ ...editForm, [e.target.name]: e.target.value });
  };

  const submitEdit = async function(e) {
    e.preventDefault();
    setEditError('');
    setMessage('');
    setEditSaving(true);
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      const response = await axios.put(
        API_BASE_URL + '/api/quotations/' + editQuote.id + '/edit',
        {
          unitPrice: editForm.unitPrice,
          deliveryTerms: editForm.deliveryTerms,
          paymentTerms: editForm.paymentTerms,
          notes: editForm.notes,
          reason: editForm.reason
        }
      );
      if (response.data.success) {
        setMessage(
          response.data.wasAccepted
            ? 'Quotation updated. The customer\'s acceptance was cancelled and they have been asked to accept the new version.'
            : 'Quotation updated. The customer has been notified of the change.'
        );
        setEditQuote(null);
        fetchData();
      }
    } catch (err) {
      var data = err.response && err.response.data;
      setEditError(
        (data && data.errors && data.errors[0] && data.errors[0].msg) ||
        (data && data.message) ||
        'Error updating quotation'
      );
      // If the window closed or the quotation changed state, refresh the list
      if (data && data.code) fetchData();
    } finally {
      setEditSaving(false);
    }
  };

  // Newest first, so the most recent quote is always on top
  var sortedQuotations = quotations.slice().sort(function(a, b) {
    return new Date(b.created_at) - new Date(a.created_at);
  });
  var latestId = sortedQuotations.length > 0 ? sortedQuotations[0].id : null;

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="quotations-page">
      <div className="page-header">
        <h2>Quotations</h2>
        {isMarketing && (
          <button className="glow-btn" onClick={function() { setShowForm(!showForm); }}>
            {showForm ? 'Cancel' : '+ New Quotation'}
          </button>
        )}
      </div>

      {message && (
        <div className="success-message success-with-action">
          <span>{message}</span>
          {justAcceptedId && (
            <button
              className="glow-btn glow-btn-small"
              onClick={function() { handleCreateOrder(justAcceptedId); }}
            >
              Create Order →
            </button>
          )}
        </div>
      )}
      {error && <div className="error-message">{error}</div>}

      {showForm && isMarketing && (
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
                  fuelRequests.map(function(request) {
                    return (
                      <option key={request.id} value={request.id}>
                        {request.fuel_type} - {request.quantity} {request.unit} - {request.company_name || 'Customer'}
                      </option>
                    );
                  })
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
                <label className="glow-label">Validity</label>
                <div className="validity-fixed">
                  Valid for {QUOTE_VALIDITY_HOURS} hours after it is sent
                </div>
              </div>
            </div>

            <div className="calculation-summary">
              <p><strong>Subtotal:</strong> ${subtotal.toFixed(2)} ({quantity} units @ ${unitPrice || 0}/unit)</p>
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
              <label className="glow-label">Prepared by *</label>
              <input
                type="text"
                name="preparedBy"
                className="glow-input"
                value={formData.preparedBy}
                onChange={handleChange}
                required
                maxLength={100}
                placeholder="Enter your full name"
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

      <div className="quotations-list">
        {sortedQuotations.length === 0 ? (
          <div className="glow-card no-content">
            <p>No quotations yet.</p>
            {isCustomer && <p>Use Get a Quote to request one.</p>}
          </div>
        ) : (
          <div className="quotations-grid">
            {sortedQuotations.map(function(quote) {
              var isLatest = quote.id === latestId;
              var effectiveStatus = getEffectiveStatus(quote);
              var needsResponse = isCustomer && effectiveStatus === 'sent';
              var expiry = isCustomer ? getExpiryNote(quote) : null;

              return (
                <div
                  key={quote.id}
                  className={'quote-card glow-card' + (isLatest ? ' quote-card-latest' : '')}
                  onClick={function() { setSelectedQuote(quote); }}
                  style={{ cursor: 'pointer' }}
                >
                  <div className="quote-header">
                    <div className="quote-title">
                      <h3>{quote.quotation_number}</h3>
                      {isLatest && <span className="latest-pill">Latest</span>}
                      {quote.edited && <span className="edited-tag">Edited</span>}
                    </div>
                    {getStatusBadge(effectiveStatus)}
                  </div>
                  <div className="quote-details">
                    <p><strong>Fuel Type:</strong> {quote.fuel_type}</p>
                    <p><strong>Quantity:</strong> {quote.quantity} {quote.unit}</p>
                    <p><strong>Grand Total:</strong> {formatCurrency(quote.grand_total)}</p>
                    {quote.created_by_name && (
                      <p><strong>Prepared by:</strong> {quote.created_by_name}</p>
                    )}
                    <p><strong>Expires:</strong> {getExpiresLabel(quote)}</p>
                  </div>

                  {(needsResponse || expiry) && (
                    <div className="quote-attention">
                      {needsResponse && <span className="action-tag">Needs your response</span>}
                      {expiry && (
                        <span className={'expiry-note ' + expiry.tone}>{expiry.text}</span>
                      )}
                    </div>
                  )}

                  <div className="quote-footer">
                    <small>Created: {formatDateTime(quote.created_at)}</small>
                    {isReadyToOrder(quote) && (
                      <span className="ready-tag">Ready to order</span>
                    )}
                    <span className="stat-btn">
                      View Details <span className="stat-btn-arrow">→</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {selectedQuote && (
        <div className="modal-overlay" onClick={function() { setSelectedQuote(null); }}>
          <div className="modal-content glow-card" onClick={function(e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <h3>{selectedQuote.quotation_number}</h3>
              <button className="modal-close" onClick={function() { setSelectedQuote(null); }}>✕</button>
            </div>

            <div className="modal-status-row">
              {getStatusBadge(getEffectiveStatus(selectedQuote))}
              {selectedQuote.id === latestId && <span className="latest-pill">Latest</span>}
              {selectedQuote.edited && (
                <span className="edited-tag">Edited · version {selectedQuote.current_version}</span>
              )}
              {isReadyToOrder(selectedQuote) && (
                <span className="ready-tag">Ready to order</span>
              )}
            </div>

            <div className="modal-details">
              {selectedQuote.company_name && (
                <div className="modal-detail-item">
                  <span className="detail-label">Customer</span>
                  <span className="detail-value">{selectedQuote.company_name}</span>
                </div>
              )}
              {selectedQuote.created_by_name && (
                <div className="modal-detail-item">
                  <span className="detail-label">Prepared by</span>
                  <span className="detail-value">{selectedQuote.created_by_name}</span>
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
              <div className="modal-detail-item modal-detail-highlight">
                <span className="detail-label">Grand Total</span>
                <span className="detail-value">{formatCurrency(selectedQuote.grand_total)}</span>
              </div>
              <div className="modal-detail-item">
                <span className="detail-label">Expires</span>
                <span className="detail-value">{getExpiresLabel(selectedQuote)}</span>
              </div>
              {selectedQuote.created_at && (
                <div className="modal-detail-item">
                  <span className="detail-label">Created</span>
                  <span className="detail-value">{formatDateTime(selectedQuote.created_at)}</span>
                </div>
              )}
            </div>

            {isCustomer && selectedQuote.status === 'sent' && getEffectiveStatus(selectedQuote) === 'expired' && (
              <div className="error-message">
                This quotation has expired. Use Get a Quote to request a new one.
              </div>
            )}

            <div className="modal-actions">
              {selectedQuote.status === 'draft' && isMarketing && (
                <button className="glow-btn" onClick={function() { updateStatus(selectedQuote.id, 'sent'); }}>
                  Send to Customer
                </button>
              )}
              {(selectedQuote.status === 'draft' || selectedQuote.status === 'sent') && isMarketing && (
                <button className="glow-btn glow-btn-secondary" onClick={function() { updateStatus(selectedQuote.id, 'expired'); }}>
                  Expire
                </button>
              )}

              {/* Marketing can edit a sent OR accepted quotation until the 15 minutes are up
                  (an accepted one that already has an order can't be edited) */}
              {isMarketing && (selectedQuote.status === 'sent' || selectedQuote.status === 'accepted') && !selectedQuote.has_order && (
                editMinutesLeft(selectedQuote) > 0 ? (
                  <button className="glow-btn" onClick={function() { openEdit(selectedQuote); }}>
                    Edit ({editMinutesLeft(selectedQuote)} min left)
                  </button>
                ) : selectedQuote.status === 'sent' ? (
                  <span className="form-hint">
                    The {EDIT_WINDOW_MINUTES}-minute edit window has ended. To change the price, expire this
                    quotation and create a new one.
                  </span>
                ) : null
              )}

              {getEffectiveStatus(selectedQuote) === 'sent' && isCustomer && (
                <>
                  <button className="glow-btn" onClick={function() { acceptQuotation(selectedQuote); }}>
                    Accept Quotation
                  </button>
                  <button className="glow-btn glow-btn-secondary" onClick={function() { rejectQuotation(selectedQuote.id); }}>
                    Reject
                  </button>
                </>
              )}

              {/* Only one of these shows: create the order, or view the one already placed */}
              {isReadyToOrder(selectedQuote) && (
                <button className="glow-btn" onClick={function() { handleCreateOrder(selectedQuote.id); }}>
                  Create Order
                </button>
              )}

              {selectedQuote.status === 'accepted' && isCustomer && selectedQuote.has_order && (
                <button className="glow-btn glow-btn-secondary" onClick={function() { navigate('/orders'); }}>
                  View Order
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {editQuote && (
        <div className="modal-overlay" onClick={function() { if (!editSaving) setEditQuote(null); }}>
          <div className="modal-content glow-card" onClick={function(e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <h3>Edit {editQuote.quotation_number}</h3>
              <button className="modal-close" onClick={function() { setEditQuote(null); }}>✕</button>
            </div>

            <p className="form-hint">
              {editMinutesLeft(editQuote) > 0
                ? 'You can edit for ' + editMinutesLeft(editQuote) + ' more minute(s). The customer will be notified of the change.'
                : 'The edit window has ended. Saving will be refused.'}
            </p>

            {editQuote.status === 'accepted' && (
              <div className="error-message">
                The customer already accepted this quotation. Saving will cancel their acceptance
                and they will have to accept the new version.
              </div>
            )}

            {editError && <div className="error-message">{editError}</div>}

            <form onSubmit={submitEdit}>
              <div className="form-group">
                <label className="glow-label">Unit Price ($) *</label>
                <input
                  type="number"
                  name="unitPrice"
                  className="glow-input"
                  value={editForm.unitPrice}
                  onChange={handleEditChange}
                  required
                  step="0.01"
                  min="0"
                />
                <span className="form-hint">
                  Total: {formatCurrency(editQuote.grand_total)} →{' '}
                  <strong>{formatCurrency((parseFloat(editQuote.quantity) || 0) * (parseFloat(editForm.unitPrice) || 0))}</strong>
                  {' '}({editQuote.quantity} {editQuote.unit})
                </span>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label className="glow-label">Delivery Terms</label>
                  <input type="text" name="deliveryTerms" className="glow-input"
                    value={editForm.deliveryTerms} onChange={handleEditChange} />
                </div>
                <div className="form-group">
                  <label className="glow-label">Payment Terms</label>
                  <input type="text" name="paymentTerms" className="glow-input"
                    value={editForm.paymentTerms} onChange={handleEditChange} />
                </div>
              </div>

              <div className="form-group">
                <label className="glow-label">Notes</label>
                <textarea name="notes" className="glow-input" rows="2"
                  value={editForm.notes} onChange={handleEditChange} />
              </div>

              <div className="form-group">
                <label className="glow-label">Reason for the edit *</label>
                <input
                  type="text"
                  name="reason"
                  className="glow-input"
                  value={editForm.reason}
                  onChange={handleEditChange}
                  required
                  placeholder="e.g., Typed 1.05 instead of 1.50"
                />
                <span className="form-hint">Saved with your name in the quotation history.</span>
              </div>

              <div className="modal-actions">
                <button type="submit" className="glow-btn" disabled={editSaving || !editForm.reason.trim()}>
                  {editSaving ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" className="glow-btn glow-btn-secondary"
                  onClick={function() { setEditQuote(null); }} disabled={editSaving}>
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Quotations;
