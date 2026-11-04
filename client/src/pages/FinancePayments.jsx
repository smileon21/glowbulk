import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Finance.css';

const TABS = [
  { key: 'confirm', label: 'To confirm' },
  { key: 'invoice', label: 'Invoices to issue' },
  { key: 'waiting', label: 'Waiting for proof' },
  { key: 'done', label: 'Done' }
];

const FinancePayments = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('confirm');
  const [selected, setSelected] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState('');

  var authConfig = function() {
    return { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } };
  };

  var errorText = function(err, fallback) {
    var data = err.response && err.response.data;
    return (data && data.message) ||
      (data && data.errors && data.errors[0] && data.errors[0].msg) ||
      fallback;
  };

  var fetchOrders = async function() {
    try {
      var res = await axios.get(API_BASE_URL + '/api/orders/all', authConfig());
      if (res.data.success) setOrders(res.data.data);
    } catch (err) {
      setError(errorText(err, 'Error loading orders'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(function() {
    fetchOrders();
  }, []);

  // Start clean every time a different order is opened
  useEffect(function() {
    setRejecting(false);
    setReason('');
  }, [selected && selected.id]);

  var formatDate = function(d) {
    if (!d) return 'Not specified';
    var date = new Date(d);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-ZW', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  var formatCurrency = function(amount) {
    return '$' + Number(amount || 0).toFixed(2);
  };

  var lists = {
    confirm: orders.filter(function(o) {
      return o.status === 'pending_payment' && o.payment_status === 'proof_uploaded';
    }),
    invoice: orders.filter(function(o) {
      return o.status === 'payment_confirmed' && !o.invoice_path;
    }),
    waiting: orders.filter(function(o) {
      return o.status === 'pending_payment' && o.payment_status !== 'proof_uploaded';
    }),
    done: orders
      .filter(function(o) { return o.payment_status === 'confirmed'; })
      .sort(function(a, b) {
        return new Date(b.payment_verified_at || 0) - new Date(a.payment_verified_at || 0);
      })
  };

  var finishAction = async function(text, updatedOrder) {
    setMessage(text);
    await fetchOrders();
    // keep the window open on the updated order when it still needs attention, otherwise close it
    setSelected(updatedOrder || null);
  };

  var confirmPayment = async function(order) {
    if (!window.confirm('Confirm payment for ' + order.order_number + '?')) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      var res = await axios.put(
        API_BASE_URL + '/api/orders/' + order.id + '/confirm-payment',
        { notes: 'Payment verified by finance' },
        authConfig()
      );
      if (res.data.success) {
        await finishAction('Payment confirmed. You can now issue the invoice.', res.data.data);
      }
    } catch (err) {
      setError(errorText(err, 'Error confirming payment'));
    } finally {
      setBusy(false);
    }
  };

  var rejectPayment = async function(order) {
    if (!reason.trim()) {
      setError('Tell the customer why the proof was rejected');
      return;
    }
    setBusy(true);
    setError('');
    setMessage('');
    try {
      var res = await axios.put(
        API_BASE_URL + '/api/orders/' + order.id + '/reject-payment',
        { reason: reason.trim() },
        authConfig()
      );
      if (res.data.success) {
        await finishAction('Proof rejected. The customer has been told and can upload a new one.', null);
      }
    } catch (err) {
      setError(errorText(err, 'Error rejecting proof'));
    } finally {
      setBusy(false);
    }
  };

  var uploadInvoice = async function(order, file) {
    if (!file) return;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      var formData = new FormData();
      formData.append('invoiceFile', file);
      var res = await axios.post(
        API_BASE_URL + '/api/orders/upload-invoice/' + order.id,
        formData,
        {
          headers: {
            Authorization: 'Bearer ' + localStorage.getItem('token'),
            'Content-Type': 'multipart/form-data'
          }
        }
      );
      if (res.data.success) {
        await finishAction('Invoice uploaded. The order is now completed and the customer has been told.', res.data.data);
      }
    } catch (err) {
      setError(errorText(err, 'Error uploading invoice'));
    } finally {
      setBusy(false);
    }
  };

  // Shows a proof/invoice file as a PDF button or an image
  var fileView = function(label, url, buttonText) {
    if (!url) return null;
    var isPdf = url.toLowerCase().split('?')[0].endsWith('.pdf');
    return (
      <div className="modal-detail-item modal-detail-notes">
        <span className="detail-label">{label}</span>
        <div style={{ marginTop: '8px' }}>
          {isPdf ? (
            <a href={url} target="_blank" rel="noopener noreferrer" className="glow-btn-small" style={{ display: 'inline-block', textDecoration: 'none' }}>
              {buttonText}
            </a>
          ) : (
            <img
              src={url}
              alt={label}
              style={{ maxWidth: '280px', maxHeight: '280px', cursor: 'pointer', borderRadius: '6px', display: 'block' }}
              onClick={function() { window.open(url, '_blank'); }}
            />
          )}
        </div>
      </div>
    );
  };

  var detail = function(label, value) {
    if (value === undefined || value === null || value === '') return null;
    return (
      <div className="modal-detail-item">
        <span className="detail-label">{label}</span>
        <span className="detail-value">{value}</span>
      </div>
    );
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  var current = lists[tab];

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>Payments &amp; Invoices</h2>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && !selected && <div className="error-message">{error}</div>}

      <div className="fin-tabs">
        {TABS.map(function(t) {
          return (
            <button
              key={t.key}
              type="button"
              className={'fin-tab' + (tab === t.key ? ' active' : '')}
              onClick={function() { setTab(t.key); setMessage(''); setError(''); }}
            >
              {t.label} ({lists[t.key].length})
            </button>
          );
        })}
      </div>

      {current.length === 0 ? (
        <div className="glow-card no-content">
          <p>Nothing here.</p>
        </div>
      ) : (
        <div className="orders-grid">
          {current.map(function(o) {
            return (
              <div
                key={o.id}
                className="order-card"
                style={{ cursor: 'pointer' }}
                onClick={function() { setSelected(o); setError(''); setMessage(''); }}
              >
                <div className="order-header">
                  <h3>{o.order_number}</h3>
                </div>
                <div className="order-details">
                  {o.company_name && <p><strong>Company:</strong> {o.company_name}</p>}
                  <p><strong>Amount:</strong> {formatCurrency(o.grand_total)}</p>
                  <p><strong>Fuel:</strong> {o.fuel_type}, {o.quantity} {o.unit}</p>
                  {tab === 'done' && o.payment_confirmed_by_name && (
                    <p><strong>Confirmed by:</strong> {o.payment_confirmed_by_name}</p>
                  )}
                  {tab === 'done' && (
                    <p><strong>Invoice:</strong> {o.invoice_path ? 'Issued' : 'Not issued yet'}</p>
                  )}
                </div>
                <div className="order-footer">
                  <small>Created: {formatDate(o.created_at)}</small>
                  <span className="stat-btn">Open →</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="modal-overlay" onClick={function() { setSelected(null); }}>
          <div className="modal-content" onClick={function(e) { e.stopPropagation(); }}>
            <div className="modal-header">
              <h3>{selected.order_number}</h3>
              <button className="modal-close" onClick={function() { setSelected(null); }}>✕</button>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="modal-details">
              {detail('Customer', selected.company_name)}
              {detail('Contact', [selected.contact_person_name, selected.contact_person_phone].filter(Boolean).join(' · '))}
              {detail('Fuel', selected.fuel_type + ', ' + selected.quantity + ' ' + selected.unit)}
              {detail('Amount to pay', formatCurrency(selected.grand_total))}
              {detail('Order status', selected.status)}
              {detail('Payment status', selected.payment_status)}
              {fileView('Proof of payment', selected.payment_proof_path, 'View proof (PDF)')}
              {selected.status === 'pending_payment' && !selected.payment_proof_path &&
                detail('Proof', 'The customer has not uploaded a proof yet')}
              {detail('Payment confirmed by', selected.payment_confirmed_by_name)}
              {detail('Payment confirmed on', selected.payment_verified_at ? formatDate(selected.payment_verified_at) : '')}
              {detail('Notes', selected.payment_notes)}
              {fileView('Invoice', selected.invoice_path, 'Download invoice (PDF)')}
              {detail('Invoice issued by', selected.invoice_issued_by_name)}
            </div>

            <div className="modal-actions">
              {selected.status === 'pending_payment' && (
                <div style={{ width: '100%' }}>
                  {!rejecting ? (
                    <div className="fin-actions">
                      <button className="glow-btn" disabled={busy} onClick={function() { confirmPayment(selected); }}>
                        {busy ? 'Working...' : 'Confirm payment'}
                      </button>
                      {selected.payment_proof_path && (
                        <button className="glow-btn glow-btn-secondary" disabled={busy} onClick={function() { setRejecting(true); setError(''); }}>
                          Reject proof
                        </button>
                      )}
                    </div>
                  ) : (
                    <div>
                      <label className="glow-label">Reason (the customer will see this) *</label>
                      <textarea
                        className="glow-input fin-textarea"
                        value={reason}
                        maxLength={300}
                        onChange={function(e) { setReason(e.target.value); }}
                        placeholder="e.g. The amount does not match the invoice total"
                      />
                      <div className="fin-actions">
                        <button className="glow-btn" disabled={busy || !reason.trim()} onClick={function() { rejectPayment(selected); }}>
                          {busy ? 'Working...' : 'Send rejection'}
                        </button>
                        <button className="glow-btn glow-btn-secondary" disabled={busy} onClick={function() { setRejecting(false); setReason(''); }}>
                          Back
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {selected.status === 'payment_confirmed' && !selected.invoice_path && (
                <div style={{ width: '100%' }}>
                  <label
                    htmlFor={'fin-invoice-' + selected.id}
                    className="glow-btn"
                    style={{ display: 'inline-block', cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}
                  >
                    {busy ? 'Uploading...' : 'Upload invoice & complete order'}
                  </label>
                  <input
                    id={'fin-invoice-' + selected.id}
                    type="file"
                    accept="application/pdf,image/jpeg,image/png,image/jpg"
                    style={{ display: 'none' }}
                    disabled={busy}
                    onChange={function(e) {
                      var file = e.target.files && e.target.files[0];
                      if (file) uploadInvoice(selected, file);
                      e.target.value = '';
                    }}
                  />
                  <span className="form-hint" style={{ display: 'block', marginTop: '6px' }}>
                    Uploading the invoice marks the order as completed.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FinancePayments;
