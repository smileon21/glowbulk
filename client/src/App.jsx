import React, { useEffect, useState, useRef } from 'react';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
} from 'react-router-dom';

import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import Register from './pages/Register';
import AuthCallback from './pages/AuthCallback';
import CustomerProfile from './pages/CustomerProfile';
import AdminProfile from './pages/AdminProfile';
import ContentManagement from './pages/ContentManagement';
import FuelRequests from './pages/FuelRequests';
import Quotations from './pages/Quotations';
import Orders from './pages/Orders';
import CreateOrder from './pages/CreateOrder';
import Announcements from './pages/Announcements';
import Security from './pages/Security';
import UploadProof from './pages/UploadProof';
import NotificationBell from './components/NotificationBell';
import { formatName } from './utils/format';

import './App.css';

// =====================================================
// ROLE PROTECTED ROUTE
// =====================================================
const RoleProtectedRoute = ({ children, allowedRoles }) => {
  const userRole = localStorage.getItem('userRole');
  if (!allowedRoles.includes(userRole)) {
    return <Navigate to="/dashboard" replace />;
  }
  return children;
};

// =====================================================
// PROFILE ROUTE (Role-Based)
// =====================================================
const ProfileRoute = () => {
  const userRole = localStorage.getItem('userRole');
  if (userRole === 'admin' || userRole === 'marketing') {
    return <AdminProfile />;
  }
  return <CustomerProfile />;
};

// =====================================================
// MENU ICONS
// =====================================================
const ProfileIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="8" r="4" />
    <path d="M4 21a8 8 0 0 1 16 0" />
  </svg>
);

const LogoutIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <path d="M16 17l5-5-5-5" />
    <path d="M21 12H9" />
  </svg>
);

// =====================================================
// SIDEBAR
// =====================================================
const Sidebar = ({ userRole, handleLogout, sidebarOpen, setSidebarOpen }) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const location = useLocation();
  const userName = formatName(localStorage.getItem('userName'));
  const userEmail = localStorage.getItem('userEmail');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === 'Escape') setProfileOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
    setProfileOpen(false);
  }, [location.pathname, setSidebarOpen]);

  const navItems = [
    { to: '/dashboard', label: 'Dashboard' },
    { to: '/announcements', label: 'News & Updates' },
    { to: '/profile', label: 'Profile' },
    { to: '/security', label: 'Security' },
    { to: '/fuel-requests', label: 'Fuel Requests' },
    { to: '/quotations', label: 'Quotations' },
    { to: '/orders', label: 'Orders' },
  ];

  if (userRole === 'admin' || userRole === 'marketing') {
    navItems.push({ to: '/content', label: 'Content' });
  }

  if (userRole === 'customer') {
    navItems.push({ to: '/create-order', label: 'Create Order' });
  }

  return (
    <aside className={`glow-sidebar ${sidebarOpen ? 'open' : ''}`}>
      <Link to="/dashboard" className="sidebar-logo">
        <img src="/logo.png" alt="GLOW PETROLEUM" className="sidebar-logo-image" />
        <div className="sidebar-logo-text-wrapper">
          <h1 className="sidebar-logo-text">
            GLOW<span className="logo-highlight">BULK</span>
          </h1>
          <p className="sidebar-logo-tagline">We Go Further...</p>
        </div>
      </Link>

      <nav className="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            className={`sidebar-link ${location.pathname === item.to ? 'active' : ''}`}
          >
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-profile" ref={profileRef}>
        {profileOpen && (
          <div className="sidebar-profile-menu" role="menu">
            <div className="menu-head">
              <span className="menu-head-label">Signed in as</span>
              <span className="menu-head-email">{userEmail || userName || 'User'}</span>
            </div>

            <Link
              to="/profile"
              className="dropdown-item"
              role="menuitem"
              onClick={() => setProfileOpen(false)}
            >
              <span className="menu-icon"><ProfileIcon /></span>
              <span className="menu-label">My Profile</span>
            </Link>

            <div className="dropdown-divider" />

            <button
              type="button"
              className="dropdown-item dropdown-logout"
              role="menuitem"
              onClick={handleLogout}
            >
              <span className="menu-icon"><LogoutIcon /></span>
              <span className="menu-label">Log out</span>
              <span className="menu-hint">End session</span>
            </button>
          </div>
        )}
        <button
          type="button"
          className="sidebar-profile-toggle"
          onClick={() => setProfileOpen((prev) => !prev)}
          aria-haspopup="menu"
          aria-expanded={profileOpen}
        >
          <span className="user-avatar">
            {userName ? userName.charAt(0).toUpperCase() : 'U'}
          </span>
          <span className="sidebar-profile-info">
            <span className="sidebar-profile-name">{userName || 'User'}</span>
            <span className="sidebar-profile-role">{userRole || 'Customer'}</span>
          </span>
          <span className={`dropdown-arrow ${profileOpen ? 'open' : ''}`}>▼</span>
        </button>
      </div>
    </aside>
  );
};

