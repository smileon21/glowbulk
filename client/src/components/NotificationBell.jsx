
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';
import { enablePush } from './push';

const POLL_MS = 30000;
const CAN_NOTIFY =
  typeof window !== 'undefined' && 'Notification' in window;

const authConfig = () => ({
  headers: {
    Authorization: 'Bearer ' + localStorage.getItem('token')
  }
});

function timeAgo(iso) {
  const seconds = Math.floor(
    (Date.now() - new Date(iso).getTime()) / 1000
  );

  if (!Number.isFinite(seconds) || seconds < 0) return 'Just now';
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return Math.floor(seconds / 60) + 'm ago';
  if (seconds < 86400) return Math.floor(seconds / 3600) + 'h ago';
  return Math.floor(seconds / 86400) + 'd ago';
}

function getNotificationIcon(type = '') {
  const value = String(type).toLowerCase();

  if (value.includes('invoice')) return '▤';
  if (value.includes('payment')) return '✓';
  if (value.includes('quotation') || value.includes('quote')) return '▧';
  if (value.includes('order')) return '▣';
  return '●';
}

const NotificationBell = () => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [permission, setPermission] = useState(
    CAN_NOTIFY ? Notification.permission : 'unsupported'
  );
  const [deletingIds, setDeletingIds] = useState([]);
  const [clearing, setClearing] = useState(false);
  const [actionError, setActionError] = useState('');

  const wrapRef = useRef(null);
  const lastIdRef = useRef(null);
  const navigate = useNavigate();
  const location = useLocation();

  const storageKey =
    'glowbulk_last_notif_id_' +
    (localStorage.getItem('userEmail') || 'user');

  const showDesktopAlert = useCallback((n) => {
    if (!CAN_NOTIFY || Notification.permission !== 'granted') return;

    try {
      const toast = new Notification(n.title, {
        body: n.message + ' Open GlowBulk to see it.',
        tag: 'glowbulk-' + n.id
      });

      toast.onclick = () => {
        window.focus();
        if (n.link) navigate(n.link);
        toast.close();
      };
    } catch (error) {
      // The in-app notification bell remains available.
    }
  }, [navigate]);

  const load = useCallback(async () => {
    try {
      const res = await axios.get(
        API_BASE_URL + '/api/notifications',
        authConfig()
      );

      if (!res.data.success) return;

      const list = res.data.data || [];
      setItems(list);
      setUnread(Number(res.data.unread) || 0);

      const maxId = list.reduce(
        (max, n) => Math.max(max, Number(n.id) || 0),
        0
      );

      if (lastIdRef.current === null) {
        const stored = localStorage.getItem(storageKey);

        lastIdRef.current =
          stored !== null ? Number(stored) : maxId;

        if (stored === null) {
          localStorage.setItem(storageKey, String(maxId));
        }
      }

      const fresh = list
        .filter(
          n =>
            Number(n.id) > lastIdRef.current &&
            !n.is_read
        )
        .sort((a, b) => Number(a.id) - Number(b.id));

      if (fresh.length > 0) {
        lastIdRef.current = Math.max(lastIdRef.current, maxId);
        localStorage.setItem(storageKey, String(lastIdRef.current));
        fresh.slice(-3).forEach(showDesktopAlert);
      }
    } catch (error) {
      // Retry during the next scheduled refresh.
    }
  }, [showDesktopAlert, storageKey]);

  useEffect(() => {
    load();
    const id = setInterval(load, POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    load();
  }, [location.pathname, load]);

  useEffect(() => {
    if (!open) return undefined;

    const onDown = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
      }
    };

    const onKeyDown = event => {
      if (event.key === 'Escape') setOpen(false);
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const handleItemClick = async n => {
    setActionError('');

    if (!n.is_read) {
      setItems(prev =>
        prev.map(item =>
          item.id === n.id ? { ...item, is_read: true } : item
        )
      );
      setUnread(count => Math.max(0, count - 1));

      try {
        const res = await axios.put(
          API_BASE_URL + '/api/notifications/' + n.id + '/read',
          {},
          authConfig()
        );

        if (!res.data.success) throw new Error('Could not mark as read');
      } catch (error) {
        load();
      }
    }

    setOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    setActionError('');

    const previousItems = items;
    const previousUnread = unread;

    setItems(prev => prev.map(item => ({ ...item, is_read: true })));
    setUnread(0);

    try {
      await axios.put(
        API_BASE_URL + '/api/notifications/read-all',
        {},
        authConfig()
      );
    } catch (error) {
      setItems(previousItems);
      setUnread(previousUnread);
      setActionError('Could not mark notifications as read. Please try again.');
    }
  };

  const deleteNotification = async (event, n) => {
    event.preventDefault();
    event.stopPropagation();

    if (deletingIds.includes(n.id)) return;

    setActionError('');
    setDeletingIds(prev => [...prev, n.id]);

    try {
      await axios.delete(
        API_BASE_URL + '/api/notifications/' + n.id,
        authConfig()
      );

      setItems(prev => prev.filter(item => item.id !== n.id));

      if (!n.is_read) {
        setUnread(prev => Math.max(0, prev - 1));
      }
    } catch (error) {
      setActionError('Could not delete this notification. Please try again.');
    } finally {
      setDeletingIds(prev => prev.filter(id => id !== n.id));
    }
  };

  const clearAllNotifications = async () => {
    if (items.length === 0 || clearing) return;

    const confirmed = window.confirm(
      'Delete all your notifications? This cannot be undone.'
    );

    if (!confirmed) return;

    setActionError('');
    setClearing(true);

    try {
      await axios.delete(
        API_BASE_URL + '/api/notifications',
        authConfig()
      );

      setItems([]);
      setUnread(0);
    } catch (error) {
      setActionError('Could not clear notifications. Please try again.');
    } finally {
      setClearing(false);
    }
  };

  const turnOnDesktopAlerts = () => {
    if (!CAN_NOTIFY) return;

    Notification.requestPermission().then(result => {
      setPermission(result);

      if (result === 'granted') {
        enablePush().catch(() => {});
        showDesktopAlert({
          id: 'welcome-' + Date.now(),
          title: 'GlowBulk',
          message: 'Desktop alerts are on.',
          link: null
        });
      }
    });
  };

  const sendTestAlert = () => {
    showDesktopAlert({
      id: 'test-' + Date.now(),
      title: 'GlowBulk test',
      message: 'Desktop alerts are working.',
      link: null
    });
  };

  return (
    <div className="notif-bar">
      <div className="notif-wrap" ref={wrapRef}>
        <button
          type="button"
          className="notif-btn"
          aria-label={'Notifications' + (unread ? ', ' + unread + ' unread' : '')}
          aria-expanded={open}
          onClick={() => {
            setOpen(prev => !prev);

            if (!open) {
              load();
              setActionError('');
              if (CAN_NOTIFY) setPermission(Notification.permission);
            }
          }}
        >
          <svg
            width="21"
            height="21"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
            <path d="M13.7 21a2 2 0 0 1-3.4 0" />
          </svg>

          {unread > 0 && (
            <span className="notif-badge">
              {unread > 99 ? '99+' : unread}
            </span>
          )}
        </button>

        {open && (
          <section
            className="notif-panel"
            role="dialog"
            aria-label="Notifications"
          >
            <header className="notif-panel-header">
              <div className="notif-heading">
                <span className="notif-heading-icon">♧</span>
                <div>
                  <h4>Notifications</h4>
                  <p>
                    {unread > 0
                      ? `${unread} unread notification${unread === 1 ? '' : 's'}`
                      : "You're all caught up"}
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="notif-close-btn"
                aria-label="Close notifications"
                onClick={() => setOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="notif-toolbar">
              <span className="notif-toolbar-label">RECENT ACTIVITY</span>

              <div className="notif-toolbar-actions">
                {unread > 0 && (
                  <button
                    type="button"
                    className="notif-text-action"
                    onClick={markAllRead}
                  >
                    Mark all read
                  </button>
                )}

                {items.length > 0 && (
                  <button
                    type="button"
                    className="notif-text-action notif-clear-action"
                    onClick={clearAllNotifications}
                    disabled={clearing}
                  >
                    {clearing ? 'Clearing…' : 'Clear all'}
                  </button>
                )}
              </div>
            </div>

            {permission === 'default' && (
              <div className="notif-enable">
                <span>Get desktop alerts for new updates.</span>
                <button type="button" onClick={turnOnDesktopAlerts}>
                  Enable alerts
                </button>
              </div>
            )}

            {permission === 'granted' && (
              <div className="notif-enable muted">
                <span>Desktop alerts are enabled.</span>
                <button type="button" onClick={sendTestAlert}>
                  Test alert
                </button>
              </div>
            )}

            {permission === 'denied' && (
              <div className="notif-enable muted">
                <span>
                  Desktop alerts are blocked. Change Notification permissions
                  in your browser's site settings.
                </span>
              </div>
            )}

            {actionError && (
              <div className="notif-error" role="alert">
                {actionError}
              </div>
            )}

            {items.length === 0 ? (
              <div className="notif-empty-state">
                <span className="notif-empty-icon">✓</span>
                <strong>All caught up!</strong>
                <p>New invoices, payments and quotation updates will appear here.</p>
              </div>
            ) : (
              <ul className="notif-list">
                {items.map(n => (
                  <li
                    key={n.id}
                    className={'notif-row ' + (!n.is_read ? 'notif-row-unread' : '')}
                  >
                    <span
                      className={
                        'notif-type-icon notif-type-' +
                        String(n.type || 'general')
                          .toLowerCase()
                          .replace(/[^a-z0-9_-]/g, '-')
                      }
                      aria-hidden="true"
                    >
                      {getNotificationIcon(n.type)}
                    </span>

                    <button
                      type="button"
                      className={'notif-item ' + (!n.is_read ? 'unread' : '')}
                      onClick={() => handleItemClick(n)}
                    >
                      <span className="notif-item-topline">
                        <span className="notif-item-title">{n.title}</span>
                        {!n.is_read && (
                          <span className="notif-unread-dot" aria-label="Unread" />
                        )}
                      </span>

                      <span className="notif-item-msg">{n.message}</span>
                      <span className="notif-item-time">
                        {timeAgo(n.created_at)}
                      </span>
                    </button>

                    <button
                      type="button"
                      className="notif-delete-btn"
                      aria-label={'Delete notification: ' + n.title}
                      title="Delete notification"
                      disabled={deletingIds.includes(n.id) || clearing}
                      onClick={event => deleteNotification(event, n)}
                    >
                      {deletingIds.includes(n.id) ? '…' : '×'}
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <footer className="notif-panel-footer">
              <span>GLOWBULK</span>
              <span>Updates for your business</span>
            </footer>
          </section>
        )}
      </div>
    </div>
  );
};

export default NotificationBell;
