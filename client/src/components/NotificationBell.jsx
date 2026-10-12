// src/components/NotificationBell.jsx
// Bell + dropdown in the top-right of every logged-in page, plus Windows/desktop pop-ups
// while GlowBulk is open in a browser tab (the tab can be in the background or minimized).

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { enablePush } from './push';

const POLL_MS = 30000;
const CAN_NOTIFY = typeof window !== 'undefined' && 'Notification' in window;

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
  const [permission, setPermission] = useState(CAN_NOTIFY ? Notification.permission : 'unsupported');
  const wrapRef = useRef(null);
  const lastIdRef = useRef(null); // highest notification id we have already told the person about
  const navigate = useNavigate();
  const location = useLocation();

  const storageKey = 'glowbulk_last_notif_id_' + (localStorage.getItem('userEmail') || 'user');

  // Show one desktop (Windows) pop-up
  const showDesktopAlert = useCallback(function(n) {
    if (!CAN_NOTIFY || Notification.permission !== 'granted') return;
    try {
      var toast = new Notification(n.title, {
        body: n.message + ' Open GlowBulk to see it.',
        tag: 'glowbulk-' + n.id
      });
      toast.onclick = function() {
        window.focus();
        if (n.link) navigate(n.link);
        toast.close();
      };
    } catch (error) {
      // Some browsers refuse; the bell still works
    }
  }, [navigate]);

  const load = useCallback(async function() {
    try {
      var res = await axios.get(API_BASE_URL + '/api/notifications', authConfig());
      if (!res.data.success) return;

      var list = res.data.data;
      setItems(list);
      setUnread(res.data.unread);

      var maxId = list.reduce(function(m, n) { return Math.max(m, Number(n.id)); }, 0);

      // First time ever on this browser: remember where we are, don't pop up old items
      if (lastIdRef.current === null) {
        var stored = localStorage.getItem(storageKey);
        lastIdRef.current = stored !== null ? Number(stored) : maxId;
        if (stored === null) localStorage.setItem(storageKey, String(maxId));
      }

      var fresh = list
        .filter(function(n) { return Number(n.id) > lastIdRef.current && !n.is_read; })
        .sort(function(a, b) { return Number(a.id) - Number(b.id); });

      if (fresh.length > 0) {
        lastIdRef.current = maxId;
        localStorage.setItem(storageKey, String(maxId));
        fresh.slice(-3).forEach(showDesktopAlert); // at most 3 pop-ups at once
      }
    } catch (error) {
      // Stay quiet; we will try again on the next check
    }
  }, [showDesktopAlert, storageKey]);

  // Check now, then every 30 seconds (also while the tab is in the background)
  useEffect(function() {
    load();
    var id = setInterval(load, POLL_MS);
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

  // Must be triggered by a click, otherwise Chrome ignores or blocks the request
  var turnOnDesktopAlerts = function() {
    if (!CAN_NOTIFY) return;
    Notification.requestPermission().then(function(result) {
      setPermission(result);
      if (result === 'granted') {
        // Also register a real push subscription so alerts work when the tab is closed
        enablePush().catch(function() {});
        showDesktopAlert({ id: 'welcome-' + Date.now(), title: 'GlowBulk', message: 'Desktop alerts are on.', link: null });
      }
    });
  };

  var sendTestAlert = function() {
    showDesktopAlert({ id: 'test-' + Date.now(), title: 'GlowBulk test', message: 'Desktop alerts are working.', link: null });
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
            if (!open) {
              load();
              if (CAN_NOTIFY) setPermission(Notification.permission);
            }
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

            {permission === 'default' && (
              <div className="notif-enable">
                <span>Get a desktop pop-up when there is a new response.</span>
                <button type="button" onClick={turnOnDesktopAlerts}>Turn on desktop alerts</button>
              </div>
            )}
            {permission === 'granted' && (
              <div className="notif-enable muted">
                <span>Desktop alerts are on while GlowBulk is open.</span>
                <button type="button" onClick={sendTestAlert}>Send test alert</button>
              </div>
            )}
            {permission === 'denied' && (
              <div className="notif-enable muted">
                <span>
                  Desktop alerts are blocked. Click the padlock next to the web address, open Site settings,
                  set Notifications to Allow, then reload the page.
                </span>
              </div>
            )}

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