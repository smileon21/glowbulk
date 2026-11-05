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

// Dot colour for a log entry, picked from its action name
function entryTone(action) {
  const a = String(action || '').toUpperCase();
  if (a.includes('UNBLOCK') || a.includes('UNLOCK') || a.includes('CREATE') || a.includes('REGISTER')) return 'green';
  if (a.includes('BLOCK') || a.includes('LOCK') || a.includes('DEACTIVAT') || a.includes('FAILED')) return 'red';
  return 'slate';
}

// Small inline icon set (same stroke style as the Marketing dashboard)
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
  activity: <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />,
  bolt: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
  arrow: (
    <>
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </>
  ),
  chevron: <polyline points="9 18 15 12 9 6" />
};

const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {ICON_PATHS[name]}
  </svg>
);

// One stat tile. Clickable (a button) when it has an onClick, otherwise static.
const Tile = ({ tone, icon, label, number, sub, link, onClick }) => {
  const inner = (
    <>
      <div className="itd-tile-top">
        <span className={'itd-tile-icon itd-tone-' + tone}><Icon name={icon} /></span>
        <div className="itd-tile-body">
          <span className="itd-tile-label">{label}</span>
          <span className="itd-tile-number">{number}</span>
          <span className="itd-tile-sub">{sub}</span>
        </div>
      </div>
      {link && (
        <span className="itd-tile-link">
          {link} <span className="itd-arrow"><Icon name="arrow" /></span>
        </span>
      )}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={'itd-tile itd-edge-' + tone} onClick={onClick}>
        {inner}
      </button>
    );
  }
  return <div className={'itd-tile itd-tile-static itd-edge-' + tone}>{inner}</div>;
};

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
    <div className="itd">
      {/* Welcome heading */}
      <div className="itd-hero">
        <span className="itd-hero-bar" aria-hidden="true" />
        <div>
          <h1>Welcome, <span className="itd-accent">{userName}</span></h1>
          <p>IT console — staff accounts, access and the activity trail</p>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      {/* Stat tiles */}
      <div className="itd-tiles">
        <Tile
          tone="navy" icon="users" label="Staff Accounts" number={staffCount} sub="Total"
          link="Manage Accounts" onClick={() => navigate(ACCOUNTS_ROUTE)}
        />
        <Tile
          tone="navy" icon="user" label="Customers" number={itStats.customers} sub="Total"
        />
        <Tile
          tone="red" icon="lock" label="Blocked Accounts" number={itStats.blockedUsers}
          sub={'Locked now ' + itStats.lockedUsers}
          link="Review Accounts" onClick={() => navigate(ACCOUNTS_ROUTE)}
        />
        <Tile
          tone="red" icon="alert" label="Failed Sign-ins" number={itStats.failedLogins24h} sub="Last 24 hours"
        />
      </div>

      {/* Needs attention + Quick actions */}
      <div className="itd-columns">
        <section className="itd-card">
          <div className="itd-card-head">
            <span className="itd-card-bar" aria-hidden="true" />
            <span className="itd-card-icon"><Icon name="shield" /></span>
            <div className="itd-card-title">
              <h3>Needs attention</h3>
              {flagged.length > 0 && (
                <p>{flagged.length} account{flagged.length === 1 ? '' : 's'} flagged</p>
              )}
            </div>
          </div>

          {flagged.length === 0 ? (
            <div className="itd-empty">
              <span className="itd-empty-icon"><Icon name="checkCircle" /></span>
              <strong>All clear</strong>
              <p>No suspicious sign-in activity right now.</p>
            </div>
          ) : (
            <div className="itd-list">
              {flagged.map((account) => (
                <div key={account.id} className="itd-row">
                  <span className="itd-dot itd-dot-red" aria-hidden="true" />
                  <span className="itd-row-text">
                    <strong>{account.name || account.email} ({account.email})</strong>
                    <span>
                      {account.failed_login_attempts} failed sign-ins
                      {account.is_locked ? ' · locked' : ''}
                      {account.is_active === false ? ' · blocked' : ''}
                    </span>
                  </span>
                  <span className="itd-row-time" title={formatDate(account.last_failed_login)}>
                    {account.last_failed_login ? formatTimeAgo(account.last_failed_login) : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="itd-card">
          <div className="itd-card-head">
            <span className="itd-card-bar" aria-hidden="true" />
            <span className="itd-card-icon"><Icon name="bolt" /></span>
            <div className="itd-card-title">
              <h3>Quick Actions</h3>
            </div>
          </div>
          <div className="itd-actions">
            <button type="button" className="itd-action" onClick={() => navigate(ACCOUNTS_ROUTE)}>
              <span className="itd-action-icon itd-tone-red"><Icon name="userPlus" /></span>
              <span className="itd-action-text">
                <strong>Manage Accounts</strong>
                <span>Create, reset and block</span>
              </span>
              <span className="itd-action-chevron"><Icon name="chevron" /></span>
            </button>
          </div>
        </section>
      </div>

      {/* Recent IT activity */}
      <section className="itd-card">
        <div className="itd-card-head">
          <span className="itd-card-bar" aria-hidden="true" />
          <span className="itd-card-icon"><Icon name="activity" /></span>
          <div className="itd-card-title">
            <h3>Recent IT activity</h3>
          </div>
        </div>

        {itLog.length === 0 ? (
          <div className="itd-empty">
            <span className="itd-empty-icon itd-empty-icon--neutral"><Icon name="activity" /></span>
            <strong>No activity yet</strong>
            <p>No activity recorded yet. Account actions will show up here.</p>
          </div>
        ) : (
          <div className="itd-list">
            {itLog.map((entry) => (
              <div key={entry.id} className="itd-row">
                <span className={'itd-dot itd-dot-' + entryTone(entry.action)} aria-hidden="true" />
                <span className="itd-row-text">
                  <strong>
                    {actionLabel(entry.action)}
                    {entry.actor_name ? ' by ' + entry.actor_name : ''}
                  </strong>
                  {entry.details && <span>{entry.details}</span>}
                </span>
                <span className="itd-row-time" title={formatDate(entry.created_at)}>
                  {formatTimeAgo(entry.created_at)}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default ITDashboard;
