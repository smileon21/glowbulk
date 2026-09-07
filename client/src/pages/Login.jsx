import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      console.log('Logging in...');
      console.log('API_URL:', API_URL);
      
      const response = await axios.post(`${API_URL}/api/auth/login`, {
        email: email.trim().toLowerCase(),
        password
      });

      console.log('Login Response:', response.data);

      if (response.data.success) {
        const { token, user } = response.data.data;

        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('userRole', user.role);
        localStorage.setItem('userName', `${user.firstName} ${user.lastName}`);
        localStorage.setItem('userEmail', user.email);
        
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

        console.log('Login successful! Redirecting...');
        console.log('User Role:', user.role);
        
        window.location.href = '/dashboard';
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
              autoComplete="email"
              style={{ color: '#14141f', background: '#ffffff' }}
            />
          </div>
          
          <div className="form-group">
            <label className="glow-label">Password</label>
            <div style={{ display: 'flex', alignItems: 'center', position: 'relative' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                className="glow-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="Enter your password"
                autoComplete="current-password"
                style={{ 
                  color: '#14141f', 
                  background: '#ffffff',
                  paddingRight: '45px'
                }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '18px',
                  color: '#6b7280',
                  padding: '8px'
                }}
              >
                {showPassword ? '👁️' : '👁️‍🗨️'}
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