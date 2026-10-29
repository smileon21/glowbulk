import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import { formatDate } from '../utils/format';

// A quotation stays valid for this many hours
const QUOTE_VALIDITY_HOURS = 72;
// Marketing can edit a sent (or just-accepted) quotation for this many minutes
const EDIT_WINDOW_MINUTES = 15;

// The marketing team shares one login, so each person types their own name.
// The name is kept for this browser tab only (it is forgotten when the tab is closed),
// so it is pre-filled for the next action but can always be changed.
const NAME_STORAGE_KEY = 'marketingPersonName';

var readSavedName = function() {
  try {
    return sessionStorage.getItem(NAME_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
};

// Prices keep up to 4 decimals (a 2.5 cent discount gives 1.475), totals keep 2
var round4 = function(n) { return Math.round(n * 10000) / 10000; };
var round2 = function(n) { return Math.round(n * 100) / 100; };

var CATEGORY_LABELS = { regular: 'Regular', long_term: 'Long term' };

var categoryLabel = function(category) {
  return CATEGORY_LABELS[category] || 'Not set';
};

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

  // The name of the marketing person using the shared login right now
  const [myName, setMyNameState] = useState(readSavedName());

  // Customer shown in the new-quotation form (details, category, discount)
  const [customerInfo, setCustomerInfo] = useState(null);
  const [infoLoading, setInfoLoading] = useState(false);
  const [infoError, setInfoError] = useState('');

  // Edit-modal state (Marketing only)
  const [editQuote, setEditQuote] = useState(null);
  const [editForm, setEditForm] = useState({
    basePrice: '', deliveryTerms: '', paymentTerms: '', notes: '', reason: ''
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const [formData, setFormData] = useState({
    fuelRequestId: '',
    basePrice: '',
    deliveryTerms: '',
    paymentTerms: '',
    notes: '',
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

  // Load the customer's details, category and discount when a fuel request is picked
  useEffect(() => {
    if (!showForm || !formData.fuelRequestId) {
      setCustomerInfo(null);
      setInfoError('');
      return;
    }

    var cancelled = false;
    setInfoLoading(true);
    setInfoError('');
    setCustomerInfo(null);

    axios.get(API_BASE_URL + '/api/quotations/customer-info/' + formData.fuelRequestId)
      .then(function(response) {
        if (cancelled) return;
        if (response.data.success) {
          setCustomerInfo(response.data.data);
        }
      })
      .catch(function(err) {
        if (cancelled) return;
        var data = err.response && err.response.data;
        setInfoError((data && data.message) || 'Could not load the customer details');
      })
      .finally(function() {
        if (!cancelled) setInfoLoading(false);
      });

    return function() { cancelled = true; };
  }, [formData.fuelRequestId, showForm]);

  const setMyName = function(value) {
    setMyNameState(value);
    try {
      sessionStorage.setItem(NAME_STORAGE_KEY, value);
    } catch (e) {
      // Storage unavailable: the name just won't be remembered
    }
  };

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

  // ----- New-quotation maths (the server repeats this and is the one that counts) -----
  var quantity = selectedFuelRequest ? parseFloat(selectedFuelRequest.quantity) || 0 : 0;
  var requestUnit = selectedFuelRequest && selectedFuelRequest.unit ? selectedFuelRequest.unit : 'litres';
  var basePrice = parseFloat(formData.basePrice) || 0;
  var discountCents = customerInfo ? parseFloat(customerInfo.discount_cents_per_litre) || 0 : 0;
  var discountDollars = discountCents / 100;
  // Price per litre = the day's price minus the customer's discount
  var finalPrice = round4(basePrice - discountDollars);

  var subtotal = round2(quantity * finalPrice);
  var grandTotal = subtotal;

  var priceTooLow = basePrice > 0 && finalPrice <= 0;
  var nameMissing = !myName.trim();
  var canCreate = fuelRequests.length > 0 && !!customerInfo && basePrice > 0 && finalPrice > 0 && !nameMissing;

  const handleSubmit = async function(e) {
    e.preventDefault();
    setMessage('');
    setError('');
    setJustAcceptedId(null);

    if (nameMissing) {
      setError('Please enter your name before creating the quotation');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      // The server works out the discount, price per litre, total and validity itself
      var payload = {
        fuelRequestId: formData.fuelRequestId,
        basePrice: formData.basePrice,
        deliveryTerms: formData.deliveryTerms,
        paymentTerms: formData.paymentTerms,
        notes: formData.notes,
        status: formData.status,
        preparedBy: myName.trim()
      };

      const response = await axios.post(API_BASE_URL + '/api/quotations', payload);

      if (response.data.success) {
        var statusText = formData.status === 'sent' ? ' and sent to customer' : '';
        setMessage('Quotation created successfully' + statusText + '!');
        setShowForm(false);
        setCustomerInfo(null);
        setFormData({
          fuelRequestId: '',
          basePrice: '',
          deliveryTerms: '',
          paymentTerms: '',
          notes: '',
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
    setError('');

    if (!myName.trim()) {
      setError('Please enter your name first');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      const response = await axios.put(
        API_BASE_URL + '/api/quotations/' + id + '/status',
        { status: status, actorName: myName.trim() }
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

  // Price per litre: at least 2 decimals, up to 4 (1.50, 1.47, 1.475)
  var formatPrice = function(amount) {
    var n = Number(amount);
    if (!isFinite(n)) return '$0.00';
    return '$' + n.toFixed(4).replace(/0{1,2}$/, '');
  };

  // Cents per litre, e.g. "3 cents per litre"
  var formatDiscount = function(cents) {
    var n = Number(cents) || 0;
    return String(n) + ' cents per litre';
  };

  var joinAddress = function(info) {
    return [info.billing_address, info.billing_city, info.billing_state, info.billing_country]
      .filter(function(part) { return part && String(part).trim(); })
      .join(', ');
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

  // True when a quotation has the day's price and discount saved on it
  // (quotations made before the discount feature only have a unit price)
  var hasPriceBreakdown = function(quote) {
    return quote.base_price !== null && quote.base_price !== undefined;
  };

  // ----- Edit modal handlers (Marketing only) -----

  var openEdit = function(quote) {
    setEditError('');
    setEditForm({
      // Older quotations have no day's price, and no discount either, so the unit price is the base
      basePrice: hasPriceBreakdown(quote) ? quote.base_price : quote.unit_price,
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

    if (!myName.trim()) {
      setEditError('Please enter your name before saving the edit');
      return;
    }

    setEditSaving(true);
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      const response = await axios.put(
        API_BASE_URL + '/api/quotations/' + editQuote.id + '/edit',
        {
          basePrice: editForm.basePrice,
          deliveryTerms: editForm.deliveryTerms,
          paymentTerms: editForm.paymentTerms,
          notes: editForm.notes,
          reason: editForm.reason,
          editedBy: myName.trim()
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

  // Edit-modal maths: the discount saved on the quotation is kept, only the day's price changes
  var editDiscountCents = editQuote ? parseFloat(editQuote.discount_cents_per_litre) || 0 : 0;
  var editBasePrice = parseFloat(editForm.basePrice) || 0;
  var editNewUnitPrice = round4(editBasePrice - editDiscountCents / 100);
  var editQuantity = editQuote ? parseFloat(editQuote.quantity) || 0 : 0;
  var editNewTotal = round2(editQuantity * editNewUnitPrice);
  var editPriceTooLow = editBasePrice > 0 && editNewUnitPrice <= 0;

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

            {formData.fuelRequestId && infoLoading && (
              <p className="form-hint">Loading customer details...</p>
            )}
            {formData.fuelRequestId && infoError && (
              <div className="error-message">{infoError}</div>
            )}

            {customerInfo && (
              <div className="calculation-summary">
                <p>
                  <strong>Customer:</strong>{' '}
                  {customerInfo.company_name || customerInfo.contact_person_name || 'Customer #' + customerInfo.id}
                </p>
                {customerInfo.account_type && (
                  <p><strong>Account type:</strong> {String(customerInfo.account_type).replace(/_/g, ' ')}</p>
                )}
                {customerInfo.contact_person_name && (
                  <p><strong>Contact person:</strong> {customerInfo.contact_person_name}</p>
                )}
                {customerInfo.contact_person_email && (
                  <p><strong>Email:</strong> {customerInfo.contact_person_email}</p>
                )}
                {customerInfo.contact_person_phone && (
                  <p><strong>Phone:</strong> {customerInfo.contact_person_phone}</p>
                )}
                {joinAddress(customerInfo) && (
                  <p><strong>Address:</strong> {joinAddress(customerInfo)}</p>
                )}
                {customerInfo.company_registration && (
                  <p><strong>Registration:</strong> {customerInfo.company_registration}</p>
                )}
                {customerInfo.industry && (
                  <p><strong>Industry:</strong> {customerInfo.industry}</p>
                )}
                <p><strong>Category:</strong> {categoryLabel(customerInfo.category)}</p>
                <p><strong>Discount:</strong> {formatDiscount(discountCents)}</p>
                {customerInfo.verification_status && customerInfo.verification_status !== 'verified' && (
                  <p className="form-hint">
                    This customer is not verified yet (status: {customerInfo.verification_status}).
                  </p>
                )}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label className="glow-label">Today's Price ($ per litre) *</label>
                <input
                  type="number"
                  name="basePrice"
                  className="glow-input"
                  value={formData.basePrice}
                  onChange={handleChange}
                  required
                  placeholder="e.g., 1.50"
                  step="0.001"
                  min="0"
                />
                <span className="form-hint">The customer's discount is taken off this price automatically.</span>
              </div>

              <div className="form-group">
                <label className="glow-label">Validity</label>
                <div className="validity-fixed">
                  Valid for {QUOTE_VALIDITY_HOURS} hours after it is sent
                </div>
              </div>
            </div>

            <div className="calculation-summary">
              <p><strong>Today's price:</strong> {formatPrice(basePrice)} per litre</p>
              <p>
                <strong>Discount:</strong>{' '}
                {customerInfo
                  ? '- ' + formatPrice(discountDollars) + ' (' + formatDiscount(discountCents) + ')'
                  : 'Select a fuel request to see the customer\'s discount'}
              </p>
              <p><strong>Price per litre:</strong> {formatPrice(finalPrice > 0 ? finalPrice : 0)}</p>
              <p><strong>Subtotal:</strong> ${subtotal > 0 ? subtotal.toFixed(2) : '0.00'} ({quantity} {requestUnit} @ {formatPrice(finalPrice > 0 ? finalPrice : 0)})</p>
              <p className="grand-total-line">
                <strong>Grand Total:</strong> ${grandTotal > 0 ? grandTotal.toFixed(2) : '0.00'}
              </p>
            </div>

            {priceTooLow && (
              <div className="error-message">
                The discount is more than or equal to today's price. Enter a higher price.
              </div>
            )}

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
              <label className="glow-label">Your name (prepared by) *</label>
              <input
                type="text"
                name="preparedBy"
                className="glow-input"
                value={myName}
                onChange={function(e) { setMyName(e.target.value); }}
                required
                maxLength={100}
                placeholder="Enter your full name"
              />
              <span className="form-hint">
                Several people use this login. Your name is shown on the quotation and saved in the Activity Log.
              </span>
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

            <button type="submit" className="glow-btn" disabled={!canCreate}>
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
              {isStaff && selectedQuote.customer_category && (
                <div className="modal-detail-item">
                  <span className="detail-label">Category</span>
                  <span className="detail-value">{categoryLabel(selectedQuote.customer_category)}</span>
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
              {hasPriceBreakdown(selectedQuote) && (
                <>
                  <div className="modal-detail-item">
                    <span className="detail-label">Today's Price</span>
                    <span className="detail-value">{formatPrice(selectedQuote.base_price)}</span>
                  </div>
                  <div className="modal-detail-item">
                    <span className="detail-label">Discount</span>
                    <span className="detail-value">{formatDiscount(selectedQuote.discount_cents_per_litre)}</span>
                  </div>
                </>
              )}
              <div className="modal-detail-item">
                <span className="detail-label">{hasPriceBreakdown(selectedQuote) ? 'Price per litre' : 'Unit Price'}</span>
                <span className="detail-value">{formatPrice(selectedQuote.unit_price)}</span>
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

            {/* Several people share the marketing login: each types their own name before acting */}
            {isMarketing && (selectedQuote.status === 'draft' || selectedQuote.status === 'sent') && (
              <div className="form-group">
                <label className="glow-label">Your name *</label>
                <input
                  type="text"
                  className="glow-input"
                  value={myName}
                  onChange={function(e) { setMyName(e.target.value); }}
                  maxLength={100}
                  placeholder="Enter your full name"
                />
                <span className="form-hint">Saved in the Activity Log with what you do here.</span>
              </div>
            )}

            <div className="modal-actions">
              {selectedQuote.status === 'draft' && isMarketing && (
                <button
                  className="glow-btn"
                  disabled={nameMissing}
                  onClick={function() { updateStatus(selectedQuote.id, 'sent'); }}
                >
                  Send to Customer
                </button>
              )}
              {(selectedQuote.status === 'draft' || selectedQuote.status === 'sent') && isMarketing && (
                <button
                  className="glow-btn glow-btn-secondary"
                  disabled={nameMissing}
                  onClick={function() { updateStatus(selectedQuote.id, 'expired'); }}
                >
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
                <label className="glow-label">Today's Price ($ per litre) *</label>
                <input
                  type="number"
                  name="basePrice"
                  className="glow-input"
                  value={editForm.basePrice}
                  onChange={handleEditChange}
                  required
                  step="0.001"
                  min="0"
                />
                <span className="form-hint">
                  Discount kept on this quotation: {formatDiscount(editDiscountCents)}.
                  Price per litre: {formatPrice(editQuote.unit_price)} →{' '}
                  <strong>{formatPrice(editNewUnitPrice > 0 ? editNewUnitPrice : 0)}</strong>
                </span>
                <span className="form-hint">
                  Total: {formatCurrency(editQuote.grand_total)} →{' '}
                  <strong>{formatCurrency(editNewTotal > 0 ? editNewTotal : 0)}</strong>
                  {' '}({editQuote.quantity} {editQuote.unit})
                </span>
                {editPriceTooLow && (
                  <span className="form-hint">
                    The discount is more than or equal to today's price. Enter a higher price.
                  </span>
                )}
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
              </div>

              <div className="form-group">
                <label className="glow-label">Your name *</label>
                <input
                  type="text"
                  className="glow-input"
                  value={myName}
                  onChange={function(e) { setMyName(e.target.value); }}
                  required
                  maxLength={100}
                  placeholder="Enter your full name"
                />
                <span className="form-hint">Saved with the reason in the quotation history and the Activity Log.</span>
              </div>

              <div className="modal-actions">
                <button
                  type="submit"
                  className="glow-btn"
                  disabled={editSaving || !editForm.reason.trim() || nameMissing || editBasePrice <= 0 || editPriceTooLow}
                >
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
