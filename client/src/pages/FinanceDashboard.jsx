import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import { API_BASE_URL } from '../config';
import './Finance.css';

// Small inline icons (no image files needed). They follow the text colour.
const Icon = ({ name }) => {
  var paths = {
    card: (
      <>
        <rect x="2" y="5" width="20" height="14" rx="2" />
        <line x1="2" y1="10" x2="22" y2="10" />
        <line x1="6" y1="15" x2="10" y2="15" />
      </>
    ),
    doc: (
      <>
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="8" y1="13" x2="16" y2="13" />
        <line x1="8" y1="17" x2="16" y2="17" />
      </>
    ),
    hourglass: (
      <>
        <path d="M5 2h14" />
        <path d="M5 22h14" />
        <path d="M7 2v4l5 6-5 6v4" />
        <path d="M17 2v4l-5 6 5 6v4" />
      </>
    ),
    alert: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="7" x2="12" y2="13" />
        <line x1="12" y1="17" x2="12.01" y2="17" />
      </>
    ),
    info: (
      <>
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="12" x2="12" y2="17" />
        <line x1="12" y1="8" x2="12.01" y2="8" />
      </>
    ),
    check: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="8 12 11 15 16 9" />
      </>
    ),
    clipboard: (
      <>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <polyline points="9 14 11 16 15 12" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="10" />
        <polyline points="12 6 12 12 16 14" />
      </>
    ),
    arrow: (
      <>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </>
    ),
    close: (
      <>
        <line x1="6" y1="6" x2="18" y2="18" />
        <line x1="18" y1="6" x2="6" y2="18" />
      </>
    )
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name]}
    </svg>
  );
};

