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
import Accounts from './pages/Accounts';
import ActivityLog from './pages/ActivityLog';
import NotificationBell from './components/NotificationBell';
import { formatName } from './utils/format';

import './App.css';

// =====================================================
// ROLE GROUPS
// "admin" is the value stored in the database; on screen it is called IT.
// IT only sees the IT console. Business pages are for customers and business staff.
// =====================================================
const IT_ROLES = ['admin'];
const STAFF_BUSINESS_ROLES = ['marketing', 'pricing', 'finance'];
const BUSINESS_ROLES = ['customer', ...STAFF_BUSINESS_ROLES];

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
  if (userRole !== 'customer') {
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

const roleLabel = (role) => (role === 'admin' ? 'IT' : role);

// =====================================================
// SIDEBAR
// =====================================================
const Sidebar = ({ userRole, handleLogout, sidebarOpen, setSidebarOpen }) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const location = useLocation();
  const userName = formatName(localStorage.getItem('userName'));
  const userEmail = localStorage.getItem('userEmail');
  const isIT = IT_ROLES.includes(userRole);
  const isStaff = STAFF_BUSINESS_ROLES.includes(userRole);

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

  // IT gets only IT tools. Everyone else gets the business menu.
  // Customers see "Get a Quote" (opens the request form straight away).
  // Staff keep "Fuel Requests" (the list of incoming requests).
  // No "Create Order" link: orders are created from an accepted quotation
  // on the Quotations page (the /create-order route still exists for that).
  const navItems = isIT
    ? [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/accounts', label: 'Accounts' },
        { to: '/activity-log', label: 'Activity Log' },
        { to: '/profile', label: 'Profile' },
        { to: '/security', label: 'Security' },
      ]
    : [
        { to: '/dashboard', label: 'Dashboard' },
        { to: '/announcements', label: 'News & Updates' },
        { to: '/profile', label: 'Profile' },
        { to: '/security', label: 'Security' },
        { to: '/fuel-requests', label: isStaff ? 'Fuel Requests' : 'Get a Quote' },
        { to: '/quotations', label: 'Quotations' },
        { to: '/orders', label: 'Orders' },
        ...(userRole === 'marketing' ? [{ to: '/content', label: 'Content' }] : []),
      ];

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
            <span className="sidebar-profile-role">{roleLabel(userRole) || 'Customer'}</span>
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

          {/* Shared by every role: Dashboard shows the IT console or the business view */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/profile" element={<ProfileRoute />} />
          <Route path="/security" element={<Security />} />

          {/* IT only */}
          <Route
            path="/accounts"
            element={
              <RoleProtectedRoute allowedRoles={IT_ROLES}>
                <Accounts />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/activity-log"
            element={
              <RoleProtectedRoute allowedRoles={IT_ROLES}>
                <ActivityLog />
              </RoleProtectedRoute>
            }
          />

          {/* Business pages: customers and business staff, never IT */}
          <Route
            path="/announcements"
            element={
              <RoleProtectedRoute allowedRoles={BUSINESS_ROLES}>
                <Announcements />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/fuel-requests"
            element={
              <RoleProtectedRoute allowedRoles={BUSINESS_ROLES}>
                <FuelRequests />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/quotations"
            element={
              <RoleProtectedRoute allowedRoles={BUSINESS_ROLES}>
                <Quotations />
              </RoleProtectedRoute>
            }
          />
          <Route
            path="/orders"
            element={
              <RoleProtectedRoute allowedRoles={BUSINESS_ROLES}>
                <Orders />
              </RoleProtectedRoute>
            }
          />

          {/* Marketing only */}
          <Route
            path="/content"
            element={
              <RoleProtectedRoute allowedRoles={['marketing']}>
                <ContentManagement />
              </RoleProtectedRoute>
            }
          />

          {/* Customers only */}
          <Route
            path="/create-order"
            element={
              <RoleProtectedRoute allowedRoles={['customer']}>
                <CreateOrder />
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
