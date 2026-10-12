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

/* --------------------------------------------------------------------------
   Type → icon. Each entry is a stroke-based 24x24 SVG path so the icon
   inherits the tile colour via currentColor.
   -------------------------------------------------------------------------- */
const TYPE_ICONS = {
  invoice:
    '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/>',
  payment:
    '<circle cx="12" cy="12" r="9"/><polyline points="8.5 12.5 11 15 16 9.5"/>',
  quotation:
    '<path d="M9 11H5a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5a4 4 0 0 0-4-4"/><path d="M19 11h-4a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2v-5a4 4 0 0 0-4-4"/>',
  order:
    '<path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/>',
  fuel:
    '<path d="M3 22V6a2 2 0 0 1 2-2h6a2 2 0 0 1 2 2v16"/><line x1="3" y1="10" x2="13" y2="10"/><line x1="6" y1="14" x2="10" y2="14"/><path d="M13 12h4a2 2 0 0 1 2 2v3a1.5 1.5 0 0 0 3 0V9l-3-3"/>',
  request:
    '<path d="M22 2 11 13"/><path d="M22 2 15 22l-4-9-9-4z"/>',
  general:
    '<circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>'
};

/* Normalise any backend type string to one of the keys above. */
function iconKey(type = '') {
  const value = String(type).toLowerCase();

  if (value.includes('invoice') || value.includes('billing')) return 'invoice';
  if (value.includes('payment') || value.includes('paid')) return 'payment';
  if (value.includes('quotation') || value.includes('quote')) return 'quotation';
  if (value.includes('fuel') || value.includes('request')) return 'fuel';
  if (value.includes('order') || value.includes('delivery')) return 'order';
  return 'general';
}

function TypeIcon({ type }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: TYPE_ICONS[iconKey(type)] }}
    />
  );
}

const NotificationBell = () => {
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
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

  /* Close on outside click + Esc while the dropdown is open. */
  useEffect(() => {
    if (!open) return undefined;

    const onDown = event => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setOpen(false);
        setMenuOpen(false);
      }
    };

    const onKeyDown = event => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  /* Close the “...” menu when clicking anywhere else. */
  useEffect(() => {
    if (!menuOpen) return undefined;

    const close = () => setMenuOpen(false);

    document.addEventListener('mousedown', close);

    return () => document.removeEventListener('mousedown', close);
  }, [menuOpen]);

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
    setMenuOpen(false);
    if (n.link) navigate(n.link);
  };

  const markAllRead = async () => {
    setActionError('');
    setMenuOpen(false);

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
    setMenuOpen(false);

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
              setMenuOpen(false);
              if (CAN_NOTIFY) setPermission(Notification.permission);
            }
          }}
        >
          <svg
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
            {/* Header: bell + title + “N new” badge + “...” menu */}
            <header className="notif-panel-header">
              <span className="notif-head-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.7 21a2 2 0 0 1-3.4 0" />
                </svg>
              </span>

              <h4 className="notif-title">Notifications</h4>

              {unread > 0 && (
                <span className="notif-new-badge">{unread} new</span>
              )}

              <div className="notif-menu-wrap">
                <button
                  type="button"
                  className="notif-menu-btn"
                  aria-label="Notification options"
                  aria-expanded={menuOpen}
                  onClick={event => {
                    event.stopPropagation();
                    setMenuOpen(prev => !prev);
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <circle cx="12" cy="5" r="1.8" />
                    <circle cx="12" cy="12" r="1.8" />
                    <circle cx="12" cy="19" r="1.8" />
                  </svg>
                </button>

                {menuOpen && (
                  <div
                    className="notif-menu"
                    onMouseDown={event => event.stopPropagation()}
                  >
                    {CAN_NOTIFY && permission === 'default' && (
                      <button
                        type="button"
                        className="notif-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          turnOnDesktopAlerts();
                        }}
                      >
                        Enable desktop alerts
                      </button>
                    )}

                    {CAN_NOTIFY && permission === 'granted' && (
                      <button
                        type="button"
                        className="notif-menu-item"
                        onClick={() => {
                          setMenuOpen(false);
                          sendTestAlert();
                        }}
                      >
                        Send test alert
                      </button>
                    )}

                    <button
                      type="button"
                      className="notif-menu-item notif-menu-danger"
                      onClick={clearAllNotifications}
                      disabled={clearing || items.length === 0}
                    >
                      {clearing ? 'Clearing…' : 'Clear all notifications'}
                    </button>
                  </div>
                )}
              </div>
            </header>

            {/* Sub-header: mark all read (left) + clear all (right) */}
            <div className="notif-subheader">
              <button
                type="button"
                className="notif-mark-all"
                onClick={markAllRead}
                disabled={unread === 0}
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                Mark all as read
              </button>

              <button
                type="button"
                className="notif-clear-all"
                onClick={clearAllNotifications}
                disabled={clearing || items.length === 0}
              >
                Clear all
              </button>
            </div>

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

            {/* List */}
            <div className="notif-list-wrap">
              {items.length === 0 ? (
                <div className="notif-empty-state">
                  <span className="notif-empty-icon" aria-hidden="true">
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </span>
                  <strong>All caught up!</strong>
                  <p>
                    New invoices, payments and quotation updates will appear
                    here.
                  </p>
                </div>
              ) : (
                <ul className="notif-list">
                  {items.map(n => (
                    <li
                      key={n.id}
                      className={
                        'notif-row ' + (!n.is_read ? 'notif-row-unread' : '')
                      }
                    >
                      <span
                        className={
                          'notif-type-icon notif-type-' + iconKey(n.type)
                        }
                        aria-hidden="true"
                      >
                        <TypeIcon type={n.type} />
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
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                          <line x1="10" y1="11" x2="10" y2="17" />
                          <line x1="14" y1="11" x2="14" y2="17" />
                        </svg>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <footer className="notif-panel-footer">
              <span className="notif-foot-icon" aria-hidden="true">
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
              <button type="button" className="notif-foot-link">
                Notification preferences
              </button>
            </footer>
          </section>
        )}
      </div>
    </div>
  );
};

export default NotificationBell;
