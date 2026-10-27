import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatName, formatDate, formatTimeAgo } from '../utils/format';

const ACTIVITY_LIMIT = 6;

// Where the IT "Manage Accounts" buttons go (the Accounts page)
const ADMIN_ACCOUNTS_ROUTE = '/accounts';

// Turn the admin's requests, quotations and orders into one recent-activity feed,
// newest first. Uses each record's latest timestamp and current status.
function buildActivity(requests, quotes, orders) {
  const events = [];
  const customer = function(item) {
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

  const quoteVerbs = {
    draft: 'drafted for',
    sent: 'sent to',
    accepted: 'accepted by',
    rejected: 'rejected by',
    expired: 'expired for'
  };
  (quotes || []).forEach(function(q) {
    const verb = quoteVerbs[q.status] || q.status + ' for';
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
    const status = o.payment_status || o.status;
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
    .filter(function(e) { return e.time && !Number.isNaN(new Date(e.time).getTime()); })
    .sort(function(a, b) { return new Date(b.time) - new Date(a.time); })
    .slice(0, ACTIVITY_LIMIT);
}

// "USER_BLOCKED" -> "User blocked"
function actionLabel(action) {
  const text = String(action || '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Shared by the customer and admin dashboards
const AnnouncementsSection = ({ announcements }) => {
  if (announcements.length === 0) return null;

  return (
    <div className="announcements-section">
      <h2>Announcements</h2>
      <div className="announcements-grid">
        {announcements.map(function(announcement) {
          return (
            <div key={announcement.id} className="announcement-card">
              <div className="announcement-header">
                <h3>{announcement.title}</h3>
              </div>
              <p>{announcement.content}</p>
              <div className="announcement-footer">
                <small>Posted: {formatDate(announcement.published_at || announcement.created_at)}</small>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [activity, setActivity] = useState([]);
  const [stats, setStats] = useState({
    fuelRequests: 0,
    quotations: 0,
    orders: 0,
    pendingPayments: 0,
    totalCustomers: 0,
    pendingRequests: 0
  });

  // IT (admin role) dashboard data
  const [itStats, setItStats] = useState({
    admins: 0,
    marketing: 0,
    pricing: 0,
    finance: 0,
    customers: 0,
    blockedUsers: 0,
    lockedUsers: 0,
    failedLogins24h: 0
  });
  const [flagged, setFlagged] = useState([]);
  const [itLog, setItLog] = useState([]);

  const navigate = useNavigate();

  const userRole = localStorage.getItem('userRole');
  const userName = formatName(localStorage.getItem('userName')) || 'User';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      fetchUserData();
      if (userRole !== 'admin') {
        fetchAnnouncements();
      }
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(API_BASE_URL + '/api/content/published');
      if (response.data.success) {
        const announcements = response.data.data.filter(function(c) {
          return c.content_type === 'announcement';
        });
        setAnnouncements(announcements.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      // IT accounts only need the account and security overview
      if (userRole === 'admin') {
        const results = await Promise.all([
          axios.get(API_BASE_URL + '/api/admin/dashboard/stats'),
          axios.get(API_BASE_URL + '/api/admin/suspicious-activity'),
          axios.get(API_BASE_URL + '/api/admin/activity-log?limit=' + ACTIVITY_LIMIT)
        ]);

        setItStats(results[0].data.data);
        setFlagged(results[1].data.data.flaggedAccounts || []);
        setItLog(results[2].data.data || []);
        return;
      }

      // Try to fetch customer profile — only customers have one.
      // Marketing will get a 404 here, which we safely ignore.
      try {
        const response = await axios.get(API_BASE_URL + '/api/customers/profile/me');
        setUser(response.data.data);
      } catch (profileError) {
        if (profileError.response && profileError.response.status !== 404) {
          console.error('Error fetching profile:', profileError);
        }
      }

      if (userRole === 'customer') {
        const requests = await axios.get(API_BASE_URL + '/api/fuel-requests/my-requests');
        const quotes = await axios.get(API_BASE_URL + '/api/quotations/my-quotations');
        const orders = await axios.get(API_BASE_URL + '/api/orders/my-orders');

        setStats({
          fuelRequests: requests.data.count || 0,
          quotations: quotes.data.count || 0,
          orders: orders.data.count || 0,
          pendingPayments: 0,
          totalCustomers: 0,
          pendingRequests: 0
        });
      } else {
        const requests = await axios.get(API_BASE_URL + '/api/fuel-requests/all');
        const quotes = await axios.get(API_BASE_URL + '/api/quotations/all');
        const orders = await axios.get(API_BASE_URL + '/api/orders/all');
        const pending = await axios.get(API_BASE_URL + '/api/orders/pending-payment');
        const customers = await axios.get(API_BASE_URL + '/api/customers');

        const pendingRequests = requests.data.data?.filter(function(r) {
          return r.status === 'pending';
        }) || [];

        setStats({
          fuelRequests: requests.data.count || 0,
          quotations: quotes.data.count || 0,
          orders: orders.data.count || 0,
          pendingPayments: pending.data.count || 0,
          totalCustomers: customers.data.count || 0,
          pendingRequests: pendingRequests.length
        });

        setActivity(buildActivity(requests.data.data, quotes.data.data, orders.data.data));
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading manifest...</div>;
  }

  // CUSTOMER DASHBOARD
  if (userRole === 'customer') {
    return (
      <div className="dashboard">
        <div className="dashboard-welcome">
          <div className="welcome-text">
            <h1>Welcome, {userName}</h1>
            <div className="role-indicator customer">
              <span>Bulk Fuel. Delivered On Time. Every Time.</span>
            </div>
          </div>
          <div className="welcome-actions">
            <button className="request-cta" onClick={() => navigate('/fuel-requests')}>
              <span className="request-cta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16" />
                  <line x1="3" y1="10" x2="13" y2="10" />
                  <line x1="2" y1="22" x2="14" y2="22" />
                  <path d="M13 12h4a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3" />
                </svg>
              </span>
              <span className="request-cta-text">
                <span className="request-cta-title">Request Fuel</span>
                <span className="request-cta-sub">Bulk delivery to your site</span>
              </span>
              <span className="request-cta-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        {/* Stats Cards - Delivery Tickets */}
        <div className="dashboard-stats-row">
          <div className="stat-card stat-req">
            <div className="stat-card-header">
              <h3>Fuel Requests</h3>
              <span className="ticket-tag">REQ</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{stats.fuelRequests}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate('/fuel-requests')}>
                View All <span className="stat-btn-arrow">→</span>
              </button>
            </div>
          </div>

          <div className="stat-card stat-quo">
            <div className="stat-card-header">
              <h3>Quotations</h3>
              <span className="ticket-tag">QUO</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{stats.quotations}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate('/quotations')}>
                View All <span className="stat-btn-arrow">→</span>
              </button>
            </div>
          </div>

          <div className="stat-card stat-ord">
            <div className="stat-card-header">
              <h3>Orders</h3>
              <span className="ticket-tag">ORD</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{stats.orders}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate('/orders')}>
                View All <span className="stat-btn-arrow">→</span>
              </button>
            </div>
          </div>
        </div>

        <AnnouncementsSection announcements={announcements} />
      </div>
    );
  }

  // IT DASHBOARD (admin role): accounts, access and the audit trail
  if (userRole === 'admin') {
    const staffCount = itStats.admins + itStats.marketing + itStats.pricing + itStats.finance;

    return (
      <div className="dashboard">
        <div className="dashboard-welcome">
          <div className="welcome-text">
            <h1>Welcome, {userName}</h1>
            <div className="role-indicator admin">
              <span>IT console — staff accounts, access and the activity trail</span>
            </div>
          </div>
          <div className="welcome-actions">
            <button className="request-cta" onClick={() => navigate(ADMIN_ACCOUNTS_ROUTE)}>
              <span className="request-cta-icon" aria-hidden="true">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <line x1="19" y1="8" x2="19" y2="14" />
                  <line x1="16" y1="11" x2="22" y2="11" />
                </svg>
              </span>
              <span className="request-cta-text">
                <span className="request-cta-title">Manage Accounts</span>
                <span className="request-cta-sub">Create, reset and block</span>
              </span>
              <span className="request-cta-arrow" aria-hidden="true">→</span>
            </button>
          </div>
        </div>

        <div className="dashboard-stats-row marketing-stats-row">
          <div className="stat-card stat-ord">
            <div className="stat-card-header">
              <h3>Staff Accounts</h3>
              <span className="ticket-tag">STAFF</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{staffCount}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate(ADMIN_ACCOUNTS_ROUTE)}>
                Manage <span className="stat-btn-arrow">→</span>
              </button>
            </div>
          </div>

          <div className="stat-card stat-cust">
            <div className="stat-card-header">
              <h3>Customers</h3>
              <span className="ticket-tag">CUST</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{itStats.customers}</span>
              </div>
            </div>
          </div>

          <div className="stat-card stat-pay">
            <div className="stat-card-header">
              <h3>Blocked Accounts</h3>
              <span className="ticket-tag">BLOCK</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Blocked</span>
                <span className="detail-value">{itStats.blockedUsers}</span>
              </div>
              <div className="stat-detail-item">
                <span className="detail-label">Locked now</span>
                <span className="detail-value">{itStats.lockedUsers}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate(ADMIN_ACCOUNTS_ROUTE)}>
                Review <span className="stat-btn-arrow">→</span>
              </button>
            </div>
          </div>

          <div className="stat-card stat-req">
            <div className="stat-card-header">
              <h3>Failed Sign-ins</h3>
              <span className="ticket-tag">24H</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Last 24 hours</span>
                <span className="detail-value">{itStats.failedLogins24h}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="recent-activity">
          <h2>Needs attention</h2>
          <div className="activity-feed">
            {flagged.length === 0 ? (
              <p className="activity-empty">No suspicious sign-in activity right now.</p>
            ) : (
              flagged.map(function(account) {
                return (
                  <div key={account.id} className="activity-item">
                    <span className="activity-dot activity-bad" aria-hidden="true" />
                    <span className="activity-text">
                      <span className="activity-title">
                        {account.name || account.email} ({account.email})
                      </span>
                      <span className="activity-detail">
                        {account.failed_login_attempts} failed sign-ins
                        {account.is_locked ? ' · locked' : ''}
                        {account.is_active === false ? ' · blocked' : ''}
                      </span>
                    </span>
                    <span className="activity-time" title={formatDate(account.last_failed_login)}>
                      {account.last_failed_login ? formatTimeAgo(account.last_failed_login) : ''}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="recent-activity">
          <h2>Recent IT activity</h2>
          <div className="activity-feed">
            {itLog.length === 0 ? (
              <p className="activity-empty">No activity recorded yet. Account actions will show up here.</p>
            ) : (
              itLog.map(function(entry) {
                return (
                  <div key={entry.id} className="activity-item">
                    <span className="activity-dot activity-quo" aria-hidden="true" />
                    <span className="activity-text">
                      <span className="activity-title">
                        {actionLabel(entry.action)}
                        {entry.actor_name ? ' by ' + entry.actor_name : ''}
                      </span>
                      {entry.details && <span className="activity-detail">{entry.details}</span>}
                    </span>
                    <span className="activity-time" title={formatDate(entry.created_at)}>
                      {formatTimeAgo(entry.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // MARKETING DASHBOARD
  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <div className="welcome-text">
          <h1>Welcome, {userName}</h1>
          <div className={'role-indicator ' + userRole}>
            <span>Marketing console — manage fuel sales and delivery requests</span>
          </div>
        </div>
        <div className="welcome-actions">
          <button className="request-cta request-cta-secondary" onClick={() => navigate('/content')}>
            <span className="request-cta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 11v2a1 1 0 0 0 1 1h3l5 4V6L7 10H4a1 1 0 0 0-1 1z" />
                <path d="M16 9a3 3 0 0 1 0 6" />
                <path d="M19 6a7 7 0 0 1 0 12" />
              </svg>
            </span>
            <span className="request-cta-text">
              <span className="request-cta-title">Manage Content</span>
              <span className="request-cta-sub">Announcements &amp; news</span>
            </span>
            <span className="request-cta-arrow" aria-hidden="true">→</span>
          </button>

          <button className="request-cta" onClick={() => navigate('/quotations')}>
            <span className="request-cta-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="12" y1="12" x2="12" y2="18" />
                <line x1="9" y1="15" x2="15" y2="15" />
              </svg>
            </span>
            <span className="request-cta-text">
              <span className="request-cta-title">Create Quote</span>
              <span className="request-cta-sub">
                {stats.pendingRequests > 0
                  ? stats.pendingRequests + (stats.pendingRequests === 1 ? ' request waiting' : ' requests waiting')
                  : 'Price a fuel request'}
              </span>
            </span>
            <span className="request-cta-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      <div className="dashboard-stats-row marketing-stats-row">
        <div className="stat-card stat-cust">
          <div className="stat-card-header">
            <h3>Total Customers</h3>
            <span className="ticket-tag">CUST</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.totalCustomers}</span>
            </div>
          </div>
        </div>

        <div className="stat-card stat-req">
          <div className="stat-card-header">
            <h3>Pending Requests</h3>
            <span className="ticket-tag">REQ</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.pendingRequests}</span>
            </div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/fuel-requests')}>
              Review <span className="stat-btn-arrow">→</span>
            </button>
          </div>
        </div>

        <div className="stat-card stat-pay">
          <div className="stat-card-header">
            <h3>Pending Payments</h3>
            <span className="ticket-tag">PAY</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.pendingPayments}</span>
            </div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/orders')}>
              Verify <span className="stat-btn-arrow">→</span>
            </button>
          </div>
        </div>

        <div className="stat-card stat-ord">
          <div className="stat-card-header">
            <h3>Total Orders</h3>
            <span className="ticket-tag">ORD</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.orders}</span>
            </div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/orders')}>
              View All <span className="stat-btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>

      <AnnouncementsSection announcements={announcements} />

      <div className="recent-activity">
        <h2>Recent activity</h2>
        <div className="activity-feed">
          {activity.length === 0 ? (
            <p className="activity-empty">No activity yet. New requests, quotations and orders will show up here.</p>
          ) : (
            activity.map(function(event) {
              return (
                <button
                  key={event.key}
                  type="button"
                  className="activity-item"
                  onClick={() => navigate(event.link)}
                >
                  <span className={'activity-dot activity-' + event.type} aria-hidden="true" />
                  <span className="activity-text">
                    <span className="activity-title">{event.text}</span>
                    {event.detail && <span className="activity-detail">{event.detail}</span>}
                  </span>
                  <span className="activity-time" title={formatDate(event.time)}>
                    {formatTimeAgo(event.time)}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
