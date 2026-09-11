import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

// Absolute backend URL to prevent relative routing and 308 redirects on Vercel
const BACKEND_URL = 'https://glowbulk-api.onrender.com';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false); // Toggle password state
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // 2FA state
  const [awaitingOtp, setAwaitingOtp] = useState(false);
  const [pendingUserId, setPendingUserId] = useState(null);
  const [otpCode, setOtpCode] = useState('');
  const [resending, setResending] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  const completeLogin = (data) => {
    localStorage.setItem('token', data.token);
    localStorage.setItem('userRole', data.user.role);
    localStorage.setItem('userName', `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim());
    localStorage.setItem('userEmail', data.user.email);

    // Tell App.jsx that auth state just changed (same-tab)
    window.dispatchEvent(new Event('authChange'));

    // Full page navigation ensures a clean app re-init on the new route
    window.location.href = '/dashboard';
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: email.trim(),
        password: password
      });

      if (response.data.success) {
        const data = response.data.data;

        if (data.requiresTwoFactor) {
          setPendingUserId(data.userId);
          setAwaitingOtp(true);
        } else {
          completeLogin(data);
        }
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);

      if (err.response) {
        setError(err.response.data?.message || 'Invalid credentials or server error.');
      } else if (err.request) {
        setError('Unable to reach server. Please check your internet connection.');
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/verify-otp`, {
        userId: pendingUserId,
        code: otpCode.trim()
      });

      if (response.data.success) {
        completeLogin(response.data.data);
      } else {
        setError(response.data.message || 'Verification failed');
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setError(err.response?.data?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setResendMessage('');
    setError('');

    try {
      const response = await axios.post(`${BACKEND_URL}/api/auth/resend-otp`, {
        userId: pendingUserId
      });
      setResendMessage(response.data.message || 'A new code has been sent.');
    } catch (err) {
      setError(err.response?.data?.message || 'Unable to resend code.');
    } finally {
      setResending(false);
    }
  };

  const backToLogin = () => {
    setAwaitingOtp(false);
    setPendingUserId(null);
    setOtpCode('');
    setError('');
    setResendMessage('');
  };

  if (awaitingOtp) {
    return (
      <div className="auth-container">
        <div className="glow-card auth-card">
          <h2>Verify It's You</h2>
          <p className="sub-text">Enter the code sent to your email</p>

          {error && <div className="error-message">{error}</div>}
          {resendMessage && <div className="success-message">{resendMessage}</div>}

          <form onSubmit={handleVerifyOtp}>
            <div className="form-group">
              <label className="glow-label">6-Digit Code</label>
              <input
                type="text"
                className="glow-input"
                value={otpCode}
                onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                required
                placeholder="Enter code"
                inputMode="numeric"
                maxLength={6}
                autoFocus
              />
            </div>

            <button type="submit" className="glow-btn" disabled={loading || otpCode.length !== 6}>
              {loading ? 'Verifying...' : 'Verify & Continue'}
            </button>
          </form>

          <p className="auth-link">
            <button
              type="button"
              onClick={handleResendOtp}
              disabled={resending}
              style={{ background: 'none', border: 'none', color: '#CC0000', cursor: 'pointer', fontWeight: 600, padding: 0 }}
            >
              {resending ? 'Sending...' : 'Resend code'}
            </button>
            {' · '}
            <button
              type="button"
              onClick={backToLogin}
              style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer', padding: 0 }}
            >
              Back to login
            </button>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="glow-card auth-card">
        <h2>Login to GlowBulk</h2>
        <p className="sub-text">We Go Further...</p>
        
        {error && <div className="error-message">{error}</div>}
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="glow-label">Email</label>
            <input
              type="email"
              className="glow-input"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="Enter your email"
              autoComplete="email"
            />
          </div>
          
          <div className="form-group">
            <label className="glow-label">Password</label>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="glow-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '10px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: 0,
                  color: '#6b7280',
                  lineHeight: 1,
                  display: 'flex',
                  alignItems: 'center'
                }}
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                    <circle cx="12" cy="12" r="3" />
                  </svg>
                ) : (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                    <line x1="1" y1="1" x2="23" y2="23" />
                  </svg>
                )}
              </button>
            </div>
          </div>
          
          <button type="submit" className="glow-btn" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        </form>
        
        <p className="auth-link">
          Don't have an account? <Link to="/register">Register here</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;