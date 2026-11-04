import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatName, formatDate, formatTimeAgo } from '../utils/format';
import './Marketing.css';

// Must match the values used on the Quotations page
const QUOTE_VALIDITY_HOURS = 24;
const EDIT_WINDOW_MINUTES = 15;

const ACTIVITY_LIMIT = 6;
const TODO_LIMIT = 6;

// Small inline icons (no image files needed). They follow the text colour.
const Icon = ({ name }) => {
  var paths = {
    users: (
      <>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
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
    box: (
      <>
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
        <line x1="12" y1="22.08" x2="12" y2="12" />
      </>
    ),
    mail: (
      <>
        <rect x="2" y="4" width="20" height="16" rx="2" />
        <polyline points="22 6 12 13 2 6" />
      </>
    ),
    shield: (
      <>
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        <polyline points="9 12 11 14 15 10" />
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
    dollar: (
      <>
        <line x1="12" y1="1" x2="12" y2="23" />
        <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
      </>
    ),
    clipboard: (
      <>
        <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
        <rect x="8" y="2" width="8" height="4" rx="1" />
        <polyline points="9 14 11 16 15 12" />
      </>
    ),
    bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    pulse: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
    arrow: (
      <>
        <line x1="5" y1="12" x2="19" y2="12" />
        <polyline points="12 5 19 12 12 19" />
      </>
    ),
    chevron: <polyline points="9 18 15 12 9 6" />
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

var validDate = function(d) {
  if (!d) return null;
  var date = new Date(d);
  return isNaN(date.getTime()) ? null : date;
};

// How many records were created this calendar month.
// Returns null when the records carry no dates, so the card shows nothing
// instead of a made-up number.
var newThisMonth = function(list) {
  if (!list || list.length === 0) return null;
  var dated = list.filter(function(i) { return validDate(i.created_at); });
  if (dated.length === 0) return null;
  var now = new Date();
  return dated.filter(function(i) {
    var d = validDate(i.created_at);
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;
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

// Turn requests, quotations and orders into one recent-activity feed, newest first
function buildActivity(requests, quotes, orders) {
  var events = [];
  var customer = function(item) {
    return item.company_name || item.customer_name || 'a customer';
  };

  (requests || []).forEach(function(r) {
    events.push({
      key: 'req-' + r.id,
      type: 'req',
      text: 'New fuel request from ' + customer(r),
      detail: [r.quantity, r.unit, r.fuel_type].filter(Boolean).join(' '),
      time: r.created_at,
      link: '/fuel-requests'
    });
  });

  var quoteVerbs = {
    draft: 'drafted for',
    sent: 'sent to',
    accepted: 'accepted by',
    rejected: 'rejected by',
    expired: 'expired for'
  };
  (quotes || []).forEach(function(q) {
    var verb = quoteVerbs[q.status] || q.status + ' for';
    events.push({
      key: 'quo-' + q.id,
      type: q.status === 'rejected' ? 'bad' : 'quo',
      text: 'Quotation ' + (q.quotation_number || '#' + q.id) + ' ' + verb + ' ' + customer(q),
      detail: q.fuel_type || '',
      time: q.updated_at || q.created_at,
      link: '/quotations'
    });
  });

  (orders || []).forEach(function(o) {
    var status = o.payment_status || o.status;
    events.push({
      key: 'ord-' + o.id,
      type: 'ord',
      text: 'Order ' + (o.order_number || '#' + o.id) + ' from ' + customer(o),
      detail: status ? String(status).replace(/_/g, ' ') : '',
      time: o.updated_at || o.created_at,
      link: '/orders'
    });
  });

  return events
    .filter(function(e) { return validDate(e.time); })
    .sort(function(a, b) { return new Date(b.time) - new Date(a.time); })
    .slice(0, ACTIVITY_LIMIT);
}

const MarketingDashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [warning, setWarning] = useState('');
  const [data, setData] = useState({ requests: [], quotes: [], orders: [], customers: [] });

  const userRole = localStorage.getItem('userRole');
  const isMarketing = userRole === 'marketing';
  const userName = formatName(localStorage.getItem('userName')) || 'User';

  useEffect(function() {
    var token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

    // One failing request must not blank the whole dashboard
    var get = function(path) {
      return axios.get(API_BASE_URL + path)
        .then(function(res) { return res.data.data || []; })
        .catch(function(err) {
          console.error('Dashboard request failed: ' + path, err);
          return null;
        });
    };

    Promise.all([
      get('/api/fuel-requests/all'),
      get('/api/quotations/all'),
      get('/api/orders/all'),
      get('/api/customers')
    ]).then(function(r) {
      if (r.some(function(x) { return x === null; })) {
        setWarning('Some figures could not be loaded. Refresh to try again.');
      }
      setData({
        requests: r[0] || [],
        quotes: r[1] || [],
        orders: r[2] || [],
        customers: r[3] || []
      });
      setLoading(false);
    });
  }, []);

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  var requests = data.requests;
  var quotes = data.quotes;
  var orders = data.orders;
  var customers = data.customers;
  var now = Date.now();

  // ---------- Figures ----------
  var sentAt = function(q) { return validDate(q.sent_at || q.created_at); };

  // Sent to the customer and still inside the 24-hour validity window
  var isLiveSent = function(q) {
    if (q.status !== 'sent') return false;
    var s = sentAt(q);
    return s ? now < s.getTime() + QUOTE_VALIDITY_HOURS * 3600000 : true;
  };

  var pendingRequests = requests.filter(function(r) { return r.status === 'pending'; });
  var pendingQuotes = quotes.filter(isLiveSent);
  var activeOrders = orders.filter(function(o) {
    return o.status !== 'completed' && o.status !== 'cancelled';
  });
  var awaitingPayment = orders.filter(function(o) { return o.status === 'pending_payment'; });
  var editable = quotes.filter(function(q) {
    var s = sentAt(q);
    return isLiveSent(q) && s && now < s.getTime() + EDIT_WINDOW_MINUTES * 60000;
  });
  // Uses the verification_status column on customers; shows nothing if the field has another name
  var unverified = customers.filter(function(c) { return c.verification_status === 'pending'; });

  var trend = function(list) {
    var n = newThisMonth(list);
    return n === null ? '' : n + ' new this month';
  };

  var tiles = [
    {
      key: 'cust', label: 'Total Customers', count: customers.length, icon: 'users', tone: 'navy',
      trend: trend(customers), linkLabel: 'View Customers', path: isMarketing ? '/customers' : null
    },
    {
      key: 'req', label: 'Pending Requests', count: pendingRequests.length, icon: 'doc', tone: 'red',
      trend: trend(requests), linkLabel: 'Review Requests', path: '/fuel-requests'
    },
    {
      key: 'quo', label: 'Pending Quotations', count: pendingQuotes.length, icon: 'hourglass', tone: 'navy',
      trend: trend(quotes), linkLabel: 'View Quotations', path: '/quotations'
    },
    {
      key: 'ord', label: 'Active Orders', count: activeOrders.length, icon: 'box', tone: 'red',
      trend: trend(orders), linkLabel: 'Track Orders', path: '/orders'
    }
  ];

  // ---------- To-do list, built from real data ----------
  var todo = [];

  if (pendingRequests.length > 0) {
    var oldest = pendingRequests
      .map(function(r) { return validDate(r.created_at); })
      .filter(Boolean)
      .sort(function(a, b) { return a - b; })[0];
    todo.push({
      key: 'req', icon: 'mail', tone: 'red',
      title: 'Follow up with ' + pendingRequests.length + ' new fuel request' + (pendingRequests.length === 1 ? '' : 's'),
      sub: 'Customers waiting for a quotation',
      tag: oldest ? 'Oldest ' + formatTimeAgo(oldest) : 'Waiting',
      button: 'View', path: '/fuel-requests'
    });
  }

  if (isMarketing && unverified.length > 0) {
    todo.push({
      key: 'ver', icon: 'shield', tone: 'navy',
      title: 'Verify ' + unverified.length + ' new customer' + (unverified.length === 1 ? '' : 's'),
      sub: 'Registrations waiting for approval',
      tag: 'Waiting', button: 'Verify', path: '/verify-customers'
    });
  }

  if (isMarketing && editable.length > 0) {
    var soonestEdit = Math.min.apply(null, editable.map(function(q) {
      return sentAt(q).getTime() + EDIT_WINDOW_MINUTES * 60000 - now;
    }));
    todo.push({
      key: 'edit', icon: 'doc', tone: 'red',
      title: editable.length + ' quotation' + (editable.length === 1 ? '' : 's') + ' can still be edited',
      sub: 'Inside the ' + EDIT_WINDOW_MINUTES + '-minute edit window',
      tag: Math.max(1, Math.ceil(soonestEdit / 60000)) + ' min left',
      button: 'Open', path: '/quotations'
    });
  }

  if (pendingQuotes.length > 0) {
    var nextExpiry = Math.min.apply(null, pendingQuotes.map(function(q) {
      var s = sentAt(q);
      return s ? s.getTime() + QUOTE_VALIDITY_HOURS * 3600000 - now : Infinity;
    }));
    todo.push({
      key: 'quo', icon: 'hourglass', tone: 'navy',
      title: pendingQuotes.length + ' quotation' + (pendingQuotes.length === 1 ? '' : 's') + ' awaiting a customer reply',
      sub: 'Sent and not yet accepted or rejected',
      tag: nextExpiry === Infinity ? 'Waiting' : 'Next expires in ' + formatTimeLeft(nextExpiry),
      button: 'View', path: '/quotations'
    });
  }

  if (awaitingPayment.length > 0) {
    todo.push({
      key: 'pay', icon: 'dollar', tone: 'red',
      title: awaitingPayment.length + ' order' + (awaitingPayment.length === 1 ? '' : 's') + ' awaiting payment',
      sub: 'Customers have not paid yet',
      tag: 'Pending payment', button: 'View', path: '/orders'
    });
  }

  todo = todo.slice(0, TODO_LIMIT);

  // ---------- Quick actions (real pages only) ----------
  var actions = isMarketing
    ? [
        { key: 'quote', icon: 'doc', tone: 'red', title: 'Create Quote', sub: 'Price a fuel request', path: '/quotations' },
        { key: 'verify', icon: 'shield', tone: 'navy', title: 'Verify Customers', sub: 'Approve new registrations', path: '/verify-customers' },
        { key: 'prices', icon: 'dollar', tone: 'red', title: 'Daily Prices', sub: 'Set prices per site', path: '/daily-prices' },
        { key: 'cust', icon: 'users', tone: 'navy', title: 'Customers', sub: 'All registered customers', path: '/customers' }
      ]
    : [
        { key: 'req', icon: 'mail', tone: 'red', title: 'Fuel Requests', sub: 'Incoming requests', path: '/fuel-requests' },
        { key: 'quote', icon: 'doc', tone: 'navy', title: 'Quotations', sub: 'Track every quotation', path: '/quotations' },
        { key: 'ord', icon: 'box', tone: 'red', title: 'Orders', sub: 'Follow each order', path: '/orders' }
      ];

  var activity = buildActivity(requests, quotes, orders);

  var subtitle = isMarketing
    ? 'Grow our customer base — manage leads and track customer engagement.'
    : 'Keep prices current and track requests, quotations and orders.';

  return (
    <div className="marketing-dashboard">
      <div className="mk-hero">
        <span className="mk-hero-bar" />
        <div>
          <h1>Welcome, <span className="mk-accent">{userName}</span></h1>
          <p>{subtitle}</p>
        </div>
      </div>

      {warning && <div className="error-message">{warning}</div>}

      <div className="mk-tiles">
        {tiles.map(function(t) {
          var inner = (
            <>
              <div className="mk-tile-top">
                <span className={'mk-tile-icon mk-tone-' + t.tone}><Icon name={t.icon} /></span>
                <div className="mk-tile-body">
                  <span className="mk-tile-label">{t.label}</span>
                  <span className="mk-tile-number">{t.count}</span>
                  {t.trend && <span className="mk-tile-trend">{t.trend}</span>}
                </div>
              </div>
              {t.path && (
                <span className="mk-tile-link">{t.linkLabel} <span className="mk-arrow"><Icon name="arrow" /></span></span>
              )}
            </>
          );
          return t.path ? (
            <button
              key={t.key}
              type="button"
              className={'mk-tile mk-edge-' + t.tone}
              onClick={function() { navigate(t.path); }}
            >
              {inner}
            </button>
          ) : (
            <div key={t.key} className={'mk-tile mk-tile-static mk-edge-' + t.tone}>{inner}</div>
          );
        })}
      </div>

      <div className="mk-columns">
        <section className="mk-card">
          <div className="mk-card-head">
            <span className="mk-card-bar" />
            <span className="mk-card-icon"><Icon name="clipboard" /></span>
            <div className="mk-card-title">
              <h3>Customer To Do List</h3>
              {todo.length === 0 && <p>Nothing waiting for you right now</p>}
            </div>
            <button type="button" className="mk-viewall" onClick={function() { navigate('/fuel-requests'); }}>
              View All Tasks <Icon name="arrow" />
            </button>
          </div>

          {todo.length === 0 ? (
            <div className="mk-empty">
              <span className="mk-empty-icon"><Icon name="clipboard" /></span>
              <strong>You’re all caught up!</strong>
              <p>No pending tasks at the moment.</p>
            </div>
          ) : (
            <div className="mk-list">
              {todo.map(function(t) {
                return (
                  <div className="mk-todo" key={t.key}>
                    <span className={'mk-todo-icon mk-tone-' + t.tone}><Icon name={t.icon} /></span>
                    <div className="mk-todo-main">
                      <strong>{t.title}</strong>
                      <span>{t.sub}</span>
                    </div>
                    <span className="mk-todo-tag">{t.tag}</span>
                    <button type="button" className="mk-todo-btn" onClick={function() { navigate(t.path); }}>
                      {t.button}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="mk-card">
          <div className="mk-card-head">
            <span className="mk-card-bar" />
            <span className="mk-card-icon"><Icon name="bolt" /></span>
            <div className="mk-card-title">
              <h3>Quick Actions</h3>
            </div>
          </div>

          <div className="mk-actions">
            {actions.map(function(a) {
              return (
                <button key={a.key} type="button" className="mk-action" onClick={function() { navigate(a.path); }}>
                  <span className={'mk-action-icon mk-tone-' + a.tone}><Icon name={a.icon} /></span>
                  <span className="mk-action-text">
                    <strong>{a.title}</strong>
                    <span>{a.sub}</span>
                  </span>
                  <span className="mk-action-chevron"><Icon name="chevron" /></span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      <section className="mk-card">
        <div className="mk-card-head">
          <span className="mk-card-bar" />
          <span className="mk-card-icon"><Icon name="pulse" /></span>
          <div className="mk-card-title">
            <h3>Recent Activity</h3>
          </div>
        </div>

        {activity.length === 0 ? (
          <p className="mk-muted">No activity yet. New requests, quotations and orders will show up here.</p>
        ) : (
          <div className="mk-list">
            {activity.map(function(event) {
              return (
                <button
                  key={event.key}
                  type="button"
                  className="mk-activity"
                  onClick={function() { navigate(event.link); }}
                >
                  <span className={'mk-dot mk-dot-' + event.type} aria-hidden="true" />
                  <span className="mk-activity-text">
                    <strong>{event.text}</strong>
                    {event.detail && <span>{event.detail}</span>}
                  </span>
                  <span className="mk-activity-time" title={formatDate(event.time)}>
                    {formatTimeAgo(event.time)}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};

export default MarketingDashboard;
