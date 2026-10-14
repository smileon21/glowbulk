import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import AdminManagement from '../components/AdminManagement';
import { formatName, formatDate } from '../utils/format';

const AdminProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchAdminData();
  }, []);

  const fetchAdminData = async () => {
    try {
      const token = localStorage.getItem('token');

      if (!token) {
        setError('Please login first');
        setLoading(false);
        return;
      }

      const config = {
        headers: {
          'Authorization': 'Bearer ' + token
        }
      };

      const userResponse = await axios.get(API_BASE_URL + '/api/auth/me', config);
      if (userResponse.data.success) {
        setUser(userResponse.data.data);
      }
    } catch (error) {
      console.error('Error fetching admin data:', error);
      if (error.response && error.response.status === 401) {
        setError('Session expired. Please login again.');
      } else {
        setError('Error loading admin data');
      }
    } finally {
      setLoading(false);
    }
  };

  const exportMonthlyOrdersReport = async () => {
    try {
      setExporting(true);
      setMessage('');
      setError('');
      const token = localStorage.getItem('token');
      const now = new Date();
      const month = now.getMonth() + 1;
      const year = now.getFullYear();

      const response = await axios({
        method: 'GET',
        url: API_BASE_URL + '/api/export/monthly-orders-report?month=' + month + '&year=' + year,
        headers: {
          'Authorization': 'Bearer ' + token
        },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const contentDisposition = response.headers['content-disposition'];
      let filename = 'GlowBulk_Orders_Report_' + year + '_' + String(month).padStart(2, '0') + '.xlsx';
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
      setMessage('Orders report exported successfully!');
    } catch (error) {
      console.error('Error exporting orders report:', error);
      setError('Error exporting orders report');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading manifest...</div>;
  }

  const displayName =
    formatName([user?.first_name, user?.last_name].filter(Boolean).join(' ')) ||
    formatName(localStorage.getItem('userName')) ||
    'Admin';
  const role = user?.role || localStorage.getItem('userRole') || 'admin';
  const twoFactorOn = !!user?.two_factor_enabled;
  const monthName = new Date().toLocaleDateString('en-GB', { month: 'long' });

  return (
    <div className="admin-profile-container">
      <div className="page-header">
        <h2>Admin Profile</h2>
        <button
          className="glow-btn glow-btn-secondary export-btn"
          onClick={exportMonthlyOrdersReport}
          disabled={exporting}
          title={'Download the ' + monthName + ' orders report (.xlsx)'}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {exporting ? 'Exporting…' : 'Export ' + monthName + ' Orders'}
        </button>
      </div>
      <p className="sub-text">Your account and team access</p>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {/* Summary card */}
      <div className="profile-summary">
        <span className="profile-summary-avatar">{displayName.charAt(0)}</span>
        <div className="profile-summary-info">
          <span className="profile-summary-name">{displayName}</span>
          {user?.email && (
            <span className="profile-summary-email">
              Signs in as <strong>{user.email}</strong>
            </span>
          )}
          {user?.created_at && (
            <span className="profile-summary-email">
              Joined {formatDate(user.created_at)}
            </span>
          )}
        </div>
        <div className="profile-summary-side">
          <span className={'role-badge ' + role}>{role}</span>
          <Link to="/security" className={'profile-2fa ' + (twoFactorOn ? 'on' : 'off')}>
            {twoFactorOn ? '2FA on' : '2FA off'} · Security <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>

      <AdminManagement />
    </div>
  );
};

export default AdminProfile;
