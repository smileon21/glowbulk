import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './DailyPrices.css';

const FUELS = [
  { key: 'diesel', label: 'Diesel' },
  { key: 'petrol', label: 'Petrol' }
];

const authConfig = (extra) => ({
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') },
  ...extra
});

// Prices come back from the API as strings like "1.4500"
const cleanNumber = (value) => (value === null || value === undefined ? '' : String(Number(value)));

const DailyPrices = () => {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [inputs, setInputs] = useState({});
  const [preparedBy, setPreparedBy] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all'); // 'all' | 'priced' | 'unpriced'
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null); // { type: 'ok' | 'error', text }

  const canEdit = localStorage.getItem('userRole') === 'marketing';

  const load = async () => {
    try {
      const res = await axios.get(API_BASE_URL + '/api/site-prices/today', authConfig());
      const data = res.data.data || [];
      const fresh = {};
      data.forEach((r) => {
        fresh[r.site_id] = {
          diesel: cleanNumber(r.diesel_price),
          petrol: cleanNumber(r.petrol_price)
        };
      });
      setRows(data);
      setInputs(fresh);
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not load today\'s prices' });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const setValue = (siteId, fuel, value) => {
    setInputs((prev) => ({ ...prev, [siteId]: { ...prev[siteId], [fuel]: value } }));
  };

  // Only fields that are filled in AND different from what is already saved
  const changes = useMemo(() => {
    const list = [];
    rows.forEach((r) => {
      FUELS.forEach(({ key }) => {
        const typed = (inputs[r.site_id]?.[key] ?? '').trim();
        if (typed === '') return;
        const saved = r[key + '_price'];
        if (saved === null || saved === undefined || Number(saved) !== Number(typed)) {
          list.push({ siteId: r.site_id, fuelType: key, unitPrice: typed });
        }
      });
    });
    return list;
  }, [rows, inputs]);

  const isChanged = (siteId, fuel) =>
    changes.some((c) => c.siteId === siteId && c.fuelType === fuel);

  const handleSave = async () => {
    setNotice(null);
    if (!preparedBy.trim()) {
      setNotice({ type: 'error', text: 'Please type your name before saving.' });
      return;
    }
    if (changes.length === 0) {
      setNotice({ type: 'error', text: 'Nothing to save. Enter a price or change an existing one.' });
      return;
    }
    if (changes.some((c) => !(Number(c.unitPrice) > 0))) {
      setNotice({ type: 'error', text: 'Every price must be a number greater than 0.' });
      return;
    }

    setSaving(true);
    try {
      const res = await axios.put(
        API_BASE_URL + '/api/site-prices/today',
        {
          preparedBy: preparedBy.trim(),
          prices: changes.map((c) => ({ ...c, unitPrice: Number(c.unitPrice) }))
        },
        authConfig()
      );
      // Saved: go straight to the page that shows today's priced sites
      navigate('/todays-prices', { state: { saved: res.data.message } });
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not save prices' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (row, fuel) => {
    setNotice(null);
    if (!preparedBy.trim()) {
      setNotice({ type: 'error', text: 'Please type your name before removing a price.' });
      return;
    }
    const label = fuel.charAt(0).toUpperCase() + fuel.slice(1);
    if (!window.confirm('Remove today\'s ' + label + ' price for ' + row.name + '?')) return;

    try {
      await axios.delete(
        API_BASE_URL + '/api/site-prices/today/' + row.site_id + '/' + fuel,
        authConfig({ params: { preparedBy: preparedBy.trim() } })
      );
      setNotice({ type: 'ok', text: label + ' price removed for ' + row.name + '.' });
      await load();
    } catch (err) {
      setNotice({ type: 'error', text: err.response?.data?.message || 'Could not remove price' });
    }
  };

  const isPriced = (r) => r.diesel_price !== null || r.petrol_price !== null;

  // Priced sites come first, so today's prices are always at the top of the list
  const shown = rows
    .filter((r) => {
      const q = search.trim().toLowerCase();
      const matchesSearch =
        !q || (r.name + ' ' + r.city + ' ' + (r.region || '')).toLowerCase().includes(q);
      const matchesFilter =
        filter === 'all' || (filter === 'priced' ? isPriced(r) : !isPriced(r));
      return matchesSearch && matchesFilter;
    })
    .sort((a, b) => Number(isPriced(b)) - Number(isPriced(a)));

  const pricedCount = rows.filter(isPriced).length;
  const today = rows[0]?.price_date;

  if (loading) {
    return <div className="loading">Loading prices...</div>;
  }

  return (
    <div className="dp-page">
      <div className="page-header">
        <div>
          <h2>Daily Prices</h2>
          <p className="dp-sub">
            Prices for {today || 'today'}. Only fill in sites that sell bulk fuel today.
            Customers inside a priced site's zone get an automatic quotation.
            Prices reset at midnight (Harare time).
          </p>
        </div>
        <div className="dp-actions">
          <span className="status-badge active">{pricedCount} of {rows.length} sites priced</span>
          <button
            type="button"
            className="glow-btn glow-btn-secondary"
            onClick={() => navigate('/todays-prices')}
          >
            View today's prices
          </button>
        </div>
      </div>

      {notice && (
        <div className={notice.type === 'ok' ? 'success-message' : 'error-message'}>{notice.text}</div>
      )}

      <div className="dp-toolbar">
        <input
          type="text"
          className="glow-input"
          placeholder="Search site, city or region"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {canEdit && (
          <>
            <input
              type="text"
              className="glow-input"
              placeholder="Your name (required)"
              maxLength={100}
              value={preparedBy}
              onChange={(e) => setPreparedBy(e.target.value)}
            />
            <button className="glow-btn" onClick={handleSave} disabled={saving || changes.length === 0}>
              {saving
                ? 'Saving...'
                : changes.length > 0
                  ? 'Save ' + changes.length + ' price' + (changes.length === 1 ? '' : 's')
                  : 'Save prices'}
            </button>
          </>
        )}
      </div>

      <div className="dp-filters">
        <button
          type="button"
          className={'filter-chip' + (filter === 'all' ? ' active' : '')}
          onClick={() => setFilter('all')}
        >
          All sites ({rows.length})
        </button>
        <button
          type="button"
          className={'filter-chip' + (filter === 'priced' ? ' active' : '')}
          onClick={() => setFilter('priced')}
        >
          Priced today ({pricedCount})
        </button>
        <button
          type="button"
          className={'filter-chip' + (filter === 'unpriced' ? ' active' : '')}
          onClick={() => setFilter('unpriced')}
        >
          Not priced ({rows.length - pricedCount})
        </button>
      </div>

      <div className="glow-card users-table-container">
        <table className="users-table">
          <thead>
            <tr>
              <th>Site</th>
              <th>City</th>
              {FUELS.map((f) => (
                <th key={f.key}>{f.label} (per litre)</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.length === 0 ? (
              <tr>
                <td colSpan={2 + FUELS.length} className="no-data">No sites match.</td>
              </tr>
            ) : (
              shown.map((r) => (
                <tr key={r.site_id}>
                  <td className="dp-site">{r.name}</td>
                  <td>{r.city}</td>
                  {FUELS.map((f) => {
                    const saved = r[f.key + '_price'];
                    const hasSaved = saved !== null && saved !== undefined;
                    return (
                      <td key={f.key}>
                        <div className="dp-cell">
                          <input
                            type="number"
                            min="0"
                            step="0.0001"
                            inputMode="decimal"
                            className={
                              'glow-input dp-input' +
                              (hasSaved ? ' dp-saved' : '') +
                              (isChanged(r.site_id, f.key) ? ' dp-changed' : '')
                            }
                            placeholder="Not set"
                            value={inputs[r.site_id]?.[f.key] ?? ''}
                            disabled={!canEdit}
                            onChange={(e) => setValue(r.site_id, f.key, e.target.value)}
                          />
                          {canEdit && hasSaved && (
                            <button
                              type="button"
                              className="glow-btn glow-btn-small glow-btn-secondary"
                              title="Remove today's price"
                              onClick={() => handleRemove(r, f.key)}
                            >
                              Remove
                            </button>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <p className="dp-hint">
          Leave a field empty for a site that is not selling. Changed fields are outlined in red and
          saved together. Past days are kept for reports.
        </p>
      )}
    </div>
  );
};

export default DailyPrices;
