import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

// Absolute backend URL to prevent relative routing and 308 redirects on Vercel
const BACKEND_URL = 'https://glowbulk-api.onrender.com';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Direct call to Render backend
      const response = await axios.post(`${BACKEND_URL}/api/auth/login`, {
        email: email.trim(),
        password: password
      });

      if (response.data.success) {
        const data = response.data.data;
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('userName', `${data.user.firstName || ''} ${data.user.lastName || ''}`.trim());
        localStorage.setItem('userEmail', data.user.email);

        // Tell App.jsx that auth state just changed (same-tab)
        window.dispatchEvent(new Event('authChange'));

        // Full page navigation ensures a clean app re-init on the new route
        window.location.href = '/dashboard';
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (err) {
      console.error('Login error:', err);

      // Detailed error response handling
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
            <input
              type="password"
              className="glow-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              placeholder="Enter your password"
              autoComplete="current-password"
            />
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