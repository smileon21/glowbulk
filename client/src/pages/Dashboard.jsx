import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_BASE_URL } from '../config';

const Dashboard = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [announcements, setAnnouncements] = useState([]);
  const [stats, setStats] = useState({
    fuelRequests: 0,
    quotations: 0,
    orders: 0,
    pendingPayments: 0,
    totalCustomers: 0,
    pendingRequests: 0
  });
  const navigate = useNavigate();

  const userRole = localStorage.getItem('userRole');
  const userName = localStorage.getItem('userName') || 'User';

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = 'Bearer ' + token;
      fetchUserData();
      fetchAnnouncements();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const response = await axios.get(API_BASE_URL + '/api/content/published');
      if (response.data.success) {
        const announcements = response.data.data.filter(function(c) {
          return c.content_type === 'announcement';
        });
        setAnnouncements(announcements.slice(0, 3));
      }
    } catch (error) {
      console.error('Error fetching announcements:', error);
    }
  };

  const fetchUserData = async () => {
    try {
      const response = await axios.get(API_BASE_URL + '/api/customers/profile/me');
      setUser(response.data.data);

      if (userRole === 'customer') {
        const requests = await axios.get(API_BASE_URL + '/api/fuel-requests/my-requests');
        const quotes = await axios.get(API_BASE_URL + '/api/quotations/my-quotations');
        const orders = await axios.get(API_BASE_URL + '/api/orders/my-orders');

        setStats({
          fuelRequests: requests.data.count || 0,
          quotations: quotes.data.count || 0,
          orders: orders.data.count || 0,
          pendingPayments: 0,
          totalCustomers: 0,
          pendingRequests: 0
        });
      } else {
        const requests = await axios.get(API_BASE_URL + '/api/fuel-requests/all');
        const quotes = await axios.get(API_BASE_URL + '/api/quotations/all');
        const orders = await axios.get(API_BASE_URL + '/api/orders/all');
        const pending = await axios.get(API_BASE_URL + '/api/orders/pending-payment');
        const customers = await axios.get(API_BASE_URL + '/api/customers');

        const pendingRequests = requests.data.data?.filter(function(r) {
          return r.status === 'pending';
        }) || [];

        setStats({
          fuelRequests: requests.data.count || 0,
          quotations: quotes.data.count || 0,
          orders: orders.data.count || 0,
          pendingPayments: pending.data.count || 0,
          totalCustomers: customers.data.count || 0,
          pendingRequests: pendingRequests.length
        });
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">Loading manifest...</div>;
  }

  // CUSTOMER DASHBOARD
  if (userRole === 'customer') {
    return (
      <div className="dashboard">
        <div className="dashboard-welcome">
          <h1>Welcome, {userName}</h1>
          <div className="role-indicator customer">
            <span>Bulk Fuel. Delivered On Time. Every Time.</span>
          </div>
        </div>

        {/* Announcements Section */}
        {announcements.length > 0 && (
          <div className="announcements-section">
            <h2>Announcements</h2>
            <div className="announcements-grid">
              {announcements.map(function(announcement) {
                return (
                  <div key={announcement.id} className="announcement-card">
                    <div className="announcement-header">
                      <h3>{announcement.title}</h3>
                    </div>
                    <p>{announcement.content}</p>
                    <div className="announcement-footer">
                     <small>Posted: {new Date(announcement.published_at || announcement.created_at).toLocaleDateString()}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Stats Cards - Delivery Tickets */}
        <div className="dashboard-stats-row">
          <div className="stat-card">
            <div className="stat-card-header">
              <h3>Fuel Requests</h3>
              <span className="ticket-tag">REQ</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{stats.fuelRequests}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate('/fuel-requests')}>
                View All →
              </button>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <h3>Quotations</h3>
              <span className="ticket-tag">QUO</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{stats.quotations}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate('/quotations')}>
                View All →
              </button>
            </div>
          </div>

          <div className="stat-card">
            <div className="stat-card-header">
              <h3>Orders</h3>
              <span className="ticket-tag">ORD</span>
            </div>
            <div className="stat-card-body">
              <div className="stat-detail-item">
                <span className="detail-label">Total</span>
                <span className="detail-value">{stats.orders}</span>
              </div>
            </div>
            <div className="stat-card-footer">
              <button className="stat-btn" onClick={() => navigate('/orders')}>
                View All →
              </button>
            </div>
          </div>
        </div>

        <div className="quick-actions">
          <h2>Quick actions</h2>
          <div className="actions-grid">
            <div className="action-card">
              <h3>New fuel request</h3>
              <p>Submit a new bulk fuel request</p>
              <button className="glow-btn" onClick={() => navigate('/fuel-requests')}>
                Request Fuel
              </button>
            </div>
            <div className="action-card">
              <h3>View quotations</h3>
              <p>Check your pending quotations</p>
              <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/quotations')}>
                View Quotes
              </button>
            </div>
            <div className="action-card">
              <h3>Track orders</h3>
              <p>Monitor your order status</p>
              <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/orders')}>
                Track Orders
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ADMIN DASHBOARD
  return (
    <div className="dashboard">
      <div className="dashboard-welcome">
        <h1>Welcome, {userName}</h1>
        <div className={'role-indicator ' + userRole}>
          <span>Marketing console — manage fuel sales and delivery requests</span>
        </div>
      </div>

      {/* Announcements Section - Also show on admin dashboard */}
      {announcements.length > 0 && (
        <div className="announcements-section">
          <h2>Announcements</h2>
          <div className="announcements-grid">
            {announcements.map(function(announcement) {
              return (
                <div key={announcement.id} className="announcement-card">
                  <div className="announcement-header">
                    <h3>{announcement.title}</h3>
                  </div>
                  <p>{announcement.content}</p>
                  <div className="announcement-footer">
                    <small>Posted: {new Date(announcement.published_at).toLocaleDateString()}</small>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="dashboard-stats-row marketing-stats-row">
        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total Customers</h3>
            <span className="ticket-tag">CUST</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.totalCustomers}</span>
            </div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn">View All →</button>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Pending Requests</h3>
            <span className="ticket-tag">REQ</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.pendingRequests}</span>
            </div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/fuel-requests')}>
              Review →
            </button>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Pending Payments</h3>
            <span className="ticket-tag">PAY</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.pendingPayments}</span>
            </div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/orders')}>
              Verify →
            </button>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <h3>Total Orders</h3>
            <span className="ticket-tag">ORD</span>
          </div>
          <div className="stat-card-body">
            <div className="stat-detail-item">
              <span className="detail-label">Total</span>
              <span className="detail-value">{stats.orders}</span>
            </div>
          </div>
          <div className="stat-card-footer">
            <button className="stat-btn" onClick={() => navigate('/orders')}>
              View All →
            </button>
          </div>
        </div>
      </div>

      <div className="quick-actions">
        <h2>Accounting actions</h2>
        <div className="actions-grid">
          <div className="action-card">
            <h3>Review requests</h3>
            <p>View and respond to customer fuel requests</p>
            <button className="glow-btn" onClick={() => navigate('/fuel-requests')}>
              Review Requests
            </button>
          </div>
          <div className="action-card">
            <h3>Create quotation</h3>
            <p>Generate quotations for customers</p>
            <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/quotations')}>
              Create Quote
            </button>
          </div>
          <div className="action-card">
            <h3>Confirm payments</h3>
            <p>Verify and confirm customer payments</p>
            <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/orders')}>
              Confirm Payments
            </button>
          </div>
          <div className="action-card">
            <h3>Update content</h3>
            <p>Manage website content and announcements</p>
            <button className="glow-btn glow-btn-secondary" onClick={() => navigate('/content')}>
              Manage Content
            </button>
          </div>
        </div>
      </div>

      <div className="recent-activity">
        <h2>Recent activity</h2>
        <div className="activity-list glow-card">
          <p>New fuel request from customer</p>
          <p>Payment confirmed for order #ORD-20260831-1410</p>
          <p>Quotation sent to customer</p>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;