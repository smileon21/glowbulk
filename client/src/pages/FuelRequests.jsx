import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import MapPicker from '../components/MapPicker';

const emptyForm = {
  fuelType: 'Diesel',
  quantity: '',
  unit: 'Liters',
  deliveryAddress: '',
  deliveryCity: '',
  deliveryCountry: 'Zimbabwe',
  deliveryLatitude: '',
  deliveryLongitude: '',
  preferredDeliveryDate: '',
  preferredDeliveryTime: '',
  specialInstructions: '',
  priority: 'normal'
};

const FuelRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  // True once the customer types in the address or city themselves, so the map stops overwriting it
  const addressEdited = useRef(false);

  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');
  // Business staff see the list of incoming requests; customers see the quote form.
  // This matches the backend. IT (admin) never reaches this page: App.jsx sends them to the dashboard.
  const isStaff = ['marketing', 'pricing', 'finance'].includes(userRole);
  // Only marketing writes quotations
  const isMarketing = userRole === 'marketing';

  // Today's date (local time) in YYYY-MM-DD, so past delivery dates can't be picked
  const todayStr = (function() {
    var d = new Date();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return d.getFullYear() + '-' + m + '-' + day;
  })();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      const endpoint = isStaff
        ? API_BASE_URL + '/api/fuel-requests/all'
        : API_BASE_URL + '/api/fuel-requests/my-requests';

      const response = await axios.get(endpoint);
      if (response.data.success) {
        setRequests(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = function(e) {
    var next = { ...formData, [e.target.name]: e.target.value };
    setFormData(next);

    // Typing in the address or city takes over from the map; emptying both hands it back
    if (e.target.name === 'deliveryAddress' || e.target.name === 'deliveryCity') {
      addressEdited.current = next.deliveryAddress !== '' || next.deliveryCity !== '';
    }
  };

  // The map found a street address for the pin: fill the address and city (unless typed by hand)
  const handleAddressFromMap = function(found) {
    if (addressEdited.current) return false;
    setFormData(function(prev) {
      return {
        ...prev,
        deliveryAddress: found.address || prev.deliveryAddress,
        deliveryCity: found.city || prev.deliveryCity
      };
    });
    return true;
  };

  // Called by the map whenever the pin is placed or moved
  const handlePinChange = function(pos) {
    setFormData(function(prev) {
      return { ...prev, deliveryLatitude: pos.lat, deliveryLongitude: pos.lng };
    });
  };

  const handleSubmit = async function(e) {
    e.preventDefault();
    if (submitting) return; // stops double-clicks creating duplicate requests
    setMessage('');
    setError('');

    // The exact delivery spot is required
    if (formData.deliveryLatitude === '' || formData.deliveryLongitude === '') {
      setError('Please pin your delivery location on the map.');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      const response = await axios.post(API_BASE_URL + '/api/fuel-requests', formData);

      if (response.data.success) {
        setMessage('Quote request sent! Our team will reply with a quotation shortly. You will find it under Quotations.');
        setFormData(emptyForm);
        addressEdited.current = false;
        fetchRequests();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    } catch (error) {
      var data = error.response && error.response.data;
      setError(
        (data && data.errors && data.errors[0] && data.errors[0].msg) ||
        (data && data.message) ||
        'Error submitting request'
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async function(id) {
    if (!window.confirm('Delete this quote request? This cannot be undone.')) {
      return;
    }

    setMessage('');
    setError('');
    setDeletingId(id);

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      const response = await axios.delete(API_BASE_URL + '/api/fuel-requests/' + id);

      if (response.data.success) {
        setMessage('Request deleted.');
        setRequests(function(prev) {
          return prev.filter(function(r) {
            return r.id !== id;
          });
        });
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error deleting request');
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = function(status) {
    var statusMap = {
      'pending': { color: '#E8A33D', text: 'Pending', textColor: '#5a3d0a' },
      'quoted': { color: '#2f7ea8', text: isStaff ? 'Quoted' : 'Quote Ready' },
      'accepted': { color: '#2f7a3f', text: 'Accepted' },
      'rejected': { color: '#8f0000', text: 'Rejected' },
      'expired': { color: '#6b7280', text: 'Expired' }
    };
    var s = statusMap[status] || { color: '#6b7280', text: status };
    return (
      <span className="status-badge" style={{ background: s.color, color: s.textColor || 'white' }}>
        {s.text}
      </span>
    );
  };

  var formatDate = function(dateString) {
    if (!dateString) return 'Not specified';
    var date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-ZW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  var formatTime = function(timeString) {
    if (!timeString) return 'Not specified';

    var parts = timeString.split(':');
    if (parts.length >= 2) {
      var hours = parseInt(parts[0]);
      var minutes = parts[1];
      var ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return hours + ':' + minutes + ' ' + ampm;
    }

    return timeString;
  };

  var formatQuantity = function(q) {
    var n = Number(q);
    return isNaN(n) ? q : n.toLocaleString();
  };

  if (loading) {
    return <div className="loading">Loading manifest...</div>;
  }

  return (
    <div className="fuel-requests-page">
      <div className="page-header">
        <h2>{isStaff ? 'Fuel Requests' : 'Get a Quote'}</h2>
      </div>
      {!isStaff && (
        <p className="sub-text">Tell us what you need and our team will send you a quotation.</p>
      )}

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {!isStaff && (
        <div className="request-form glow-card">
          <h3>Request a Quote</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-row three">
              <div className="form-group">
                <label className="glow-label">Fuel Type *</label>
                <select
                  name="fuelType"
                  className="glow-input"
                  value={formData.fuelType}
                  onChange={handleChange}
                  required
                >
                  <option value="Diesel">Diesel</option>
                  <option value="Petrol">Petrol</option>
                </select>
              </div>
              <div className="form-group">
                <label className="glow-label">Quantity (Liters) *</label>
                <input
                  type="number"
                  name="quantity"
                  className="glow-input"
                  value={formData.quantity}
                  onChange={handleChange}
                  required
                  placeholder="e.g. 5000"
                  min="1"
                />
              </div>
              <div className="form-group">
                <label className="glow-label">Priority</label>
                <select
                  name="priority"
                  className="glow-input"
                  value={formData.priority}
                  onChange={handleChange}
                >
                  <option value="normal">Normal</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="glow-label">Delivery Address</label>
              <input
                type="text"
                name="deliveryAddress"
                className="glow-input"
                value={formData.deliveryAddress}
                onChange={handleChange}
                placeholder="Street address"
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="glow-label">City</label>
                <input
                  type="text"
                  name="deliveryCity"
                  className="glow-input"
                  value={formData.deliveryCity}
                  onChange={handleChange}
                  placeholder="City"
                />
              </div>
              <div className="form-group">
                <label className="glow-label">Country</label>
                <input
                  type="text"
                  name="deliveryCountry"
                  className="glow-input"
                  value={formData.deliveryCountry}
                  onChange={handleChange}
                  placeholder="Country"
                />
              </div>
            </div>

            <div className="form-group">
              <label className="glow-label">Exact Delivery Location *</label>
              <MapPicker
                value={formData.deliveryLatitude !== ''
                  ? { lat: Number(formData.deliveryLatitude), lng: Number(formData.deliveryLongitude) }
                  : null}
                onChange={handlePinChange}
                onAddress={handleAddressFromMap}
              />
              <small className="form-hint">
                Click the map, drag the pin, search for a place, or use your current location.
              </small>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="glow-label">Preferred Delivery Date *</label>
                <input
                  type="date"
                  name="preferredDeliveryDate"
                  className="glow-input"
                  value={formData.preferredDeliveryDate}
                  onChange={handleChange}
                  min={todayStr}
                  required
                />
              </div>
              <div className="form-group">
                <label className="glow-label">Preferred Time</label>
                <input
                  type="time"
                  name="preferredDeliveryTime"
                  className="glow-input"
                  value={formData.preferredDeliveryTime}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="glow-label">Special Instructions</label>
              <textarea
                name="specialInstructions"
                className="glow-input"
                value={formData.specialInstructions}
                onChange={handleChange}
                rows="3"
                placeholder="Any special instructions for delivery..."
              />
            </div>

            <button type="submit" className="glow-btn" disabled={submitting}>
              {submitting ? 'Sending...' : 'Get Quote'}
            </button>
          </form>
        </div>
      )}

      {!isStaff && requests.length > 0 && <h3>Your Quote Requests</h3>}

      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="glow-card no-content">
            <p>
              {isStaff
                ? 'No fuel requests yet.'
                : "You haven't requested a quote yet. Fill in the form above to get started."}
            </p>
          </div>
        ) : (
          <div className="requests-grid">
            {requests.map(function(request) {
              return (
                <div key={request.id} className="request-card glow-card">
                  <div className="request-header">
                    <h3>{request.fuel_type}</h3>
                    {getStatusBadge(request.status)}
                  </div>
                  <div className="request-details">
                    {isStaff && (
                      <p>
                        <strong>Customer:</strong>{' '}
                        <span>
                          {request.company_name || request.contact_person_name ||
                            ((request.first_name || '') + ' ' + (request.last_name || '')).trim() || 'N/A'}
                        </span>
                      </p>
                    )}
                    <p><strong>Quantity:</strong> <span>{formatQuantity(request.quantity)} {request.unit}</span></p>
                    <p>
                      <strong>Priority:</strong>{' '}
                      <span className={'priority-tag ' + request.priority}>{request.priority}</span>
                    </p>
                    <p><strong>Delivery Date:</strong> <span>{formatDate(request.preferred_delivery_date)}</span></p>
                    <p><strong>Time:</strong> <span>{formatTime(request.preferred_delivery_time)}</span></p>
                    <p><strong>Address:</strong> <span>{request.delivery_address || 'Not specified'}</span></p>
                    {request.delivery_latitude != null && request.delivery_longitude != null && (
                      <p>
                        <strong>Pin:</strong>{' '}
                        <span>
                          <a
                            href={'https://www.openstreetmap.org/?mlat=' + request.delivery_latitude +
                              '&mlon=' + request.delivery_longitude +
                              '#map=17/' + request.delivery_latitude + '/' + request.delivery_longitude}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            View on map
                          </a>
                        </span>
                      </p>
                    )}
                    {request.special_instructions && (
                      <p><strong>Instructions:</strong> <span>{request.special_instructions}</span></p>
                    )}
                  </div>
                  <div className="request-footer">
                    <small>Submitted: {formatDate(request.created_at)}</small>
                    {request.status === 'pending' && !isStaff && (
                      <span className="pending-note">Awaiting quotation</span>
                    )}
                  </div>

                  {!isStaff && request.status === 'pending' && (
                    <div className="request-actions">
                      <button
                        className="glow-btn-small danger"
                        onClick={function() { handleDelete(request.id); }}
                        disabled={deletingId === request.id}
                      >
                        {deletingId === request.id ? 'Deleting...' : 'Delete Request'}
                      </button>
                    </div>
                  )}

                  {!isStaff && request.status === 'quoted' && (
                    <div className="request-actions">
                      <button
                        className="glow-btn-small"
                        onClick={function() { navigate('/quotations'); }}
                      >
                        View Quote
                      </button>
                    </div>
                  )}

                  {isMarketing && (request.status === 'pending' || request.status === 'quoted') && (
                    <div className="request-actions">
                      <button
                        className="glow-btn-small"
                        onClick={function() { navigate('/quotations'); }}
                      >
                        Respond with Quotation
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default FuelRequests;
