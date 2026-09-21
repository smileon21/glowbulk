import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const UploadProof = () => {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const [proofFile, setProofFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
    }
  }, []);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please upload a PDF, JPG, or PNG file');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      setProofFile(file);
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!proofFile) {
      setError('Please select a file to upload');
      return;
    }

    setSubmitting(true);
    setError('');
    setMessage('');

    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('proofFile', proofFile);

      const response = await axios.post(
        `${API_BASE_URL}/api/orders/upload-proof/${orderId}`,
        formData,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      if (response.data.success) {
        setMessage('Payment proof uploaded successfully!');
        setTimeout(() => {
          navigate('/orders');
        }, 2000);
      }
    } catch (err) {
      console.error('Error uploading proof:', err);
      setError(err.response?.data?.message || 'Error uploading payment proof');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="create-order-container">
      <h2>Upload Payment Proof</h2>
      <p className="sub-text">Order #{orderId}</p>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      <form onSubmit={handleSubmit} className="create-order-form">
        <div className="form-section">
          <h3>Payment Proof</h3>
          <div className="form-group">
            <label className="glow-label">Upload Proof of Payment *</label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png"
              className="glow-input"
              onChange={handleFileChange}
              required
            />
            <small style={{ color: '#6b7280', fontSize: '12px' }}>PDF, JPG, PNG (Max 5MB)</small>
            {proofFile && <span className="file-name">📎 {proofFile.name}</span>}
          </div>
        </div>

        <div className="order-summary">
          <div style={{ display: 'flex', gap: '10px' }}>
            <button
              type="button"
              className="glow-btn glow-btn-secondary"
              onClick={() => navigate('/orders')}
              style={{ width: 'auto', padding: '14px 30px' }}
            >
              Cancel
            </button>
            <button type="submit" className="glow-btn" disabled={submitting}>
              {submitting ? 'Uploading...' : 'Upload Proof'}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
};

export default UploadProof;