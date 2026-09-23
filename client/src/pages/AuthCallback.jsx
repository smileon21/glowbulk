import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

// Decode JWT payload without verifying signature (safe for reading claims)
const decodeJwt = (token) => {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    return JSON.parse(jsonPayload);
  } catch (err) {
    console.error('Failed to decode JWT:', err);
    return null;
  }
};

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);

    // Read app_jwt (your backend's JWT) — fall back to session_jwt for safety
    const appJwt = params.get('app_jwt') || params.get('session_jwt');

    if (!appJwt) {
      navigate('/login?error=auth_failed', { replace: true });
      return;
    }

    const payload = decodeJwt(appJwt);

    // Store token under the key your app uses ('token')
    localStorage.setItem('token', appJwt);

    // Store user info for the UI
    if (payload) {
      localStorage.setItem('userRole', payload.role || 'customer');
      localStorage.setItem('userId', String(payload.id || ''));
      localStorage.setItem('userEmail', payload.email || '');
      if (payload.first_name) localStorage.setItem('firstName', payload.first_name);
      if (payload.last_name) localStorage.setItem('lastName', payload.last_name);
      localStorage.setItem(
        'userName',
        `${payload.first_name || ''} ${payload.last_name || ''}`.trim()
      );
    } else {
      localStorage.setItem('userRole', 'customer');
    }

    // Notify App.jsx that auth state just changed (same-tab)
    window.dispatchEvent(new Event('authChange'));

    // Redirect user to dashboard
    navigate('/dashboard', { replace: true });
  }, [location, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h2>Authenticating...</h2>
      <p>Please wait while we log you in.</p>
    </div>
  );
}