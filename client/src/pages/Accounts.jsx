import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatTimeAgo } from '../utils/format';
import './ITAdmin.css';

// "admin" is the value stored in the database; on screen it is called IT
const ROLE_LABELS = {
  admin: 'IT',
  marketing: 'Marketing',
  pricing: 'Pricing',
  finance: 'Finance',
  customer: 'Customer'
};

const STAFF_ROLES = ['admin', 'marketing', 'pricing', 'finance'];

const authConfig = (extra) => ({
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
  ...extra
});

const errorText = (err, fallback) => (err.response && err.response.data && err.response.data.message) || fallback;

// ---------------------------------------------------------------
// Small modal shell
// ---------------------------------------------------------------
const Modal = ({ title, onClose, children }) => (
  <div className="it-modal-backdrop" onMouseDown={onClose}>
    <div
      className="it-modal"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <h3>{title}</h3>
      {children}
    </div>
  </div>
);

// ---------------------------------------------------------------
// Temporary password panel (shown once)
// ---------------------------------------------------------------
const SecretPanel = ({ secret, onDismiss }) => {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(secret.password);
      setCopied(true);
    } catch (err) {
      setCopied(false);
    }
  };

  return (
    <div className="it-secret">
      <strong>{secret.title}</strong>
      <span className="it-sub">{secret.name ? secret.name + ' · ' : ''}{secret.email}</span>
      <div>
        <code>{secret.password}</code>
        <button type="button" className="it-btn ghost small" onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <span className="it-sub">
        This temporary password is shown only once. Give it to the person in person or by phone.
        They must choose their own password when they first sign in.
      </span>
      <div style={{ marginTop: '0.75rem' }}>
        <button type="button" className="it-btn" onClick={onDismiss}>
          I have noted it
        </button>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------
// Create account
// ---------------------------------------------------------------
const CreateAccountForm = ({ onCreated, onCancel }) => {
  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', phone: '', role: 'marketing' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      const response = await axios.post(`${API_BASE_URL}/api/admin/users`, form, authConfig());
      onCreated(response.data.data);
    } catch (err) {
      setError(errorText(err, 'Unable to create the account.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="it-card" onSubmit={submit}>
      <strong>New staff account</strong>
      {error && <div className="error-message" style={{ marginTop: '0.6rem' }}>{error}</div>}

      <div className="it-form-grid">
        <div className="it-field">
          <label>First name</label>
          <input className="it-input" value={form.firstName} onChange={set('firstName')} required />
        </div>
        <div className="it-field">
          <label>Last name</label>
          <input className="it-input" value={form.lastName} onChange={set('lastName')} required />
        </div>
        <div className="it-field">
          <label>Email</label>
          <input className="it-input" type="email" value={form.email} onChange={set('email')} required />
        </div>
        <div className="it-field">
          <label>Phone (optional)</label>
          <input className="it-input" value={form.phone} onChange={set('phone')} />
        </div>
        <div className="it-field">
          <label>Department</label>
          <select className="it-select" value={form.role} onChange={set('role')}>
            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>{ROLE_LABELS[role]}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="it-actions">
        <button type="submit" className="it-btn" disabled={saving}>
          {saving ? 'Creating...' : 'Create account'}
        </button>
        <button type="button" className="it-btn ghost" onClick={onCancel}>Cancel</button>
      </div>
    </form>
  );
};

// ---------------------------------------------------------------
// Modals for one account
// ---------------------------------------------------------------
const BlockModal = ({ user, onClose, onDone }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${user.id}/block`,
        { reason: reason.trim() },
        authConfig()
      );
      onDone(`${user.name} is blocked. It takes effect on their next click.`);
    } catch (err) {
      setError(errorText(err, 'Unable to block this account.'));
      setSaving(false);
    }
  };

  return (
    <Modal title={`Block ${user.name}?`} onClose={onClose}>
      <form onSubmit={submit}>
        <p className="it-sub">{user.email}</p>
        {error && <div className="error-message">{error}</div>}
        <div className="it-field">
          <label>Reason (the person will see this)</label>
          <textarea
            className="it-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            required
            autoFocus
          />
        </div>
        <div className="it-modal-actions">
          <button type="button" className="it-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="it-btn" disabled={saving || reason.trim().length < 3}>
            {saving ? 'Blocking...' : 'Block account'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const EmailModal = ({ user, onClose, onDone }) => {
  const [email, setEmail] = useState(user.email);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await axios.put(
        `${API_BASE_URL}/api/admin/users/${user.id}/email`,
        { email: email.trim() },
        authConfig()
      );
      onDone(`Email for ${user.name} updated.`);
    } catch (err) {
      setError(errorText(err, 'Unable to change the email.'));
      setSaving(false);
    }
  };

  return (
    <Modal title={`Change email for ${user.name}`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="error-message">{error}</div>}
        <div className="it-field">
          <label>New email</label>
          <input
            className="it-input full"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="it-modal-actions">
          <button type="button" className="it-btn ghost" onClick={onClose}>Cancel</button>
          <button type="submit" className="it-btn" disabled={saving || !email.trim()}>
            {saving ? 'Saving...' : 'Save email'}
          </button>
        </div>
      </form>
    </Modal>
  );
};

const ResetModal = ({ user, onClose, onDone }) => {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      const response = await axios.put(
        `${API_BASE_URL}/api/admin/users/${user.id}/reset-password`,
        {},
        authConfig()
      );
      onDone(null, {
        title: 'Password reset',
        name: user.name,
        email: user.email,
        password: response.data.data.temporaryPassword
      });
    } catch (err) {
      setError(errorText(err, 'Unable to reset the password.'));
      setSaving(false);
    }
  };

  return (
    <Modal title={`Reset password for ${user.name}?`} onClose={onClose}>
      {error && <div className="error-message">{error}</div>}
      <p>
        A new temporary password will be created and shown once. Their old password stops working
        immediately, and they must choose a new one when they sign in.
      </p>
      <div className="it-modal-actions">
        <button type="button" className="it-btn ghost" onClick={onClose}>Cancel</button>
        <button type="button" className="it-btn" onClick={submit} disabled={saving}>
          {saving ? 'Resetting...' : 'Reset password'}
        </button>
      </div>
    </Modal>
  );
};

// ---------------------------------------------------------------
// Page
// ---------------------------------------------------------------
const Accounts = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [role, setRole] = useState('staff');
  const [status, setStatus] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  const [showCreate, setShowCreate] = useState(false);
  const [modal, setModal] = useState(null); // { type: 'block' | 'email' | 'reset', user }
  const [secret, setSecret] = useState(null);

  const myEmail = (localStorage.getItem('userEmail') || '').toLowerCase();

  // Wait a moment after typing before searching
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = {};
      if (role) params.role = role;
      if (status) params.status = status;
      if (search) params.search = search;

      const response = await axios.get(`${API_BASE_URL}/api/admin/users`, authConfig({ params }));
      setUsers(response.data.data || []);
    } catch (err) {
      setError(errorText(err, 'Unable to load accounts.'));
    } finally {
      setLoading(false);
    }
  }, [role, status, search]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleDone = (message, newSecret) => {
    setModal(null);
    setError('');
    setNotice(message || '');
    if (newSecret) setSecret(newSecret);
    loadUsers();
  };

  const handleCreated = (data) => {
    setShowCreate(false);
    setNotice('');
    setSecret({
      title: 'Account created',
      name: data.name,
      email: data.email,
      password: data.temporaryPassword
    });
    loadUsers();
  };

  const unblock = async (user) => {
    setError('');
    setNotice('');
    try {
      await axios.put(`${API_BASE_URL}/api/admin/users/${user.id}/unblock`, {}, authConfig());
      setNotice(`${user.name} can sign in again.`);
      loadUsers();
    } catch (err) {
      setError(errorText(err, 'Unable to unblock this account.'));
    }
  };

  return (
    <div className="it-page">
      <div className="page-header">
        <h2>Accounts</h2>
      </div>
      <p className="sub-text">Create staff accounts, reset passwords and control access</p>

      {error && <div className="error-message">{error}</div>}
      {notice && <div className="success-message">{notice}</div>}

      {secret && <SecretPanel secret={secret} onDismiss={() => setSecret(null)} />}

      {showCreate ? (
        <CreateAccountForm onCreated={handleCreated} onCancel={() => setShowCreate(false)} />
      ) : (
        <div className="it-toolbar">
          <button type="button" className="it-btn" onClick={() => setShowCreate(true)}>
            + New staff account
          </button>
        </div>
      )}

      <div className="it-toolbar">
        <input
          className="it-input"
          type="search"
          placeholder="Search name or email"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
        />
        <select className="it-select" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="staff">All staff</option>
          <option value="admin">IT</option>
          <option value="marketing">Marketing</option>
          <option value="pricing">Pricing</option>
          <option value="finance">Finance</option>
          <option value="customer">Customers</option>
          <option value="">Everyone</option>
        </select>
        <select className="it-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Any status</option>
          <option value="active">Active</option>
          <option value="blocked">Blocked</option>
        </select>
        <span className="it-spacer" />
        <span className="it-sub">{loading ? 'Loading...' : `${users.length} account${users.length === 1 ? '' : 's'}`}</span>
      </div>

      <div className="it-table-wrap">
        {users.length === 0 && !loading ? (
          <div className="it-empty">No accounts match these filters.</div>
        ) : (
          <table className="it-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Department</th>
                <th>Status</th>
                <th>Last sign-in</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const isSelf = (user.email || '').toLowerCase() === myEmail;
                const isStaff = STAFF_ROLES.includes(user.role);
                const blocked = user.is_active === false;

                return (
                  <tr key={user.id}>
                    <td>
                      {user.name || user.email}
                      <span className="it-sub">{user.email}</span>
                      {user.company_name && <span className="it-sub">{user.company_name}</span>}
                    </td>
                    <td>{ROLE_LABELS[user.role] || user.role}</td>
                    <td>
                      {blocked ? (
                        <span className="it-badge blocked">Blocked</span>
                      ) : user.is_locked ? (
                        <span className="it-badge locked">Locked</span>
                      ) : (
                        <span className="it-badge active">Active</span>
                      )}
                      {user.must_change_password && !blocked && (
                        <span className="it-badge pending">Temporary password</span>
                      )}
                      {blocked && user.blocked_reason && (
                        <span className="it-sub">Reason: {user.blocked_reason}</span>
                      )}
                    </td>
                    <td>{user.last_login ? formatTimeAgo(user.last_login) : 'Never'}</td>
                    <td>
                      {isSelf ? (
                        <span className="it-sub">This is you</span>
                      ) : (
                        <div className="it-actions">
                          {isStaff && (
                            <button
                              type="button"
                              className="it-btn ghost small"
                              onClick={() => setModal({ type: 'reset', user })}
                            >
                              Reset password
                            </button>
                          )}
                          {isStaff && (
                            <button
                              type="button"
                              className="it-btn ghost small"
                              onClick={() => setModal({ type: 'email', user })}
                            >
                              Change email
                            </button>
                          )}
                          {blocked ? (
                            <button type="button" className="it-btn small" onClick={() => unblock(user)}>
                              Unblock
                            </button>
                          ) : (
                            <>
                              {user.is_locked && (
                                <button type="button" className="it-btn small" onClick={() => unblock(user)}>
                                  Unlock
                                </button>
                              )}
                              <button
                                type="button"
                                className="it-btn danger small"
                                onClick={() => setModal({ type: 'block', user })}
                              >
                                Block
                              </button>
                            </>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {modal && modal.type === 'block' && (
        <BlockModal user={modal.user} onClose={() => setModal(null)} onDone={handleDone} />
      )}
      {modal && modal.type === 'email' && (
        <EmailModal user={modal.user} onClose={() => setModal(null)} onDone={handleDone} />
      )}
      {modal && modal.type === 'reset' && (
        <ResetModal user={modal.user} onClose={() => setModal(null)} onDone={handleDone} />
      )}
    </div>
  );
};

export default Accounts;
