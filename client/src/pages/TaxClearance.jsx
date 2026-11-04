import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './Finance.css';

const TaxClearance = () => {
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [certificateNumber, setCertificateNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [file, setFile] = useState(null);
  const [fileKey, setFileKey] = useState(0); // changing this clears the file input
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  var authConfig = function() {
    return { headers: { Authorization: 'Bearer ' + localStorage.getItem('token') } };
  };

  var errorText = function(err, fallback) {
    var data = err.response && err.response.data;
    return (data && data.message) ||
      (data && data.errors && data.errors[0] && data.errors[0].msg) ||
      fallback;
  };

  var load = async function() {
    try {
      var results = await Promise.all([
        axios.get(API_BASE_URL + '/api/finance/tax-clearance/latest', authConfig()),
        axios.get(API_BASE_URL + '/api/finance/tax-clearance/history', authConfig())
      ]);
      setLatest(results[0].data.data || null);
      setHistory(results[1].data.data || []);
    } catch (err) {
      setError(errorText(err, 'Error loading tax clearance'));
    } finally {
      setLoading(false);
    }
  };

  useEffect(function() {
    load();
  }, []);

  var formatDate = function(d) {
    if (!d) return '';
    var date = new Date(d);
    if (isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-ZW', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  var submit = async function(e) {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!certificateNumber.trim() || !expiryDate || !file) {
      setError('Enter the certificate number, the expiry date and choose the PDF');
      return;
    }

    setSaving(true);
    try {
      var formData = new FormData();
      // Text fields go before the file so the server reads them reliably
      formData.append('certificateNumber', certificateNumber.trim());
      formData.append('expiryDate', expiryDate);
      formData.append('certificateFile', file);

      var res = await axios.post(API_BASE_URL + '/api/finance/tax-clearance', formData, {
        headers: {
          Authorization: 'Bearer ' + localStorage.getItem('token'),
          'Content-Type': 'multipart/form-data'
        }
      });

      if (res.data.success) {
        setMessage('Tax clearance certificate uploaded. Customers now see the new one.');
        setCertificateNumber('');
        setExpiryDate('');
        setFile(null);
        setFileKey(function(k) { return k + 1; });
        await load();
      }
    } catch (err) {
      setError(errorText(err, 'Error uploading certificate'));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading...</div>;
  }

  var statusBadge = null;
  if (latest) {
    if (latest.is_expired) {
      statusBadge = <span className="status-badge" style={{ background: '#8f0000' }}>Expired</span>;
    } else if (Number(latest.days_left) <= 30) {
      statusBadge = <span className="status-badge" style={{ background: '#E8A33D' }}>Expires in {latest.days_left} day(s)</span>;
    } else {
      statusBadge = <span className="status-badge" style={{ background: '#2f7a3f' }}>Valid</span>;
    }
  }

  return (
    <div className="orders-page">
      <div className="page-header">
        <h2>Tax Clearance</h2>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="glow-card fin-section">
        <h3>Current certificate</h3>
        {!latest ? (
          <p className="fin-muted">No certificate uploaded yet. Customers see nothing until you upload one.</p>
        ) : (
          <>
            <p>
              <strong>{latest.certificate_number}</strong> {statusBadge}
            </p>
            <p>Expires: {formatDate(latest.expiry_date)}</p>
            <p className="fin-muted">Uploaded by {latest.uploaded_by} on {formatDate(latest.uploaded_at)}</p>
            {latest.is_expired && (
              <div className="fin-notice">
                This certificate has expired, so customers no longer see it. Upload a new one below.
              </div>
            )}
            <a href={latest.file_url} target="_blank" rel="noopener noreferrer" className="glow-btn-small" style={{ display: 'inline-block', textDecoration: 'none' }}>
              View certificate (PDF)
            </a>
          </>
        )}
      </div>

      <form className="glow-card fin-section" onSubmit={submit}>
        <h3>Upload a new certificate</h3>
        <p className="fin-muted">The old certificate is kept in the history below.</p>
        <div className="fin-form-grid">
          <div className="form-group">
            <label className="glow-label">Certificate number *</label>
            <input
              type="text"
              className="glow-input"
              value={certificateNumber}
              maxLength={100}
              onChange={function(e) { setCertificateNumber(e.target.value); }}
            />
          </div>
          <div className="form-group">
            <label className="glow-label">Expiry date *</label>
            <input
              type="date"
              className="glow-input"
              value={expiryDate}
              onChange={function(e) { setExpiryDate(e.target.value); }}
            />
          </div>
          <div className="form-group full">
            <label className="glow-label">Certificate PDF *</label>
            <input
              key={fileKey}
              type="file"
              accept="application/pdf"
              className="glow-input"
              onChange={function(e) { setFile((e.target.files && e.target.files[0]) || null); }}
            />
          </div>
        </div>
        <div className="fin-actions">
          <button type="submit" className="glow-btn" disabled={saving}>
            {saving ? 'Uploading...' : 'Upload certificate'}
          </button>
        </div>
      </form>

      <div className="glow-card fin-section">
        <h3>History</h3>
        {history.length === 0 ? (
          <p className="fin-muted">No certificates yet.</p>
        ) : (
          history.map(function(h) {
            return (
              <div className="fin-row" key={h.id}>
                <div>
                  <strong>{h.certificate_number}</strong> {h.is_current ? '(current)' : ''}
                  <br />
                  <small>Expires {formatDate(h.expiry_date)} · uploaded by {h.uploaded_by} on {formatDate(h.uploaded_at)}</small>
                </div>
                <a href={h.file_url} target="_blank" rel="noopener noreferrer">View PDF</a>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TaxClearance;
