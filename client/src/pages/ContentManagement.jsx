import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const ContentManagement = () => {
  const [contents, setContents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    title: '',
    contentType: 'announcement',
    content: '',
    slug: '',
    metaDescription: '',
    status: 'draft'
  });

  useEffect(function() {
    fetchContent();
  }, []);

  var fetchContent = async function() {
    try {
      setLoading(true);
      var token = localStorage.getItem('token');
      var config = {
        headers: { 'Authorization': 'Bearer ' + token }
      };
      var response = await axios.get(API_BASE_URL + '/api/content/all', config);
      if (response.data.success) {
        setContents(response.data.data);
      }
    } catch (error) {
      console.error('Error fetching content:', error);
      setError('Error loading content');
    } finally {
      setLoading(false);
    }
  };

  var handleChange = function(e) {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  var handleSubmit = async function(e) {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      var token = localStorage.getItem('token');
      var config = {
        headers: { 'Authorization': 'Bearer ' + token }
      };
      
      var response;
      if (editing) {
        response = await axios.put(API_BASE_URL + '/api/content/' + editing, formData, config);
      } else {
        response = await axios.post(API_BASE_URL + '/api/content', formData, config);
      }
      
      if (response.data.success) {
        setMessage(editing ? 'Content updated successfully!' : 'Content created successfully!');
        setShowForm(false);
        setEditing(null);
        setFormData({
          title: '',
          contentType: 'announcement',
          content: '',
          slug: '',
          metaDescription: '',
          status: 'draft'
        });
        fetchContent();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error saving content');
    }
  };

  var handlePublish = async function(id) {
    try {
      var token = localStorage.getItem('token');
      var config = {
        headers: { 'Authorization': 'Bearer ' + token }
      };
      var response = await axios.put(API_BASE_URL + '/api/content/' + id + '/publish', {}, config);
      if (response.data.success) {
        setMessage('Content published successfully!');
        fetchContent();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error publishing content');
    }
  };

  var handleDelete = async function(id) {
    if (!window.confirm('Are you sure you want to delete this content?')) return;
    
    try {
      var token = localStorage.getItem('token');
      var config = {
        headers: { 'Authorization': 'Bearer ' + token }
      };
      var response = await axios.delete(API_BASE_URL + '/api/content/' + id, config);
      if (response.data.success) {
        setMessage('Content deleted successfully!');
        fetchContent();
      }
    } catch (error) {
      setError(error.response?.data?.message || 'Error deleting content');
    }
  };

  var handleEdit = function(content) {
    setFormData({
      title: content.title,
      contentType: content.content_type,
      content: content.content,
      slug: content.slug,
      metaDescription: content.meta_description || '',
      status: content.status
    });
    setEditing(content.id);
    setShowForm(true);
  };

  var getContentTypeLabel = function(type) {
    var labels = {
      'announcement': 'Announcement',
      'faq': 'FAQ',
      'fuel_info': 'Fuel Info',
      'policy': 'Policy',
      'news': 'News'
    };
    return labels[type] || type;
  };

  var getStatusBadge = function(status) {
    var statusMap = {
      'draft': { color: '#6c757d', text: 'Draft' },
      'published': { color: '#28a745', text: 'Published' }
    };
    var s = statusMap[status] || { color: '#6c757d', text: status };
    return <span className="status-badge" style={{ background: s.color }}>{s.text}</span>;
  };

  if (loading) {
    return <div className="loading">Loading content...</div>;
  }

  return (
    <div className="content-management">
      <div className="content-header">
        <h2>Content Management</h2>
        <button className="glow-btn" onClick={function() {
          setShowForm(!showForm);
          setEditing(null);
          setFormData({
            title: '',
            contentType: 'announcement',
            content: '',
            slug: '',
            metaDescription: '',
            status: 'draft'
          });
        }}>
          {showForm ? 'Cancel' : '+ New Content'}
        </button>
      </div>

      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}

      {showForm && (
        <div className="content-form glow-card">
          <h3>{editing ? 'Edit Content' : 'Create New Content'}</h3>
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="glow-label">Title *</label>
              <input
                type="text"
                name="title"
                className="glow-input"
                value={formData.title}
                onChange={handleChange}
                required
                placeholder="Enter content title"
              />
            </div>

            <div className="form-group">
              <label className="glow-label">Content Type *</label>
              <select
                name="contentType"
                className="glow-input"
                value={formData.contentType}
                onChange={handleChange}
                required
              >
                <option value="announcement">Announcement</option>
                <option value="faq">FAQ</option>
                <option value="fuel_info">Fuel Information</option>
                <option value="policy">Policy</option>
                <option value="news">News</option>
              </select>
            </div>

            <div className="form-group">
              <label className="glow-label">Slug (URL) *</label>
              <input
                type="text"
                name="slug"
                className="glow-input"
                value={formData.slug}
                onChange={handleChange}
                required
                placeholder="welcome-to-glowbulk"
              />
              <small>Used in the URL: /content/slug/your-slug</small>
            </div>

            <div className="form-group">
              <label className="glow-label">Content *</label>
              <textarea
                name="content"
                className="glow-input"
                value={formData.content}
                onChange={handleChange}
                required
                rows="6"
                placeholder="Write your content here..."
              />
            </div>

            <div className="form-group">
              <label className="glow-label">Meta Description</label>
              <input
                type="text"
                name="metaDescription"
                className="glow-input"
                value={formData.metaDescription}
                onChange={handleChange}
                placeholder="Brief description for SEO"
              />
            </div>

            <div className="form-group">
              <label className="glow-label">Status</label>
              <select
                name="status"
                className="glow-input"
                value={formData.status}
                onChange={handleChange}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </div>

            <button type="submit" className="glow-btn">
              {editing ? 'Update Content' : 'Create Content'}
            </button>
          </form>
        </div>
      )}

      <div className="content-list">
        {contents.length === 0 ? (
          <div className="no-content">
            <p>No content created yet.</p>
            <p className="sub-text">Create announcements, FAQs, and fuel information for your customers.</p>
          </div>
        ) : (
          <div className="content-grid">
            {contents.map(function(content) {
              return (
                <div key={content.id} className="content-item glow-card">
                  <div className="content-item-header">
                    <h3>{content.title}</h3>
                    {getStatusBadge(content.status)}
                  </div>
                  <p className="content-type">Type: {getContentTypeLabel(content.content_type)}</p>
                  <p className="content-preview">
                    {content.content && content.content.substring(0, 150)}...
                  </p>
                  <div className="content-actions">
                    {content.status !== 'published' && (
                      <button 
                        className="glow-btn glow-btn-small" 
                        onClick={function() { handlePublish(content.id); }}
                      >
                        Publish
                      </button>
                    )}
                    <button 
                      className="glow-btn glow-btn-small glow-btn-secondary" 
                      onClick={function() { handleEdit(content); }}
                    >
                      Edit
                    </button>
                    <button 
                      className="glow-btn glow-btn-small danger" 
                      onClick={function() { handleDelete(content.id); }}
                    >
                      Delete
                    </button>
                  </div>
                  <small className="content-meta">
                    Created: {new Date(content.created_at).toLocaleDateString()}
                    {content.published_at && ' | Published: ' + new Date(content.published_at).toLocaleDateString()}
                  </small>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ContentManagement;