const FinanceDashboard = () => {
  const [orders, setOrders] = useState([]);
  const [taxClearance, setTaxClearance] = useState(null);
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  // Notices can be closed for this visit (they come back on reload)
  const [hideTax, setHideTax] = useState(false);
  const [hideMethods, setHideMethods] = useState(false);
  const navigate = useNavigate();

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

  var goTo = function(path) {
    return function(e) {
      if (e && e.preventDefault) e.preventDefault();
      navigate(path);
    };
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
    .slice(0, 8);

  var activeMethods = methods.filter(function(m) { return m.is_active; }).length;
  var todoCount = toConfirm.length + toInvoice.length;

  // Tax clearance notice: red = missing/expired, amber = expiring soon, green = fine
  var taxText = 'No certificate uploaded yet.';
  var taxTone = 'danger';
  var taxLink = 'Upload a new certificate';
  if (taxClearance) {
    if (taxClearance.is_expired) {
      taxText = 'Certificate ' + taxClearance.certificate_number + ' expired on ' + formatDate(taxClearance.expiry_date) + '.';
    } else if (Number(taxClearance.days_left) <= 30) {
      taxText = 'Certificate ' + taxClearance.certificate_number + ' expires in ' + taxClearance.days_left + ' day(s), on ' + formatDate(taxClearance.expiry_date) + '.';
      taxTone = 'warn';
    } else {
      taxText = 'Certificate ' + taxClearance.certificate_number + ' is valid until ' + formatDate(taxClearance.expiry_date) + '.';
      taxTone = 'ok';
      taxLink = 'Manage';
    }
  }

  var tiles = [
    { label: 'Payments to confirm', count: toConfirm.length, icon: 'card', tone: 'navy', path: '/finance/payments' },
    { label: 'Invoices to issue', count: toInvoice.length, icon: 'doc', tone: 'red', path: '/finance/payments' },
    { label: 'Waiting for customer proof', count: waitingProof.length, icon: 'hourglass', tone: 'navy', path: '/finance/payments' },
    { label: 'Active payment methods', count: activeMethods, icon: 'card', tone: 'red', path: '/finance/payment-methods' }
  ];

  return (
    <div className="finance-dashboard">
      <div className="page-header fin-hero">
        <div>
          <h2>Finance <span className="fin-hero-accent">Dashboard</span></h2>
          <p>Manage payments, track invoices and stay compliant.</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {(!hideTax || (activeMethods === 0 && !hideMethods)) && (
        <div className="fin-notices">
          {!hideTax && (
            <div className={'fin-notice fin-notice-' + taxTone}>
              <span className="fin-notice-icon"><Icon name={taxTone === 'ok' ? 'check' : 'alert'} /></span>
              <div className="fin-notice-text">
                <strong>Tax clearance:</strong> {taxText}{' '}
                <a href="/finance/tax-clearance" onClick={goTo('/finance/tax-clearance')}>{taxLink}</a>
              </div>
              <button type="button" className="fin-notice-close" aria-label="Dismiss" onClick={function() { setHideTax(true); }}>
                <Icon name="close" />
              </button>
            </div>
          )}

          {activeMethods === 0 && !hideMethods && (
            <div className="fin-notice fin-notice-info">
              <span className="fin-notice-icon"><Icon name="info" /></span>
              <div className="fin-notice-text">
                <strong>No active payment methods.</strong> Customers cannot see how to pay.{' '}
                <a href="/finance/payment-methods" onClick={goTo('/finance/payment-methods')}>Add one</a>
              </div>
              <button type="button" className="fin-notice-close" aria-label="Dismiss" onClick={function() { setHideMethods(true); }}>
                <Icon name="close" />
              </button>
            </div>
          )}
        </div>
      )}

      <div className="fin-tiles">
        {tiles.map(function(t) {
          return (
            <button
              key={t.label}
              type="button"
              className={'fin-tile' + (t.count > 0 ? ' fin-tile-alert' : '')}
              onClick={goTo(t.path)}
            >
              <span className={'fin-tile-icon fin-tile-icon-' + t.tone}><Icon name={t.icon} /></span>
              <span className="fin-tile-body">
                <span className="fin-tile-number">{t.count}</span>
                <span className="fin-tile-label">{t.label}</span>
              </span>
              <span className="fin-tile-arrow"><Icon name="arrow" /></span>
            </button>
          );
        })}
      </div>

      <div className="fin-columns">
        <section className="fin-card">
          <div className="fin-card-head">
            <span className="fin-card-bar" />
            <span className="fin-card-icon"><Icon name="clipboard" /></span>
            <div className="fin-card-title">
              <h3>To Do</h3>
              <p>{todoCount === 0 ? 'Nothing waiting for you right now' : todoCount + ' item(s) need your attention'}</p>
            </div>
            <button type="button" className="fin-viewall" onClick={goTo('/finance/payments')}>
              View All <Icon name="arrow" />
            </button>
          </div>

          {todoCount === 0 ? (
            <div className="fin-empty">
              <span className="fin-empty-icon"><Icon name="clipboard" /></span>
              <strong>You’re all caught up!</strong>
              <p>No pending tasks at the moment.</p>
            </div>
          ) : (
            <div className="fin-list">
              {toConfirm.map(function(o) {
                return (
                  <div className="fin-item" key={'c' + o.id}>
                    <span className="fin-item-icon fin-item-icon-amber"><Icon name="card" /></span>
                    <div className="fin-item-main">
                      <strong>{o.order_number}</strong>
                      <span>{o.company_name || 'Customer'} · {formatCurrency(o.grand_total)}</span>
                    </div>
                    <span className="fin-pill fin-pill-amber">Proof uploaded</span>
                    <button className="glow-btn glow-btn-small" onClick={goTo('/finance/payments')}>Review</button>
                  </div>
                );
              })}
              {toInvoice.map(function(o) {
                return (
                  <div className="fin-item" key={'i' + o.id}>
                    <span className="fin-item-icon fin-item-icon-red"><Icon name="doc" /></span>
                    <div className="fin-item-main">
                      <strong>{o.order_number}</strong>
                      <span>{o.company_name || 'Customer'} · {formatCurrency(o.grand_total)}</span>
                    </div>
                    <span className="fin-pill fin-pill-slate">Invoice due</span>
                    <button className="glow-btn glow-btn-small" onClick={goTo('/finance/payments')}>Issue invoice</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="fin-card">
          <div className="fin-card-head">
            <span className="fin-card-bar" />
            <span className="fin-card-icon"><Icon name="clock" /></span>
            <div className="fin-card-title">
              <h3>Recent Confirmations</h3>
            </div>
            <button type="button" className="fin-viewall" onClick={goTo('/finance/payments')}>
              View All <Icon name="arrow" />
            </button>
          </div>

          {done.length === 0 ? (
            <div className="fin-empty">
              <span className="fin-empty-icon"><Icon name="clock" /></span>
              <strong>No confirmed payments yet</strong>
              <p>Confirmed payments will show up here.</p>
            </div>
          ) : (
            <div className="fin-list">
              {done.map(function(o) {
                return (
                  <div className="fin-item" key={o.id}>
                    <span className="fin-item-icon fin-item-icon-blue"><Icon name="doc" /></span>
                    <div className="fin-item-main">
                      <strong>{o.order_number}</strong>
                      <span>
                        {o.company_name || 'Customer'} · {formatCurrency(o.grand_total)}
                        {!o.invoice_path && <em className="fin-flag"> · invoice pending</em>}
                      </span>
                    </div>
                    <span className="fin-pill fin-pill-green">Confirmed</span>
                    <span className="fin-item-date">{formatDate(o.payment_verified_at)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
};

export default FinanceDashboard;
