import React from 'react';
import ITDashboard from './ITDashboard';
import BusinessDashboard from './BusinessDashboard';
import MarketingDashboard from './MarketingDashboard';

// IT accounts (role "admin") get the IT console.
// Customers get the customer dashboard.
// Marketing and pricing get the marketing dashboard.
// (Finance has its own dashboard, chosen in App.jsx.)
const Dashboard = () => {
  const userRole = localStorage.getItem('userRole');
  if (userRole === 'admin') return <ITDashboard />;
  if (userRole === 'customer') return <BusinessDashboard />;
  return <MarketingDashboard />;
};

export default Dashboard;
