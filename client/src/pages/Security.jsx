import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import TwoFactorSettings from '../components/TwoFactorSettings';

const Security = () => {
  const [account, setAccount] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAccount();
  }, []);

  const fetchAccount = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get(`${API_BASE_URL}/api/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setAccount(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching account info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading security settings...</div>;
  }

  return (
    <div className="security-page">
      <div className="page-header">
        <h2>Security</h2>
      </div>
      <p className="sub-text">Manage how you sign in to GlowBulk</p>

      <TwoFactorSettings initialEnabled={account?.two_factor_enabled} />
    </div>
  );
};

export default Security;