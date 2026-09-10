import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import TwoFactorSettings from '../components/TwoFactorSettings';

const AdminProfile = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [admins, setAdmins] = useState([]);
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
      
      const usersResponse = await axios.get(API_BASE_URL + '/api/auth/users', config);
      if (usersResponse.data.success) {
        const adminUsers = usersResponse.data.data.filter(function(u) {
          return u.role === 'admin';
        });
        setAdmins(adminUsers);
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

  return (
    <div className="admin-profile-container">
      <div className="page-header">
        <h2>Admin Profile</h2>
      </div>
      <p className="sub-text">System Administration Dashboard</p>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <div className="export-section">
        <button 
          className="glow-btn export-btn" 
          onClick={exportMonthlyOrdersReport}
          disabled={exporting}
        >
          {exporting ? 'Exporting...' : 'Export Orders Report'}
        </button>
      </div>

      <div className="admin-info glow-card">
        <h3>Your Account</h3>
        <div className="admin-info-grid">
          <div className="admin-info-item">
            <span className="detail-label">Name</span>
            <span className="detail-value">{user?.first_name} {user?.last_name}</span>
          </div>
          <div className="admin-info-item">
            <span className="detail-label">Email</span>
            <span className="detail-value">{user?.email}</span>
          </div>
          <div className="admin-info-item">
            <span className="detail-label">Role</span>
            <span className={'role-badge ' + (user?.role || '')}>{user?.role}</span>
          </div>
          <div className="admin-info-item">
            <span className="detail-label">Joined</span>
            <span className="detail-value">
              {user?.created_at ? new Date(user.created_at).toLocaleDateString() : 'N/A'}
            </span>
          </div>
        </div>
      </div>

      <TwoFactorSettings initialEnabled={user?.two_factor_enabled} />

      <div className="admin-stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total Admins</h3>
            <span className="ticket-tag">ADM</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Count</span>
              <span className="detail-value">{admins.length}</span>
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>System Admins</h3>
            <span className="ticket-tag">SYS</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Count</span>
              <span className="detail-value">{admins.filter(function(u) { return u.role === 'admin'; }).length}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="admin-users">
        <h3>System Administrators</h3>
        <div className="users-table-container glow-card">
          <table className="users-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Joined</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {admins.length === 0 ? (
                <tr>
                  <td colSpan="5" className="no-data">No admin users found</td>
                </tr>
              ) : (
                admins.map(function(admin) {
                  return (
                    <tr key={admin.id}>
                      <td>{admin.first_name} {admin.last_name}</td>
                      <td>{admin.email}</td>
                      <td>
                        <span className="role-badge admin">
                          {admin.role}
                        </span>
                      </td>
                      <td>{new Date(admin.created_at).toLocaleDateString()}</td>
                      <td>
                        <span className={'status-badge ' + (admin.is_active ? 'active' : 'inactive')}>
                          {admin.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default AdminProfile;