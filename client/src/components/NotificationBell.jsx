// src/components/NotificationBell.jsx
// The bell in the top-right of every logged-in page. Polls the backend every 30 seconds.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const POLL_MS = 30000;

const authConfig = () => ({
  headers: { Authorization: 'Bearer ' + localStorage.getItem('token') }
});

function timeAgo(iso) {
  var seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

const NotificationBell = () => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const load = useCallback(async function() {
    try {
      var res = await axios.get(API_BASE_URL + '/api/notifications', authConfig());
      if (res.data.success) {
        setItems(res.data.data);
        setUnread(res.data.unread);
      }
    } catch (error) {
      // Stay quiet; we will try again on the next check
    }
  }, []);

  // Check now, then every 30 seconds while the tab is visible
  useEffect(function() {
    load();
    var id = setInterval(function() {
      if (document.visibilityState === 'visible') load();
    }, POLL_MS);
    return function() { clearInterval(id); };
  }, [load]);

  // Also check whenever the person moves to another page
  useEffect(function() {
    load();
  }, [location.pathname, load]);

  // Close the dropdown when clicking elsewhere
  useEffect(function() {
    if (!open) return undefined;
    var onDown = function(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return function() { document.removeEventListener('mousedown', onDown); };
  }, [open]);

  var handleItemClick = function(n) {
    if (!n.is_read) {
      setItems(function(prev) {
        return prev.map(function(x) { return x.id === n.id ? { ...x, is_read: true } : x; });
      });
      setUnread(function(u) { return Math.max(0, u - 1); });
      axios.put(API_BASE_URL + '/api/notifications/' + n.id + '/read', {}, authConfig()).catch(function() {});
    }
    setOpen(false);
    if (n.link) navigate(n.link);
  };

  var markAllRead = function() {
    setItems(function(prev) { return prev.map(function(x) { return { ...x, is_read: true }; }); });
    setUnread(0);
    axios.put(API_BASE_URL + '/api/notifications/read-all', {}, authConfig()).catch(function() {});
  };

  return (
    <div className="notif-bar">
      <div className="notif-wrap" ref={wrapRef}>
        <button
          type="button"
          className="notif-btn"
          aria-label={'Notifications' + (unread ? ', ' + unread + ' unread' : '')}
          onClick={function() {
            setOpen(function(o) { return !o; });
            if (!open) load();
          }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
               strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>
          {unread > 0 && <span className="notif-badge">{unread > 99 ? '99+' : unread}</span>}
        </button>

        {open && (
          <div className="notif-panel" role="menu">
            <div className="notif-panel-header">
              <h4>Notifications</h4>
              {unread > 0 && (
                <button type="button" className="notif-markall" onClick={markAllRead}>
                  Mark all read
                </button>
              )}
            </div>

            {items.length === 0 ? (
              <p className="notif-empty">You're all caught up.</p>
            ) : (
              <ul className="notif-list">
                {items.map(function(n) {
                  return (
                    <li key={n.id}>
                      <button
                        type="button"
                        className={'notif-item ' + (n.is_read ? '' : 'unread')}
                        onClick={function() { handleItemClick(n); }}
                      >
                        <span className="notif-item-title">{n.title}</span>
                        <span className="notif-item-msg">{n.message}</span>
                        <span className="notif-item-time">{timeAgo(n.created_at)}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default NotificationBell;
