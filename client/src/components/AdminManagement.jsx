import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });

  const [resetPasswordId, setResetPasswordId] = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(function() {
    fetchAdmins();
  }, []);

  const getToken = function() {
    return localStorage.getItem('token');
  };

  const fetchAdmins = async function() {
    try {
      const response = await axios.get(
        API_BASE_URL + '/api/auth/users',
        { headers: { Authorization: 'Bearer ' + getToken() } }
      );

      if (response.data.success) {
        const adminUsers = response.data.data.filter(function(u) {
          return u.role === 'admin';
        });
        setAdmins(adminUsers);
      }
    } catch (err) {
      console.error('Error fetching admins:', err);
      setError('Error loading admins');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = function(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  const handleCreateAdmin = async function(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await axios.post(
        API_BASE_URL + '/api/auth/admin/create',
        {
          firstName: formData.firstName,
          lastName: formData.lastName,
          email: formData.email,
          password: formData.password,
          phone: formData.phone
        },
        { headers: { Authorization: 'Bearer ' + getToken() } }
      );

      if (response.data.success) {
        setMessage('Admin account created successfully');
        setShowForm(false);
        setFormData({
          firstName: '',
          lastName: '',
          email: '',
          password: '',
          confirmPassword: '',
          phone: ''
        });
        fetchAdmins();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error creating admin');
    }
  };

  const handleToggleStatus = async function(id, currentStatus) {
    const newStatus = !currentStatus;
    if (!window.confirm('Are you sure you want to ' + (newStatus ? 'activate' : 'deactivate') + ' this admin?')) {
      return;
    }

    try {
      const response = await axios.put(
        API_BASE_URL + '/api/auth/admin/' + id + '/status',
        { isActive: newStatus },
        { headers: { Authorization: 'Bearer ' + getToken() } }
      );

      if (response.data.success) {
        setMessage(response.data.message);
        fetchAdmins();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error updating status');
    }
  };

  const handleResetPassword = async function(e) {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    try {
      const response = await axios.put(
        API_BASE_URL + '/api/auth/admin/' + resetPasswordId + '/reset-password',
        { newPassword: newPassword },
        { headers: { Authorization: 'Bearer ' + getToken() } }
      );

      if (response.data.success) {
        setMessage('Password reset successfully');
        setResetPasswordId(null);
        setNewPassword('');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Error resetting password');
    }
  };

  const getInitials = function(firstName, lastName) {
    const f = firstName ? firstName.charAt(0).toUpperCase() : '';
    const l = lastName ? lastName.charAt(0).toUpperCase() : '';
    return f + l;
  };

  if (loading) {
    return <div className="loading">Loading admins...</div>;
  }

  return (
    <div className="admin-info glow-card" style={{ marginTop: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <h3 style={{ margin: 0 }}>Admin Management</h3>
        <button
          className="glow-btn"
          onClick={function() { setShowForm(!showForm); }}
          style={{ width: 'auto', padding: '10px 20px', fontSize: '13px' }}
        >
          {showForm ? 'Cancel' : '+ Add Admin'}
        </button>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreateAdmin} style={{ marginBottom: '24px', padding: '20px', background: '#f9f9f9', borderRadius: '6px' }}>
          <h4 style={{ marginTop: 0 }}>Create New Admin</h4>

          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">First Name *</label>
              <input
                type="text"
                name="firstName"
                className="glow-input"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="John"
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Last Name *</label>
              <input
                type="text"
                name="lastName"
                className="glow-input"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Doe"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="glow-label">Email *</label>
            <input
              type="email"
              name="email"
              className="glow-input"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="admin@glowpetroleum.com"
            />
          </div>

          <div className="form-group">
            <label className="glow-label">Phone Number</label>
            <input
              type="tel"
              name="phone"
              className="glow-input"
              value={formData.phone}
              onChange={handleChange}
              placeholder="+263 77 123 4567"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">Password *</label>
              <input
                type="password"
                name="password"
                className="glow-input"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="Min 6 characters"
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Confirm Password *</label>
              <input
                type="password"
                name="confirmPassword"
                className="glow-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="Confirm password"
              />
            </div>
          </div>

          <button type="submit" className="glow-btn" style={{ width: 'auto' }}>
            Create Admin
          </button>
        </form>
      )}

      {resetPasswordId && (
        <form onSubmit={handleResetPassword} style={{ marginBottom: '24px', padding: '20px', background: '#fff3f3', borderRadius: '6px' }}>
          <h4 style={{ marginTop: 0 }}>Reset Password</h4>
          <div className="form-group">
            <label className="glow-label">New Password</label>
            <input
              type="password"
              className="glow-input"
              value={newPassword}
              onChange={function(e) { setNewPassword(e.target.value); }}
              required
              minLength={6}
              placeholder="Enter new password"
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button type="submit" className="glow-btn" style={{ width: 'auto' }}>
              Reset Password
            </button>
            <button
              type="button"
              className="glow-btn glow-btn-secondary"
              onClick={function() { setResetPasswordId(null); setNewPassword(''); }}
              style={{ width: 'auto' }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="users-table-container" style={{ marginTop: '16px' }}>
        <table className="users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Actions</th>
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
                    <td>{admin.phone || 'N/A'}</td>
                    <td>
                      <span className={'status-badge ' + (admin.is_active ? 'active' : 'inactive')}>
                        {admin.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <button
                        className="glow-btn-small glow-btn-secondary"
                        onClick={function() { setResetPasswordId(admin.id); }}
                        style={{ marginRight: '5px' }}
                      >
                        Reset Password
                      </button>
                      <button
                        className={'glow-btn-small ' + (admin.is_active ? 'danger' : '')}
                        onClick={function() { handleToggleStatus(admin.id, admin.is_active); }}
                      >
                        {admin.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AdminManagement;