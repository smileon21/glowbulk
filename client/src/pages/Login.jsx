import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // Strips trailing slashes and forces HTTPS protocol to prevent 308 redirects
      const cleanBaseUrl = API_BASE_URL.replace(/\/$/, '').replace(/^http:/, 'https:');

      const response = await axios.post(`${cleanBaseUrl}/api/auth/login`, {
        email: email,
        password: password
      });

      if (response.data.success) {
        const data = response.data.data;
        localStorage.setItem('token', data.token);
        localStorage.setItem('userRole', data.user.role);
        localStorage.setItem('userName', `${data.user.firstName} ${data.user.lastName}`);
        localStorage.setItem('userEmail', data.user.email);
        
        // Use React Router for SPA client-side navigation
        navigate('/dashboard');
      } else {
        setError(response.data.message || 'Login failed');
      }
    } catch (error) {
      console.error('Login error:', error);
      setError(error.response?.data?.message || 'Login failed. Please try again.');
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