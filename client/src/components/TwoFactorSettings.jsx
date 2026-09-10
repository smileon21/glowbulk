import React, { useState } from 'react';
import axios from 'axios';

const BACKEND_URL = 'https://glowbulk-api.onrender.com';

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return { headers: { Authorization: `Bearer ${token}` } };
};

const TwoFactorSettings = ({ initialEnabled }) => {
  const [enabled, setEnabled] = useState(!!initialEnabled);
  const [step, setStep] = useState('idle'); // idle | setup-otp | disable-confirm
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const startEnable = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/2fa/send-setup-otp`,
        {},
        authHeaders()
      );
      setMessage(response.data.message || 'Verification code sent to your email');
      setStep('setup-otp');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to send verification code');
    } finally {
      setLoading(false);
    }
  };

  const confirmEnable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/2fa/enable`,
        { code: code.trim() },
        authHeaders()
      );
      if (response.data.success) {
        setEnabled(true);
        setStep('idle');
        setCode('');
        setMessage('Two-factor authentication is now enabled.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid or expired code');
    } finally {
      setLoading(false);
    }
  };

  const startDisable = () => {
    setStep('disable-confirm');
    setError('');
    setMessage('');
  };

  const confirmDisable = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const response = await axios.post(
        `${BACKEND_URL}/api/auth/2fa/disable`,
        { password },
        authHeaders()
      );
      if (response.data.success) {
        setEnabled(false);
        setStep('idle');
        setPassword('');
        setMessage('Two-factor authentication has been disabled.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Incorrect password');
    } finally {
      setLoading(false);
    }
  };

  const cancel = () => {
    setStep('idle');
    setCode('');
    setPassword('');
    setError('');
    setMessage('');
  };

  return (
    <div className="form-section">
      <h3>Two-Factor Authentication</h3>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {step === 'idle' && (
        <>
          <p style={{ color: 'var(--steel)', fontSize: '14px', marginBottom: '16px' }}>
            {enabled
              ? 'A verification code will be emailed to you each time you log in.'
              : 'Add an extra layer of security. When enabled, a code will be emailed to you at login.'}
          </p>
          {enabled ? (
            <button
              type="button"
              className="glow-btn glow-btn-secondary"
              style={{ width: 'auto' }}
              onClick={startDisable}
            >
              Disable Two-Factor Authentication
            </button>
          ) : (
            <button
              type="button"
              className="glow-btn"
              style={{ width: 'auto' }}
              onClick={startEnable}
              disabled={loading}
            >
              {loading ? 'Sending code...' : 'Enable Two-Factor Authentication'}
            </button>
          )}
        </>
      )}

      {step === 'setup-otp' && (
        <form onSubmit={confirmEnable}>
          <div className="form-group">
            <label className="glow-label">Enter the code sent to your email</label>
            <input
              type="text"
              className="glow-input"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="6-digit code"
              inputMode="numeric"
              maxLength={6}
              required
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              className="glow-btn"
              style={{ width: 'auto' }}
              disabled={loading || code.length !== 6}
            >
              {loading ? 'Verifying...' : 'Confirm & Enable'}
            </button>
            <button
              type="button"
              className="glow-btn glow-btn-secondary"
              style={{ width: 'auto' }}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {step === 'disable-confirm' && (
        <form onSubmit={confirmDisable}>
          <div className="form-group">
            <label className="glow-label">Enter your password to confirm</label>
            <input
              type="password"
              className="glow-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              required
              autoFocus
            />
          </div>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="submit"
              className="glow-btn glow-btn-secondary"
              style={{ width: 'auto' }}
              disabled={loading}
            >
              {loading ? 'Disabling...' : 'Confirm Disable'}
            </button>
            <button
              type="button"
              className="glow-btn glow-btn-secondary"
              style={{ width: 'auto' }}
              onClick={cancel}
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

export default TwoFactorSettings;