import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// Used in two places:
//  - Login.jsx, when IT gave the person a temporary password (forced = true, token passed in)
//  - Security.jsx, for any signed-in user (token read from localStorage)
const ChangePasswordForm = ({ token, baseUrl, forced = false, onSuccess }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    if (newPassword === currentPassword) {
      setError('New password must be different from the current one.');
      return;
    }

    setLoading(true);
    try {
      const authToken = token || localStorage.getItem('token');
      const response = await axios.post(
        `${baseUrl || API_BASE_URL}/api/auth/change-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${authToken}` } }
      );

      if (response.data.success) {
        setSuccess(response.data.message || 'Password changed successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        if (onSuccess) onSuccess();
      } else {
        setError(response.data.message || 'Unable to change password.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="form-group">
        <label className="glow-label">{forced ? 'Temporary password' : 'Current password'}</label>
        <input
          type="password"
          className="glow-input"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder={forced ? 'The password IT gave you' : 'Enter your current password'}
        />
      </div>

      <div className="form-group">
        <label className="glow-label">New password</label>
        <input
          type="password"
          className="glow-input"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="At least 8 characters"
        />
      </div>

      <div className="form-group">
        <label className="glow-label">Confirm new password</label>
        <input
          type="password"
          className="glow-input"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          placeholder="Repeat the new password"
        />
      </div>

      <button type="submit" className="glow-btn" disabled={loading}>
        {loading ? 'Saving...' : forced ? 'Set password & continue' : 'Change password'}
      </button>
    </form>
  );
};

export default ChangePasswordForm;
