import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Register = () => {
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  });

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;

    setFormData((prevData) => ({
      ...prevData,
      [name]: value,
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
    setSuccess('');

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

    setLoading(true);

    try {
      console.log('Registering customer...');

      const response = await axios.post(
        `${API_BASE_URL}/api/auth/register`,
        {
          firstName: formData.firstName.trim(),
          lastName: formData.lastName.trim(),
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }
      );

      console.log('✅ Registration response:', response.data);

      if (!response.data.success) {
        setError(
          response.data.message || 'Registration failed. Please try again.'
        );
        setLoading(false);
        return;
      }

      console.log('Registration successful. Logging customer in...');

      const loginResponse = await axios.post(
        `${API_BASE_URL}/api/auth/login`,
        {
          email: formData.email.trim().toLowerCase(),
          password: formData.password,
        }
      );

      console.log('✅ Login response:', loginResponse.data);

      if (!loginResponse.data.success) {
        setSuccess(
          'Account created successfully. Please login to continue.'
        );

        setTimeout(() => {
          window.location.href = '/login';
        }, 1500);

        setLoading(false);
        return;
      }

      // Get authentication data
      const { token, user } = loginResponse.data.data;

      if (!token || !user) {
        setError(
          'Account created, but login information was not returned by the server.'
        );
        setLoading(false);
        return;
      }

      // Save authentication information
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
      localStorage.setItem('userName', `${user.firstName} ${user.lastName}`);
      localStorage.setItem('userEmail', user.email);

      // Set Axios authorization header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;

      console.log('💾 Authentication saved successfully.');
      console.log('User:', user);
      console.log('User Role:', user.role);
      console.log('User Name:', `${user.firstName} ${user.lastName}`);

      // FORCE REDIRECT with full page reload
      console.log('🚀 Redirecting to dashboard...');
      window.location.href = '/dashboard';

    } catch (error) {
      console.error('❌ Registration error:', error);

      if (error.response) {
        console.error('Response:', error.response.data);
        console.error('Status:', error.response.status);

        setError(
          error.response.data?.message ||
          'Registration failed. Please check your information.'
        );
      } else if (error.request) {
        console.error('No response from server.');
        setError(
          'Cannot connect to the server. Please make sure the backend is running.'
        );
      } else {
        console.error('Error:', error.message);
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="glow-card auth-card">

        <h2>Create Account</h2>

        <p className="sub-text">
          Join GlowBulk Today
        </p>

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        {success && (
          <div className="success-message">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit}>

          <div className="form-row">

            <div className="form-group">
              <label className="glow-label">
                First Name
              </label>

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
              <label className="glow-label">
                Last Name
              </label>

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
            <label className="glow-label">
              Email
            </label>

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
            <label className="glow-label">
              Password
            </label>

            <input
              type="password"
              name="password"
              className="glow-input"
              value={formData.password}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="Create a password (min 6 characters)"
              autoComplete="new-password"
            />
          </div>

          <div className="form-group">
            <label className="glow-label">
              Confirm Password
            </label>

            <input
              type="password"
              name="confirmPassword"
              className="glow-input"
              value={formData.confirmPassword}
              onChange={handleChange}
              required
              minLength={6}
              placeholder="Confirm your password"
              autoComplete="new-password"
            />
          </div>

          <button
            type="submit"
            className="glow-btn"
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Register'}
          </button>

        </form>

        <p className="auth-link">
          Already have an account?{' '}
          <Link to="/login">
            Login here
          </Link>
        </p>

      </div>
    </div>
  );
};

export default Register;