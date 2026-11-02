import React, { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const PAGE_SIZE = 20;

const CustomerManagement = () => {
  const [customers, setCustomers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('created_at');
  const [sortDir, setSortDir] = useState('desc');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchCustomers();
  }, []);

  const fetchCustomers = async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const config = { headers: { Authorization: 'Bearer ' + token } };
      // Expects: { success: true, data: [ { id, name/full_name, email, phone, company_name, city, created_at } ] }
      const response = await axios.get(API_BASE_URL + '/api/marketing/customers', config);
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

  const getName = (c) => c.name || c.full_name || c.contact_name || '-';

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = customers;
    if (q) {
      list = customers.filter((c) =>
        [getName(c), c.company_name, c.email, c.phone, c.city]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q))
      );
    }
    const sorted = [...list].sort((a, b) => {
      let av = sortBy === 'name' ? getName(a) : a[sortBy];
      let bv = sortBy === 'name' ? getName(b) : b[sortBy];
      if (sortBy === 'created_at') {
        av = new Date(av || 0).getTime();
        bv = new Date(bv || 0).getTime();
      } else {
        av = String(av || '').toLowerCase();
        bv = String(bv || '').toLowerCase();
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
    return sorted;
  }, [customers, search, sortBy, sortDir]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const toggleSort = (field) => {
    if (sortBy === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortDir('asc');
    }
    setPage(1);
  };

  const arrow = (field) => (sortBy === field ? (sortDir === 'asc' ? ' ▲' : ' ▼') : '');

  const exportCsv = () => {
    const rows = [['Name', 'Company', 'Email', 'Phone', 'City', 'Registered']];
    filtered.forEach((c) => {
      rows.push([
        getName(c),
        c.company_name || '',
        c.email || '',
        c.phone || '',
        c.city || '',
        c.created_at ? new Date(c.created_at).toLocaleDateString() : ''
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
        <h2>Registered Customers ({customers.length})</h2>
        <div>
          <button className="glow-btn glow-btn-small glow-btn-secondary" onClick={fetchCustomers}>
            Refresh
          </button>{' '}
          <button className="glow-btn glow-btn-small" onClick={exportCsv} disabled={filtered.length === 0}>
            Export CSV
          </button>
        </div>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="form-group">
        <input
          type="text"
          className="glow-input"
          placeholder="Search by name, company, email, phone or city"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
      </div>

      {filtered.length === 0 ? (
        <div className="no-content">
          <p>{customers.length === 0 ? 'No customers have registered yet.' : 'No customers match your search.'}</p>
        </div>
      ) : (
        <div className="glow-card" style={{ overflowX: 'auto' }}>
          <table className="glow-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => toggleSort('name')}>
                  Name{arrow('name')}
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => toggleSort('company_name')}>
                  Company{arrow('company_name')}
                </th>
                <th style={{ textAlign: 'left' }}>Email</th>
                <th style={{ textAlign: 'left' }}>Phone</th>
                <th style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => toggleSort('city')}>
                  City{arrow('city')}
                </th>
                <th style={{ cursor: 'pointer', textAlign: 'left' }} onClick={() => toggleSort('created_at')}>
                  Registered{arrow('created_at')}
                </th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((c) => (
                <tr key={c.id}>
                  <td>{getName(c)}</td>
                  <td>{c.company_name || '-'}</td>
                  <td>{c.email || '-'}</td>
                  <td>{c.phone || '-'}</td>
                  <td>{c.city || '-'}</td>
                  <td>{c.created_at ? new Date(c.created_at).toLocaleDateString() : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="pagination" style={{ marginTop: 12 }}>
          <button
            className="glow-btn glow-btn-small glow-btn-secondary"
            disabled={currentPage === 1}
            onClick={() => setPage(currentPage - 1)}
          >
            Previous
          </button>
          <span style={{ margin: '0 12px' }}>
            Page {currentPage} of {totalPages}
          </span>
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
  );
};

export default CustomerManagement;
