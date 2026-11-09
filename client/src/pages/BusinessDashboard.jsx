import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { formatName, formatTimeAgo } from '../utils/format';

// Customer dashboard (Dashboard.jsx sends role "customer" here).
// Staff dashboards live in MarketingDashboard / FinanceDashboard / ITDashboard.

const QUOTE_VALIDITY_HOURS = 24;
const URGENT_MS = 6 * 3600000;            // under 6 hours left on a quote
const INVOICE_FRESH_MS = 7 * 86400000;    // show "invoice ready" for a week
const MONTHS_SHOWN = 6;
const TODO_LIMIT = 5;
const UPDATES_LIMIT = 4;

const ICONS = {
  fuel: 'M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16M3 10h10M2 22h12M13 12h4a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3',
  doc: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M8 13h8M8 17h5',
  box: 'M21 8l-9-5-9 5v8l9 5 9-5zM3.3 7.5L12 12.5l8.7-5M12 22V12.5',
  cash: 'M2 7h20v10H2zM12 12m-2.5 0a2.5 2.5 0 1 0 5 0a2.5 2.5 0 1 0-5 0M6 12h.01M18 12h.01',
  check: 'M20 6L9 17l-5-5',
  clock: 'M12 12m-9 0a9 9 0 1 0 18 0a9 9 0 1 0-18 0M12 7v5l3 2',
  alert: 'M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z',
  bell: 'M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0'
};

const Icon = ({ name }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={ICONS[name]} />
  </svg>
);

const money = (n) =>
  '$' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

// ---------- date helpers ----------

const monthKey = (d) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');

// The last N months, oldest first, e.g. [{ key: '2026-06', label: 'Jun' }, ...]
function lastMonths(count) {
  const out = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ key: monthKey(d), label: d.toLocaleDateString('en-GB', { month: 'short' }) });
  }
  return out;
}

function countByMonth(list, months) {
  const counts = months.map(() => 0);
  (list || []).forEach((item) => {
    const d = new Date(item.created_at);
    if (Number.isNaN(d.getTime())) return;
    const i = months.findIndex((m) => m.key === monthKey(d));
    if (i >= 0) counts[i] += 1;
  });
  return counts;
}

// "+100% vs last month" style text from the last two buckets of a series
function trendOf(series) {
  const cur = series[series.length - 1] || 0;
  const prev = series[series.length - 2] || 0;
  if (cur === 0 && prev === 0) return { dir: 'flat', text: 'No requests this month' };
  if (prev === 0) return { dir: 'up', text: cur + ' this month' };
  const pct = Math.round(((cur - prev) / prev) * 100);
  if (pct === 0) return { dir: 'flat', text: 'Same as last month' };
  return { dir: pct > 0 ? 'up' : 'down', text: (pct > 0 ? '+' : '') + pct + '% vs last month' };
}

// ---------- quotation helpers (same 24h rule as Quotations.jsx) ----------

const quoteExpiresAt = (q) => {
  if (q.expires_at) {
    const t = new Date(q.expires_at).getTime();
    if (!Number.isNaN(t)) return t;
  }
  const start = new Date(q.sent_at || q.created_at).getTime();
  return Number.isNaN(start) ? null : start + QUOTE_VALIDITY_HOURS * 3600000;
};

const timeLeft = (ms) => {
  const mins = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(mins / 60);
  return h > 0 ? h + 'h ' + (mins % 60) + 'm left' : mins + 'm left';
};

