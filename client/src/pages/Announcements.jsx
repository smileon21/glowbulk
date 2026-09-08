import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE_URL } from '../config';

var FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'announcement', label: 'Announcements' },
  { key: 'faq', label: 'FAQs' },
  { key: 'fuel_info', label: 'Fuel Info' },
  { key: 'policy', label: 'Policies' },
  { key: 'news', label: 'News' },
];

var TYPE_LABELS = {
  announcement: ' Announcement',
  faq: ' FAQ',
  fuel_info: ' Fuel Info',
  policy: ' Policy',
  news: ' News',
};

var Announcements = function() {
  var [items, setItems] = useState([]);
  var [loading, setLoading] = useState(true);
  var [error, setError] = useState('');
  var [activeFilter, setActiveFilter] = useState('all');

  useEffect(function() {
    fetchAnnouncements();
  }, []);

  var fetchAnnouncements = async function() {
    try {
      var response = await axios.get(API_BASE_URL + '/api/content/published');
      if (response.data.success) {
        setItems(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching announcements:', err);
      setError('Unable to load news and updates right now.');
    } finally {
      setLoading(false);
    }
  };

  var formatDate = function(dateString) {
    if (!dateString) return 'Not specified';
    var date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid date';
    return date.toLocaleDateString('en-ZW', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  var filteredItems =
    activeFilter === 'all'
      ? items
      : items.filter(function(item) {
          return item.content_type === activeFilter;
        });

  if (loading) {
    return <div className="loading">Loading updates...</div>;
  }

  return (
    <div className="announcements-page">
      <div className="page-header">
        <h2>News & Updates</h2>
      </div>

      {error && <div className="error-message">{error}</div>}

      <div className="announcements-filters">
        {FILTERS.map(function(filter) {
          return (
            <button
              key={filter.key}
              className={'filter-chip ' + (activeFilter === filter.key ? 'active' : '')}
              onClick={function() { setActiveFilter(filter.key); }}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      {filteredItems.length === 0 ? (
        <div className="glow-card no-content">
          <p>No updates in this category yet.</p>
        </div>
      ) : (
        <div className="announcements-grid">
          {filteredItems.map(function(item) {
            return (
              <div key={item.id} className="announcement-card">
                <div className="announcement-header">
                  <h3>{item.title}</h3>
                  <span className="content-type-tag">
                    {TYPE_LABELS[item.content_type] || item.content_type}
                  </span>
                </div>
                <p className="announcement-body">{item.content}</p>
                <div className="announcement-footer">
                  <small>Posted: {formatDate(item.published_at || item.created_at)}</small>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Announcements;