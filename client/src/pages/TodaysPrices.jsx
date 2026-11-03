import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './DailyPrices.css';

// 1.9 -> "1.90", 1.895 -> "1.895"
const formatPrice = (value) => {
  if (value === null || value === undefined) return '—';
  const n = Number(value);
  const decimals = Math.min(4, Math.max(2, (String(n).split('.')[1] || '').length));
  return n.toFixed(decimals);
};

const TodaysPrices = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message] = useState(location.state?.saved || '');

  useEffect(() => {
    // Clear the "saved" message from history so a refresh does not show it again
    if (location.state?.saved) {
      navigate(location.pathname, { replace: true, state: null });
    }

    const load = async () => {
      try {
        const res = await axios.get(API_BASE_URL + '/api/site-prices/today', {
          headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
        });
        setRows(res.data.data || []);
      } catch (err) {
        setError(err.response?.data?.message || 'Could not load today\'s prices');
      } finally {
        setLoading(false);
      }
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="loading">Loading prices...</div>;
  }

  const priced = rows.filter((r) => r.diesel_price !== null || r.petrol_price !== null);
  const today = rows[0]?.price_date;

  const setBy = (r) =>
    Array.from(new Set([r.diesel_prepared_by, r.petrol_prepared_by].filter(Boolean))).join(', ') || '—';

  return (
    <div className="dp-page">
      <div className="page-header">
        <div>
          <h2>Today's Prices</h2>
          <p className="dp-sub">
            Prices for {today || 'today'}. Customers inside one of these sites' zones are quoted
            automatically with the nearest priced site's price. Prices reset at midnight (Harare time).
          </p>
        </div>
        <div className="dp-actions">
          <span className="status-badge active">{priced.length} of {rows.length} sites priced</span>
          <button type="button" className="glow-btn" onClick={() => navigate('/daily-prices')}>
            Edit prices
          </button>
        </div>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {priced.length === 0 && !error ? (
        <div className="glow-card no-content">
          <p>No prices have been set for today yet.</p>
          <p>Until you set prices, every request is quoted manually.</p>
          <p>
            <button type="button" className="glow-btn" onClick={() => navigate('/daily-prices')}>
              Set today's prices
            </button>
          </p>
        </div>
      ) : (
        <div className="glow-card users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>Site</th>
                <th>City</th>
                <th>Diesel (per litre)</th>
                <th>Petrol (per litre)</th>
                <th>Set by</th>
              </tr>
            </thead>
            <tbody>
              {priced.map((r) => (
                <tr key={r.site_id}>
                  <td className="dp-site">{r.name}</td>
                  <td>{r.city}</td>
                  <td className="dp-price">{formatPrice(r.diesel_price)}</td>
                  <td className="dp-price">{formatPrice(r.petrol_price)}</td>
                  <td>{setBy(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {priced.length > 0 && rows.length > priced.length && (
        <p className="dp-hint">
          {rows.length - priced.length} other site{rows.length - priced.length === 1 ? '' : 's'} have no price
          today and are skipped when quoting.
        </p>
      )}
    </div>
  );
};

export default TodaysPrices;
