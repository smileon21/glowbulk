import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// The year GlowBulk went live: no data exists before this
const SYSTEM_START_YEAR = 2026;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const TYPES = [
  { value: 'all', label: 'Everything (one file, a sheet for each)', short: 'Everything' },
  { value: 'quotations', label: 'Quotations', short: 'Quotations' },
  { value: 'orders', label: 'Orders', short: 'Orders' },
  { value: 'invoices', label: 'Invoices', short: 'Invoices' },
  { value: 'fuel-requests', label: 'Fuel requests', short: 'Fuel requests' }
];

const PERIODS = [
  { value: 'month', label: 'A month' },
  { value: 'year', label: 'Whole year' },
  { value: 'range', label: 'Custom dates' }
];

const ExportPanel = () => {
  const now = new Date();
  const thisYear = now.getFullYear();

  const [type, setType] = useState('all');
  const [period, setPeriod] = useState('month');
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(thisYear);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [format, setFormat] = useState('xlsx');

  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // From the current year back to the year GlowBulk started
  const years = [];
  for (var y = thisYear; y >= SYSTEM_START_YEAR; y--) years.push(y);

  var typeInfo = TYPES.find(function(t) { return t.value === type; });
  var isEverything = type === 'all';

  var periodLabel =
    period === 'month' ? MONTHS[month - 1] + ' ' + year :
    period === 'year' ? 'Whole of ' + year :
    (from && to ? from + ' to ' + to : 'Choose both dates');

  var periodSlug =
    period === 'month' ? year + '-' + String(month).padStart(2, '0') :
    period === 'year' ? year + '_full-year' :
    from + '_to_' + to;

  const handleExport = async function() {
    setMessage('');
    setError('');

    if (period === 'range') {
      if (!from || !to) {
        setError('Choose both a start date and an end date.');
        return;
      }
      if (from > to) {
        setError('The start date must be before the end date.');
        return;
      }
    }

    var fileFormat = isEverything ? 'xlsx' : format;
    var params = { type: type, period: period, format: fileFormat };
    if (period === 'month') {
      params.month = month;
      params.year = year;
    }
    if (period === 'year') params.year = year;
    if (period === 'range') {
      params.from = from;
      params.to = to;
    }

    try {
      setExporting(true);
      const token = localStorage.getItem('token');

      const response = await axios({
        method: 'GET',
        url: API_BASE_URL + '/api/export/report',
        params: params,
        headers: { Authorization: 'Bearer ' + token },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;

      var filename =
        'GlowBulk_' + typeInfo.short.replace(/\s+/g, '_') + '_' + periodSlug +
        (fileFormat === 'csv' ? '.csv' : '.xlsx');

      const contentDisposition = response.headers['content-disposition'];
      if (contentDisposition) {
        const match = contentDisposition.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/);
        if (match && match[1]) {
          filename = match[1].replace(/['"]/g, '');
        }
      }

      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setMessage(typeInfo.short + ' for ' + periodLabel + ' downloaded.');
    } catch (err) {
      // With a file download the error body arrives as a blob, so read the message out of it
      var text = 'Error exporting the report.';
      try {
        const body = await err.response.data.text();
        text = JSON.parse(body).message || text;
      } catch (readErr) {
        // keep the default message
      }
      setError(text);
    } finally {
      setExporting(false);
    }
  };

  return (
    <section className="export-panel glow-card">
      <div className="export-panel-head">
        <h3>Export reports</h3>
        <p>Pick what you need and for which period, then download.</p>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="export-grid">
        <div className="form-group">
          <label className="glow-label" htmlFor="export-type">What to export</label>
          <select
            id="export-type"
            className="glow-input"
            value={type}
            onChange={function(e) { setType(e.target.value); }}
          >
            {TYPES.map(function(t) {
              return <option key={t.value} value={t.value}>{t.label}</option>;
            })}
          </select>
        </div>

        <div className="form-group">
          <label className="glow-label" htmlFor="export-period">Period</label>
          <select
            id="export-period"
            className="glow-input"
            value={period}
            onChange={function(e) { setPeriod(e.target.value); }}
          >
            {PERIODS.map(function(p) {
              return <option key={p.value} value={p.value}>{p.label}</option>;
            })}
          </select>
        </div>

        {period === 'month' && (
          <div className="form-group">
            <label className="glow-label" htmlFor="export-month">Month</label>
            <select
              id="export-month"
              className="glow-input"
              value={month}
              onChange={function(e) { setMonth(Number(e.target.value)); }}
            >
              {MONTHS.map(function(name, index) {
                return <option key={name} value={index + 1}>{name}</option>;
              })}
            </select>
          </div>
        )}

        {(period === 'month' || period === 'year') && (
          <div className="form-group">
            <label className="glow-label" htmlFor="export-year">Year</label>
            <select
              id="export-year"
              className="glow-input"
              value={year}
              onChange={function(e) { setYear(Number(e.target.value)); }}
            >
              {years.map(function(yr) {
                return <option key={yr} value={yr}>{yr}</option>;
              })}
            </select>
          </div>
        )}

        {period === 'range' && (
          <>
            <div className="form-group">
              <label className="glow-label" htmlFor="export-from">From</label>
              <input
                id="export-from"
                type="date"
                className="glow-input"
                value={from}
                max={to || undefined}
                onChange={function(e) { setFrom(e.target.value); }}
              />
            </div>
            <div className="form-group">
              <label className="glow-label" htmlFor="export-to">To</label>
              <input
                id="export-to"
                type="date"
                className="glow-input"
                value={to}
                min={from || undefined}
                onChange={function(e) { setTo(e.target.value); }}
              />
            </div>
          </>
        )}

        {!isEverything && (
          <div className="form-group">
            <label className="glow-label" htmlFor="export-format">File type</label>
            <select
              id="export-format"
              className="glow-input"
              value={format}
              onChange={function(e) { setFormat(e.target.value); }}
            >
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
        )}
      </div>

      <div className="export-footer">
        <span className="export-summary">
          <strong>{typeInfo.short}</strong> · {periodLabel}
        </span>
        <button
          type="button"
          className="glow-btn export-download"
          onClick={handleExport}
          disabled={exporting}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? 'Preparing…' : 'Download'}
        </button>
      </div>

      <p className="export-note">
        Quotations, orders and fuel requests are counted by the date they were created.
        Invoices are counted by the date the invoice was uploaded.
      </p>
    </section>
  );
};

export default ExportPanel;
