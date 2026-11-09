import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import './CustomerManagement.css';

const PAGE_SIZE = 20;

const CATEGORY_LABELS = {
  regular: 'Regular',
  long_term: 'Long-term client'
};

const STATUS_LABELS = {
  pending: 'Awaiting verification',
  verified: 'Verified',
  rejected: 'Rejected'
};

const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Awaiting verification' },
  { key: 'verified', label: 'Verified' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'company', label: 'Companies' },
  { key: 'individual', label: 'Individuals' },
  { key: 'discount', label: 'Gets discounts' }
];

const formatDate = (value) => {
  if (!value) return '';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

// Company customers: account_type says so; older accounts without it count as a company
// when they have a company name
const isCompany = (c) =>
  c.account_type === 'company' || (!c.account_type && !!c.company_name);

// Name shown in the list: company if there is one, otherwise the person
const displayName = (c) =>
  c.company_name || c.contact_person_name || c.name || c.full_name || 'Unnamed customer';

const contactName = (c) => c.contact_person_name || c.name || c.full_name || '';
const getEmail = (c) => c.contact_person_email || c.email || '';
const getPhone = (c) => c.contact_person_phone || c.phone || c.contact_phone || '';
const getCity = (c) => c.city || c.billing_city || c.delivery_city || '';
const getStatus = (c) => c.verification_status || '';

const initials = (c) => {
  const words = displayName(c).split(/\s+/).filter(Boolean);
  const letters = words.slice(0, 2).map((w) => w.charAt(0));
  return letters.join('').toUpperCase() || '?';
};

const matchesFilter = (c, key) => {
  switch (key) {
    case 'pending':
    case 'verified':
    case 'rejected':
      return getStatus(c) === key;
    case 'company':
      return isCompany(c);
    case 'individual':
      return !isCompany(c);
    case 'discount':
      return !!c.gets_discount;
    default:
      return true;
  }
};

const StatusPill = ({ status }) => (
  <span className={'cm-pill cm-pill-' + (STATUS_LABELS[status] ? status : 'neutral')}>
    {STATUS_LABELS[status] || status || 'Unknown'}
  </span>
);

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [page, setPage] = useState(1);
  const [selectedId, setSelectedId] = useState(null);

  useEffect(() => {
    fetchCustomers();
  }, []);

  // Esc closes the details
  useEffect(() => {
    if (selectedId === null) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') setSelectedId(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selectedId]);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: 'Bearer ' + token } };
      // Existing staff route: { success: true, count, data: [ ...customer rows ] }
      const response = await axios.get(API_BASE_URL + '/api/customers', config);
      if (response.data.success) {
        setCustomers(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching customers:', err);
      setError(err.response?.data?.message || 'Error loading customers');
    } finally {
      setLoading(false);
    }
  };

  // How many customers each filter chip would show
  const counts = useMemo(() => {
    const result = {};
    FILTERS.forEach((f) => {
      result[f.key] = customers.filter((c) => matchesFilter(c, f.key)).length;
    });
    return result;
  }, [customers]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers.filter((c) => matchesFilter(c, filter));

    if (q) {
      list = list.filter((c) =>
        [displayName(c), contactName(c), c.company_name, getEmail(c), getPhone(c), getCity(c), getStatus(c)]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === 'name') {
        return displayName(a).toLowerCase().localeCompare(displayName(b).toLowerCase());
      }
      const at = new Date(a.created_at || 0).getTime();
      const bt = new Date(b.created_at || 0).getTime();
      return sortBy === 'oldest' ? at - bt : bt - at;
    });
  }, [customers, search, filter, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const selected = customers.find((c) => c.id === selectedId) || null;

  const exportCsv = () => {
    const rows = [[
      'Name', 'Contact person', 'Account type', 'Email', 'Phone', 'City',
      'Status', 'Category', 'Gets discounts', 'Registered'
    ]];
    filtered.forEach((c) => {
      rows.push([
        displayName(c),
        contactName(c),
        isCompany(c) ? 'Company' : 'Individual',
        getEmail(c),
        getPhone(c),
        getCity(c),
        STATUS_LABELS[getStatus(c)] || getStatus(c),
        CATEGORY_LABELS[c.category] || c.category || '',
        getStatus(c) === 'verified' ? (c.gets_discount ? 'Yes' : 'No') : '',
        formatDate(c.created_at)
      ]);
    });
    const csv = rows
      .map((r) => r.map((v) => '"' + String(v).replace(/"/g, '""') + '"').join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'glowbulk-customers.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return <div className="loading">Loading customers...</div>;
  }

  return (
    <div className="customer-management">
      <div className="content-header">
        <div>
          <h2>Customers ({customers.length})</h2>
          <p className="cm-subtitle">Everyone registered on GlowBulk. Select a customer to see their details.</p>
        </div>
        <div className="cm-head-actions">
          <button className="glow-btn glow-btn-small glow-btn-secondary" onClick={fetchCustomers}>
            Refresh
          </button>
          <button className="glow-btn glow-btn-small" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="cm-toolbar">
        <input
          type="search"
          className="glow-input cm-search"
          placeholder="Search by name, company, email, phone or city"
          aria-label="Search customers"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="glow-input cm-sort"
          aria-label="Sort customers"
          value={sortBy}
          onChange={(e) => {
            setSortBy(e.target.value);
            setPage(1);
          }}
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="name">Name A to Z</option>
        </select>
      </div>

      <div className="cm-chips" role="group" aria-label="Filter customers">
        {FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0 || filter === f.key).map((f) => (
          <button
            key={f.key}
            type="button"
            className={'filter-chip' + (filter === f.key ? ' active' : '')}
            aria-pressed={filter === f.key}
            onClick={() => {
              setFilter(f.key);
              setPage(1);
            }}
          >
            {f.label} <span className="cm-chip-count">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="glow-card no-content">
          <p>{customers.length === 0 ? 'No customers have registered yet.' : 'No customers match your search.'}</p>
        </div>
      ) : (
        <div className="cm-layout">
          <div className="cm-list" role="list">
            {pageItems.map((c) => (
              <button
                type="button"
                key={c.id}
                role="listitem"
                className={'cm-row' + (c.id === selectedId ? ' selected' : '')}
                onClick={() => setSelectedId(c.id)}
              >
                <span className="cm-avatar" aria-hidden="true">{initials(c)}</span>

                <span className="cm-row-main">
                  <span className="cm-row-name">{displayName(c)}</span>
                  <span className="cm-row-meta">
                    {isCompany(c) ? 'Company' : 'Individual'}
                    {getCity(c) ? ' - ' + getCity(c) : ''}
                    {isCompany(c) && contactName(c) ? ' - ' + contactName(c) : ''}
                  </span>
                </span>

                <span className="cm-row-tags">
                  {getStatus(c) === 'verified' && c.category && (
                    <span className="cm-pill cm-pill-neutral">{CATEGORY_LABELS[c.category] || c.category}</span>
                  )}
                  {getStatus(c) === 'verified' && c.gets_discount && (
                    <span className="cm-pill cm-pill-discount">Discount</span>
                  )}
                  <StatusPill status={getStatus(c)} />
                </span>

                <span className="cm-row-date">{formatDate(c.created_at)}</span>
              </button>
            ))}

            {totalPages > 1 && (
              <div className="cm-pagination">
                <button
                  className="glow-btn glow-btn-small glow-btn-secondary"
                  disabled={currentPage === 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  Previous
                </button>
                <span>Page {currentPage} of {totalPages}</span>
                <button
                  className="glow-btn glow-btn-small glow-btn-secondary"
                  disabled={currentPage === totalPages}
                  onClick={() => setPage(currentPage + 1)}
                >
                  Next
                </button>
              </div>
            )}
          </div>

          {selected && (
            <aside className="cm-detail" aria-label={'Details for ' + displayName(selected)}>
              <div className="cm-detail-top">
                <span className="cm-avatar cm-avatar-lg" aria-hidden="true">{initials(selected)}</span>
                <div className="cm-detail-title">
                  <h3>{displayName(selected)}</h3>
                  <p>{isCompany(selected) ? 'Company account' : 'Individual customer'}</p>
                  <StatusPill status={getStatus(selected)} />
                </div>
                <button
                  type="button"
                  className="modal-close"
                  aria-label="Close details"
                  onClick={() => setSelectedId(null)}
                >
                  ✕
                </button>
              </div>

              <section className="cm-section">
                <h4>Contact</h4>
                <dl className="cm-fields">
                  <div>
                    <dt>Contact person</dt>
                    <dd>{contactName(selected) || '-'}</dd>
                  </div>
                  <div>
                    <dt>Phone</dt>
                    <dd>
                      {getPhone(selected)
                        ? <a href={'tel:' + getPhone(selected)}>{getPhone(selected)}</a>
                        : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt>Email</dt>
                    <dd>
                      {getEmail(selected)
                        ? <a href={'mailto:' + getEmail(selected)}>{getEmail(selected)}</a>
                        : '-'}
                    </dd>
                  </div>
                  <div>
                    <dt>Address</dt>
                    <dd>
                      {[selected.billing_address, getCity(selected)].filter(Boolean).join(', ') || '-'}
                    </dd>
                  </div>
                </dl>
              </section>

              <section className="cm-section">
                <h4>Account</h4>
                <dl className="cm-fields">
                  {isCompany(selected) && (
                    <>
                      <div>
                        <dt>Company</dt>
                        <dd>{selected.company_name || '-'}</dd>
                      </div>
                      <div>
                        <dt>Registration no.</dt>
                        <dd>{selected.company_registration || '-'}</dd>
                      </div>
                    </>
                  )}
                  <div>
                    <dt>Category</dt>
                    <dd>
                      {getStatus(selected) === 'verified'
                        ? (CATEGORY_LABELS[selected.category] || selected.category || '-')
                        : 'Set when verified'}
                    </dd>
                  </div>
                  <div>
                    <dt>Gets discounts</dt>
                    <dd>
                      {getStatus(selected) === 'verified'
                        ? (selected.gets_discount ? 'Yes' : 'No')
                        : 'Set when verified'}
                    </dd>
                  </div>
                  <div>
                    <dt>Registered</dt>
                    <dd>{formatDate(selected.created_at) || '-'}</dd>
                  </div>
                  {selected.verified_at && (
                    <div>
                      <dt>{getStatus(selected) === 'rejected' ? 'Rejected on' : 'Verified on'}</dt>
                      <dd>{formatDate(selected.verified_at)}</dd>
                    </div>
                  )}
                </dl>

                {getStatus(selected) === 'verified' && (
                  <p className="cm-hint">
                    {selected.gets_discount
                      ? 'This customer is quoted manually by marketing, who enter the discount on each quote.'
                      : 'This customer gets automatic quotes when a site price is set for today.'}
                  </p>
                )}

                {getStatus(selected) === 'pending' && (
                  <p className="cm-hint">
                    This customer cannot request fuel until they are approved on the Verify Customers page.
                  </p>
                )}

                {getStatus(selected) === 'rejected' && selected.rejection_reason && (
                  <p className="cm-hint cm-hint-red">Reason given: {selected.rejection_reason}</p>
                )}
              </section>

              {(getPhone(selected) || getEmail(selected)) && (
                <div className="cm-detail-actions">
                  {getPhone(selected) && (
                    <a className="glow-btn" href={'tel:' + getPhone(selected)}>Call</a>
                  )}
                  {getEmail(selected) && (
                    <a className="glow-btn glow-btn-secondary" href={'mailto:' + getEmail(selected)}>Email</a>
                  )}
                </div>
              )}
            </aside>
          )}
        </div>
      )}
    </div>
  );
};

export default CustomerManagement;
