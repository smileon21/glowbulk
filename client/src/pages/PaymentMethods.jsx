import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Finance.css';

const TYPE_LABELS = {
  bank: 'Bank account',
  mobile_money: 'Mobile money',
  cash: 'Cash',
  other: 'Other'
};

const EMPTY_FORM = {
  method_type: 'bank',
  title: '',
  currency: 'USD',
  bank_name: '',
  account_name: '',
  account_number: '',
  branch: '',
  swift_code: '',
  mobile_number: '',
  instructions: '',
  sort_order: 0
};

const PaymentMethods = () => {
  const [methods, setMethods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [form, setForm] = useState(null); // null = form closed
  const [editingId, setEditingId] = useState(null);
  const [saving, setSaving] = useState(false);

  var authConfig = function() {
    return { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } };
  };

  var errorText = function(err, fallback) {
    var data = err.response && err.response.data;
    return (data && data.message) ||
      (data && data.errors && data.errors[0] && data.errors[0].msg) ||
      fallback;
  };

  var fetchMethods = async function() {
    try {
      var res = await axios.get(API_BASE_URL + '/api/finance/payment-methods', authConfig());
      if (res.data.success) setMethods(res.data.data);
    } catch (err) {
      setError(errorText(err, 'Error loading payment methods'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(function() {
    fetchMethods();
  }, []);

  var openAdd = function() {
    setForm(Object.assign({}, EMPTY_FORM));
    setEditingId(null);
    setError('');
    setMessage('');
  };

  var openEdit = function(m) {
    var next = {};
    Object.keys(EMPTY_FORM).forEach(function(k) {
      next[k] = m[k] === null || m[k] === undefined ? '' : m[k];
    });
    setForm(next);
    setEditingId(m.id);
    setError('');
    setMessage('');
  };

  var setField = function(name, value) {
    setForm(function(prev) {
      var next = Object.assign({}, prev);
      next[name] = value;
      return next;
    });
  };

  var save = async function(e) {
    e.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      var res;
      if (editingId) {
        res = await axios.put(API_BASE_URL + '/api/finance/payment-methods/' + editingId, form, authConfig());
      } else {
        res = await axios.post(API_BASE_URL + '/api/finance/payment-methods', form, authConfig());
      }
      if (res.data.success) {
        setMessage(res.data.message);
        setForm(null);
        setEditingId(null);
        await fetchMethods();
      }
    } catch (err) {
      setError(errorText(err, 'Error saving payment method'));
    } finally {
      setSaving(false);
    }
  };

  var toggleActive = async function(m) {
    var turningOff = m.is_active;
    if (turningOff && !window.confirm('Switch off "' + m.title + '"? Customers will no longer see it.')) return;
    setError('');
    setMessage('');
    try {
      var res = await axios.patch(
        API_BASE_URL + '/api/finance/payment-methods/' + m.id + '/active',
        { is_active: !m.is_active },
        authConfig()
      );
      if (res.data.success) {
        setMessage(res.data.message);
        await fetchMethods();
      }
    } catch (err) {
      setError(errorText(err, 'Error updating payment method'));
    }
  };

  var field = function(name, label, opts) {
    opts = opts || {};
    return (
      <div className={'form-group' + (opts.full ? ' full' : '')}>
        <label className="glow-label">{label}{opts.required ? ' *' : ''}</label>
        <input
          type={opts.type || 'text'}
          className="glow-input"
          value={form[name]}
          maxLength={opts.maxLength || 100}
          placeholder={opts.placeholder || ''}
          onChange={function(e) { setField(name, e.target.value); }}
        />
      </div>
    );
  };

  var summary = function(m) {
    var lines = [];
    if (m.method_type === 'bank') {
      if (m.bank_name) lines.push(m.bank_name + (m.branch ? ', ' + m.branch : ''));
      if (m.account_name) lines.push('Account name: ' + m.account_name);
      if (m.account_number) lines.push('Account number: ' + m.account_number);
      if (m.swift_code) lines.push('SWIFT: ' + m.swift_code);
    }
    if (m.mobile_number) lines.push('Number: ' + m.mobile_number + (m.account_name ? ' (' + m.account_name + ')' : ''));
    if (m.instructions) lines.push(m.instructions);
    return lines;
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>Payment Methods</h2>
        {!form && (
          <button className="glow-btn" onClick={openAdd}>+ Add payment method</button>
        )}
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {form && (
        <form className="glow-card fin-section" onSubmit={save}>
          <h3>{editingId ? 'Edit payment method' : 'Add payment method'}</h3>
          <div className="fin-form-grid">
            <div className="form-group">
              <label className="glow-label">Type *</label>
              <select
                className="glow-input"
                value={form.method_type}
                onChange={function(e) { setField('method_type', e.target.value); }}
              >
                {Object.keys(TYPE_LABELS).map(function(k) {
                  return <option key={k} value={k}>{TYPE_LABELS[k]}</option>;
                })}
              </select>
            </div>
            {field('title', 'Title (what customers see)', { required: true, placeholder: 'e.g. CBZ USD account' })}
            {field('currency', 'Currency', { maxLength: 10 })}
            {field('sort_order', 'Order in the list', { type: 'number', maxLength: 4 })}

            {form.method_type === 'bank' && (
              <>
                {field('bank_name', 'Bank name', { required: true })}
                {field('account_name', 'Account name')}
                {field('account_number', 'Account number', { required: true, maxLength: 60 })}
                {field('branch', 'Branch')}
                {field('swift_code', 'SWIFT code', { maxLength: 30 })}
              </>
            )}

            {form.method_type === 'mobile_money' && (
              <>
                {field('mobile_number', 'Mobile number', { required: true, maxLength: 30 })}
                {field('account_name', 'Registered name')}
              </>
            )}

            <div className="form-group full">
              <label className="glow-label">Instructions for the customer</label>
              <textarea
                className="glow-input fin-textarea"
                value={form.instructions}
                maxLength={500}
                onChange={function(e) { setField('instructions', e.target.value); }}
                placeholder="e.g. Use your order number as the payment reference"
              />
            </div>
          </div>

          <div className="fin-actions">
            <button type="submit" className="glow-btn" disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              type="button"
              className="glow-btn glow-btn-secondary"
              disabled={saving}
              onClick={function() { setForm(null); setEditingId(null); setError(''); }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {methods.length === 0 ? (
        <div className="glow-card no-content">
          <p>No payment methods yet. Add the bank account or mobile money number customers should pay into.</p>
        </div>
      ) : (
        <div className="orders-grid">
          {methods.map(function(m) {
            return (
              <div key={m.id} className="order-card" style={{ opacity: m.is_active ? 1 : 0.6 }}>
                <div className="order-header">
                  <h3>{m.title}</h3>
                  <span className="status-badge" style={{ background: m.is_active ? '#2f7a3f' : '#6b7280' }}>
                    {m.is_active ? 'On' : 'Off'}
                  </span>
                </div>
                <div className="order-details">
                  <p><strong>{TYPE_LABELS[m.method_type] || m.method_type}</strong> · {m.currency}</p>
                  {summary(m).map(function(line, i) { return <p key={i}>{line}</p>; })}
                </div>
                <div className="order-footer">
                  <small>Updated by {m.updated_by}</small>
                </div>
                <div className="fin-actions">
                  <button className="glow-btn glow-btn-small" onClick={function() { openEdit(m); }}>Edit</button>
                  <button className="glow-btn glow-btn-small glow-btn-secondary" onClick={function() { toggleActive(m); }}>
                    {m.is_active ? 'Switch off' : 'Switch on'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PaymentMethods;