// Turn quotations and orders into "what do I do next" items
function buildTodos(quotes, orders, now) {
  const items = [];

  (quotes || []).forEach((q) => {
    const ref = q.quotation_number || '#' + q.id;
    if (q.status === 'sent') {
      const end = quoteExpiresAt(q);
      if (end === null || end <= now) return; // expired
      const left = end - now;
      items.push({
        key: 'q-sent-' + q.id,
        rank: left < URGENT_MS ? 0 : 1,
        tone: left < URGENT_MS ? 'urgent' : 'action',
        title: 'Respond to quotation ' + ref,
        sub: [q.quantity, q.unit, q.fuel_type].filter(Boolean).join(' '),
        tag: timeLeft(left),
        link: '/quotations'
      });
    } else if (q.status === 'accepted' && !q.has_order) {
      items.push({
        key: 'q-acc-' + q.id,
        rank: 1,
        tone: 'action',
        title: 'Place your order for ' + ref,
        sub: 'Quotation accepted',
        tag: 'Ready to order',
        link: '/create-order?quotationId=' + q.id
      });
    }
  });

  (orders || []).forEach((o) => {
    const ref = o.order_number || '#' + o.id;
    if (o.status === 'cancelled') return;

    if (o.status === 'pending_payment') {
      if (o.payment_status === 'proof_uploaded') {
        items.push({
          key: 'o-review-' + o.id, rank: 2, tone: 'wait',
          title: 'Payment proof under review', sub: 'Order ' + ref,
          tag: 'Waiting', link: '/orders'
        });
      } else {
        const rejected = o.payment_status === 'rejected';
        items.push({
          key: 'o-pay-' + o.id, rank: rejected ? 0 : 1,
          tone: rejected ? 'urgent' : 'action',
          title: rejected ? 'Proof rejected: upload a new one' : 'Upload proof of payment',
          sub: 'Order ' + ref,
          tag: rejected ? 'Action needed' : 'Pending payment',
          link: '/upload-proof/' + o.id
        });
      }
    } else if (o.status === 'payment_confirmed' && !o.invoice_path) {
      items.push({
        key: 'o-inv-wait-' + o.id, rank: 2, tone: 'wait',
        title: 'Payment confirmed, invoice on the way', sub: 'Order ' + ref,
        tag: 'Waiting', link: '/orders'
      });
    }

    if (o.invoice_path) {
      const at = new Date(o.invoice_uploaded_at).getTime();
      if (!Number.isNaN(at) && now - at < INVOICE_FRESH_MS) {
        items.push({
          key: 'o-inv-' + o.id, rank: 3, tone: 'done',
          title: 'Invoice ready to download', sub: 'Order ' + ref,
          tag: 'Ready', link: '/orders'
        });
      }
    }
  });

  return items.sort((a, b) => a.rank - b.rank);
}

// ---------- chart (plain SVG, no chart library) ----------

const SERIES = [
  { id: 'req', label: 'Fuel requests' },
  { id: 'quo', label: 'Quotations' },
  { id: 'ord', label: 'Orders' }
];

const ActivityChart = ({ months, data }) => {
  const W = 600, H = 230, L = 34, R = 14, T = 14, B = 30;
  const peak = Math.max(3, ...SERIES.flatMap((s) => data[s.id]));
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, months.length - 1);
  const y = (v) => T + (1 - v / peak) * (H - T - B);
  const ticks = Array.from({ length: peak + 1 }, (_, i) => i);
  const sparse = peak > 6; // too many grid lines: show every other one
  const empty = SERIES.every((s) => data[s.id].every((v) => v === 0));

  return (
    <div className="cd-chart">
      <div className="cd-legend">
        {SERIES.map((s) => (
          <span key={s.id}><i className={'cd-swatch cd-line-' + s.id} />{s.label}</span>
        ))}
      </div>
      <svg viewBox={'0 0 ' + W + ' ' + H} role="img"
        aria-label="Fuel requests, quotations and orders over the last six months">
        {ticks.filter((t) => !sparse || t % 2 === 0).map((t) => (
          <g key={t}>
            <line className="cd-grid-line" x1={L} x2={W - R} y1={y(t)} y2={y(t)} />
            <text className="cd-axis" x={L - 8} y={y(t) + 4} textAnchor="end">{t}</text>
          </g>
        ))}
        {months.map((m, i) => (
          <text key={m.key} className="cd-axis" x={x(i)} y={H - 8} textAnchor="middle">{m.label}</text>
        ))}
        {SERIES.map((s) => (
          <g key={s.id}>
            <polyline className={'cd-line cd-line-' + s.id} fill="none"
              points={data[s.id].map((v, i) => x(i) + ',' + y(v)).join(' ')} />
            {data[s.id].map((v, i) => (
              <circle key={i} className={'cd-dot cd-fill-' + s.id} cx={x(i)} cy={y(v)} r="3.5">
                <title>{s.label}, {months[i].label}: {v}</title>
              </circle>
            ))}
          </g>
        ))}
      </svg>
      {empty && <p className="cd-chart-empty">Your activity will appear here after your first request.</p>}
    </div>
  );
};

// ---------- page ----------

