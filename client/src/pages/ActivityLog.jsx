import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './ITAdmin.css';

const PAGE_SIZE = 25;

// "USER_BLOCKED" -> "User blocked"
const actionLabel = (action) => {
  const text = String(action || '').replace(/_/g, ' ').toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
};

const showValue = (value) => {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'yes' : 'no';
  return String(value);
};

// Lists only the fields that differ between the old and new values
const changedFields = (oldValues, newValues) => {
  const before = oldValues || {};
  const after = newValues || {};
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys
    .filter((key) => JSON.stringify(before[key]) !== JSON.stringify(after[key]))
    .map((key) => ({ key, from: before[key], to: after[key] }));
};

const ActivityLog = () => {
  const [rows, setRows] = useState([]);
  const [actions, setActions] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [page, setPage] = useState(1);
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Wait a moment after typing before searching
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadLog = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = { page, limit: PAGE_SIZE };
      if (action) params.action = action;
      if (from) params.from = from;
      if (to) params.to = to;
      if (search) params.search = search;

      const response = await axios.get(`${API_BASE_URL}/api/admin/activity-log`, {
        headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
        params
      });

      setRows(response.data.data || []);
      setActions(response.data.actions || []);
      setPagination(response.data.pagination || { page: 1, totalPages: 1, total: 0 });
    } catch (err) {
      setError((err.response && err.response.data && err.response.data.message) || 'Unable to load the activity log.');
    } finally {
      setLoading(false);
    }
  }, [page, action, from, to, search]);

  useEffect(() => {
    loadLog();
  }, [loadLog]);

  const clearFilters = () => {
    setAction('');
    setFrom('');
    setTo('');
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const hasFilters = action || from || to || search;

  return (
    <div className="it-page">
      <div className="page-header">
        <h2>Activity Log</h2>
      </div>
      <p className="sub-text">Every account action, signed with who did it and when</p>

      {error && <div className="error-message">{error}</div>}

      <div className="it-toolbar it-filters">
        <input
          className="it-input it-search"
          type="search"
          placeholder="Search person"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select
          className="it-select"
          value={action}
          onChange={(e) => { setAction(e.target.value); setPage(1); }}
        >
          <option value="">All actions</option>
          {actions.map((a) => (
            <option key={a} value={a}>{actionLabel(a)}</option>
          ))}
        </select>
        <div className="it-field">
          <label htmlFor="log-from">From</label>
          <input
            id="log-from"
            className="it-input"
            type="date"
            value={from}
            onChange={(e) => { setFrom(e.target.value); setPage(1); }}
          />
        </div>
        <div className="it-field">
          <label htmlFor="log-to">To</label>
          <input
            id="log-to"
            className="it-input"
            type="date"
            value={to}
            onChange={(e) => { setTo(e.target.value); setPage(1); }}
          />
        </div>
        {hasFilters && (
          <button type="button" className="it-btn ghost small" onClick={clearFilters}>
            Clear filters
          </button>
        )}
      </div>

      <div className="it-table-wrap">
        {rows.length === 0 && !loading ? (
          <div className="it-empty">No activity matches these filters.</div>
        ) : (
          <table className="it-table">
            <thead>
              <tr>
                <th>When</th>
                <th>Who</th>
                <th>Action</th>
                <th>Details</th>
                <th>Changes</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const changes = changedFields(row.old_values, row.new_values);
                return (
                  <tr key={row.id}>
                    <td>{new Date(row.created_at).toLocaleString()}</td>
                    <td>
                      {row.actor_name || 'System'}
                      {row.actor_role && (
                        <span className="it-sub">{row.actor_role === 'admin' ? 'IT' : row.actor_role}</span>
                      )}
                    </td>
                    <td>{actionLabel(row.action)}</td>
                    <td>
                      {row.details || '—'}
                      {row.ip_address && <span className="it-sub">IP {row.ip_address}</span>}
                    </td>
                    <td>
                      {changes.length === 0
                        ? '—'
                        : changes.map((c) => (
                            <div key={c.key} className="it-change">
                              {c.key.replace(/_/g, ' ')}: {showValue(c.from)} → {showValue(c.to)}
                            </div>
                          ))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="it-pagination">
        <span className="it-sub">
          {loading ? 'Loading...' : `${pagination.total} entr${pagination.total === 1 ? 'y' : 'ies'}`}
        </span>
        <div className="it-actions">
          <button
            type="button"
            className="it-btn ghost small"
            disabled={page <= 1 || loading}
            onClick={() => setPage(page - 1)}
          >
            Previous
          </button>
          <span className="it-sub" style={{ alignSelf: 'center' }}>
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            type="button"
            className="it-btn ghost small"
            disabled={page >= pagination.totalPages || loading}
            onClick={() => setPage(page + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
};

export default ActivityLog;
