import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import AdminManagement from '../components/AdminManagement';
import ExportPanel from '../components/ExportPanel';
import { formatName, formatDate } from '../utils/format';

const AdminProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  if (loading) {
    return <div className="loading">Loading manifest...</div>;
  }

  const displayName =
    formatName([user?.first_name, user?.last_name].filter(Boolean).join(' ')) ||
    formatName(localStorage.getItem('userName')) ||
    'Admin';
  const role = user?.role || localStorage.getItem('userRole') || 'admin';
  const twoFactorOn = !!user?.two_factor_enabled;

  return (
    <div className="admin-profile-container">
      <div className="page-header">
        <h2>Admin Profile</h2>
      </div>
      <p className="sub-text">Your account and team access</p>

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

      <ExportPanel />

      <AdminManagement />
    </div>
  );
};

export default AdminProfile;
