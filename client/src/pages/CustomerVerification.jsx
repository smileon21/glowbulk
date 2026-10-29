import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './CustomerVerification.css';

const authHeaders = () => ({
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
});

const formatDate = (value) => {
  if (!value) return '';
  return new Date(value).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
};

// Name shown in the list: company if there is one, otherwise the person
const displayName = (customer) =>
  customer.company_name || customer.contact_person_name || 'Unnamed customer';

const CustomerVerification = () => {
  const [customers, setCustomers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Decision form
  const [category, setCategory] = useState('regular');
  const [discount, setDiscount] = useState('0');
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  const selected = customers.find((c) => c.id === selectedId) || null;

  const loadPending = async () => {
    try {
      const response = await axios.get(
        API_BASE_URL + '/api/customers/pending',
        authHeaders()
      );
      if (response.data.success) {
        setCustomers(response.data.data);
      }
    } catch (err) {
      console.error('Error loading pending customers:', err);
      setError(err.response?.data?.message || 'Unable to load pending customers.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPending();
  }, []);

  const resetDecisionForm = () => {
    setCategory('regular');
    setDiscount('0');
    setRejecting(false);
    setRejectReason('');
  };

  const selectCustomer = (id) => {
    setSelectedId(id);
    setMessage('');
    setError('');
    resetDecisionForm();
  };

  // Remove the customer from the list after a decision
  const removeFromList = (id) => {
    setCustomers((prev) => prev.filter((c) => c.id !== id));
    setSelectedId(null);
    resetDecisionForm();
  };

  const handleApprove = async () => {
    if (!selected || saving) return;

    const cents = Number(discount);
    if (discount === '' || Number.isNaN(cents) || cents < 0 || cents > 100) {
      setError('Enter a discount between 0 and 100 cents per litre.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post(
        API_BASE_URL + '/api/customers/' + selected.id + '/verify',
        { category, discountCentsPerLitre: cents },
        authHeaders()
      );

      if (response.data.success) {
        setMessage(displayName(selected) + ' has been verified.');
        removeFromList(selected.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not verify this customer.');
    } finally {
      setSaving(false);
    }
  };

  const handleReject = async () => {
    if (!selected || saving) return;

    if (!rejectReason.trim()) {
      setError('Please give a reason for rejecting this customer.');
      return;
    }

    setSaving(true);
    setError('');
    setMessage('');

    try {
      const response = await axios.post(
        API_BASE_URL + '/api/customers/' + selected.id + '/reject',
        { reason: rejectReason.trim() },
        authHeaders()
      );

      if (response.data.success) {
        setMessage(displayName(selected) + ' has been rejected.');
        removeFromList(selected.id);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Could not reject this customer.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading pending customers...</div>;
  }

  return (
    <div className="verify-container">
      <div className="page-header">
        <h2>Verify Customers</h2>
      </div>
      <p className="sub-text">
        Check each new registration, then approve it with a category and discount, or reject it.
      </p>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {customers.length === 0 ? (
        <div className="glow-card verify-empty">
          No customers are waiting for verification.
        </div>
      ) : (
        <div className="verify-layout">
          {/* LIST */}
          <div className="verify-list" role="list">
            {customers.map((customer) => (
              <button
                type="button"
                key={customer.id}
                role="listitem"
                className={'verify-item' + (customer.id === selectedId ? ' selected' : '')}
                onClick={() => selectCustomer(customer.id)}
              >
                <span className="verify-item-name">{displayName(customer)}</span>
                <span className="verify-item-meta">
                  {customer.account_type === 'company' ? 'Company' : 'Individual'}
                  {' - registered '}
                  {formatDate(customer.created_at)}
                </span>
              </button>
            ))}
          </div>

          {/* DETAIL */}
          <div className="glow-card verify-detail">
            {!selected ? (
              <p className="sub-text">Select a customer to review their details.</p>
            ) : (
              <>
                <h3>{displayName(selected)}</h3>

                <dl className="verify-fields">
                  <div>
                    <dt>Account type</dt>
                    <dd>{selected.account_type === 'company' ? 'Company' : 'Individual'}</dd>
                  </div>
                  {selected.account_type === 'company' && (
                    <>
                      <div>
                        <dt>Company name</dt>
                        <dd>{selected.company_name || '-'}</dd>
                      </div>
                      <div>
                        <dt>Registration number</dt>
                        <dd>{selected.company_registration || '-'}</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Contact person</dt>
                    <dd>{selected.contact_person_name || '-'}</dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>{selected.contact_person_email || '-'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>{selected.contact_person_phone || '-'}</dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>{selected.billing_address || '-'}</dd>
                  </div>
                  <div>
                    <dt>Registered</dt>
                    <dd>{formatDate(selected.created_at)}</dd>
                  </div>
                </dl>

                {!rejecting ? (
                  <div className="verify-decision">
                    <h4>Approve this customer</h4>

                    <div className="form-row">
                      <div className="form-group">
                        <label className="glow-label">Category</label>
                        <select
                          className="glow-input"
                          value={category}
                          onChange={(e) => setCategory(e.target.value)}
                        >
                          <option value="regular">Regular</option>
                          <option value="long_term">Long-term client</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label className="glow-label">Discount (cents per litre)</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.01"
                          className="glow-input"
                          value={discount}
                          onChange={(e) => setDiscount(e.target.value)}
                        />
                        <span className="form-hint">
                          Deducted from the day's price on every quote. Use 0 for no discount.
                        </span>
                      </div>
                    </div>

                    <div className="verify-actions">
                      <button
                        type="button"
                        className="glow-btn glow-btn-secondary"
                        onClick={() => {
                          setError('');
                          setRejecting(true);
                        }}
                        disabled={saving}
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        className="glow-btn"
                        onClick={handleApprove}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Approve customer'}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="verify-decision">
                    <h4>Reject this customer</h4>

                    <div className="form-group">
                      <label className="glow-label">Reason (the customer will see this)</label>
                      <textarea
                        className="glow-input"
                        rows={3}
                        value={rejectReason}
                        onChange={(e) => setRejectReason(e.target.value)}
                        placeholder="For example: we could not confirm the company details."
                      />
                    </div>

                    <div className="verify-actions">
                      <button
                        type="button"
                        className="glow-btn glow-btn-secondary"
                        onClick={() => {
                          setError('');
                          setRejecting(false);
                        }}
                        disabled={saving}
                      >
                        Back
                      </button>
                      <button
                        type="button"
                        className="glow-btn"
                        onClick={handleReject}
                        disabled={saving}
                      >
                        {saving ? 'Saving...' : 'Confirm rejection'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CustomerVerification;