const BusinessDashboard = () => {
  const navigate = useNavigate();
  const userName = formatName(localStorage.getItem('userName')) || 'there';

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [requests, setRequests] = useState([]);
  const [quotes, setQuotes] = useState([]);
  const [orders, setOrders] = useState([]);
  const [updates, setUpdates] = useState([]);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) { setLoading(false); return; }
    axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;

    const load = async () => {
      try {
        const [r, q, o, n] = await Promise.all([
          axios.get(API_BASE_URL + '/api/fuel-requests/my-requests'),
          axios.get(API_BASE_URL + '/api/quotations/my-quotations'),
          axios.get(API_BASE_URL + '/api/orders/my-orders'),
          // Notifications are a bonus: never let them break the dashboard
          axios.get(API_BASE_URL + '/api/notifications').catch(() => null)
        ]);
        setRequests(r.data.data || []);
        setQuotes(q.data.data || []);
        setOrders(o.data.data || []);
        setUpdates(n && n.data && n.data.success ? (n.data.data || []).slice(0, UPDATES_LIMIT) : []);
      } catch (err) {
        console.error('Error fetching dashboard data:', err);
        setLoadError('We could not load your dashboard. Please refresh the page.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Keep the quote countdowns live
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  const months = useMemo(() => lastMonths(MONTHS_SHOWN), []);

  const series = useMemo(() => ({
    req: countByMonth(requests, months),
    quo: countByMonth(quotes, months),
    ord: countByMonth(orders, months)
  }), [requests, quotes, orders, months]);

  const paidOrders = useMemo(
    () => orders.filter((o) => o.status === 'payment_confirmed' || o.status === 'completed'),
    [orders]
  );
  const totalSpend = paidOrders.reduce((sum, o) => sum + (parseFloat(o.grand_total) || 0), 0);
  const awaitingPayment = orders.filter((o) => o.status === 'pending_payment').length;
  const openQuotes = quotes.filter((q) => {
    const end = quoteExpiresAt(q);
    return q.status === 'sent' && end !== null && end > now;
  }).length;

  const todos = useMemo(() => buildTodos(quotes, orders, now), [quotes, orders, now]);
  const actionCount = todos.filter((t) => t.tone === 'urgent' || t.tone === 'action').length;

  if (loading) return <div className="loading">Loading your dashboard...</div>;

  const reqTrend = trendOf(series.req);
  const today = new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="dashboard cd">
      {/* Welcome */}
      <section className="cd-hero">
        <div className="cd-hero-text">
          <p className="cd-date">{today}</p>
          <h1>Welcome, {userName}</h1>
          <p className="cd-hero-sub">
            {actionCount > 0
              ? 'You have ' + actionCount + (actionCount === 1 ? ' item' : ' items') + ' that need your attention.'
              : 'Bulk fuel. Delivered on time. Every time.'}
          </p>
        </div>
        <button className="request-cta" onClick={() => navigate('/fuel-requests')}>
          <span className="request-cta-icon"><Icon name="fuel" /></span>
          <span className="request-cta-text">
            <span className="request-cta-title">Get a Quote</span>
            <span className="request-cta-sub">Bulk delivery to your site</span>
          </span>
          <span className="request-cta-arrow" aria-hidden="true">→</span>
        </button>
      </section>

      {loadError && <div className="error-message">{loadError}</div>}

      {/* Stat tickets */}
      <div className="dashboard-stats-row marketing-stats-row">
        <div className="stat-card stat-req">
          <div className="stat-card-header">
            <h3>Fuel Requests</h3>
            <span className="ticket-tag">REQ</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{requests.length}</span>
            </div>
            <span className={'cd-trend cd-trend-' + reqTrend.dir}>{reqTrend.text}</span>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/fuel-requests')}>
              Get a Quote <span className="stat-btn-arrow">→</span>
            </button>
          </div>
        </div>

        <div className="stat-card stat-quo">
          <div className="stat-card-header">
            <h3>Quotations</h3>
            <span className="ticket-tag">QUO</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{quotes.length}</span>
            </div>
            <span className={'cd-trend ' + (openQuotes > 0 ? 'cd-trend-warn' : 'cd-trend-flat')}>
              {openQuotes > 0 ? openQuotes + ' waiting for your answer' : 'Nothing waiting'}
            </span>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/quotations')}>
              View All <span className="stat-btn-arrow">→</span>
            </button>
          </div>
        </div>

        <div className="stat-card stat-ord">
          <div className="stat-card-header">
            <h3>Orders</h3>
            <span className="ticket-tag">ORD</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{orders.length}</span>
            </div>
            <span className={'cd-trend ' + (awaitingPayment > 0 ? 'cd-trend-warn' : 'cd-trend-flat')}>
              {awaitingPayment > 0 ? awaitingPayment + ' awaiting payment' : 'No unpaid orders'}
            </span>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/orders')}>
              View All <span className="stat-btn-arrow">→</span>
            </button>
          </div>
        </div>

        <div className="stat-card stat-cust">
          <div className="stat-card-header">
            <h3>Total Spend</h3>
            <span className="ticket-tag">PAID</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Confirmed</span>
              <span className="detail-value">{money(totalSpend)}</span>
            </div>
            <span className="cd-trend cd-trend-flat">
              {paidOrders.length === 1 ? '1 paid order' : paidOrders.length + ' paid orders'}
            </span>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/orders')}>
              Orders <span className="stat-btn-arrow">→</span>
            </button>
          </div>
        </div>
      </div>

      {/* Next steps (lead panel) + activity */}
      <div className="cd-grid cd-grid-lead">
        <section className="cd-panel cd-todo" aria-labelledby="cd-todo-title">
          <header className="cd-panel-head">
            <h2 id="cd-todo-title">Your next steps</h2>
            {actionCount > 0 && <span className="cd-count">{actionCount}</span>}
          </header>

          {todos.length === 0 ? (
            <div className="cd-empty">
              <span className="cd-empty-icon"><Icon name="check" /></span>
              <strong>You are all caught up</strong>
              <p>When a quotation arrives or an order needs payment, it shows up here.</p>
              <button className="glow-btn glow-btn-small" onClick={() => navigate('/fuel-requests')}>
                Get a Quote
              </button>
            </div>
          ) : (
            <ul className="cd-todo-list">
              {todos.slice(0, TODO_LIMIT).map((t) => (
                <li key={t.key}>
                  <button type="button" className={'cd-todo-item cd-tone-' + t.tone}
                    onClick={() => navigate(t.link)}>
                    <span className="cd-todo-icon">
                      <Icon name={t.tone === 'urgent' ? 'alert' : t.tone === 'wait' ? 'clock' : t.tone === 'done' ? 'check' : 'doc'} />
                    </span>
                    <span className="cd-todo-text">
                      <span className="cd-todo-title">{t.title}</span>
                      {t.sub && <span className="cd-todo-sub">{t.sub}</span>}
                    </span>
                    <span className="cd-pill">{t.tag}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
          {todos.length > TODO_LIMIT && (
            <p className="cd-more">{todos.length - TODO_LIMIT} more on your Quotations and Orders pages.</p>
          )}
        </section>

        <section className="cd-panel" aria-labelledby="cd-chart-title">
          <header className="cd-panel-head">
            <h2 id="cd-chart-title">Activity, last 6 months</h2>
          </header>
          <ActivityChart months={months} data={series} />
        </section>
      </div>

      {/* Shortcuts + latest updates */}
      <div className="cd-grid cd-grid-even">
        <section className="cd-panel" aria-labelledby="cd-qa-title">
          <header className="cd-panel-head">
            <h2 id="cd-qa-title">Quick actions</h2>
          </header>
          <div className="cd-actions">
            <button className="glow-btn" onClick={() => navigate('/fuel-requests')}>
              <Icon name="fuel" /> Get a Quote
            </button>
            <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/quotations')}>
              <Icon name="doc" /> View my quotations
            </button>
            <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/orders')}>
              <Icon name="box" /> View my orders
            </button>
          </div>
        </section>

        <section className="cd-panel" aria-labelledby="cd-up-title">
          <header className="cd-panel-head">
            <h2 id="cd-up-title">Latest updates</h2>
          </header>
          {updates.length === 0 ? (
            <p className="cd-quiet">No updates yet. Quotation replies, payment confirmations and invoices will appear here.</p>
          ) : (
            <ul className="cd-updates">
              {updates.map((n) => (
                <li key={n.id}>
                  <button type="button" className="cd-update" onClick={() => n.link && navigate(n.link)}>
                    <span className={'cd-update-dot' + (n.is_read ? '' : ' unread')} aria-hidden="true" />
                    <span className="cd-update-text">
                      <span className="cd-update-title">{n.title}</span>
                      <span className="cd-update-msg">{n.message}</span>
                    </span>
                    <span className="cd-update-time">{formatTimeAgo(n.created_at)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
};

export default BusinessDashboard;
