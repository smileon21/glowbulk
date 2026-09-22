import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const sessionJwt = params.get('session_jwt');

    if (sessionJwt) {
      // Save session info to localStorage
      localStorage.setItem('token', sessionJwt);
      localStorage.setItem('userRole', 'customer'); // Default role if not provided in URL
      
      // Notify App state listener to switch from guest to authenticated view
      window.dispatchEvent(new Event('authChange'));

      // Redirect user to dashboard
      navigate('/dashboard', { replace: true });
    } else {
      // Redirect back to login if missing session_jwt
      navigate('/login?error=auth_failed', { replace: true });
    }
  }, [location, navigate]);

  return (
    <div style={{ textAlign: 'center', padding: '50px' }}>
      <h2>Authenticating...</h2>
      <p>Please wait while we log you in.</p>
    </div>
  );
}