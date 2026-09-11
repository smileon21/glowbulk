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
import CustomerProfile from './pages/CustomerProfile';
import AdminProfile from './pages/AdminProfile';
import ContentManagement from './pages/ContentManagement';
import FuelRequests from './pages/FuelRequests';
import Quotations from './pages/Quotations';
import Orders from './pages/Orders';
import CreateOrder from './pages/CreateOrder';
import Announcements from './pages/Announcements';
import Security from './pages/Security';

import './App.css';

// =====================================================
// PROTECTED ROUTE
// =====================================================
const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
};

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
// SIDEBAR
// =====================================================
const Sidebar = ({ userRole, handleLogout, sidebarOpen, setSidebarOpen }) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef(null);
  const location = useLocation();
  const userName = localStorage.getItem('userName');

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (profileRef.current && !profileRef.current.contains(event.target)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    setSidebarOpen(false);
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
            <span className="sidebar-link-icon">{item.icon}</span>
            <span>{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="sidebar-profile" ref={profileRef}>
        {profileOpen && (
          <div className="sidebar-profile-menu">
            <Link to="/profile" className="dropdown-item" onClick={() => setProfileOpen(false)}>
               My Profile
            </Link>
            <div className="dropdown-divider"></div>
            <button className="dropdown-item dropdown-logout" onClick={handleLogout}>
               Logout
            </button>
          </div>
        )}
        <button className="sidebar-profile-toggle" onClick={() => setProfileOpen(!profileOpen)}>
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

    // Listen for storage events (cross-tab) and custom auth state changes (same-tab)
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
    
    // Dispatch state update
    window.dispatchEvent(new Event('authChange'));
    window.location.href = '/login';
  };

  return (
    <Router>
      {isAuthenticated ? (
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
                <Route path="*" element={<Navigate to="/dashboard" replace />} />
              </Routes>
            </main>
            <Footer />
          </div>
        </div>
      ) : (
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
      )}
    </Router>
  );
}

export default App;