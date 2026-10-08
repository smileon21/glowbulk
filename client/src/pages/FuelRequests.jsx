import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const FuelRequests = () => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [deletingId, setDeletingId] = useState(null);
  const [formData, setFormData] = useState({
    fuelType: 'Diesel',
    quantity: '',
    unit: 'Liters',
    deliveryAddress: '',
    deliveryCity: '',
    deliveryCountry: 'Zimbabwe',
    preferredDeliveryDate: '',
    preferredDeliveryTime: '',
    specialInstructions: '',
    priority: 'normal'
  });

  const navigate = useNavigate();
  const userRole = localStorage.getItem('userRole');
  const isStaff = userRole === 'admin' || userRole === 'marketing';

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
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async function(e) {
    e.preventDefault();
    if (submitting) return; // stops double-clicks creating duplicate requests
    setMessage('');
    setError('');
    setSubmitting(true);

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

      const response = await axios.post(API_BASE_URL + '/api/fuel-requests', formData);

      if (response.data.success) {
        setMessage('Fuel request submitted successfully!');
        setShowForm(false);
        setFormData({
          fuelType: 'Diesel',
          quantity: '',
          unit: 'Liters',
          deliveryAddress: '',
          deliveryCity: '',
          deliveryCountry: 'Zimbabwe',
          preferredDeliveryDate: '',
          preferredDeliveryTime: '',
          specialInstructions: '',
          priority: 'normal'
        });
        fetchRequests();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error submitting request');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async function(id) {
    if (!window.confirm('Delete this fuel request? This cannot be undone.')) {
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
        setMessage('Fuel request deleted.');
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
      'quoted': { color: '#2f7ea8', text: 'Quoted' },
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
        <h2>Fuel Requests</h2>
        {!isStaff && (
          <button className="glow-btn" onClick={function() { setShowForm(!showForm); }}>
            {showForm ? 'Cancel' : '+ New Request'}
          </button>
        )}
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {showForm && !isStaff && (
        <div className="request-form glow-card">
          <h3>Submit Fuel Request</h3>
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
              {submitting ? 'Submitting...' : 'Submit Request'}
            </button>
          </form>
        </div>
      )}

      <div className="requests-list">
        {requests.length === 0 ? (
          <div className="glow-card no-content">
            <p>No fuel requests yet.</p>
            {!isStaff && <p>Click "+ New Request" to submit your first request.</p>}
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
                      <p><strong>Customer:</strong> <span>{request.company_name || 'N/A'}</span></p>
                    )}
                    <p><strong>Quantity:</strong> <span>{formatQuantity(request.quantity)} {request.unit}</span></p>
                    <p>
                      <strong>Priority:</strong>{' '}
                      <span className={'priority-tag ' + request.priority}>{request.priority}</span>
                    </p>
                    <p><strong>Delivery Date:</strong> <span>{formatDate(request.preferred_delivery_date)}</span></p>
                    <p><strong>Time:</strong> <span>{formatTime(request.preferred_delivery_time)}</span></p>
                    <p><strong>Address:</strong> <span>{request.delivery_address || 'Not specified'}</span></p>
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

                  {isStaff && (request.status === 'pending' || request.status === 'quoted') && (
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
