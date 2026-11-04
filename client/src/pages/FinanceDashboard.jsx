import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './Finance.css';

const FinanceDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [taxClearance, setTaxClearance] = useState(null);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const userName = localStorage.getItem('userName') || '';

  useEffect(function() {
    var load = async function() {
      var token = localStorage.getItem('token');
      var config = { headers: { Authorization: 'Bearer ' + token } };
      try {
        var results = await Promise.all([
          axios.get(API_BASE_URL + '/api/orders/all', config),
          axios.get(API_BASE_URL + '/api/finance/tax-clearance/latest', config),
          axios.get(API_BASE_URL + '/api/finance/payment-methods', config)
        ]);
        setOrders(results[0].data.data || []);
        setTaxClearance(results[1].data.data || null);
        setMethods(results[2].data.data || []);
      } catch (err) {
        console.error('Error loading finance dashboard:', err);
        setError('Error loading the dashboard');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  var formatDate = function(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-ZW', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  var formatCurrency = function(amount) {
    return '$' + Number(amount || 0).toFixed(2);
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  // To do
  var toConfirm = orders.filter(function(o) {
    return o.status === 'pending_payment' && o.payment_status === 'proof_uploaded';
  });
  var waitingProof = orders.filter(function(o) {
    return o.status === 'pending_payment' && o.payment_status !== 'proof_uploaded';
  });
  var toInvoice = orders.filter(function(o) {
    return o.status === 'payment_confirmed' && !o.invoice_path;
  });

  // Done: payments finance has confirmed, newest first
  var done = orders
    .filter(function(o) { return o.payment_status === 'confirmed'; })
    .sort(function(a, b) {
      return new Date(b.payment_verified_at || 0) - new Date(a.payment_verified_at || 0);
    })
    .slice(0, 10);

  var activeMethods = methods.filter(function(m) { return m.is_active; }).length;

  // Tax clearance status
  var taxText = 'No certificate uploaded yet';
  var taxAlert = true;
  if (taxClearance) {
    if (taxClearance.is_expired) {
      taxText = 'Certificate ' + taxClearance.certificate_number + ' expired on ' + formatDate(taxClearance.expiry_date);
    } else if (Number(taxClearance.days_left) <= 30) {
      taxText = 'Certificate ' + taxClearance.certificate_number + ' expires in ' + taxClearance.days_left + ' day(s), on ' + formatDate(taxClearance.expiry_date);
    } else {
      taxText = 'Certificate ' + taxClearance.certificate_number + ' valid until ' + formatDate(taxClearance.expiry_date);
      taxAlert = false;
    }
  }

  return (
    <div className="finance-dashboard">
      <div className="page-header">
        <h2>Finance{userName ? ' · ' + userName : ''}</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      {taxAlert && (
        <div className="fin-notice">
          <strong>Tax clearance: </strong>{taxText}.{' '}
          <a href="/finance/tax-clearance" onClick={function(e) { e.preventDefault(); navigate('/finance/tax-clearance'); }}>
            Upload a new certificate
          </a>
        </div>
      )}

      {activeMethods === 0 && (
        <div className="fin-notice">
          <strong>No active payment methods. </strong>
          Customers cannot see how to pay.{' '}
          <a href="/finance/payment-methods" onClick={function(e) { e.preventDefault(); navigate('/finance/payment-methods'); }}>
            Add one
          </a>
        </div>
      )}

      <div className="fin-tiles">
        <button type="button" className={'fin-tile' + (toConfirm.length ? ' fin-tile-alert' : '')} onClick={function() { navigate('/finance/payments'); }}>
          <span className="fin-tile-number">{toConfirm.length}</span>
          <span className="fin-tile-label">Payments to confirm</span>
        </button>
        <button type="button" className={'fin-tile' + (toInvoice.length ? ' fin-tile-alert' : '')} onClick={function() { navigate('/finance/payments'); }}>
          <span className="fin-tile-number">{toInvoice.length}</span>
          <span className="fin-tile-label">Invoices to issue</span>
        </button>
        <button type="button" className="fin-tile" onClick={function() { navigate('/finance/payments'); }}>
          <span className="fin-tile-number">{waitingProof.length}</span>
          <span className="fin-tile-label">Waiting for customer proof</span>
        </button>
        <button type="button" className="fin-tile" onClick={function() { navigate('/finance/payment-methods'); }}>
          <span className="fin-tile-number">{activeMethods}</span>
          <span className="fin-tile-label">Active payment methods</span>
        </button>
      </div>

      <div className="glow-card fin-section">
        <h3>To do</h3>
        {toConfirm.length === 0 && toInvoice.length === 0 ? (
          <p className="fin-muted">Nothing waiting for you.</p>
        ) : (
          <>
            {toConfirm.map(function(o) {
              return (
                <div className="fin-row" key={'c' + o.id}>
                  <div>
                    <strong>{o.order_number}</strong>
                    {o.company_name ? ' · ' + o.company_name : ''}
                    <br />
                    <small>Proof of payment uploaded · {formatCurrency(o.grand_total)}</small>
                  </div>
                  <button className="glow-btn glow-btn-small" onClick={function() { navigate('/finance/payments'); }}>
                    Review
                  </button>
                </div>
              );
            })}
            {toInvoice.map(function(o) {
              return (
                <div className="fin-row" key={'i' + o.id}>
                  <div>
                    <strong>{o.order_number}</strong>
                    {o.company_name ? ' · ' + o.company_name : ''}
                    <br />
                    <small>Payment confirmed, invoice not issued · {formatCurrency(o.grand_total)}</small>
                  </div>
                  <button className="glow-btn glow-btn-small" onClick={function() { navigate('/finance/payments'); }}>
                    Issue invoice
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>

      <div className="glow-card fin-section">
        <h3>Recently confirmed</h3>
        {done.length === 0 ? (
          <p className="fin-muted">No confirmed payments yet.</p>
        ) : (
          done.map(function(o) {
            return (
              <div className="fin-row" key={o.id}>
                <div>
                  <strong>{o.order_number}</strong>
                  {o.company_name ? ' · ' + o.company_name : ''}
                  <br />
                  <small>
                    {formatCurrency(o.grand_total)} · confirmed {formatDate(o.payment_verified_at)}
                    {o.payment_confirmed_by_name ? ' by ' + o.payment_confirmed_by_name : ''}
                    {o.invoice_path ? ' · invoiced' : ''}
                  </small>
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="glow-card fin-section">
        <h3>Tax clearance</h3>
        <p>{taxText}</p>
      </div>
    </div>
  );
};

export default FinanceDashboard;
