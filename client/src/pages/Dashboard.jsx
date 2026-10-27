import React from 'react';
import ITDashboard from './ITDashboard';
import BusinessDashboard from './BusinessDashboard';

// IT accounts (role "admin") get the IT console.
// Customers and business staff (marketing, pricing, finance) get the business dashboard.
const Dashboard = () => {
  const userRole = localStorage.getItem('userRole');
  return userRole === 'admin' ? <ITDashboard /> : <BusinessDashboard />;
};

export default Dashboard;
