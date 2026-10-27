import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatName, formatDate, formatTimeAgo } from '../utils/format';

const ACTIVITY_LIMIT = 6;
const ACCOUNTS_ROUTE = '/accounts';

// "USER_BLOCKED" -> "User blocked"
function actionLabel(action) {
  const text = String(action || '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const ITDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [itStats, setItStats] = useState({
    admins: 0, marketing: 0, pricing: 0, finance: 0,
    customers: 0, blockedUsers: 0, lockedUsers: 0, failedLogins24h: 0
  });
  const [flagged, setFlagged] = useState([]);
  const [itLog, setItLog] = useState([]);

  const navigate = useNavigate();
  const userName = formatName(localStorage.getItem('userName')) || 'User';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      setLoading(false);
      return;
    }
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

    const load = async () => {
      try {
        const results = await Promise.all([
          axios.get(API_BASE_URL + '/api/admin/dashboard/stats'),
          axios.get(API_BASE_URL + '/api/admin/suspicious-activity'),
          axios.get(API_BASE_URL + '/api/admin/activity-log?limit=' + ACTIVITY_LIMIT)
        ]);
        setItStats(results[0].data.data);
        setFlagged(results[1].data.data.flaggedAccounts || []);
        setItLog(results[2].data.data || []);
      } catch (err) {
        console.error('Error loading IT dashboard:', err);
        setError('Could not load the IT dashboard.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  if (loading) return <div className="loading">Loading manifest...</div>;

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
          <button className="request-cta" onClick={() => navigate(ACCOUNTS_ROUTE)}>
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

      {error && <div className="error-message">{error}</div>}

      <div className="dashboard-stats-row marketing-stats-row">
        <div className="stat-card stat-ord">
          <div className="stat-card-header"><h3>Staff Accounts</h3><span className="ticket-tag">STAFF</span></div>
          <div className="stat-card-body">
            <div className="stat-detail-item"><span className="detail-label">Total</span><span className="detail-value">{staffCount}</span></div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate(ACCOUNTS_ROUTE)}>Manage <span className="stat-btn-arrow">→</span></button>
          </div>
        </div>

        <div className="stat-card stat-cust">
          <div className="stat-card-header"><h3>Customers</h3><span className="ticket-tag">CUST</span></div>
          <div className="stat-card-body">
            <div className="stat-detail-item"><span className="detail-label">Total</span><span className="detail-value">{itStats.customers}</span></div>
          </div>
        </div>

        <div className="stat-card stat-pay">
          <div className="stat-card-header"><h3>Blocked Accounts</h3><span className="ticket-tag">BLOCK</span></div>
          <div className="stat-card-body">
            <div className="stat-detail-item"><span className="detail-label">Blocked</span><span className="detail-value">{itStats.blockedUsers}</span></div>
            <div className="stat-detail-item"><span className="detail-label">Locked now</span><span className="detail-value">{itStats.lockedUsers}</span></div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate(ACCOUNTS_ROUTE)}>Review <span className="stat-btn-arrow">→</span></button>
          </div>
        </div>

        <div className="stat-card stat-req">
          <div className="stat-card-header"><h3>Failed Sign-ins</h3><span className="ticket-tag">24H</span></div>
          <div className="stat-card-body">
            <div className="stat-detail-item"><span className="detail-label">Last 24 hours</span><span className="detail-value">{itStats.failedLogins24h}</span></div>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h2>Needs attention</h2>
        <div className="activity-feed">
          {flagged.length === 0 ? (
            <p className="activity-empty">No suspicious sign-in activity right now.</p>
          ) : (
            flagged.map((account) => (
              <div key={account.id} className="activity-item">
                <span className="activity-dot activity-bad" aria-hidden="true" />
                <span className="activity-text">
                  <span className="activity-title">{account.name || account.email} ({account.email})</span>
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
            ))
          )}
        </div>
      </div>

      <div className="recent-activity">
        <h2>Recent IT activity</h2>
        <div className="activity-feed">
          {itLog.length === 0 ? (
            <p className="activity-empty">No activity recorded yet. Account actions will show up here.</p>
          ) : (
            itLog.map((entry) => (
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
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default ITDashboard;