// =====================================================
// MOBILE TOPBAR
// =====================================================
const MobileTopbar = ({ setSidebarOpen }) => (
  <header className="mobile-topbar">
    <button
      className="mobile-topbar-toggle"
      onClick={() => setSidebarOpen((prev) => !prev)}
      aria-label="Toggle menu"
    >
      ☰
    </button>
    <div className="mobile-topbar-logo">
      GLOW<span className="logo-highlight">BULK</span>
    </div>
    <span className="mobile-topbar-spacer" />
  </header>
);

// =====================================================
// FOOTER
// =====================================================
const Footer = () => (
  <footer className="glow-footer">
    <div className="footer-content">
      <p className="footer-text">&copy; 2026 GLOW PETROLEUM. All rights reserved.</p>
      <p className="footer-website">
        <a href="https://www.glowpetroleum.com" target="_blank" rel="noopener noreferrer">
          www.glowpetroleum.com
        </a>
      </p>
      <p className="footer-tagline">We Go Further...</p>
    </div>
  </footer>
);

// =====================================================
// AUTHENTICATED LAYOUT
// =====================================================
const AuthenticatedLayout = ({ userRole, handleLogout, sidebarOpen, setSidebarOpen }) => (
  <div className="App app-with-sidebar">
    <MobileTopbar setSidebarOpen={setSidebarOpen} />

    <Sidebar
      userRole={userRole}
      handleLogout={handleLogout}
      sidebarOpen={sidebarOpen}
      setSidebarOpen={setSidebarOpen}
    />

    {sidebarOpen && (
      <div className="sidebar-overlay open" onClick={() => setSidebarOpen(false)} />
    )}

    <div className="main-wrapper">
      <NotificationBell />
      <main className="glow-container">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="/register" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/announcements" element={<Announcements />} />
          <Route path="/profile" element={<ProfileRoute />} />
          <Route path="/security" element={<Security />} />
          <Route path="/fuel-requests" element={<FuelRequests />} />
          <Route path="/quotations" element={<Quotations />} />
          <Route path="/orders" element={<Orders />} />

          <Route
            path="/create-order"
            element={
              <RoleProtectedRoute allowedRoles={['customer']}>
                <CreateOrder />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/content"
            element={
              <RoleProtectedRoute allowedRoles={['admin', 'marketing']}>
                <ContentManagement />
              </RoleProtectedRoute>
            }
          />

          <Route
            path="/upload-proof/:orderId"
            element={
              <RoleProtectedRoute allowedRoles={['customer']}>
                <UploadProof />
              </RoleProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </main>
      <Footer />
    </div>
  </div>
);

// =====================================================
// GUEST LAYOUT
// =====================================================
const GuestLayout = () => (
  <div className="App guest-app">
    <header className="guest-header">
      <Link to="/login" className="guest-logo">
        <img src="/logo.png" alt="GLOW PETROLEUM" className="header-logo-image" />
        <div className="logo-text-wrapper">
          <h1 className="logo-text">
            GLOW<span className="logo-highlight">BULK</span>
          </h1>
          <p className="logo-tagline">We Go Further...</p>
        </div>
      </Link>
    </header>

    <main className="glow-container">
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </main>

    <Footer />
  </div>
);

// =====================================================
// MAIN APP
// =====================================================
function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(
    !!localStorage.getItem('token')
  );
  const [userRole, setUserRole] = useState(localStorage.getItem('userRole'));
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const checkAuthentication = () => {
    const token = localStorage.getItem('token');
    const role = localStorage.getItem('userRole');
    setIsAuthenticated(!!token);
    setUserRole(role);
  };

  useEffect(() => {
    checkAuthentication();

    window.addEventListener('storage', checkAuthentication);
    window.addEventListener('authChange', checkAuthentication);

    return () => {
      window.removeEventListener('storage', checkAuthentication);
      window.removeEventListener('authChange', checkAuthentication);
    };
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userName');
    localStorage.removeItem('userEmail');

    window.dispatchEvent(new Event('authChange'));
    window.location.href = '/login';
  };

  return (
    <Router>
      <Routes>
        {/* Callback always runs, regardless of auth state */}
        <Route path="/auth/callback" element={<AuthCallback />} />

        {/* Everything else splits by auth state */}
        <Route
          path="*"
          element={
            isAuthenticated ? (
              <AuthenticatedLayout
                userRole={userRole}
                handleLogout={handleLogout}
                sidebarOpen={sidebarOpen}
                setSidebarOpen={setSidebarOpen}
              />
            ) : (
              <GuestLayout />
            )
          }
        />
      </Routes>
    </Router>
  );
}

export default App;
