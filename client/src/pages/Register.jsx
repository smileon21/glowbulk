import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

// Small eye icon used by both password fields
const EyeIcon = ({ visible }) =>
  visible ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.94 10.94 0 0112 20c-7 0-11-8-11-8a18.5 18.5 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  );

const toggleButtonStyle = {
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
};

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    accountType: 'individual',
    companyName: '',
    companyRegistration: '',
    address: '',
    password: '',
    confirmPassword: ''
  });

  // Password visibility states
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value
    }));

    // Clear error while user is typing
    if (error) {
      setError('');
    }
  };

  // Handle registration
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    // Prevent multiple submissions
    if (loading) return;

    // Check passwords
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    // Check password length
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    // Company accounts need a company name
    const isCompany = formData.accountType === 'company';
    if (isCompany && !formData.companyName.trim()) {
      setError('Please enter your company name.');
      return;
    }

    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE_URL}/api/auth/register`, {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: formData.email.trim().toLowerCase(),
        phone: formData.phone.trim(),
        accountType: formData.accountType,
        companyName: isCompany ? formData.companyName.trim() : null,
        companyRegistration: isCompany ? formData.companyRegistration.trim() : null,
        address: formData.address.trim(),
        password: formData.password
      });

      if (!response.data.success) {
        setError(response.data.message || 'Registration failed. Please try again.');
        return;
      }

      // No automatic login: the account must be verified by our team first
      setSubmitted(true);
    } catch (err) {
      console.error('Registration error:', err);

      if (err.response) {
        setError(
          err.response.data?.message ||
            'Registration failed. Please check your information.'
        );
      } else if (err.request) {
        setError('Cannot connect to the server. Please make sure the backend is running.');
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  // After a successful registration
  if (submitted) {
    return (
      <div className="auth-container">
        <div className="glow-card auth-card">
          <h2>Registration submitted</h2>
          <div className="success-message">
            Thank you. Our team will verify your account and we will notify you
            once it is approved. You can log in after that.
          </div>
          <p className="auth-link">
            <Link to="/login">Back to login</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-container">
      <div className="glow-card auth-card">
        <h2>Create Account</h2>

        <p className="sub-text">Join GlowBulk Today</p>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">First Name</label>
              <input
                type="text"
                name="firstName"
                className="glow-input"
                value={formData.firstName}
                onChange={handleChange}
                required
                placeholder="Enter your first name"
                autoComplete="given-name"
              />
            </div>

            <div className="form-group">
              <label className="glow-label">Last Name</label>
              <input
                type="text"
                name="lastName"
                className="glow-input"
                value={formData.lastName}
                onChange={handleChange}
                required
                placeholder="Enter your last name"
                autoComplete="family-name"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="glow-label">Email</label>
            <input
              type="email"
              name="email"
              className="glow-input"
              value={formData.email}
              onChange={handleChange}
              required
              placeholder="Enter your email"
              autoComplete="email"
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
              required
              placeholder="+263 77 123 4567"
              autoComplete="tel"
            />
          </div>

          <div className="form-group">
            <label className="glow-label">Account Type</label>
            <select
              name="accountType"
              className="glow-input"
              value={formData.accountType}
              onChange={handleChange}
            >
              <option value="individual">Individual</option>
              <option value="company">Company</option>
            </select>
          </div>

          {formData.accountType === 'company' && (
            <div className="form-row">
              <div className="form-group">
                <label className="glow-label">Company Name *</label>
                <input
                  type="text"
                  name="companyName"
                  className="glow-input"
                  value={formData.companyName}
                  onChange={handleChange}
                  placeholder="Enter your company name"
                  autoComplete="organization"
                />
              </div>

              <div className="form-group">
                <label className="glow-label">Company Registration</label>
                <input
                  type="text"
                  name="companyRegistration"
                  className="glow-input"
                  value={formData.companyRegistration}
                  onChange={handleChange}
                  placeholder="Registration number"
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="glow-label">Address</label>
            <textarea
              name="address"
              className="glow-input"
              rows={2}
              value={formData.address}
              onChange={handleChange}
              required
              placeholder="Your physical address"
              autoComplete="street-address"
            />
          </div>

          <div className="form-group">
            <label className="glow-label">Password</label>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showPassword ? 'text' : 'password'}
                name="password"
                className="glow-input"
                value={formData.password}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="Create a password (min 6 characters)"
                autoComplete="new-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={toggleButtonStyle}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                <EyeIcon visible={showPassword} />
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="glow-label">Confirm Password</label>

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <input
                type={showConfirmPassword ? 'text' : 'password'}
                name="confirmPassword"
                className="glow-input"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                minLength={6}
                placeholder="Confirm your password"
                autoComplete="new-password"
                style={{ paddingRight: '40px' }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={toggleButtonStyle}
                aria-label={showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
              >
                <EyeIcon visible={showConfirmPassword} />
              </button>
            </div>
          </div>

          <button type="submit" className="glow-btn" disabled={loading}>
            {loading ? 'Submitting...' : 'Register'}
          </button>
        </form>

        <p className="auth-link">
          Already have an account? <Link to="/login">Login here</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
