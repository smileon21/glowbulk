import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatName, formatDate, formatTimeAgo } from '../utils/format';
import './ITDashboard.css';

const ACTIVITY_LIMIT = 6;
const ACCOUNTS_ROUTE = '/accounts';

// "USER_BLOCKED" -> "User blocked"
function actionLabel(action) {
  const text = String(action || '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

// Picks an icon and colour for a log entry from its action name.
// Anything it does not recognise falls back to a neutral "activity" icon.
function entryKind(action) {
  const a = String(action || '').toUpperCase();
  if (a.includes('UNBLOCK') || a.includes('UNLOCK')) return { icon: 'unlock', tone: 'green' };
  if (a.includes('BLOCK') || a.includes('LOCK') || a.includes('DEACTIVAT')) return { icon: 'lock', tone: 'red' };
  if (a.includes('PASSWORD') || a.includes('RESET')) return { icon: 'key', tone: 'slate' };
  if (a.includes('CREATE') || a.includes('REGISTER')) return { icon: 'userPlus', tone: 'green' };
  return { icon: 'activity', tone: 'slate' };
}

// Small inline icon set (same stroke style as the rest of the app)
const ICON_PATHS = {
  users: (
    <>
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </>
  ),
  user: (
    <>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </>
  ),
  userPlus: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <line x1="20" y1="8" x2="20" y2="14" />
      <line x1="23" y1="11" x2="17" y2="11" />
    </>
  ),
  lock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </>
  ),
  unlock: (
    <>
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </>
  ),
  alert: (
    <>
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </>
  ),
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  checkCircle: (
    <>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </>
  ),
  key: <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />,
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  calendar: (
    <>
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </>
  )
};

const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICON_PATHS[name]}
  </svg>
);

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
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
  });

  return (
    <div className="itd">
      {/* Date sits beside the notification bell */}
      <div className="itd-topline">
        <span className="itd-date"><Icon name="calendar" />{today}</span>
      </div>

      {/* Welcome banner */}
      <header className="itd-hero">
        <div className="itd-hero-text">
          <h1>
            Welcome, <span className="itd-name">{userName}</span> <span aria-hidden="true">👋</span>
          </h1>
          <p>IT console — staff accounts, access and the activity trail</p>
        </div>
        <div className="itd-hero-actions">
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
      </header>

      {error && <div className="error-message">{error}</div>}

      {/* Stat cards */}
      <section className="itd-stats">
        <div className="itd-stat itd-stat--green">
          <span className="itd-stat-icon"><Icon name="users" /></span>
          <div className="itd-stat-body">
            <h3>Staff Accounts</h3>
            <div className="itd-stat-figure">
              <span className="itd-stat-value">{staffCount}</span>
              <span className="itd-stat-chip">Total</span>
            </div>
            <button className="itd-stat-link" onClick={() => navigate(ACCOUNTS_ROUTE)}>
              Manage <span>→</span>
            </button>
          </div>
        </div>

        <div className="itd-stat itd-stat--steel">
          <span className="itd-stat-icon"><Icon name="user" /></span>
          <div className="itd-stat-body">
            <h3>Customers</h3>
            <div className="itd-stat-figure">
              <span className="itd-stat-value">{itStats.customers}</span>
              <span className="itd-stat-chip">Total</span>
            </div>
          </div>
        </div>

        <div className="itd-stat itd-stat--red">
          <span className="itd-stat-icon"><Icon name="lock" /></span>
          <div className="itd-stat-body">
            <h3>Blocked Accounts</h3>
            <div className="itd-stat-figure">
              <span className="itd-stat-value">{itStats.blockedUsers}</span>
              <span className="itd-stat-chip">Locked now <b>{itStats.lockedUsers}</b></span>
            </div>
            <button className="itd-stat-link" onClick={() => navigate(ACCOUNTS_ROUTE)}>
              Review <span>→</span>
            </button>
          </div>
        </div>

        <div className="itd-stat itd-stat--amber">
          <span className="itd-stat-icon"><Icon name="alert" /></span>
          <div className="itd-stat-body">
            <h3>Failed Sign-ins</h3>
            <div className="itd-stat-figure">
              <span className="itd-stat-value">{itStats.failedLogins24h}</span>
              <span className="itd-stat-chip">Last 24 hours</span>
            </div>
          </div>
        </div>
      </section>

      {/* Needs attention + Recent IT activity */}
      <section className="itd-panels">
        <div className="itd-panel">
          <div className="itd-panel-head">
            <span className="itd-panel-icon"><Icon name="shield" /></span>
            <h2>Needs attention</h2>
            {flagged.length > 0 && <span className="itd-count">{flagged.length}</span>}
          </div>
          <div className="itd-panel-body">
            {flagged.length === 0 ? (
              <div className="itd-empty">
                <span className="itd-empty-icon"><Icon name="checkCircle" /></span>
                <p>No suspicious sign-in activity right now.</p>
              </div>
            ) : (
              flagged.map((account) => (
                <div key={account.id} className="itd-row">
                  <span className="itd-row-icon itd-tone-red"><Icon name="alert" /></span>
                  <span className="itd-row-text">
                    <span className="itd-row-title">{account.name || account.email} ({account.email})</span>
                    <span className="itd-row-detail">
                      {account.failed_login_attempts} failed sign-ins
                      {account.is_locked ? ' · locked' : ''}
                      {account.is_active === false ? ' · blocked' : ''}
                    </span>
                  </span>
                  <span className="itd-row-time" title={formatDate(account.last_failed_login)}>
                    {account.last_failed_login ? formatTimeAgo(account.last_failed_login) : ''}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        <div className="itd-panel">
          <div className="itd-panel-head">
            <span className="itd-panel-icon"><Icon name="activity" /></span>
            <h2>Recent IT activity</h2>
          </div>
          <div className="itd-panel-body">
            {itLog.length === 0 ? (
              <div className="itd-empty">
                <span className="itd-empty-icon itd-empty-icon--neutral"><Icon name="activity" /></span>
                <p>No activity recorded yet. Account actions will show up here.</p>
              </div>
            ) : (
              itLog.map((entry) => {
                const kind = entryKind(entry.action);
                return (
                  <div key={entry.id} className="itd-row">
                    <span className={'itd-row-icon itd-tone-' + kind.tone}><Icon name={kind.icon} /></span>
                    <span className="itd-row-text">
                      <span className="itd-row-title">
                        {actionLabel(entry.action)}
                        {entry.actor_name ? ' by ' + entry.actor_name : ''}
                      </span>
                      {entry.details && <span className="itd-row-detail">{entry.details}</span>}
                    </span>
                    <span className="itd-row-time" title={formatDate(entry.created_at)}>
                      {formatTimeAgo(entry.created_at)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

export default ITDashboard;
