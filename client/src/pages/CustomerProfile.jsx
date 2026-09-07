import React, { useState, useEffect } from 'react';
import axios from 'axios';

const CustomerProfile = () => {
  const [profile, setProfile] = useState({
    company_name: '',
    company_registration: '',
    contact_person_name: '',
    contact_person_email: '',
    contact_person_phone: '',
    industry: '',
    billing_address: '',
    billing_city: '',
    billing_country: '',
    delivery_address: '',
    delivery_city: '',
    delivery_country: '',
    preferred_fuel_types: []
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [profileExists, setProfileExists] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setLoading(false);
        return;
      }
      
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      const response = await axios.get('`${API_URL}/api/customers/profile/me');
      
      if (response.data.success) {
        setProfile(response.data.data);
        setProfileExists(true);
        setError('');
      }
    } catch (error) {
      if (error.response?.status === 404) {
        setProfileExists(false);
        setMessage('Please create your customer profile below.');
        setError('');
      } else {
        console.error('Error fetching profile:', error);
        setError('Unable to load profile. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setProfile({
      ...profile,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setMessage('');
    setError('');

    try {
      const token = localStorage.getItem('token');
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      
      let response;
      if (profileExists) {
        response = await axios.put('`${API_URL}/api/customers/profile/me', profile);
      } else {
        response = await axios.post('`${API_URL}/api/customers/profile', profile);
      }
      
      if (response.data.success) {
        setMessage(profileExists ? 'Profile updated successfully!' : 'Profile created successfully!');
        setProfile(response.data.data);
        setProfileExists(true);
        setError('');
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error saving profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading profile...</div>;
  }

  return (
    <div className="profile-container">
      <div className="page-header">
        <h2>My Profile</h2>
      </div>
      <p className="sub-text">Update your company and contact information</p>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="profile-form">
        <div className="form-section">
          <h3>Company Information</h3>
          
          <div className="form-group">
            <label className="glow-label">Company Name *</label>
            <input
              type="text"
              name="company_name"
              className="glow-input"
              value={profile.company_name || ''}
              onChange={handleChange}
              required
              placeholder="Enter your company name"
            />
          </div>

          <div className="form-group">
            <label className="glow-label">Company Registration</label>
            <input
              type="text"
              name="company_registration"
              className="glow-input"
              value={profile.company_registration || ''}
              onChange={handleChange}
              placeholder="Enter company registration number"
            />
          </div>

          <div className="form-group">
            <label className="glow-label">Industry</label>
            <input
              type="text"
              name="industry"
              className="glow-input"
              value={profile.industry || ''}
              onChange={handleChange}
              placeholder="e.g., Oil & Gas, Mining, Transport"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Contact Person</h3>

          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">Contact Person Name *</label>
              <input
                type="text"
                name="contact_person_name"
                className="glow-input"
                value={profile.contact_person_name || ''}
                onChange={handleChange}
                required
                placeholder="Full name"
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Phone Number</label>
              <input
                type="text"
                name="contact_person_phone"
                className="glow-input"
                value={profile.contact_person_phone || ''}
                onChange={handleChange}
                placeholder="+263 77 123 4567"
              />
            </div>
          </div>

          <div className="form-group">
            <label className="glow-label">Email Address *</label>
            <input
              type="email"
              name="contact_person_email"
              className="glow-input"
              value={profile.contact_person_email || ''}
              onChange={handleChange}
              required
              placeholder="email@company.com"
            />
          </div>
        </div>

        <div className="form-section">
          <h3>Billing Address</h3>

          <div className="form-group">
            <label className="glow-label">Street Address</label>
            <input
              type="text"
              name="billing_address"
              className="glow-input"
              value={profile.billing_address || ''}
              onChange={handleChange}
              placeholder="123 Main Street"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">City</label>
              <input
                type="text"
                name="billing_city"
                className="glow-input"
                value={profile.billing_city || ''}
                onChange={handleChange}
                placeholder="Harare"
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Country</label>
              <input
                type="text"
                name="billing_country"
                className="glow-input"
                value={profile.billing_country || ''}
                onChange={handleChange}
                placeholder="Zimbabwe"
              />
            </div>
          </div>
        </div>

        <div className="form-section">
          <h3>Delivery Address</h3>

          <div className="form-group">
            <label className="glow-label">Street Address</label>
            <input
              type="text"
              name="delivery_address"
              className="glow-input"
              value={profile.delivery_address || ''}
              onChange={handleChange}
              placeholder="456 Industrial Road"
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="glow-label">City</label>
              <input
                type="text"
                name="delivery_city"
                className="glow-input"
                value={profile.delivery_city || ''}
                onChange={handleChange}
                placeholder="Harare"
              />
            </div>
            <div className="form-group">
              <label className="glow-label">Country</label>
              <input
                type="text"
                name="delivery_country"
                className="glow-input"
                value={profile.delivery_country || ''}
                onChange={handleChange}
                placeholder="Zimbabwe"
              />
            </div>
          </div>
        </div>

        <div className="form-actions">
          <button type="submit" className="glow-btn" disabled={saving}>
            {saving ? 'Saving...' : (profileExists ? 'Update Profile' : 'Create Profile')}
          </button>
        </div>
      </form>
    </div>
  );
};

export default CustomerProfile;
