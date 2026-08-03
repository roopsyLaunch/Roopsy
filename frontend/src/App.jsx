import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { 
  LayoutDashboard, 
  Clock, 
  Users, 
  Sparkles, 
  ShoppingBag, 
  LogOut, 
  UserCheck, 
  AlertCircle, 
  Search, 
  Mail, 
  Phone, 
  CheckCircle, 
  XCircle, 
  Scissors,
  Star,
  Trash2,
  Calendar,
  ShieldAlert,
  Shield,
  Layers,
  MapPin,
  Clock3
} from 'lucide-react';

const API_BASE = "http://localhost:5000/api";

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  // Tab State: 'overview' | 'approvals' | 'partners' | 'bookings' | 'orders' | 'reviews' | 'users'
  const [activeTab, setActiveTab] = useState("overview");

  // Dashboard Stats
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalTailors: 0,
    activeTailors: 0,
    pendingTailors: 0,
    totalOrders: 0,
    totalRevenue: 0,
    platformCommission: 0
  });
  
  // Data States
  const [pendingApprovals, setPendingApprovals] = useState([]);
  const [tailors, setTailors] = useState([]);
  const [barbers, setBarbers] = useState([]);
  const [bookings, setBookings] = useState([]);
  const [orders, setOrders] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [users, setUsers] = useState([]);
  const [loadingData, setLoadingData] = useState(false);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  // Rejection Modal State
  const [rejectingId, setRejectingId] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectModal, setShowRejectModal] = useState(false);
  
  // Partner sub-tab selection: 'all' | 'barber' | 'beauty' | 'tailor'
  const [partnerSubTab, setPartnerSubTab] = useState("all");

  // Partner Details Modal State
  const [selectedPartner, setSelectedPartner] = useState(null);
  const [selectedPartnerServices, setSelectedPartnerServices] = useState([]);
  const [loadingPartnerDetails, setLoadingPartnerDetails] = useState(false);
  const [showPartnerDetailsModal, setShowPartnerDetailsModal] = useState(false);

  // Lightbox Preview Image State
  const [previewImageUrl, setPreviewImageUrl] = useState(null);

  // Booking queues sub-tab: 'all' | 'active' | 'completed' | 'cancelled'
  const [bookingSubTab, setBookingSubTab] = useState("all");
  const [bookingCategoryFilter, setBookingCategoryFilter] = useState("all");

  // Tailor orders sub-tab: 'all' | 'pending' | 'production' | 'ready' | 'completed' | 'cancelled'
  const [tailorSubTab, setTailorSubTab] = useState("all");

  // Check auth status on mount
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setIsAuthenticated(true);
    }
  }, []);

  // Fetch stats and data when auth changes or tab changes
  useEffect(() => {
    if (isAuthenticated) {
      fetchStats();
      fetchTabDocs();
    }
  }, [isAuthenticated, activeTab]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoginLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
      const { token, user } = res.data;
      if (user.role !== "admin") {
        throw new Error("Access Denied: Admin role required.");
      }
      localStorage.setItem("admin_token", token);
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      setIsAuthenticated(true);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || err.message || "Invalid credentials");
    } finally {
      setLoginLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    delete axios.defaults.headers.common["Authorization"];
    setIsAuthenticated(false);
    setActiveTab("overview");
  };

  const fetchStats = async () => {
    try {
      const res = await axios.get(`${API_BASE}/admin-panel/dashboard-stats`);
      setStats(res.data);
    } catch (err) {
      console.error("Failed to load dashboard stats", err);
      if (err.response?.status === 401 || err.response?.status === 403) {
        handleLogout();
      }
    }
  };

  const fetchTabDocs = async () => {
    setLoadingData(true);
    try {
      if (activeTab === "overview") {
        const [ordersRes, bookingsRes] = await Promise.all([
          axios.get(`${API_BASE}/admin-panel/orders`),
          axios.get(`${API_BASE}/admin-panel/bookings`)
        ]);
        setOrders(ordersRes.data.slice(0, 5) || []);
        setBookings(bookingsRes.data.slice(0, 5) || []);
      } else if (activeTab === "approvals") {
        const res = await axios.get(`${API_BASE}/admin/barbers/pending`);
        setPendingApprovals(res.data.requests || []);
      } else if (activeTab === "partners") {
        const [tailorsRes, barbersRes] = await Promise.all([
          axios.get(`${API_BASE}/admin-panel/tailors`),
          axios.get(`${API_BASE}/admin-panel/barbers`)
        ]);
        setTailors(tailorsRes.data || []);
        setBarbers(barbersRes.data || []);
      } else if (activeTab === "bookings") {
        const res = await axios.get(`${API_BASE}/admin-panel/bookings`);
        setBookings(res.data || []);
      } else if (activeTab === "orders") {
        const res = await axios.get(`${API_BASE}/admin-panel/orders`);
        setOrders(res.data || []);
      } else if (activeTab === "reviews") {
        const res = await axios.get(`${API_BASE}/admin-panel/reviews`);
        setReviews(res.data || []);
      } else if (activeTab === "users") {
        const res = await axios.get(`${API_BASE}/admin-panel/users`);
        setUsers(res.data || []);
      }
    } catch (err) {
      console.error("Failed to fetch documents", err);
    } finally {
      setLoadingData(false);
    }
  };

  // Barber Approval Decision
  const handleApproveBarber = async (id) => {
    if (!window.confirm("Are you sure you want to approve this shop request?")) return;
    try {
      await axios.patch(`${API_BASE}/admin/barbers/${id}/decision`, { status: "approved" });
      alert("Shop approved successfully!");
      fetchTabDocs();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert("Failed to approve shop");
    }
  };

  const handleOpenRejectBarber = (id) => {
    setRejectingId(id);
    setRejectionReason("");
    setShowRejectModal(true);
  };

  const handleConfirmRejectBarber = async () => {
    if (!rejectionReason.trim()) {
      alert("Please provide a reason for rejection.");
      return;
    }
    try {
      await axios.patch(`${API_BASE}/admin/barbers/${rejectingId}/decision`, {
        status: "rejected",
        rejectionReason: rejectionReason
      });
      setShowRejectModal(false);
      alert("Shop request rejected.");
      fetchTabDocs();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert("Failed to reject shop request");
    }
  };

  // Toggle Verification / Active states
  const handleToggleTailorStatus = async (id, currentVerified, currentActive) => {
    try {
      await axios.patch(`${API_BASE}/admin-panel/tailors/${id}`, {
        isVerified: !currentVerified,
        isActive: currentActive
      });
      fetchTabDocs();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  const handleToggleBarberStatus = async (id, currentStatus) => {
    try {
      const nextStatus = currentStatus === "approved" ? "rejected" : "approved";
      await axios.patch(`${API_BASE}/admin-panel/barbers/${id}`, {
        approvalStatus: nextStatus
      });
      fetchTabDocs();
      fetchStats();
    } catch (err) {
      console.error(err);
      alert("Failed to update status");
    }
  };

  const handleViewPartnerDetails = async (id, type) => {
    setLoadingPartnerDetails(true);
    setShowPartnerDetailsModal(true);
    setSelectedPartner(null);
    setSelectedPartnerServices([]);
    try {
      const res = await axios.get(`${API_BASE}/admin-panel/partners/${id}/details?type=${type}`);
      setSelectedPartner(res.data.partner);
      setSelectedPartnerServices(res.data.services || []);
    } catch (err) {
      console.error(err);
      alert("Failed to load partner details");
    } finally {
      setLoadingPartnerDetails(false);
    }
  };

  // Cancel Booking on behalf of user
  const handleCancelBooking = async (id) => {
    if (!window.confirm("Are you sure you want to cancel this booking slot?")) return;
    try {
      await axios.patch(`${API_BASE}/admin-panel/bookings/${id}`, { status: "cancelled" });
      alert("Booking slot cancelled successfully.");
      fetchTabDocs();
    } catch (err) {
      console.error(err);
      alert("Failed to cancel booking");
    }
  };

  // Delete Inappropriate Review
  const handleDeleteReview = async (id) => {
    if (!window.confirm("Are you sure you want to delete this rating review?")) return;
    try {
      await axios.delete(`${API_BASE}/admin-panel/reviews/${id}`);
      alert("Review deleted successfully!");
      fetchTabDocs();
    } catch (err) {
      console.error(err);
      alert("Failed to delete review");
    }
  };

  // Upgrade user roles
  const handleUpgradeUser = async (id, currentRole) => {
    const nextRole = currentRole === "customer" ? "admin" : "customer";
    if (!window.confirm(`Upgrade user role to ${nextRole}?`)) return;
    try {
      await axios.patch(`${API_BASE}/admin-panel/users/${id}/role`, { role: nextRole });
      alert(`User role updated to ${nextRole}!`);
      fetchTabDocs();
    } catch (err) {
      console.error(err);
      alert("Failed to change user role");
    }
  };

  // Delete User Profile
  const handleDeleteUser = async (id) => {
    if (!window.confirm("Permanently delete this user profile? This cannot be undone.")) return;
    try {
      await axios.delete(`${API_BASE}/admin-panel/users/${id}`);
      alert("User profile deleted.");
      fetchTabDocs();
    } catch (err) {
      console.error(err);
      alert("Failed to delete user profile");
    }
  };

  // Render Authentication (Login screen)
  if (!isAuthenticated) {
    return (
      <div className="login-bg">
        <div className="login-card">
          <div className="login-logo">
            <div className="login-logo-icon">
              <Scissors size={28} color="#ffffff" />
            </div>
            <h1 className="login-title">Antigravity Admin Panel</h1>
            <p className="login-subtitle">Manage service partners and shop registrations</p>
          </div>

          {error && (
            <div style={{ backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', padding: '12px', borderRadius: '12px', marginBottom: '20px', fontSize: '13.5px', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label className="form-label">Admin Email</label>
              <input 
                type="email" 
                className="form-input" 
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button type="submit" className="btn-login" disabled={loginLoading}>
              {loginLoading ? "Authenticating..." : "Sign In to Dashboard"}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Render Dashboard
  return (
    <div className="app-container dashboard-layout">
      
      {/* Sidebar navigation */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-brand-icon">
            <Scissors size={20} color="#ffffff" />
          </div>
          <span>ROOPSY</span>
        </div>

        <nav className="sidebar-menu">
          <div 
            className={`sidebar-item ${activeTab === 'overview' ? 'active' : ''}`}
            onClick={() => setActiveTab("overview")}
          >
            <LayoutDashboard size={18} />
            <span>Overview</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === 'approvals' ? 'active' : ''}`}
            onClick={() => { setActiveTab("approvals"); setSearchQuery(""); }}
          >
            <Clock size={18} />
            <span>Pending Approvals</span>
            {((stats.pendingBarbers || 0) + (stats.pendingParlours || 0)) > 0 && (
              <span style={{ marginLeft: 'auto', backgroundColor: '#f59e0b', color: '#ffffff', fontSize: '10.5px', padding: '2px 6px', borderRadius: '10px', fontWeight: '800' }}>
                {(stats.pendingBarbers || 0) + (stats.pendingParlours || 0)}
              </span>
            )}
          </div>

          <div 
            className={`sidebar-item ${activeTab === 'partners' ? 'active' : ''}`}
            onClick={() => { setActiveTab("partners"); setSearchQuery(""); }}
          >
            <Sparkles size={18} />
            <span>Service Partners</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === 'bookings' ? 'active' : ''}`}
            onClick={() => { setActiveTab("bookings"); setSearchQuery(""); }}
          >
            <Calendar size={18} />
            <span>Booking Queues</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === 'orders' ? 'active' : ''}`}
            onClick={() => { setActiveTab("orders"); setSearchQuery(""); }}
          >
            <ShoppingBag size={18} />
            <span>Tailor Orders</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === 'reviews' ? 'active' : ''}`}
            onClick={() => { setActiveTab("reviews"); setSearchQuery(""); }}
          >
            <Star size={18} />
            <span>Reviews & Ratings</span>
          </div>

          <div 
            className={`sidebar-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => { setActiveTab("users"); setSearchQuery(""); }}
          >
            <Users size={18} />
            <span>Users Database</span>
          </div>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-item" style={{ color: '#ef4444' }} onClick={handleLogout}>
            <LogOut size={18} color="#ef4444" />
            <span>Logout</span>
          </div>
        </div>
      </aside>

      {/* Main dashboard content panel */}
      <main className="main-content">
        <header className="header-row">
          <div>
            <h1 className="page-title">
              {activeTab === 'overview' && 'System Analytics'}
              {activeTab === 'approvals' && 'Registration Requests'}
              {activeTab === 'partners' && 'Service Providers'}
              {activeTab === 'bookings' && 'Salons Slots Booking'}
              {activeTab === 'orders' && 'Tailoring Orders'}
              {activeTab === 'reviews' && 'Reviews & Feedbacks'}
              {activeTab === 'users' && 'User Directory'}
            </h1>
            <p className="page-subtitle">Real-time indicators & management workspace</p>
          </div>
          
          {(activeTab === 'partners' || activeTab === 'bookings' || activeTab === 'orders' || activeTab === 'reviews' || activeTab === 'users') && (
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
              {activeTab === 'users' && (
                <select 
                  style={{ padding: '8px 12px', width: '130px', margin: 0, backgroundColor: '#ffffff', color: '#0f172a', border: '1px solid #e2e8f0', borderRadius: '12px', fontSize: '13.5px', outline: 'none' }}
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value)}
                >
                  <option value="all">All Roles</option>
                  <option value="customer">Customers</option>
                  <option value="barber">Barbers</option>
                  <option value="tailor">Tailors</option>
                  <option value="admin">Admins</option>
                </select>
              )}
              <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #e2e8f0', padding: '8px 14px', gap: '8px', width: '260px' }}>
                <Search size={16} color="#64748b" />
                <input 
                  type="text" 
                  placeholder={
                    activeTab === 'partners' ? "Search shops or owners..." :
                    activeTab === 'bookings' ? "Search customer or shop..." :
                    activeTab === 'orders' ? "Search customer or status..." :
                    activeTab === 'reviews' ? "Search comment or rating..." :
                    "Search users by name, email..."
                  } 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ border: 'none', outline: 'none', fontSize: '13.5px', width: '100%', color: '#0f172a', background: 'transparent' }}
                />
              </div>
            </div>
          )}
        </header>

        {/* Dashboard metrics widgets (Overview tab) */}
        {activeTab === "overview" && (
          <>
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
              <div className="metric-card" style={{ padding: '16px 20px' }}>
                <div>
                  <span className="metric-label" style={{ fontSize: '11px' }}>Total Clients</span>
                  <div className="metric-value" style={{ fontSize: '26px' }}>{stats.totalUsers || 0}</div>
                </div>
                <div className="metric-icon-box" style={{ backgroundColor: '#eff6ff', color: '#3b82f6', width: '40px', height: '40px' }}>
                  <Users size={20} />
                </div>
              </div>

              <div className="metric-card" style={{ padding: '16px 20px' }}>
                <div>
                  <span className="metric-label" style={{ fontSize: '11px' }}>Barber Shops</span>
                  <div className="metric-value" style={{ fontSize: '26px' }}>{stats.totalBarbers || 0}</div>
                  <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>{stats.activeBarbers || 0} Active</span>
                </div>
                <div className="metric-icon-box" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', width: '40px', height: '40px' }}>
                  <Scissors size={20} />
                </div>
              </div>

              <div className="metric-card" style={{ padding: '16px 20px' }}>
                <div>
                  <span className="metric-label" style={{ fontSize: '11px' }}>Beauty Parlours</span>
                  <div className="metric-value" style={{ fontSize: '26px' }}>{stats.totalParlours || 0}</div>
                  <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>{stats.activeParlours || 0} Active</span>
                </div>
                <div className="metric-icon-box" style={{ backgroundColor: '#fdf2f8', color: '#db2777', width: '40px', height: '40px' }}>
                  <Star size={20} />
                </div>
              </div>

              <div className="metric-card" style={{ padding: '16px 20px' }}>
                <div>
                  <span className="metric-label" style={{ fontSize: '11px' }}>Tailors</span>
                  <div className="metric-value" style={{ fontSize: '26px' }}>{stats.totalTailors || 0}</div>
                  <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '700' }}>{stats.activeTailors || 0} Verified</span>
                </div>
                <div className="metric-icon-box" style={{ backgroundColor: '#e6f7f2', color: '#0d9488', width: '40px', height: '40px' }}>
                  <CheckCircle size={20} />
                </div>
              </div>

              <div className="metric-card" style={{ padding: '16px 20px' }}>
                <div>
                  <span className="metric-label" style={{ fontSize: '11px' }}>Total Bookings/Orders</span>
                  <div className="metric-value" style={{ fontSize: '26px' }}>{stats.totalOrders || 0}</div>
                </div>
                <div className="metric-icon-box" style={{ backgroundColor: '#fff7ed', color: '#f97316', width: '40px', height: '40px' }}>
                  <ShoppingBag size={20} />
                </div>
              </div>
            </div>

            {/* Financial Performance Section */}
            <div className="content-card" style={{ padding: '32px', marginBottom: '40px' }}>
              <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="card-header" style={{ margin: 0 }}>💰 Financial Performance & Platform Commissions</span>
                <span style={{ backgroundColor: '#f3e8ff', color: '#7c3aed', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '12px' }}>
                  FLAT 10% COMMISSION ACTIVE
                </span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '20px' }}>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Today</span>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '8px 0 4px' }}>₹{(stats.dailyRevenue || 0).toLocaleString()}</div>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>Commission: ₹{(stats.dailyCommission || 0).toLocaleString()}</span>
                </div>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly (7 Days)</span>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '8px 0 4px' }}>₹{(stats.weeklyRevenue || 0).toLocaleString()}</div>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>Commission: ₹{(stats.weeklyCommission || 0).toLocaleString()}</span>
                </div>
                <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Monthly (30 Days)</span>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', margin: '8px 0 4px' }}>₹{(stats.monthlyRevenue || 0).toLocaleString()}</div>
                  <span style={{ fontSize: '12px', color: '#10b981', fontWeight: '700' }}>Commission: ₹{(stats.monthlyCommission || 0).toLocaleString()}</span>
                </div>
                <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #c4b5fd', borderRadius: '16px', padding: '20px', textAlign: 'center' }}>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#7c3aed', textTransform: 'uppercase', letterSpacing: '0.5px' }}>All-Time Gross</span>
                  <div style={{ fontSize: '24px', fontWeight: '800', color: '#7c3aed', margin: '8px 0 4px' }}>₹{(stats.totalRevenue || 0).toLocaleString()}</div>
                  <span style={{ fontSize: '12px', color: '#6d28d9', fontWeight: '800' }}>Commission: ₹{(stats.platformCommission || 0).toLocaleString()}</span>
                </div>
              </div>
            </div>

            {/* Grid of recent items */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px' }}>
              {/* Recent Orders Overview */}
              <div className="content-card">
                <div className="card-header">Recent Tailoring Orders</div>
                {loadingData ? (
                  <div className="loading-container"><div className="spinner"></div></div>
                ) : orders.length === 0 ? (
                  <div className="empty-state">No recent orders yet</div>
                ) : (
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Order</th>
                        <th>Shop</th>
                        <th>Clothing</th>
                        <th>Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {orders.map((o) => (
                        <tr key={o._id}>
                          <td style={{ fontWeight: '600' }}>#{o._id.substring(18)}</td>
                          <td>{o.tailorId?.shopName || 'Tailor Partner'}</td>
                          <td><span style={{ textTransform: 'capitalize', fontWeight: '600' }}>{o.clothingType || 'Outfit'}</span></td>
                          <td style={{ fontWeight: '700', color: '#10b981' }}>₹{o.totalAmount || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Recent Bookings Overview */}
              <div className="content-card">
                <div className="card-header">Recent Barber Bookings</div>
                {loadingData ? (
                  <div className="loading-container"><div className="spinner"></div></div>
                ) : bookings.length === 0 ? (
                  <div className="empty-state">No recent bookings yet</div>
                ) : (
                  <table className="premium-table">
                    <thead>
                      <tr>
                        <th>Client</th>
                        <th>Barber Shop</th>
                        <th>Time</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {bookings.map((b) => (
                        <tr key={b._id}>
                          <td>{b.customerId?.name || b.guestName || 'Walk-In'}</td>
                          <td>{b.barberId?.shopName || 'Barber'}</td>
                          <td style={{ fontSize: '12px' }}>{new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                          <td>
                            <span className={`badge ${b.status}`}>
                              {b.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </>
        )}

        {/* Tab 2: Pending registrations approvals list */}
        {activeTab === "approvals" && (
          <div className="content-card">
            <div className="card-header">Barber & Beauty Parlour Requests</div>
            {loadingData ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : pendingApprovals.length === 0 ? (
              <div className="empty-state">
                <CheckCircle size={40} className="empty-state-icon" style={{ color: '#10b981' }} />
                <h3>All Caught Up!</h3>
                <p>There are no pending shop registration requests to review.</p>
              </div>
            ) : (
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Shop Info</th>
                    <th>Owner Details</th>
                    <th>Location Info</th>
                    <th>Aadhaar Digits</th>
                    <th>UPI Handle</th>
                    <th style={{ textAlign: 'center' }}>Decisions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingApprovals.map((req) => (
                    <tr key={req.id}>
                      <td>
                        <div style={{ fontWeight: '700' }}>{req.shopName}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px', maxWidth: '180px' }} numberOfLines={1}>
                          {req.bio || "No description"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: '600' }}>{req.user?.name || "Partner Owner"}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '4px' }}>
                          <Phone size={10} /> {req.user?.phone || req.mobileNumber || "N/A"}
                        </div>
                        <div style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                          <Mail size={10} /> {req.user?.email || "N/A"}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontSize: '13.5px' }}>{req.address?.line1 || "No Line1"}</div>
                        <div style={{ fontSize: '12px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase', marginTop: '2px' }}>
                          {req.address?.city || "Lucknow"}
                        </div>
                      </td>
                      <td style={{ fontFamily: 'monospace', fontWeight: '600' }}>
                        XXXX-XXXX-{req.aadhaarLast4 || "0000"}
                      </td>
                      <td style={{ color: '#6d28d9', fontWeight: '600' }}>
                        {req.bank?.upiId || "N/A"}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                          <button 
                            className="btn btn-outline" 
                            style={{ padding: '8px 14px', fontSize: '12.5px' }}
                            onClick={() => handleViewPartnerDetails(req.id, 'barber')}
                          >
                            View Details
                          </button>
                          <button 
                            className="btn btn-success" 
                            style={{ padding: '8px 14px', fontSize: '12.5px' }}
                            onClick={() => handleApproveBarber(req.id)}
                          >
                            Approve
                          </button>
                          <button 
                            className="btn btn-danger" 
                            style={{ padding: '8px 14px', fontSize: '12.5px' }}
                            onClick={() => handleOpenRejectBarber(req.id)}
                          >
                            Reject
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 3: Service Partners directory (Tailors & Barbers) */}
        {activeTab === "partners" && (
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div className="card-header" style={{ margin: 0 }}>All Service Providers</div>
            </div>

            {/* Sub-tab navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <button 
                className={`btn ${partnerSubTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setPartnerSubTab("all")}
              >
                All Providers ({(tailors?.length || 0) + (barbers?.length || 0)})
              </button>
              <button 
                className={`btn ${partnerSubTab === 'barber' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setPartnerSubTab("barber")}
              >
                ✂️ Barber Shops ({(barbers || []).filter(b => b.businessCategory?.toLowerCase().includes('barber')).length})
              </button>
              <button 
                className={`btn ${partnerSubTab === 'beauty' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setPartnerSubTab("beauty")}
              >
                ✨ Beauty Parlours ({(barbers || []).filter(b => b.businessCategory?.toLowerCase().includes('beauty') || b.businessCategory?.toLowerCase().includes('parlor') || b.businessCategory?.toLowerCase().includes('parlour')).length})
              </button>
              <button 
                className={`btn ${partnerSubTab === 'tailor' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setPartnerSubTab("tailor")}
              >
                🧵 Tailoring ({(tailors || []).length})
              </button>
            </div>

            {loadingData ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : (
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Shop / Brand</th>
                    <th>Type</th>
                    <th>Owner Info</th>
                    <th>Location</th>
                    <th>Verifications</th>
                    <th style={{ textAlign: 'center' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Render Tailors */}
                  {(partnerSubTab === 'all' || partnerSubTab === 'tailor') && tailors
                    .filter(t => 
                      t.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      t.ownerName?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((t) => (
                      <tr key={`t-${t._id}`}>
                        <td>
                          <div style={{ fontWeight: '700' }}>{t.shopName}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Seats: {t.seatCount || 1}</div>
                        </td>
                        <td>
                          <span className="badge" style={{ backgroundColor: '#e6f7f2', color: '#0d9488', fontSize: '11px', fontWeight: '800' }}>
                            Tailoring
                          </span>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{t.ownerName || t.userId?.name || "Owner"}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{t.mobileNumber || t.userId?.phone}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px' }}>{t.address?.city || "Lucknow"}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <span className={`badge ${t.isVerified ? 'approved' : 'pending'}`}>
                              {t.isVerified ? 'Verified' : 'Unverified'}
                            </span>
                            <span className={`badge ${t.isActive ? 'active' : 'inactive'}`}>
                              {t.isActive ? 'Active' : 'Suspended'}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-outline"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => handleViewPartnerDetails(t._id, 'tailor')}
                            >
                              View Details
                            </button>
                            <button 
                              className={`btn ${t.isVerified ? 'btn-danger' : 'btn-success'}`}
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => handleToggleTailorStatus(t._id, t.isVerified, t.isActive)}
                            >
                              {t.isVerified ? 'Revoke Verify' : 'Verify Shop'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  
                  {/* Render Barbers */}
                  {barbers
                    .filter(b => {
                      const matchesSearch = b.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            b.ownerName?.toLowerCase().includes(searchQuery.toLowerCase());
                      const isBarber = b.businessCategory?.toLowerCase().includes('barber');
                      const isBeauty = b.businessCategory?.toLowerCase().includes('beauty') || 
                                       b.businessCategory?.toLowerCase().includes('parlor') || 
                                       b.businessCategory?.toLowerCase().includes('parlour');
                      const matchesSubTab = partnerSubTab === 'all' || 
                                            (partnerSubTab === 'barber' && isBarber) || 
                                            (partnerSubTab === 'beauty' && isBeauty);
                      return matchesSearch && matchesSubTab;
                    })
                    .map((b) => (
                      <tr key={`b-${b._id}`}>
                        <td>
                          <div style={{ fontWeight: '700' }}>{b.shopName}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{b.businessCategory || 'Barber Shop'}</div>
                        </td>
                        <td>
                          {b.businessCategory?.toLowerCase().includes('beauty') || b.businessCategory?.toLowerCase().includes('parlor') || b.businessCategory?.toLowerCase().includes('parlour') ? (
                            <span className="badge" style={{ backgroundColor: '#fdf2f8', color: '#db2777', fontSize: '11px', fontWeight: '800' }}>
                              Beauty Parlour
                            </span>
                          ) : (
                            <span className="badge" style={{ backgroundColor: '#f5f3ff', color: '#6d28d9', fontSize: '11px', fontWeight: '800' }}>
                              Barber Shop
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{b.ownerName || b.userId?.name || "Owner"}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{b.mobileNumber || b.userId?.phone}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13px' }}>{b.address?.city || "Lucknow"}</div>
                        </td>
                        <td>
                          <span className={`badge ${b.approvalStatus}`}>
                            {b.approvalStatus}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-outline"
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => handleViewPartnerDetails(b._id, 'barber')}
                            >
                              View Details
                            </button>
                            <button 
                              className={`btn ${b.approvalStatus === 'approved' ? 'btn-danger' : 'btn-success'}`}
                              style={{ padding: '6px 12px', fontSize: '12px' }}
                              onClick={() => handleToggleBarberStatus(b._id, b.approvalStatus)}
                            >
                              {b.approvalStatus === 'approved' ? 'Suspend Partner' : 'Approve Shop'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 4: All Booking slots Queues */}
        {activeTab === "bookings" && (
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div className="card-header" style={{ margin: 0 }}>All Queue Appointments</div>
            </div>

            {/* Sub-tab navigation */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
              <button 
                className={`btn ${bookingSubTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setBookingSubTab("all")}
              >
                All Slots ({(bookings || []).length})
              </button>
              <button 
                className={`btn ${bookingSubTab === 'active' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setBookingSubTab("active")}
              >
                ⏳ Active ({(bookings || []).filter(b => ['pending', 'confirmed', 'arrived', 'in-progress'].includes(b.status)).length})
              </button>
              <button 
                className={`btn ${bookingSubTab === 'completed' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setBookingSubTab("completed")}
              >
                ✅ Completed ({(bookings || []).filter(b => b.status === 'completed').length})
              </button>
              <button 
                className={`btn ${bookingSubTab === 'cancelled' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setBookingSubTab("cancelled")}
              >
                ❌ Cancelled / Absent ({(bookings || []).filter(b => ['cancelled', 'no-show', 'expired'].includes(b.status)).length})
              </button>
            </div>

            {/* Category Filter Pills */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
              <button 
                className={`btn ${bookingCategoryFilter === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '14px', height: '32px', display: 'flex', alignItems: 'center' }}
                onClick={() => setBookingCategoryFilter("all")}
              >
                All Shops ({(bookings || []).length})
              </button>
              <button 
                className={`btn ${bookingCategoryFilter === 'barber' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '14px', height: '32px', display: 'flex', alignItems: 'center' }}
                onClick={() => setBookingCategoryFilter("barber")}
              >
                💇‍♂️ Barber Shops ({(bookings || []).filter(b => {
                  const cat = b.barberId?.businessCategory?.toLowerCase() || '';
                  return !cat.includes('beauty') && !cat.includes('parlor') && !cat.includes('parlour');
                }).length})
              </button>
              <button 
                className={`btn ${bookingCategoryFilter === 'beauty' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 14px', fontSize: '12px', borderRadius: '14px', height: '32px', display: 'flex', alignItems: 'center' }}
                onClick={() => setBookingCategoryFilter("beauty")}
              >
                ✨ Beauty Parlours ({(bookings || []).filter(b => {
                  const cat = b.barberId?.businessCategory?.toLowerCase() || '';
                  return cat.includes('beauty') || cat.includes('parlor') || cat.includes('parlour');
                }).length})
              </button>
            </div>

            {loadingData ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : (
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Shop / Brand</th>
                    <th>Scheduled Time</th>
                    <th>Duration</th>
                    <th>OTP Info</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'center' }}>Cancel Slot</th>
                  </tr>
                </thead>
                <tbody>
                  {bookings
                    .filter(b => {
                      const matchesSearch = b.customerId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            b.guestName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            b.barberId?.shopName?.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      let matchesStatus = true;
                      if (bookingSubTab === 'active') {
                        matchesStatus = ['pending', 'confirmed', 'arrived', 'in-progress'].includes(b.status);
                      } else if (bookingSubTab === 'completed') {
                        matchesStatus = b.status === 'completed';
                      } else if (bookingSubTab === 'cancelled') {
                        matchesStatus = ['cancelled', 'no-show', 'expired'].includes(b.status);
                      }

                      let matchesCategory = true;
                      const cat = b.barberId?.businessCategory?.toLowerCase() || '';
                      const isBeauty = cat.includes('beauty') || cat.includes('parlor') || cat.includes('parlour');
                      
                      if (bookingCategoryFilter === 'barber') {
                        matchesCategory = !isBeauty;
                      } else if (bookingCategoryFilter === 'beauty') {
                        matchesCategory = isBeauty;
                      }

                      return matchesSearch && matchesStatus && matchesCategory;
                    })
                    .map((b) => (
                      <tr key={b._id}>
                        <td>
                          <div style={{ fontWeight: '700' }}>{b.customerId?.name || b.guestName || 'Walk-In'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{b.customerId?.phone || b.guestPhone || 'N/A'}</div>
                          {b.isHomeService && (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#eab308', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className="badge" style={{ backgroundColor: '#fffbeb', color: '#d97706', fontSize: '9.5px', padding: '2px 6px', fontWeight: '800', width: 'fit-content' }}>🏠 Home Service</span>
                              <span style={{ color: '#78350f', maxWidth: '200px', display: 'inline-block' }}>{b.homeServiceAddress}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{b.barberId?.shopName || 'Salon Provider'}</div>
                        </td>
                        <td>
                          <div style={{ fontSize: '13.5px', fontWeight: '700' }}>{new Date(b.startTime).toLocaleDateString()}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                            {new Date(b.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {new Date(b.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </td>
                        <td>{b.expectedDuration} mins</td>
                        <td>
                          <span style={{ fontFamily: 'monospace', fontWeight: '700', color: '#6d28d9', border: '1px dashed #c4b5fd', padding: '2px 6px', borderRadius: '4px' }}>
                            {b.verificationPin || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className={`badge ${b.status}`}>
                            {b.status}
                          </span>
                        </td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            {b.status !== 'cancelled' && b.status !== 'completed' ? (
                              <button 
                                className="btn btn-danger"
                                style={{ padding: '6px 12px', fontSize: '12px' }}
                                onClick={() => handleCancelBooking(b._id)}
                              >
                                Cancel
                              </button>
                            ) : (
                              <span style={{ fontSize: '12px', color: '#94a3b8' }}>N/A</span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 5: All Stitched outfits Tailoring Orders list */}
        {activeTab === "orders" && (
          <div className="content-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div className="card-header" style={{ margin: 0 }}>All Stitched Clothing Orders</div>
            </div>

            {/* Pipeline Status Sub-tabs */}
            <div style={{ display: 'flex', gap: '10px', marginBottom: '24px', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px', flexWrap: 'wrap' }}>
              <button 
                className={`btn ${tailorSubTab === 'all' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setTailorSubTab("all")}
              >
                All Orders ({(orders || []).length})
              </button>
              <button 
                className={`btn ${tailorSubTab === 'pending' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setTailorSubTab("pending")}
              >
                📥 New / Pending ({(orders || []).filter(o => ['pending', 'accepted', 'measurement_pending', 'fabric_pending'].includes(o.status)).length})
              </button>
              <button 
                className={`btn ${tailorSubTab === 'production' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setTailorSubTab("production")}
              >
                ✂️ Stitching / In Production ({(orders || []).filter(o => ['pattern_making', 'cutting', 'stitching', 'embroidery', 'trial', 'alteration', 'ironing', 'quality_check', 'packing'].includes(o.status)).length})
              </button>
              <button 
                className={`btn ${tailorSubTab === 'ready' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setTailorSubTab("ready")}
              >
                📦 Ready / Dispatched ({(orders || []).filter(o => ['ready', 'dispatched'].includes(o.status)).length})
              </button>
              <button 
                className={`btn ${tailorSubTab === 'completed' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setTailorSubTab("completed")}
              >
                ✅ Completed ({(orders || []).filter(o => o.status === 'completed').length})
              </button>
              <button 
                className={`btn ${tailorSubTab === 'cancelled' ? 'btn-primary' : 'btn-outline'}`}
                style={{ padding: '6px 16px', fontSize: '13px', borderRadius: '20px' }}
                onClick={() => setTailorSubTab("cancelled")}
              >
                ❌ Cancelled / Returned ({(orders || []).filter(o => ['cancelled', 'declined', 'refund'].includes(o.status)).length})
              </button>
            </div>

            {loadingData ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : orders.length === 0 ? (
              <div className="empty-state">No orders registered in system</div>
            ) : (
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Customer Details</th>
                    <th>Shop Info</th>
                    <th>Stitched Item</th>
                    <th>Price</th>
                    <th>Order Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {orders
                    .filter(o => {
                      const matchesSearch = o.customerId?.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                            o.tailorId?.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                                            o.status?.toLowerCase().includes(searchQuery.toLowerCase());
                      
                      let matchesStatus = true;
                      if (tailorSubTab === 'pending') {
                        matchesStatus = ['pending', 'accepted', 'measurement_pending', 'fabric_pending'].includes(o.status);
                      } else if (tailorSubTab === 'production') {
                        matchesStatus = ['pattern_making', 'cutting', 'stitching', 'embroidery', 'trial', 'alteration', 'ironing', 'quality_check', 'packing'].includes(o.status);
                      } else if (tailorSubTab === 'ready') {
                        matchesStatus = ['ready', 'dispatched'].includes(o.status);
                      } else if (tailorSubTab === 'completed') {
                        matchesStatus = o.status === 'completed';
                      } else if (tailorSubTab === 'cancelled') {
                        matchesStatus = ['cancelled', 'declined', 'refund'].includes(o.status);
                      }

                      return matchesSearch && matchesStatus;
                    })
                    .map((o) => (
                      <tr key={o._id}>
                        <td style={{ fontWeight: '700' }}>#{o._id.substring(18)}</td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{o.customerId?.name || 'Guest Client'}</div>
                          <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>{o.customerId?.phone || 'N/A'}</div>
                          {o.isHomeService && (
                            <div style={{ marginTop: '6px', fontSize: '11px', color: '#eab308', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span className="badge" style={{ backgroundColor: '#fffbeb', color: '#d97706', fontSize: '9.5px', padding: '2px 6px', fontWeight: '800', width: 'fit-content' }}>🏠 Home Measurement</span>
                              <span style={{ color: '#78350f', maxWidth: '200px', display: 'inline-block' }}>{o.homeServiceAddress}</span>
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{o.tailorId?.shopName || 'Tailor Partner'}</div>
                        </td>
                        <td>
                          <span style={{ textTransform: 'capitalize', fontWeight: '700' }}>{o.clothingType || 'Outfit'}</span>
                        </td>
                        <td style={{ fontWeight: '700', color: '#10b981' }}>₹{o.totalAmount || 0}</td>
                        <td>{new Date(o.createdAt).toLocaleDateString()}</td>
                        <td>
                          <span className={`badge ${o.status}`}>
                            {o.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 6: Customer Reviews list */}
        {activeTab === "reviews" && (
          <div className="content-card">
            <div className="card-header">Client Feedback Reviews</div>
            {loadingData ? (
              <div className="loading-container"><div className="spinner"></div></div>
            ) : (
              <table className="premium-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Shop Reviewed</th>
                    <th>Rating Stars</th>
                    <th style={{ width: '40%' }}>Comment Review</th>
                    <th>Date Posted</th>
                    <th style={{ textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {reviews
                    .filter(r => 
                      r.comment?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                      r.barberId?.shopName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      r.userId?.name?.toLowerCase().includes(searchQuery.toLowerCase())
                    )
                    .map((r) => (
                      <tr key={r._id}>
                        <td>
                          <div style={{ fontWeight: '700' }}>{r.userId?.name || 'Anonymous client'}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: '600' }}>{r.barberId?.shopName || 'Shop Partner'}</div>
                        </td>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#eab308' }}>
                            <Star size={16} fill="#eab308" />
                            <span style={{ fontWeight: '800' }}>{r.rating}.0</span>
                          </div>
                        </td>
                        <td>
                          <p style={{ fontStyle: 'italic', fontSize: '13.5px', color: '#334155' }}>
                            "{r.comment || 'No comment text'}"
                          </p>
                        </td>
                        <td>{new Date(r.createdAt).toLocaleDateString()}</td>
                        <td>
                          <div style={{ display: 'flex', justifyContent: 'center' }}>
                            <button 
                              className="btn btn-outline" 
                              style={{ padding: '6px', color: '#ef4444', borderColor: '#fca5a5' }}
                              onClick={() => handleDeleteReview(r._id)}
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            )}
          </div>
        )}

        {/* Tab 7: Users Directory database */}
        {activeTab === "users" && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '30px', alignItems: 'start' }}>
            
            {/* Left Column: Customers List */}
            <div className="content-card" style={{ margin: 0 }}>
              <div className="card-header">👥 Registered Customers</div>
              {loadingData ? (
                <div className="loading-container"><div className="spinner"></div></div>
              ) : (
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Email / Contact</th>
                      <th style={{ textAlign: 'center' }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => u.role === 'customer' || !u.role)
                      .filter(u => {
                        const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                              u.email?.toLowerCase().includes(searchQuery.toLowerCase());
                        return matchesSearch;
                      })
                      .map((u) => (
                        <tr key={u._id}>
                          <td>
                            <div className="user-info-cell">
                              <div className="user-avatar-mini" style={{ backgroundColor: '#f0fdf4', color: '#16a34a', fontWeight: 'bold' }}>
                                {u.name ? u.name.charAt(0).toUpperCase() : 'C'}
                              </div>
                              <div className="user-name-text" style={{ fontWeight: '700' }}>{u.name || 'Customer'}</div>
                            </div>
                          </td>
                          <td>
                            <div style={{ fontSize: '13px', fontWeight: '600' }}>{u.email}</div>
                            <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>{u.phone || 'No phone'}</div>
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '6px', color: '#ef4444', borderColor: '#fca5a5' }}
                                onClick={() => handleDeleteUser(u._id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Right Column: Partners List */}
            <div className="content-card" style={{ margin: 0 }}>
              <div className="card-header">💼 Service Partners (Shop Owners)</div>
              {loadingData ? (
                <div className="loading-container"><div className="spinner"></div></div>
              ) : (
                <table className="premium-table">
                  <thead>
                    <tr>
                      <th>Partner Name</th>
                      <th>Role / Status</th>
                      <th style={{ textAlign: 'center' }}>Delete</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users
                      .filter(u => ['barber', 'tailor'].includes(u.role))
                      .filter(u => {
                        const matchesSearch = u.name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
                                              u.email?.toLowerCase().includes(searchQuery.toLowerCase());
                        return matchesSearch;
                      })
                      .map((u) => (
                        <tr key={u._id}>
                          <td>
                            <div className="user-info-cell">
                              <div className="user-avatar-mini" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', fontWeight: 'bold' }}>
                                {u.name ? u.name.charAt(0).toUpperCase() : 'P'}
                              </div>
                              <div>
                                <div className="user-name-text" style={{ fontWeight: '700' }}>{u.name || 'Partner'}</div>
                                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>{u.email}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="badge" style={{ 
                              textTransform: 'uppercase', 
                              backgroundColor: u.role === 'barber' ? '#f5f3ff' : '#e6f7f2',
                              color: u.role === 'barber' ? '#6d28d9' : '#0d9488',
                              fontSize: '10px',
                              fontWeight: '800'
                            }}>
                              {u.role}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: 'flex', justifyContent: 'center' }}>
                              <button 
                                className="btn btn-outline" 
                                style={{ padding: '6px', color: '#ef4444', borderColor: '#fca5a5' }}
                                onClick={() => handleDeleteUser(u._id)}
                              >
                                <Trash2 size={16} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}

      </main>

      {/* Modal: Application Rejection input Dialog */}
      {showRejectModal && (
        <div className="modal-overlay">
          <div className="modal-content-card">
            <h3 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 16px', color: '#0f172a' }}>Reject Registration Application</h3>
            <p style={{ fontSize: '13.5px', color: '#64748b', margin: '0 0 20px', lineHeight: '20px' }}>
              Please enter the reason for rejecting this shop registration application. This reason will be displayed to the partner owner on their review dashboard.
            </p>
            <div className="form-group">
              <label className="form-label">Rejection Reason</label>
              <textarea 
                className="form-input" 
                rows="4"
                placeholder="e.g. Incomplete or blur document files uploaded."
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                style={{ resize: 'vertical', width: '100%', boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button className="btn btn-outline" onClick={() => setShowRejectModal(false)}>Cancel</button>
              <button className="btn btn-danger" onClick={handleConfirmRejectBarber}>Confirm Rejection</button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Partner Detail Inspector Dialog */}
      {showPartnerDetailsModal && (
        <div className="modal-overlay">
          <div className="modal-content-card" style={{ maxWidth: '850px', width: '90%', maxHeight: '85vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid #e2e8f0', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: '800', margin: 0, color: '#0f172a' }}>Shop Profile Details</h3>
              <button 
                className="btn btn-outline" 
                style={{ padding: '6px 12px', borderRadius: '50%', width: '32px', height: '32px', display: 'flex', alignItems: 'center', justify: 'center', fontWeight: '700' }}
                onClick={() => setShowPartnerDetailsModal(false)}
              >
                ✕
              </button>
            </div>

            {loadingPartnerDetails ? (
              <div className="loading-container" style={{ padding: '40px' }}><div className="spinner"></div><p style={{ marginTop: '12px' }}>Loading shop profile details...</p></div>
            ) : !selectedPartner ? (
              <div className="empty-state">Failed to load shop details.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1.2fr', gap: '30px', overflow: 'hidden', flex: 1, paddingBottom: '10px' }}>
                
                {/* Left Column: Core profile details (Static) */}
                <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Banner & Avatar preview wrapper */}
                  <div style={{ position: 'relative', marginBottom: '35px' }}>
                    {/* Banner Card */}
                    <div 
                      style={{ height: '120px', backgroundColor: '#f1f5f9', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'zoom-in' }}
                      onClick={() => {
                        const banner = selectedPartner.shopPosterUrl || selectedPartner.coverImage;
                        if (banner) setPreviewImageUrl(banner);
                      }}
                    >
                      {selectedPartner.shopPosterUrl || selectedPartner.coverImage ? (
                        <img 
                          src={selectedPartner.shopPosterUrl || selectedPartner.coverImage} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          alt="Shop Banner"
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px' }}>No cover image</div>
                      )}
                    </div>
                    {/* Floating Avatar Logo sibling */}
                    <div 
                      style={{ position: 'absolute', bottom: '-20px', left: '20px', width: '60px', height: '60px', borderRadius: '50%', backgroundColor: '#ffffff', border: '3px solid #ffffff', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.15)', overflow: 'hidden', zIndex: 10, cursor: 'zoom-in' }}
                      onClick={() => {
                        const avatar = selectedPartner.avatarUrl || selectedPartner.logoUrl;
                        if (avatar) setPreviewImageUrl(avatar);
                      }}
                    >
                      {selectedPartner.avatarUrl || selectedPartner.logoUrl ? (
                        <img 
                          src={selectedPartner.avatarUrl || selectedPartner.logoUrl} 
                          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                          alt="Shop Logo"
                        />
                      ) : (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#e2e8f0', color: '#7c3aed', fontWeight: '700' }}>
                          {selectedPartner.shopName?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                  </div>

                  <h4 style={{ fontSize: '18px', fontWeight: '800', margin: '0 0 2px', color: '#0f172a' }}>{selectedPartner.shopName}</h4>
                  <p style={{ fontSize: '12.5px', color: '#64748b', margin: '0 0 10px', lineHeight: '18px' }}>{selectedPartner.bio || "No description provided."}</p>

                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'capitalize', fontSize: '10.5px', padding: '4px 8px' }}>
                      Category: {selectedPartner.businessCategory || 'Tailoring'}
                    </span>
                    <span className="badge" style={{ backgroundColor: '#f1f5f9', color: '#334155', textTransform: 'capitalize', fontSize: '10.5px', padding: '4px 8px' }}>
                      Seats: {selectedPartner.seatCount || 1}
                    </span>
                    <span className="badge" style={{ backgroundColor: '#fdf2f8', color: '#db2777', textTransform: 'capitalize', fontSize: '10.5px', padding: '4px 8px' }}>
                      Preference: {selectedPartner.genderPreference || 'unisex'}
                    </span>
                  </div>

                  {/* Owner Info */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '12px', marginBottom: '4px', border: '1px solid #e2e8f0' }}>
                    <h5 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Owner Details</h5>
                    <div style={{ fontSize: '12.5px', color: '#0f172a', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Name:</strong> {selectedPartner.ownerName || selectedPartner.userId?.name || "N/A"}</div>
                      <div><strong>Phone:</strong> {selectedPartner.mobileNumber || selectedPartner.userId?.phone || "N/A"}</div>
                      <div><strong>Email:</strong> {selectedPartner.userId?.email || "N/A"}</div>
                      <div><strong>Location:</strong> {selectedPartner.address?.line1}, {selectedPartner.address?.city}</div>
                    </div>
                  </div>

                  {/* Financial & Verifications */}
                  <div style={{ backgroundColor: '#f8fafc', padding: '12px 16px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                    <h5 style={{ margin: '0 0 8px', fontSize: '12px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Payout UPI & Documents</h5>
                    <div style={{ fontSize: '12.5px', color: '#0f172a', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div><strong>Aadhaar:</strong> XXXX-XXXX-{selectedPartner.aadhaarLast4 || "0000"}</div>
                      <div><strong>UPI Handle:</strong> <span style={{ color: '#6d28d9', fontWeight: '700' }}>{selectedPartner.bank?.upiId || "N/A"}</span></div>
                      <div><strong>Bank Name:</strong> {selectedPartner.bank?.accountHolderName || "N/A"}</div>
                      <div><strong>Account No:</strong> {selectedPartner.bank?.accountNumber || "N/A"}</div>
                      <div><strong>IFSC Code:</strong> {selectedPartner.bank?.ifsc || "N/A"}</div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Services & Gallery (Scrollable) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'left', overflowY: 'auto', paddingRight: '12px', height: '100%', maxHeight: '72vh' }}>
                  
                  {/* Services offered list */}
                  <div>
                    <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Services Offered ({selectedPartnerServices.length})</h5>
                    {selectedPartnerServices.length === 0 ? (
                      <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                        No services added by provider yet.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '250px', overflowY: 'auto', paddingRight: '6px' }}>
                        {selectedPartnerServices.map((svc) => (
                          <div key={svc._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
                            <div>
                              <div style={{ fontWeight: '700', fontSize: '13.5px' }}>{svc.name}</div>
                              <div style={{ fontSize: '11.5px', color: '#64748b', marginTop: '2px' }}>Mode: {svc.serviceMode || svc.category || 'Standard'} • {svc.estimatedDays || svc.duration || 30} mins/days</div>
                            </div>
                            <div style={{ fontWeight: '800', color: '#10b981', fontSize: '15px' }}>₹{svc.price}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Gallery Manager Preview */}
                  <div>
                    <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Uploaded Gallery ({(selectedPartner.gallery || []).length})</h5>
                    {(selectedPartner.gallery || []).length === 0 ? (
                      <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '12px', border: '1px solid #e2e8f0', color: '#94a3b8', fontSize: '13px', textAlign: 'center' }}>
                        No gallery photos uploaded by provider.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                        {(selectedPartner.gallery || []).map((imgUrl, i) => (
                          <div 
                            key={i} 
                            style={{ height: '80px', borderRadius: '10px', overflow: 'hidden', border: '1px solid #e2e8f0', cursor: 'zoom-in' }}
                            onClick={() => setPreviewImageUrl(imgUrl)}
                          >
                            <img src={imgUrl} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt={`Gallery ${i}`} />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Daily Operational Hours */}
                  <div>
                    <h5 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: '800', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Weekly Working Hours</h5>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '8px' }}>
                      {['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((day) => {
                        const hours = selectedPartner.workingHours?.[day] || { open: "09:00", close: "18:00", isClosed: false };
                        return (
                          <div key={day} style={{ padding: '8px 4px', backgroundColor: hours.isClosed ? '#fef2f2' : '#f0fdf4', borderRadius: '8px', border: '1px solid', borderColor: hours.isClosed ? '#fecaca' : '#bbf7d0', textAlign: 'center' }}>
                            <div style={{ fontSize: '11px', fontWeight: '800', textTransform: 'uppercase', color: hours.isClosed ? '#dc2626' : '#15803d' }}>{day}</div>
                            <div style={{ fontSize: '9.5px', marginTop: '4px', color: hours.isClosed ? '#ef4444' : '#166534' }}>
                              {hours.isClosed ? 'Closed' : `${hours.open}-${hours.close}`}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal: Lightbox Image Zoom Preview Overlay */}
      {previewImageUrl && (
        <div 
          className="modal-overlay" 
          style={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 1200, cursor: 'zoom-out' }}
          onClick={() => setPreviewImageUrl(null)}
        >
          <div style={{ position: 'relative', width: '90%', height: '90%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <button 
              className="btn btn-outline" 
              style={{ position: 'absolute', top: '10px', right: '10px', padding: '6px 12px', borderRadius: '50%', width: '40px', height: '40px', display: 'flex', alignItems: 'center', justify: 'center', fontWeight: '700', backgroundColor: '#ffffff', color: '#0f172a', border: 'none', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', cursor: 'pointer', zIndex: 1210 }}
              onClick={(e) => { e.stopPropagation(); setPreviewImageUrl(null); }}
            >
              ✕
            </button>
            <img 
              src={previewImageUrl} 
              style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }} 
              alt="Zoom Preview"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </div>
      )}

    </div>
  );
}
