import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import roopsyLogo from './assets/logo.jpeg';
import { 
  LayoutDashboard, 
  Scissors, 
  Store, 
  Users, 
  Bell, 
  BarChart3, 
  Settings, 
  LogOut, 
  Search, 
  Calendar, 
  ChevronRight, 
  ChevronDown, 
  Check, 
  X, 
  Plus, 
  Eye, 
  EyeOff, 
  Sparkles, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  TrendingUp, 
  TrendingDown, 
  Layers, 
  Phone, 
  Mail, 
  MapPin, 
  Send, 
  RotateCw, 
  Wifi, 
  WifiOff, 
  DollarSign, 
  ShoppingBag,
  HeartHandshake,
  UserCheck
} from 'lucide-react';

// API Configuration with auto-fallback and Mixed Content protection
const getCleanApiBase = () => {
  const envBase = (import.meta.env.VITE_API_BASE || "").trim().replace(/\/+$/, "");
  
  // If running in browser over HTTPS and envBase is insecure HTTP (e.g. http://76.13.246.224:4000)
  // modern browsers block it (Mixed Content). We use '/api' to proxy via Render _redirects!
  if (typeof window !== "undefined" && window.location.protocol === "https:" && envBase.startsWith("http://")) {
    console.warn("[API] Insecure HTTP base detected on HTTPS page. Falling back to '/api' to prevent Mixed Content blocking.");
    return "/api";
  }

  if (!envBase) return "/api";
  
  // Ensure that absolute URLs end with /api
  if (envBase.startsWith("http") && !envBase.endsWith("/api")) {
    return `${envBase}/api`;
  }
  
  return envBase;
};

const DEFAULT_API_URL = getCleanApiBase();
const RENDER_FALLBACK_URL = "http://76.13.246.224:4000/api";

export default function App() {
  // Auth state
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(localStorage.getItem("admin_token")));
  const [adminUser, setAdminUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem("admin_user") || "null");
    } catch {
      return null;
    }
  });
  const [loginForm, setLoginForm] = useState({ identifier: "priyanshu@roopsy.com", password: "Priyanshu@roopsy@@" });
  const [showPassword, setShowPassword] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [activeTab, setActiveTab] = useState("dashboard"); // 'dashboard' | 'tailor' | 'barber' | 'beauty' | 'shops' | 'users' | 'notifications' | 'reports' | 'settings'

  // API Connectivity State
  const [apiUrl, setApiUrl] = useState(DEFAULT_API_URL);
  const [isOnline, setIsOnline] = useState(true);
  const [toastMessage, setToastMessage] = useState(null);

  // Search Query
  const [searchQuery, setSearchQuery] = useState("");

  // Loading States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Live Database Stats (initialized to zero, populated strictly from API)
  const [stats, setStats] = useState({
    totalShops: 0,
    pendingApprovals: 0,
    totalUsers: 0,
    totalNotifications: 0,
    tailor: { total: 0, active: 0, pending: 0, approved: 0, rejected: 0 },
    barber: { total: 0, active: 0, pending: 0, approved: 0, rejected: 0 },
    beauty: { total: 0, active: 0, pending: 0, approved: 0, rejected: 0 },
    other: { total: 0 },
    totalOrders: 0,
    totalRevenue: 0,
    platformCommission: 0,
    dailyRevenue: 0,
    dailyCommission: 0,
    weeklyRevenue: 0,
    weeklyCommission: 0,
    monthlyRevenue: 0,
    monthlyCommission: 0
  });

  const [shops, setShops] = useState([]);
  const [usersList, setUsersList] = useState([]);
  const [notificationsList, setNotificationsList] = useState([]);
  const [activitiesList, setActivitiesList] = useState([]);

  // Modals
  const [showAddShopModal, setShowAddShopModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectingShop, setRejectingShop] = useState(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedShop, setSelectedShop] = useState(null);
  const [shopDetailsLoading, setShopDetailsLoading] = useState(false);
  const [shopDetailedData, setShopDetailedData] = useState(null);
  const [showNotificationModal, setShowNotificationModal] = useState(false);
  const [showManageUserModal, setShowManageUserModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [editingRole, setEditingRole] = useState("customer");
  const [blockDurationValue, setBlockDurationValue] = useState(1);
  const [blockDurationUnit, setBlockDurationUnit] = useState("days");
  const [blockReasonInput, setBlockReasonInput] = useState("");
  const [isSubmittingBlock, setIsSubmittingBlock] = useState(false);

  // Add Shop Form State
  const [newShopForm, setNewShopForm] = useState({
    shopName: "",
    ownerName: "",
    category: "barber",
    phone: "",
    email: "",
    city: "New Delhi",
    state: "Delhi",
    approvalStatus: "approved"
  });

  // Notification Form State
  const [notifForm, setNotifForm] = useState({
    target: "all",
    title: "",
    body: "",
    type: "system"
  });

  // Sub-dashboard filter tabs: 'all' | 'pending' | 'approved' | 'rejected'
  const [subDashboardFilter, setSubDashboardFilter] = useState("all");

  // Show Toast notification
  const showToast = (msg, type = "success") => {
    setToastMessage({ text: msg, type });
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Comprehensive data fetch strictly from Backend API & MongoDB
  const fetchAllData = useCallback(async () => {
    const token = localStorage.getItem("admin_token");
    if (!token) {
      setIsAuthenticated(false);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;

      // Parallel fetch from live endpoints
      const [statsRes, tailorsRes, barbersRes, usersRes, notifsRes, actsRes] = await Promise.allSettled([
        axios.get(`${apiUrl}/admin-panel/dashboard-stats`),
        axios.get(`${apiUrl}/admin-panel/tailors`),
        axios.get(`${apiUrl}/admin-panel/barbers`),
        axios.get(`${apiUrl}/admin-panel/users`),
        axios.get(`${apiUrl}/admin-panel/notifications`),
        axios.get(`${apiUrl}/admin-panel/recent-activity`)
      ]);

      // Check for 401 Unauthorized
      const anyUnauthorized = [statsRes, tailorsRes, barbersRes, usersRes, notifsRes, actsRes].some(
        res => res.status === "rejected" && res.reason?.response?.status === 401
      );

      if (anyUnauthorized) {
        localStorage.removeItem("admin_token");
        localStorage.removeItem("admin_user");
        setIsAuthenticated(false);
        showToast("Session expired or unauthorized. Please log in as Admin.", "danger");
        setLoading(false);
        setRefreshing(false);
        return;
      }

      let allShops = [];

      // Process Live Tailors
      if (tailorsRes.status === "fulfilled" && Array.isArray(tailorsRes.value.data)) {
        const tailorShops = tailorsRes.value.data.map(t => ({
          id: t._id,
          name: t.shopName || "Unnamed Tailor",
          category: "Tailor",
          categoryKey: "tailor",
          owner: t.ownerName || (t.userId && t.userId.name) || "Tailor Partner",
          phone: t.mobileNumber || (t.userId && t.userId.phone) || "",
          email: (t.userId && t.userId.email) || "",
          city: (t.address && (t.address.city || t.address.line1)) || "N/A",
          submittedOn: t.createdAt ? new Date(t.createdAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "N/A",
          rawDate: t.createdAt ? new Date(t.createdAt) : new Date(0),
          status: t.approvalStatus || "pending",
          isOpen: t.isShopOpen !== false,
          raw: t
        }));
        allShops.push(...tailorShops);
      }

      // Process Live Barbers & Beauty Parlours
      if (barbersRes.status === "fulfilled" && Array.isArray(barbersRes.value.data)) {
        const barberShops = barbersRes.value.data.map(b => {
          const isBeauty = /beauty|parlou?r|ladies/i.test(b.businessCategory || b.shopName || "");
          return {
            id: b._id,
            name: b.shopName || "Unnamed Salon",
            category: isBeauty ? "Beauty Parlour" : "Barber",
            categoryKey: isBeauty ? "beauty" : "barber",
            owner: b.ownerName || (b.userId && b.userId.name) || (isBeauty ? "Parlour Partner" : "Barber Partner"),
            phone: b.mobileNumber || (b.userId && b.userId.phone) || "",
            email: (b.userId && b.userId.email) || "",
            city: (b.address && (b.address.city || b.address.line1)) || "N/A",
            submittedOn: b.createdAt ? new Date(b.createdAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : "N/A",
            rawDate: b.createdAt ? new Date(b.createdAt) : new Date(0),
            status: b.approvalStatus || "pending",
            isOpen: b.isShopOpen !== false,
            raw: b
          };
        });
        allShops.push(...barberShops);
      }

      // Sort real shops by date descending
      allShops.sort((a, b) => b.rawDate - a.rawDate);
      setShops(allShops);

      // Process Live Database Stats without hardcoded dummy fallbacks
      if (statsRes.status === "fulfilled" && statsRes.value.data) {
        const d = statsRes.value.data;
        setStats({
          totalShops: d.totalShops ?? allShops.length,
          pendingApprovals: d.pendingApprovals ?? allShops.filter(s => s.status === 'pending').length,
          totalUsers: d.totalUsers ?? 0,
          totalNotifications: d.totalNotifications ?? 0,
          tailor: {
            total: d.totalTailors ?? allShops.filter(s => s.categoryKey === 'tailor').length,
            active: d.activeTailors ?? allShops.filter(s => s.categoryKey === 'tailor' && s.isOpen).length,
            pending: d.pendingTailors ?? allShops.filter(s => s.categoryKey === 'tailor' && s.status === 'pending').length,
            approved: d.approvedTailors ?? allShops.filter(s => s.categoryKey === 'tailor' && s.status === 'approved').length,
            rejected: d.rejectedTailors ?? allShops.filter(s => s.categoryKey === 'tailor' && s.status === 'rejected').length
          },
          barber: {
            total: d.totalBarbers ?? allShops.filter(s => s.categoryKey === 'barber').length,
            active: d.activeBarbers ?? allShops.filter(s => s.categoryKey === 'barber' && s.isOpen).length,
            pending: d.pendingBarbers ?? allShops.filter(s => s.categoryKey === 'barber' && s.status === 'pending').length,
            approved: d.approvedBarbers ?? allShops.filter(s => s.categoryKey === 'barber' && s.status === 'approved').length,
            rejected: d.rejectedBarbers ?? allShops.filter(s => s.categoryKey === 'barber' && s.status === 'rejected').length
          },
          beauty: {
            total: d.totalParlours ?? allShops.filter(s => s.categoryKey === 'beauty').length,
            active: d.activeParlours ?? allShops.filter(s => s.categoryKey === 'beauty' && s.isOpen).length,
            pending: d.pendingParlours ?? allShops.filter(s => s.categoryKey === 'beauty' && s.status === 'pending').length,
            approved: d.approvedParlours ?? allShops.filter(s => s.categoryKey === 'beauty' && s.status === 'approved').length,
            rejected: d.rejectedParlours ?? allShops.filter(s => s.categoryKey === 'beauty' && s.status === 'rejected').length
          },
          other: {
            total: Math.max(0, (d.totalShops || allShops.length) - ((d.totalTailors || 0) + (d.totalBarbers || 0) + (d.totalParlours || 0)))
          },
          totalOrders: d.totalOrders ?? 0,
          totalRevenue: d.totalRevenue ?? 0,
          platformCommission: d.platformCommission ?? 0,
          dailyRevenue: d.dailyRevenue ?? 0,
          dailyCommission: d.dailyCommission ?? 0,
          weeklyRevenue: d.weeklyRevenue ?? 0,
          weeklyCommission: d.weeklyCommission ?? 0,
          monthlyRevenue: d.monthlyRevenue ?? 0,
          monthlyCommission: d.monthlyCommission ?? 0
        });
      }

      // Process Live Users
      if (usersRes.status === "fulfilled" && Array.isArray(usersRes.value.data)) {
        setUsersList(usersRes.value.data);
      } else {
        setUsersList([]);
      }

      // Process Live Notifications
      if (notifsRes.status === "fulfilled" && Array.isArray(notifsRes.value.data)) {
        setNotificationsList(notifsRes.value.data);
      } else {
        setNotificationsList([]);
      }

      // Process Live Activities
      if (actsRes.status === "fulfilled" && Array.isArray(actsRes.value.data)) {
        setActivitiesList(actsRes.value.data);
      } else {
        setActivitiesList([]);
      }

      setIsOnline(true);
    } catch (err) {
      console.error("API connect error:", err);
      setIsOnline(false);
      showToast("Error connecting to backend API: " + (err.response?.data?.error || err.message), "danger");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [apiUrl]);

  // Setup Axios default headers & fetch data
  useEffect(() => {
    const token = localStorage.getItem("admin_token");
    if (token) {
      axios.defaults.headers.common["Authorization"] = `Bearer ${token}`;
      fetchAllData();
    } else {
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, [fetchAllData]);

  // ACTION: Admin Login
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError("");

    try {
      const res = await axios.post(`${apiUrl}/auth/login`, {
        identifier: loginForm.identifier.trim(),
        password: loginForm.password
      });

      if (res.data?.token) {
        if (res.data.user && res.data.user.role !== "admin") {
          setLoginError("Access denied: This account does not have admin permissions.");
          setLoginLoading(false);
          return;
        }

        localStorage.setItem("admin_token", res.data.token);
        localStorage.setItem("admin_user", JSON.stringify(res.data.user || { name: "Super Admin", role: "admin" }));
        axios.defaults.headers.common["Authorization"] = `Bearer ${res.data.token}`;
        setAdminUser(res.data.user || { name: "Super Admin", role: "admin" });
        setIsAuthenticated(true);
        showToast("Signed in successfully as Administrator!");
        fetchAllData();
      } else {
        setLoginError("Login failed: Invalid server response.");
      }
    } catch (err) {
      console.error("Login error:", err);
      const isMixedContent = typeof window !== "undefined" && window.location.protocol === "https:" && apiUrl.startsWith("http://");
      if (isMixedContent) {
        setLoginError("Browser Security Block (Mixed Content): HTTPS page cannot connect to http:// API directly. Please set VITE_API_BASE=/api on Render.");
      } else {
        setLoginError(err.response?.data?.error || "Invalid Email/Phone or password.");
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // ACTION: Logout
  const handleLogout = () => {
    localStorage.removeItem("admin_token");
    localStorage.removeItem("admin_user");
    delete axios.defaults.headers.common["Authorization"];
    setIsAuthenticated(false);
    setAdminUser(null);
    setShops([]);
    setUsersList([]);
    setNotificationsList([]);
    setActivitiesList([]);
    showToast("Logged out successfully");
  };

  // ACTION: Approve / Accept Shop
  const handleApproveShop = async (shop) => {
    try {
      const endpoint = shop.categoryKey === 'tailor' 
        ? `${apiUrl}/admin-panel/tailors/${shop.id}` 
        : `${apiUrl}/admin-panel/barbers/${shop.id}`;

      await axios.patch(endpoint, { 
        approvalStatus: "approved", 
        isShopOpen: true,
        rejectionReason: "" 
      });
      showToast(`"${shop.name}" has been approved successfully!`);
      await fetchAllData();
    } catch (err) {
      console.error("Backend update failed:", err);
      showToast(`Approval failed: ${err.response?.data?.error || err.message}`, "danger");
    }
  };

  // ACTION: Open Reject Modal
  const handleOpenReject = (shop) => {
    setRejectingShop(shop);
    setRejectionReason(shop.raw?.rejectionReason || "");
    setShowRejectModal(true);
  };

  // ACTION: Submit Reject
  const handleConfirmReject = async () => {
    if (!rejectingShop) return;
    try {
      const endpoint = rejectingShop.categoryKey === 'tailor' 
        ? `${apiUrl}/admin-panel/tailors/${rejectingShop.id}` 
        : `${apiUrl}/admin-panel/barbers/${rejectingShop.id}`;

      await axios.patch(endpoint, { 
        approvalStatus: "rejected", 
        isShopOpen: false,
        rejectionReason: rejectionReason || "Does not meet platform guidelines" 
      });
      showToast(`"${rejectingShop.name}" has been rejected.`);
      setShowRejectModal(false);
      setRejectingShop(null);
      await fetchAllData();
    } catch (err) {
      console.error("Backend rejection failed:", err);
      showToast(`Rejection failed: ${err.response?.data?.error || err.message}`, "danger");
    }
  };

  // ACTION: Toggle Shop Open / Closed Status
  const handleToggleShopStatus = async (shop) => {
    try {
      const endpoint = shop.categoryKey === 'tailor' 
        ? `${apiUrl}/admin-panel/tailors/${shop.id}` 
        : `${apiUrl}/admin-panel/barbers/${shop.id}`;

      const nextStatus = !shop.isOpen;
      await axios.patch(endpoint, { isShopOpen: nextStatus });
      showToast(`Shop "${shop.name}" marked as ${nextStatus ? 'Open' : 'Closed'}`);
      setSelectedShop(prev => prev ? { ...prev, isOpen: nextStatus } : null);
      await fetchAllData();
    } catch (err) {
      console.error("Backend toggle failed:", err);
      showToast(`Failed to update shop status: ${err.response?.data?.error || err.message}`, "danger");
    }
  };

  // ACTION: Open Shop Details with Live Orders & Statistics
  const handleOpenShopDetails = async (shop) => {
    setSelectedShop(shop);
    setShopDetailedData(null);
    setShowDetailsModal(true);
    setShopDetailsLoading(true);
    try {
      const res = await axios.get(`${apiUrl}/admin-panel/partners/${shop.id}/details?type=${shop.categoryKey}`);
      setShopDetailedData(res.data);
    } catch (err) {
      console.error("Failed to load shop details:", err);
    } finally {
      setShopDetailsLoading(false);
    }
  };

  // ACTION: Open Manage User Modal
  const handleOpenManageUser = (user) => {
    setSelectedUser(user);
    setEditingRole(user.role || "customer");
    setBlockDurationValue(1);
    setBlockDurationUnit("days");
    setBlockReasonInput(user.blockReason || "");
    setShowManageUserModal(true);
  };

  // ACTION: Block User Temporarily
  const handleBlockUser = async () => {
    if (!selectedUser) return;
    if (selectedUser.role === 'admin' && selectedUser._id === adminUser?._id) {
      alert("You cannot suspend your own admin account.");
      return;
    }
    const val = Number(blockDurationValue);
    if (!val || val <= 0) {
      showToast("Please enter a valid positive duration number.", "danger");
      return;
    }

    setIsSubmittingBlock(true);
    try {
      const res = await axios.patch(`${apiUrl}/admin-panel/users/${selectedUser._id}/block`, {
        durationValue: val,
        durationUnit: blockDurationUnit,
        reason: blockReasonInput.trim() || undefined
      });
      showToast(res.data?.message || `User "${selectedUser.name}" temporarily suspended.`);
      setShowManageUserModal(false);
      setSelectedUser(null);
      await fetchAllData();
    } catch (err) {
      console.error("Block user failed:", err);
      showToast(`Failed to suspend user: ${err.response?.data?.error || err.message}`, "danger");
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  // ACTION: Unblock User
  const handleUnblockUser = async () => {
    if (!selectedUser) return;
    setIsSubmittingBlock(true);
    try {
      const res = await axios.patch(`${apiUrl}/admin-panel/users/${selectedUser._id}/unblock`);
      showToast(res.data?.message || `User "${selectedUser.name}" suspension removed.`);
      setShowManageUserModal(false);
      setSelectedUser(null);
      await fetchAllData();
    } catch (err) {
      console.error("Unblock user failed:", err);
      showToast(`Failed to unblock user: ${err.response?.data?.error || err.message}`, "danger");
    } finally {
      setIsSubmittingBlock(false);
    }
  };

  // ACTION: Update User Role
  const handleUpdateUserRole = async () => {
    if (!selectedUser) return;
    try {
      await axios.patch(`${apiUrl}/admin-panel/users/${selectedUser._id}/role`, {
        role: editingRole
      });
      showToast(`User "${selectedUser.name}" role updated to ${editingRole}!`);
      setShowManageUserModal(false);
      setSelectedUser(null);
      await fetchAllData();
    } catch (err) {
      console.error("Update role failed:", err);
      showToast(`Failed to update role: ${err.response?.data?.error || err.message}`, "danger");
    }
  };

  // ACTION: Delete User
  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    if (selectedUser.role === 'admin' && selectedUser._id === adminUser?._id) {
      alert("You cannot delete your own admin account.");
      return;
    }
    if (!confirm(`Are you sure you want to delete user "${selectedUser.name}"? This action cannot be undone.`)) {
      return;
    }
    try {
      await axios.delete(`${apiUrl}/admin-panel/users/${selectedUser._id}`);
      showToast(`User "${selectedUser.name}" deleted successfully.`);
      setShowManageUserModal(false);
      setSelectedUser(null);
      await fetchAllData();
    } catch (err) {
      console.error("Delete user failed:", err);
      showToast(`Failed to delete user: ${err.response?.data?.error || err.message}`, "danger");
    }
  };

  // ACTION: Create New Shop
  const handleCreateShop = async (e) => {
    e.preventDefault();
    if (!newShopForm.shopName || !newShopForm.ownerName) {
      alert("Please provide Shop Name and Owner Name");
      return;
    }

    try {
      await axios.post(`${apiUrl}/admin-panel/shops`, newShopForm);
      showToast(`Shop "${newShopForm.shopName}" onboarded successfully!`);
      setShowAddShopModal(false);
      setNewShopForm({
        shopName: "",
        ownerName: "",
        category: "barber",
        phone: "",
        email: "",
        city: "New Delhi",
        state: "Delhi",
        approvalStatus: "approved"
      });
      await fetchAllData();
    } catch (err) {
      console.error("API create failed:", err);
      showToast(`Failed to create shop: ${err.response?.data?.error || err.message}`, "danger");
    }
  };

  // ACTION: Send Notification
  const handleSendNotification = async (e) => {
    e.preventDefault();
    if (!notifForm.title || !notifForm.body) {
      alert("Please fill title and body");
      return;
    }

    try {
      await axios.post(`${apiUrl}/admin-panel/notifications`, notifForm);
      showToast("Notification broadcasted successfully!");
      setShowNotificationModal(false);
      setNotifForm({ target: "all", title: "", body: "", type: "system" });
      await fetchAllData();
    } catch (err) {
      console.error("Backend notification call failed:", err);
      showToast(`Failed to send notification: ${err.response?.data?.error || err.message}`, "danger");
    }
  };

  // Filter pending approvals for the Main Dashboard
  const pendingShops = useMemo(() => {
    return shops.filter(s => s.status === 'pending');
  }, [shops]);

  // Filter shops by category for sub-dashboards
  const filteredCategoryShops = useMemo(() => {
    let list = shops;
    if (activeTab === 'tailor') {
      list = list.filter(s => s.categoryKey === 'tailor');
    } else if (activeTab === 'barber') {
      list = list.filter(s => s.categoryKey === 'barber');
    } else if (activeTab === 'beauty') {
      list = list.filter(s => s.categoryKey === 'beauty');
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.owner && s.owner.toLowerCase().includes(q)) || (s.city && s.city.toLowerCase().includes(q)));
    }

    if (subDashboardFilter !== 'all') {
      list = list.filter(s => s.status === subDashboardFilter);
    }

    return list;
  }, [shops, activeTab, searchQuery, subDashboardFilter]);

  // Search filtered shops for "All Shops" tab
  const allShopsFiltered = useMemo(() => {
    let list = shops;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(s => (s.name && s.name.toLowerCase().includes(q)) || (s.owner && s.owner.toLowerCase().includes(q)) || (s.city && s.city.toLowerCase().includes(q)));
    }
    if (subDashboardFilter !== 'all') {
      list = list.filter(s => s.status === subDashboardFilter);
    }
    return list;
  }, [shops, searchQuery, subDashboardFilter]);

  // Filter category-specific recent activity
  const categoryActivities = useMemo(() => {
    return activitiesList.filter(a => {
      if (activeTab === 'tailor') return a.category === 'Tailor';
      if (activeTab === 'barber') return a.category === 'Barber';
      if (activeTab === 'beauty') return a.category === 'Beauty Parlour';
      return true;
    });
  }, [activitiesList, activeTab]);

  // Filter users by search query
  const filteredUsers = useMemo(() => {
    if (!searchQuery.trim()) return usersList;
    const q = searchQuery.toLowerCase();
    return usersList.filter(u => 
      (u.name && u.name.toLowerCase().includes(q)) ||
      (u.email && u.email.toLowerCase().includes(q)) ||
      (u.phone && u.phone.toLowerCase().includes(q)) ||
      (u.role && u.role.toLowerCase().includes(q))
    );
  }, [usersList, searchQuery]);

  // If unauthenticated, render the Admin Login Screen
  if (!isAuthenticated) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#0b1329',
        padding: '20px'
      }}>
        {toastMessage && (
          <div style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            backgroundColor: toastMessage.type === 'danger' ? '#ef4444' : '#10b981',
            color: '#ffffff',
            padding: '12px 20px',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '14px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <CheckCircle2 size={18} />
            {toastMessage.text}
          </div>
        )}

        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          width: '100%',
          maxWidth: '440px',
          padding: '36px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '60px',
              height: '60px',
              borderRadius: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px',
              overflow: 'hidden',
              boxShadow: '0 8px 20px rgba(0,0,0,0.12)',
              border: '2px solid #e2e8f0',
              backgroundColor: '#ffffff'
            }}>
              <img src={roopsyLogo} alt="Roopsy Logo" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: '800', color: '#0f172a', marginBottom: '6px' }}>Roopsy Admin</h1>
            <p style={{ fontSize: '14px', color: '#64748b' }}>Enter your administrator credentials to access live production data</p>
          </div>

          {loginError && (
            <div style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fecaca',
              color: '#b91c1c',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              fontWeight: '600',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <AlertCircle size={16} />
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-field" style={{ marginBottom: '16px' }}>
              <label className="form-label">Email or Phone Number</label>
              <input 
                type="text" 
                required 
                placeholder="priyanshu@roopsy.com" 
                className="form-input-text"
                value={loginForm.identifier}
                onChange={(e) => setLoginForm(prev => ({ ...prev, identifier: e.target.value }))}
              />
            </div>

            <div className="form-field" style={{ marginBottom: '20px' }}>
              <label className="form-label">Password</label>
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <input 
                  type={showPassword ? "text" : "password"} 
                  required 
                  placeholder="••••••••" 
                  className="form-input-text"
                  style={{ paddingRight: '42px', width: '100%' }}
                  value={loginForm.password}
                  onChange={(e) => setLoginForm(prev => ({ ...prev, password: e.target.value }))}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(prev => !prev)}
                  style={{
                    position: 'absolute',
                    right: '12px',
                    background: 'transparent',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                  title={showPassword ? "Hide password" : "Show password"}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button 
              type="submit" 
              className="btn-primary" 
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: '15px' }}
              disabled={loginLoading}
            >
              {loginLoading ? "Authenticating..." : "Sign In to Admin Panel"}
            </button>
          </form>

          <div style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid #e2e8f0',
            textAlign: 'center'
          }}>
            <button
              type="button"
              style={{
                background: 'none',
                border: 'none',
                color: '#2563eb',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                textDecoration: 'underline'
              }}
              onClick={() => setLoginForm({ identifier: "priyanshu@roopsy.com", password: "Priyanshu@roopsy@@" })}
            >
              Quick-fill Admin Credentials
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-layout">
      {/* Toast Alert */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          backgroundColor: toastMessage.type === 'danger' ? '#ef4444' : '#10b981',
          color: '#ffffff',
          padding: '12px 20px',
          borderRadius: '12px',
          fontWeight: '700',
          fontSize: '14px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          gap: '10px'
        }}>
          {toastMessage.type === 'danger' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          {toastMessage.text}
        </div>
      )}

      {/* LEFT SIDEBAR */}
      <aside className="app-sidebar">
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon-box" style={{ padding: 0, overflow: 'hidden', background: '#ffffff', border: '1px solid rgba(255,255,255,0.2)' }}>
            <img src={roopsyLogo} alt="Roopsy Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} />
          </div>
          <div className="brand-text-col">
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span className="brand-title">Roopsy</span>
              <span className="brand-pro-badge">PRO</span>
            </div>
            <span className="brand-subtitle">Management Console</span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="sidebar-nav">
          {/* GROUP: OVERVIEW */}
          <div className="sidebar-group-label">Overview</div>
          <button 
            className={`sidebar-nav-item ${activeTab === 'dashboard' ? 'active-dashboard' : ''}`}
            onClick={() => { setActiveTab('dashboard'); setSubDashboardFilter('all'); }}
          >
            <div className="sidebar-item-left">
              <LayoutDashboard size={18} />
              <span>Dashboard</span>
            </div>
            {stats.pendingApprovals > 0 && (
              <span className="sidebar-pending-badge" title={`${stats.pendingApprovals} Pending Approvals`}>
                {stats.pendingApprovals}
              </span>
            )}
          </button>

          {/* GROUP: SERVICES & PARTNERS */}
          <div className="sidebar-group-label" style={{ marginTop: '6px' }}>Services & Partners</div>
          <button 
            className={`sidebar-nav-item ${activeTab === 'tailor' ? 'active-tailor' : ''}`}
            onClick={() => { setActiveTab('tailor'); setSubDashboardFilter('all'); }}
          >
            <div className="sidebar-item-left">
              <Scissors size={18} />
              <span>Tailor</span>
            </div>
            <span className="sidebar-count-badge">{stats.tailor?.total || 0}</span>
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'barber' ? 'active-barber' : ''}`}
            onClick={() => { setActiveTab('barber'); setSubDashboardFilter('all'); }}
          >
            <div className="sidebar-item-left">
              <UserCheck size={18} />
              <span>Barber</span>
            </div>
            <span className="sidebar-count-badge">{stats.barber?.total || 0}</span>
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'beauty' ? 'active-beauty' : ''}`}
            onClick={() => { setActiveTab('beauty'); setSubDashboardFilter('all'); }}
          >
            <div className="sidebar-item-left">
              <Sparkles size={18} />
              <span>Beauty Parlour</span>
            </div>
            <span className="sidebar-count-badge">{stats.beauty?.total || 0}</span>
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'shops' ? 'active-shops' : ''}`}
            onClick={() => { setActiveTab('shops'); setSubDashboardFilter('all'); }}
          >
            <div className="sidebar-item-left">
              <Store size={18} />
              <span>All Shops</span>
            </div>
            <span className="sidebar-count-badge">{stats.totalShops || 0}</span>
          </button>

          {/* GROUP: MANAGEMENT */}
          <div className="sidebar-group-label" style={{ marginTop: '6px' }}>Management</div>
          <button 
            className={`sidebar-nav-item ${activeTab === 'users' ? 'active-users' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            <div className="sidebar-item-left">
              <Users size={18} />
              <span>Users</span>
            </div>
            <span className="sidebar-count-badge">{stats.totalUsers || 0}</span>
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'notifications' ? 'active-notifications' : ''}`}
            onClick={() => setActiveTab('notifications')}
          >
            <div className="sidebar-item-left">
              <Bell size={18} />
              <span>Notifications</span>
            </div>
            {notificationsList.length > 0 && (
              <span className="nav-badge">{notificationsList.length}</span>
            )}
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'reports' ? 'active-reports' : ''}`}
            onClick={() => setActiveTab('reports')}
          >
            <div className="sidebar-item-left">
              <BarChart3 size={18} />
              <span>Reports</span>
            </div>
          </button>

          <button 
            className={`sidebar-nav-item ${activeTab === 'settings' ? 'active-settings' : ''}`}
            onClick={() => setActiveTab('settings')}
          >
            <div className="sidebar-item-left">
              <Settings size={18} />
              <span>Settings</span>
            </div>
          </button>
        </nav>

        {/* Sidebar Footer */}
        <div className="sidebar-bottom">
          {/* Live System Indicator */}
          <div className="sidebar-status-box">
            <div className="pulse-indicator-dot"></div>
            <div className="status-text-col">
              <span className="status-title">System Live</span>
              <span className="status-desc">MongoDB Atlas Connected</span>
            </div>
          </div>

          {/* User Profile Snippet & Quick Logout */}
          <div className="sidebar-user-card">
            <div className="sidebar-user-info">
              <div className="sidebar-user-avatar">
                {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : "S"}
              </div>
              <div className="sidebar-user-details">
                <span className="sidebar-user-name">{adminUser?.name || "Super Admin"}</span>
                <span className="sidebar-user-role">Super Admin</span>
              </div>
            </div>
            <button className="sidebar-logout-icon-btn" onClick={handleLogout} title="Sign Out">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <main className="app-main">
        {/* TOP HEADER */}
        <header className="top-header">
          {/* Search bar */}
          <div className="header-search-wrapper">
            <button className="header-icon-btn" title="Toggle Filters">
              <Layers size={18} />
            </button>
            <div className="header-search-input-box">
              <Search size={16} className="search-icon-inside" />
              <input 
                type="text" 
                placeholder="Search shops, users, or services..." 
                className="header-search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {/* Header Right Actions */}
          <div className="header-right-actions">
            {/* Refresh Live Data Button */}
            <button 
              className="header-icon-btn" 
              title="Refresh live data"
              onClick={() => { setRefreshing(true); fetchAllData(); }}
            >
              <RotateCw size={17} className={refreshing ? "animate-spin" : ""} />
            </button>

            {/* Notification Bell */}
            <button 
              className="header-icon-btn" 
              title="Notifications"
              onClick={() => setActiveTab('notifications')}
            >
              <Bell size={18} />
              {notificationsList.length > 0 && (
                <span className="icon-badge-dot">{notificationsList.length}</span>
              )}
            </button>

            {/* Admin Profile */}
            <div className="admin-profile-pill" onClick={() => setActiveTab('settings')}>
              <div className="admin-avatar">
                {adminUser?.name ? adminUser.name.charAt(0).toUpperCase() : "A"}
              </div>
              <div className="admin-info">
                <span className="admin-name">{adminUser?.name || "Admin"}</span>
                <span className="admin-role">Super Admin</span>
              </div>
              <ChevronDown size={14} color="#64748b" />
            </div>

            {/* Date Pill Display */}
            <div className="date-pill">
              <Calendar size={15} color="#2563eb" />
              <span>{new Date().toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' })}</span>
              <ChevronDown size={14} color="#94a3b8" />
            </div>
          </div>
        </header>

        {/* SCROLLABLE PAGE CONTENT */}
        <div className="page-content-scroll">
          {loading && shops.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '100px 0', gap: '16px' }}>
              <RotateCw size={32} className="animate-spin" color="#2563eb" />
              <span style={{ fontSize: '15px', color: '#64748b', fontWeight: '600' }}>Fetching live database records...</span>
            </div>
          ) : (
            <>
              {/* TAB 1: MAIN DASHBOARD */}
              {activeTab === 'dashboard' && (
                <div>
                  {/* Header Title */}
                  <div className="page-header-row">
                    <div className="page-title-box">
                      <h1 className="page-title">Dashboard</h1>
                      <span className="page-subtitle">Welcome back, {adminUser?.name || "Admin"}! 👋</span>
                    </div>
                  </div>

                  {/* 4 TOP STAT CARDS */}
                  <div className="stat-cards-grid">
                    {/* Total Shops */}
                    <div className="stat-card">
                      <div className="stat-card-header">
                        <span className="stat-card-label">Total Shops</span>
                        <div className="stat-card-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb', border: '1px solid #dbeafe' }}>
                          <Store size={19} />
                        </div>
                      </div>
                      <div>
                        <h2 className="stat-card-value">{stats.totalShops}</h2>
                        <span className="stat-card-sub stat-trend-up">
                          <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block' }}></span>
                          {(stats.tailor?.active || 0) + (stats.barber?.active || 0) + (stats.beauty?.active || 0)} currently open
                        </span>
                      </div>
                    </div>

                    {/* Pending Approvals */}
                    <div className="stat-card">
                      <div className="stat-card-header">
                        <span className="stat-card-label">Pending Approvals</span>
                        <div className="stat-card-icon-box" style={{ backgroundColor: '#fffbeb', color: '#d97706', border: '1px solid #fef3c7' }}>
                          <Clock size={19} />
                        </div>
                      </div>
                      <div>
                        <h2 className="stat-card-value">{stats.pendingApprovals}</h2>
                        <span className="stat-card-sub stat-trend-amber">
                          {stats.pendingApprovals > 0 ? "Needs your review" : "All shops reviewed"}
                        </span>
                      </div>
                    </div>

                    {/* Total Users */}
                    <div className="stat-card">
                      <div className="stat-card-header">
                        <span className="stat-card-label">Total Users</span>
                        <div className="stat-card-icon-box" style={{ backgroundColor: '#ecfdf5', color: '#059669', border: '1px solid #d1fae5' }}>
                          <Users size={19} />
                        </div>
                      </div>
                      <div>
                        <h2 className="stat-card-value">{stats.totalUsers}</h2>
                        <span className="stat-card-sub stat-trend-up">
                          <TrendingUp size={13} /> Registered platform accounts
                        </span>
                      </div>
                    </div>

                    {/* Total Notifications */}
                    <div className="stat-card">
                      <div className="stat-card-header">
                        <span className="stat-card-label">Total Notifications</span>
                        <div className="stat-card-icon-box" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed', border: '1px solid #ede9fe' }}>
                          <Bell size={19} />
                        </div>
                      </div>
                      <div>
                        <h2 className="stat-card-value">{stats.totalNotifications}</h2>
                        <span className="stat-card-sub stat-trend-up">
                          <TrendingUp size={13} /> Sent system alerts
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* BALANCED 2-COLUMN DASHBOARD GRID */}
                  <div className="dashboard-main-grid">
                    {/* LEFT COLUMN: Pending Approvals & Service Categories */}
                    <div className="dashboard-left-col">
                      {/* CARD 1: Pending Shop Approvals Table */}
                      <div className="section-card">
                        <div className="section-card-header">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <h3 className="section-card-title">Pending Shop Approvals</h3>
                            {pendingShops.length > 0 && (
                              <span style={{ fontSize: '11px', backgroundColor: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                {pendingShops.length} Pending
                              </span>
                            )}
                          </div>
                          <button className="view-all-link" onClick={() => setActiveTab('shops')}>
                            View All <ChevronRight size={14} />
                          </button>
                        </div>

                        <div className="table-responsive">
                          <table className="smart-table">
                            <thead>
                              <tr>
                                <th>Shop Name</th>
                                <th>Category</th>
                                <th>Owner</th>
                                <th>Submitted On</th>
                                <th style={{ textAlign: 'center' }}>Action</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pendingShops.length === 0 ? (
                                <tr>
                                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px 20px', color: '#64748b' }}>
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                      <div style={{ width: 36, height: 36, borderRadius: '50%', backgroundColor: '#ecfdf5', color: '#10b981', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                        <CheckCircle2 size={20} />
                                      </div>
                                      <span style={{ fontWeight: '600', fontSize: '13.5px', color: '#334155' }}>All shops have been reviewed</span>
                                      <span style={{ fontSize: '12px', color: '#94a3b8' }}>No pending partner applications require approval right now.</span>
                                    </div>
                                  </td>
                                </tr>
                              ) : (
                                pendingShops.map((shop) => (
                                  <tr key={shop.id}>
                                    <td>
                                      <div className="shop-name-cell">
                                        <div className="shop-icon-circle">
                                          {shop.categoryKey === 'tailor' ? <Scissors size={16} /> : (shop.categoryKey === 'beauty' ? <Sparkles size={16} /> : <Store size={16} />)}
                                        </div>
                                        <span>{shop.name}</span>
                                      </div>
                                    </td>
                                    <td>
                                      <span className={`cat-pill ${shop.categoryKey}`}>
                                        {shop.category}
                                      </span>
                                    </td>
                                    <td>{shop.owner}</td>
                                    <td style={{ color: '#64748b', fontSize: '12.5px' }}>{shop.submittedOn}</td>
                                    <td>
                                      <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                                        <button 
                                          className="btn-view-pill"
                                          onClick={() => handleOpenShopDetails(shop)}
                                          title="View full shop & orders details"
                                        >
                                          View
                                        </button>
                                        <button 
                                          className="btn-approve" 
                                          onClick={() => handleApproveShop(shop)}
                                        >
                                          Approve
                                        </button>
                                        <button 
                                          className="btn-reject" 
                                          onClick={() => handleOpenReject(shop)}
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* CARD 2: Service Categories */}
                      <div className="section-card">
                        <div className="section-card-header">
                          <h3 className="section-card-title">Service Categories</h3>
                          <button className="view-all-link" onClick={() => setActiveTab('shops')}>
                            View All <ChevronRight size={14} />
                          </button>
                        </div>

                        <div className="categories-grid">
                          {/* Tailor Card */}
                          <div className="category-highlight-card cat-card-tailor" onClick={() => setActiveTab('tailor')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div className="cat-card-top-icon">
                                <Scissors size={18} />
                              </div>
                              <span style={{ fontSize: '11px', backgroundColor: '#f5f3ff', color: '#7c3aed', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                Active
                              </span>
                            </div>
                            <div>
                              <div className="cat-card-title">Tailor</div>
                              <div className="cat-card-count">{stats.tailor.total} Registered Shops</div>
                            </div>
                            <div className="cat-card-footer">
                              <span>Manage Tailors</span>
                              <ChevronRight size={13} />
                            </div>
                          </div>

                          {/* Barber Card */}
                          <div className="category-highlight-card cat-card-barber" onClick={() => setActiveTab('barber')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div className="cat-card-top-icon">
                                <Store size={18} />
                              </div>
                              <span style={{ fontSize: '11px', backgroundColor: '#f0f9ff', color: '#0284c7', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                Active
                              </span>
                            </div>
                            <div>
                              <div className="cat-card-title">Barber</div>
                              <div className="cat-card-count">{stats.barber.total} Registered Shops</div>
                            </div>
                            <div className="cat-card-footer">
                              <span>Manage Barbers</span>
                              <ChevronRight size={13} />
                            </div>
                          </div>

                          {/* Beauty Parlour Card */}
                          <div className="category-highlight-card cat-card-beauty" onClick={() => setActiveTab('beauty')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div className="cat-card-top-icon">
                                <Sparkles size={18} />
                              </div>
                              <span style={{ fontSize: '11px', backgroundColor: '#fdf2f8', color: '#db2777', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                Active
                              </span>
                            </div>
                            <div>
                              <div className="cat-card-title">Beauty Parlour</div>
                              <div className="cat-card-count">{stats.beauty.total} Registered Shops</div>
                            </div>
                            <div className="cat-card-footer">
                              <span>Manage Parlours</span>
                              <ChevronRight size={13} />
                            </div>
                          </div>

                          {/* Other Services Card */}
                          <div className="category-highlight-card cat-card-other" onClick={() => setActiveTab('shops')}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                              <div className="cat-card-top-icon">
                                <Layers size={18} />
                              </div>
                              <span style={{ fontSize: '11px', backgroundColor: '#f0fdfa', color: '#0d9488', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                                Explore
                              </span>
                            </div>
                            <div>
                              <div className="cat-card-title">Other Services</div>
                              <div className="cat-card-count">{stats.other.total} Registered Shops</div>
                            </div>
                            <div className="cat-card-footer">
                              <span>View Categories</span>
                              <ChevronRight size={13} />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* RIGHT COLUMN: Quick Actions & Recent Activity */}
                    <div className="dashboard-right-col">
                      {/* CARD 1: Quick Actions */}
                      <div className="section-card">
                        <div className="section-card-header">
                          <h3 className="section-card-title">Quick Actions</h3>
                        </div>

                        <div className="quick-actions-list">
                          <div className="quick-action-item" onClick={() => setShowAddShopModal(true)}>
                            <div className="quick-action-left">
                              <div className="qa-icon-box" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                                <Plus size={18} />
                              </div>
                              <span>Add New Shop</span>
                            </div>
                            <ChevronRight size={16} color="#94a3b8" />
                          </div>

                          <div className="quick-action-item" onClick={() => setShowNotificationModal(true)}>
                            <div className="quick-action-left">
                              <div className="qa-icon-box" style={{ backgroundColor: '#f5f3ff', color: '#7c3aed' }}>
                                <Bell size={18} />
                              </div>
                              <span>Send Notification</span>
                            </div>
                            <ChevronRight size={16} color="#94a3b8" />
                          </div>

                          <div className="quick-action-item" onClick={() => setActiveTab('shops')}>
                            <div className="quick-action-left">
                              <div className="qa-icon-box" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>
                                <Eye size={18} />
                              </div>
                              <span>View All Shops</span>
                            </div>
                            <ChevronRight size={16} color="#94a3b8" />
                          </div>

                          <div className="quick-action-item" onClick={() => setActiveTab('shops')}>
                            <div className="quick-action-left">
                              <div className="qa-icon-box" style={{ backgroundColor: '#fffbeb', color: '#d97706' }}>
                                <Layers size={18} />
                              </div>
                              <span>Manage Categories</span>
                            </div>
                            <ChevronRight size={16} color="#94a3b8" />
                          </div>

                          <div className="quick-action-item" onClick={() => setActiveTab('reports')}>
                            <div className="quick-action-left">
                              <div className="qa-icon-box" style={{ backgroundColor: '#f0fdfa', color: '#0d9488' }}>
                                <BarChart3 size={18} />
                              </div>
                              <span>View Reports</span>
                            </div>
                            <ChevronRight size={16} color="#94a3b8" />
                          </div>
                        </div>
                      </div>

                      {/* CARD 2: Recent Notifications / Live Activity List */}
                      <div className="section-card">
                        <div className="section-card-header">
                          <h3 className="section-card-title">Recent Activity</h3>
                          <button className="view-all-link" onClick={() => setActiveTab('notifications')}>
                            View All <ChevronRight size={14} />
                          </button>
                        </div>

                        <div className="activity-feed-list">
                          {activitiesList.length === 0 ? (
                            <p style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>No recent activity recorded.</p>
                          ) : (
                            activitiesList.slice(0, 5).map((act, idx) => (
                              <div className="activity-feed-item" key={idx}>
                                <div 
                                  className="activity-icon-badge"
                                  style={{
                                    backgroundColor: act.status === 'approved' ? '#ecfdf5' : (act.type === 'system_update' ? '#f5f3ff' : '#eff6ff'),
                                    color: act.status === 'approved' ? '#10b981' : (act.type === 'system_update' ? '#7c3aed' : '#2563eb')
                                  }}
                                >
                                  {act.status === 'approved' ? <CheckCircle2 size={16} /> : (act.type === 'system_update' ? <Bell size={16} /> : <Store size={16} />)}
                                </div>
                                <div className="activity-body">
                                  <span className="activity-action-title">{act.action}</span>
                                  <span className="activity-description">{act.shopName}</span>
                                  <span className="activity-time">
                                    {act.createdAt ? new Date(act.createdAt).toLocaleString("en-GB", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                  </span>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2, 3, 4: TAILOR, BARBER, BEAUTY SUB-DASHBOARDS */}
              {(activeTab === 'tailor' || activeTab === 'barber' || activeTab === 'beauty') && (
                <div>
                  {/* Header Title with Subtitle */}
                  <div className="page-header-row">
                    <div className="page-title-box">
                      <h1 className="page-title">
                        {activeTab === 'tailor' ? 'Tailor Dashboard' : (activeTab === 'barber' ? 'Barber Dashboard' : 'Beauty Parlour Dashboard')}
                      </h1>
                      <span className="page-subtitle">
                        Manage {activeTab === 'tailor' ? 'tailor' : (activeTab === 'barber' ? 'barber' : 'beauty parlour')} shops and approvals
                      </span>
                    </div>

                    <div className="action-btn-group">
                      <button className="btn-primary" onClick={() => {
                        setNewShopForm(prev => ({ ...prev, category: activeTab }));
                        setShowAddShopModal(true);
                      }}>
                        <Plus size={16} /> Add {activeTab === 'tailor' ? 'Tailor' : (activeTab === 'barber' ? 'Barber' : 'Parlour')}
                      </button>
                    </div>
                  </div>

                  {/* 4 Stat Cards for Category */}
                  <div className="stat-cards-grid">
                    {/* Total Category Shops */}
                    <div className="stat-card">
                      <div 
                        className="stat-card-icon-box"
                        style={{ 
                          backgroundColor: activeTab === 'tailor' ? '#7c3aed' : (activeTab === 'barber' ? '#0284c7' : '#db2777')
                        }}
                      >
                        {activeTab === 'tailor' ? <Scissors size={22} /> : (activeTab === 'beauty' ? <Sparkles size={22} /> : <Store size={22} />)}
                      </div>
                      <div>
                        <span className="stat-card-label">Total {activeTab === 'tailor' ? 'Tailor' : (activeTab === 'barber' ? 'Barber' : 'Beauty')} Shops</span>
                        <h2 className="stat-card-value">{stats[activeTab]?.total || 0}</h2>
                        <span className="stat-card-sub stat-trend-up">
                          <TrendingUp size={14} /> {stats[activeTab]?.active || 0} currently open
                        </span>
                      </div>
                    </div>

                    {/* Pending Approvals */}
                    <div className="stat-card">
                      <div className="stat-card-icon-box" style={{ backgroundColor: '#f59e0b' }}>
                        <Clock size={22} />
                      </div>
                      <div>
                        <span className="stat-card-label">Pending Approvals</span>
                        <h2 className="stat-card-value">{stats[activeTab]?.pending || 0}</h2>
                        <span className="stat-card-sub stat-trend-amber">
                          {stats[activeTab]?.pending > 0 ? "Needs your action" : "All reviewed"}
                        </span>
                      </div>
                    </div>

                    {/* Approved */}
                    <div className="stat-card">
                      <div className="stat-card-icon-box" style={{ backgroundColor: '#10b981' }}>
                        <CheckCircle2 size={22} />
                      </div>
                      <div>
                        <span className="stat-card-label">Approved</span>
                        <h2 className="stat-card-value">{stats[activeTab]?.approved || 0}</h2>
                        <span className="stat-card-sub stat-trend-up">
                          <TrendingUp size={14} /> Verified partners
                        </span>
                      </div>
                    </div>

                    {/* Rejected */}
                    <div className="stat-card">
                      <div className="stat-card-icon-box" style={{ backgroundColor: '#ef4444' }}>
                        <XCircle size={22} />
                      </div>
                      <div>
                        <span className="stat-card-label">Rejected</span>
                        <h2 className="stat-card-value">{stats[activeTab]?.rejected || 0}</h2>
                        <span className="stat-card-sub stat-trend-down">
                          <TrendingDown size={14} /> Rejected / Inactive
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Approvals Table Card */}
                  <div className="section-card">
                    <div className="section-card-header">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <h3 className="section-card-title">
                          {activeTab === 'tailor' ? 'Tailor' : (activeTab === 'barber' ? 'Barber' : 'Beauty Parlour')} Shop Approvals
                        </h3>

                        {/* Filter Pills */}
                        <div style={{ display: 'flex', gap: '8px' }}>
                          {['all', 'pending', 'approved', 'rejected'].map(filterKey => (
                            <button
                              key={filterKey}
                              onClick={() => setSubDashboardFilter(filterKey)}
                              style={{
                                padding: '4px 12px',
                                borderRadius: '16px',
                                border: '1px solid #e2e8f0',
                                backgroundColor: subDashboardFilter === filterKey ? '#0f172a' : '#ffffff',
                                color: subDashboardFilter === filterKey ? '#ffffff' : '#64748b',
                                fontSize: '12px',
                                fontWeight: '700',
                                cursor: 'pointer',
                                textTransform: 'capitalize'
                              }}
                            >
                              {filterKey}
                            </button>
                          ))}
                        </div>
                      </div>

                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Showing {filteredCategoryShops.length} shops
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="smart-table">
                        <thead>
                          <tr>
                            <th>Shop Name</th>
                            <th>Owner</th>
                            <th>Submitted On</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredCategoryShops.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                No shops found for this category and filter.
                              </td>
                            </tr>
                          ) : (
                            filteredCategoryShops.map((shop) => (
                              <tr key={shop.id}>
                                <td>
                                  <div className="shop-name-cell">
                                    <div className="shop-icon-circle">
                                      {shop.categoryKey === 'tailor' ? <Scissors size={16} /> : (shop.categoryKey === 'beauty' ? <Sparkles size={16} /> : <Store size={16} />)}
                                    </div>
                                    <div>
                                      <div style={{ fontWeight: '700' }}>{shop.name}</div>
                                      <div style={{ fontSize: '11.5px', color: '#64748b' }}>{shop.city}</div>
                                    </div>
                                  </div>
                                </td>
                                <td>{shop.owner}</td>
                                <td style={{ color: '#64748b', fontSize: '12.5px' }}>{shop.submittedOn}</td>
                                <td>
                                  <span className={`status-badge ${shop.status}`}>
                                    {shop.status === 'approved' && <Check size={12} />}
                                    {shop.status === 'rejected' && <X size={12} />}
                                    {shop.status === 'pending' && <Clock size={12} />}
                                    {shop.status.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                                    {shop.status === 'pending' && (
                                      <>
                                        <button 
                                          className="btn-approve" 
                                          onClick={() => handleApproveShop(shop)}
                                        >
                                          Approve
                                        </button>
                                        <button 
                                          className="btn-reject" 
                                          onClick={() => handleOpenReject(shop)}
                                        >
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {shop.status === 'approved' && (
                                      <button 
                                        className="btn-reject" 
                                        onClick={() => handleOpenReject(shop)}
                                        title="Reject / Revoke approval"
                                      >
                                        Reject
                                      </button>
                                    )}
                                    {shop.status === 'rejected' && (
                                      <button 
                                        className="btn-approve" 
                                        onClick={() => handleApproveShop(shop)}
                                        title="Accept / Re-approve shop"
                                      >
                                        Accept
                                      </button>
                                    )}
                                    <button 
                                      className="btn-view-pill"
                                      onClick={() => handleOpenShopDetails(shop)}
                                    >
                                      View Details
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Recent Category Activity Card */}
                  <div className="section-card">
                    <div className="section-card-header">
                      <h3 className="section-card-title">
                        Recent {activeTab === 'tailor' ? 'Tailor' : (activeTab === 'barber' ? 'Barber' : 'Beauty Parlour')} Activity
                      </h3>
                    </div>

                    <div className="table-responsive">
                      <table className="smart-table">
                        <thead>
                          <tr>
                            <th>Action</th>
                            <th>Shop Name</th>
                            <th>Time</th>
                          </tr>
                        </thead>
                        <tbody>
                          {categoryActivities.length === 0 ? (
                            <tr>
                              <td colSpan={3} style={{ textAlign: 'center', padding: '20px', color: '#64748b' }}>
                                No recent activity recorded for this category.
                              </td>
                            </tr>
                          ) : (
                            categoryActivities.slice(0, 4).map((act, idx) => (
                              <tr key={idx}>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '600' }}>
                                    <CheckCircle2 size={16} color="#10b981" />
                                    <span>{act.action}</span>
                                  </div>
                                </td>
                                <td style={{ color: '#0f172a', fontWeight: '500' }}>{act.shopName}</td>
                                <td style={{ color: '#64748b', fontSize: '12.5px' }}>
                                  {act.createdAt ? new Date(act.createdAt).toLocaleString("en-GB", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 5: ALL SHOPS MANAGEMENT */}
              {activeTab === 'shops' && (
                <div>
                  <div className="page-header-row">
                    <div className="page-title-box">
                      <h1 className="page-title">Shops Directory</h1>
                      <span className="page-subtitle">View, search, onboard, and manage all partner salons and tailors</span>
                    </div>
                    <button className="btn-primary" onClick={() => setShowAddShopModal(true)}>
                      <Plus size={16} /> Add New Shop
                    </button>
                  </div>

                  <div className="section-card">
                    <div className="section-card-header">
                      <div style={{ display: 'flex', gap: '8px' }}>
                        {['all', 'pending', 'approved', 'rejected'].map(statusKey => (
                          <button
                            key={statusKey}
                            onClick={() => setSubDashboardFilter(statusKey)}
                            style={{
                              padding: '6px 14px',
                              borderRadius: '16px',
                              border: '1px solid #e2e8f0',
                              backgroundColor: subDashboardFilter === statusKey ? '#2563eb' : '#ffffff',
                              color: subDashboardFilter === statusKey ? '#ffffff' : '#64748b',
                              fontSize: '12.5px',
                              fontWeight: '700',
                              cursor: 'pointer',
                              textTransform: 'capitalize'
                            }}
                          >
                            {statusKey}
                          </button>
                        ))}
                      </div>

                      <span style={{ fontSize: '13px', color: '#64748b' }}>
                        Total: {allShopsFiltered.length} shops found
                      </span>
                    </div>

                    <div className="table-responsive">
                      <table className="smart-table">
                        <thead>
                          <tr>
                            <th>Shop Name</th>
                            <th>Category</th>
                            <th>Owner & Contact</th>
                            <th>City</th>
                            <th>Status</th>
                            <th style={{ textAlign: 'center' }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {allShopsFiltered.length === 0 ? (
                            <tr>
                              <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                No shops found in the database.
                              </td>
                            </tr>
                          ) : (
                            allShopsFiltered.map((shop) => (
                              <tr key={shop.id}>
                                <td>
                                  <div className="shop-name-cell">
                                    <div className="shop-icon-circle">
                                      {shop.categoryKey === 'tailor' ? <Scissors size={16} /> : (shop.categoryKey === 'beauty' ? <Sparkles size={16} /> : <Store size={16} />)}
                                    </div>
                                    <span style={{ fontWeight: '700' }}>{shop.name}</span>
                                  </div>
                                </td>
                                <td>
                                  <span className={`cat-pill ${shop.categoryKey}`}>
                                    {shop.category}
                                  </span>
                                </td>
                                <td>
                                  <div>
                                    <div style={{ fontWeight: '600' }}>{shop.owner}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{shop.phone || 'No phone'}</div>
                                  </div>
                                </td>
                                <td>{shop.city}</td>
                                <td>
                                  <span className={`status-badge ${shop.status}`}>
                                    {shop.status.toUpperCase()}
                                  </span>
                                </td>
                                <td>
                                  <div className="action-btn-group" style={{ justifyContent: 'center' }}>
                                    <button 
                                      className="btn-view-pill"
                                      onClick={() => handleOpenShopDetails(shop)}
                                    >
                                      View
                                    </button>
                                    {shop.status === 'pending' && (
                                      <>
                                        <button className="btn-approve" onClick={() => handleApproveShop(shop)}>
                                          Approve
                                        </button>
                                        <button className="btn-reject" onClick={() => handleOpenReject(shop)}>
                                          Reject
                                        </button>
                                      </>
                                    )}
                                    {shop.status === 'approved' && (
                                      <button className="btn-reject" onClick={() => handleOpenReject(shop)} title="Reject / Revoke approval">
                                        Reject
                                      </button>
                                    )}
                                    {shop.status === 'rejected' && (
                                      <button className="btn-approve" onClick={() => handleApproveShop(shop)} title="Accept / Re-approve shop">
                                        Accept
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 6: USERS MANAGEMENT */}
              {activeTab === 'users' && (
                <div>
                  <div className="page-header-row">
                    <div className="page-title-box">
                      <h1 className="page-title">Users & Customers</h1>
                      <span className="page-subtitle">Manage customer accounts, verify roles, and monitor registrations</span>
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="table-responsive">
                      <table className="smart-table">
                        <thead>
                          <tr>
                            <th>User</th>
                            <th>Phone</th>
                            <th>Role</th>
                            <th>Joined</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredUsers.length === 0 ? (
                            <tr>
                              <td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: '#64748b' }}>
                                No users found in database.
                              </td>
                            </tr>
                          ) : (
                            filteredUsers.map((u) => (
                              <tr key={u._id}>
                                <td>
                                  <div>
                                    <div style={{ fontWeight: '700' }}>{u.name}</div>
                                    <div style={{ fontSize: '12px', color: '#64748b' }}>{u.email}</div>
                                  </div>
                                </td>
                                <td>{u.phone || 'N/A'}</td>
                                <td>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                    <span className="cat-pill other" style={{ textTransform: 'capitalize' }}>
                                      {u.role || 'Customer'}
                                    </span>
                                    {u.isBlocked && u.blockedUntil && new Date(u.blockedUntil) > new Date() && (
                                      <span className="status-badge rejected" style={{ fontSize: '10px', padding: '2px 6px' }}>
                                        SUSPENDED
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <span style={{ color: '#64748b', fontSize: '12px' }}>
                                    {u.createdAt ? new Date(u.createdAt).toLocaleDateString("en-GB") : 'Recent'}
                                  </span>
                                </td>
                                <td style={{ textAlign: 'center' }}>
                                  <button 
                                    className="btn-view-pill"
                                    onClick={() => handleOpenManageUser(u)}
                                  >
                                    Manage
                                  </button>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 7: NOTIFICATIONS */}
              {activeTab === 'notifications' && (
                <div>
                  <div className="page-header-row">
                    <div className="page-title-box">
                      <h1 className="page-title">Notifications Center</h1>
                      <span className="page-subtitle">Send push updates, system alerts, and platform broadcasts</span>
                    </div>
                    <button className="btn-primary" onClick={() => setShowNotificationModal(true)}>
                      <Send size={16} /> Broadcast Notification
                    </button>
                  </div>

                  <div className="section-card">
                    <div className="section-card-header">
                      <h3 className="section-card-title">Recent Broadcasts & Alerts</h3>
                    </div>

                    <div className="activity-feed-list">
                      {notificationsList.length === 0 ? (
                        <div style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          No notifications recorded in system.
                        </div>
                      ) : (
                        notificationsList.map((notif, idx) => (
                          <div className="activity-feed-item" key={notif._id || idx}>
                            <div className="activity-icon-badge" style={{ backgroundColor: '#eff6ff', color: '#2563eb' }}>
                              <Bell size={16} />
                            </div>
                            <div className="activity-body">
                              <span className="activity-action-title">{notif.title}</span>
                              <span className="activity-description">{notif.body}</span>
                              <span className="activity-time">
                                {notif.userId?.name ? `Target: ${notif.userId.name} • ` : ''}
                                {notif.createdAt ? new Date(notif.createdAt).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Recent'}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 8: REPORTS */}
              {activeTab === 'reports' && (
                <div>
                  <div className="page-header-row">
                    <div className="page-title-box">
                      <h1 className="page-title">Financial & Performance Reports</h1>
                      <span className="page-subtitle">Live revenue tracking, platform commission, and booking totals</span>
                    </div>
                  </div>

                  <div className="stat-cards-grid">
                    <div className="stat-card">
                      <div className="stat-card-icon-box" style={{ backgroundColor: '#10b981' }}>
                        <DollarSign size={22} />
                      </div>
                      <div>
                        <span className="stat-card-label">Total Platform GMV</span>
                        <h2 className="stat-card-value">₹{Number(stats.totalRevenue || 0).toLocaleString()}</h2>
                        <span className="stat-card-sub stat-trend-up">Across all completed services</span>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-card-icon-box" style={{ backgroundColor: '#2563eb' }}>
                        <TrendingUp size={22} />
                      </div>
                      <div>
                        <span className="stat-card-label">Platform Commission (10%)</span>
                        <h2 className="stat-card-value">₹{Number(stats.platformCommission || 0).toLocaleString()}</h2>
                        <span className="stat-card-sub stat-trend-up">Net platform earnings</span>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-card-icon-box" style={{ backgroundColor: '#8b5cf6' }}>
                        <ShoppingBag size={22} />
                      </div>
                      <div>
                        <span className="stat-card-label">Total Completed Orders</span>
                        <h2 className="stat-card-value">{stats.totalOrders || 0}</h2>
                        <span className="stat-card-sub stat-trend-up">Tailor orders & salon bookings</span>
                      </div>
                    </div>

                    <div className="stat-card">
                      <div className="stat-card-icon-box" style={{ backgroundColor: '#f59e0b' }}>
                        <HeartHandshake size={22} />
                      </div>
                      <div>
                        <span className="stat-card-label">Active Partner Shops</span>
                        <h2 className="stat-card-value">{shops.filter(s => s.status === 'approved').length}</h2>
                        <span className="stat-card-sub stat-trend-up">Verified merchants</span>
                      </div>
                    </div>
                  </div>

                  {/* Revenue Breakdown */}
                  <div className="section-card" style={{ marginTop: '24px' }}>
                    <div className="section-card-header">
                      <h3 className="section-card-title">Revenue Timelines Breakdown</h3>
                    </div>
                    <div className="stat-cards-grid" style={{ marginBottom: 0 }}>
                      <div className="stat-card" style={{ border: '1px solid #e2e8f0' }}>
                        <div>
                          <span className="stat-card-label">Daily Revenue (Last 24 Hours)</span>
                          <h2 className="stat-card-value" style={{ fontSize: '20px' }}>₹{Number(stats.dailyRevenue || 0).toLocaleString()}</h2>
                          <span className="stat-card-sub">Platform Comm: ₹{Number(stats.dailyCommission || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="stat-card" style={{ border: '1px solid #e2e8f0' }}>
                        <div>
                          <span className="stat-card-label">Weekly Revenue (Last 7 Days)</span>
                          <h2 className="stat-card-value" style={{ fontSize: '20px' }}>₹{Number(stats.weeklyRevenue || 0).toLocaleString()}</h2>
                          <span className="stat-card-sub">Platform Comm: ₹{Number(stats.weeklyCommission || 0).toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="stat-card" style={{ border: '1px solid #e2e8f0' }}>
                        <div>
                          <span className="stat-card-label">Monthly Revenue (Last 30 Days)</span>
                          <h2 className="stat-card-value" style={{ fontSize: '20px' }}>₹{Number(stats.monthlyRevenue || 0).toLocaleString()}</h2>
                          <span className="stat-card-sub">Platform Comm: ₹{Number(stats.monthlyCommission || 0).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 9: SETTINGS */}
              {activeTab === 'settings' && (
                <div>
                  <div className="page-header-row">
                    <div className="page-title-box">
                      <h1 className="page-title">Admin Settings</h1>
                      <span className="page-subtitle">Platform configuration, API endpoint connectivity, and preferences</span>
                    </div>
                  </div>

                  <div className="section-card">
                    <div className="section-card-header">
                      <h3 className="section-card-title">Backend API Connectivity</h3>
                      <span className={`connectivity-pill ${isOnline ? 'connectivity-online' : 'connectivity-offline'}`}>
                        {isOnline ? <Wifi size={13} /> : <WifiOff size={13} />}
                        {isOnline ? 'Connected (Live)' : 'Offline / Standalone'}
                      </span>
                    </div>

                    <div style={{ maxWidth: '600px' }}>
                      <div className="form-field">
                        <label className="form-label">Active API Base URL</label>
                        <input 
                          type="text" 
                          className="form-input-text" 
                          value={apiUrl}
                          onChange={(e) => setApiUrl(e.target.value)}
                        />
                      </div>

                      <div style={{ display: 'flex', gap: '10px', marginTop: '14px' }}>
                        <button 
                          className="btn-secondary"
                          onClick={() => setApiUrl("/api")}
                        >
                          Use Local (/api)
                        </button>
                        <button 
                          className="btn-secondary"
                          onClick={() => setApiUrl(RENDER_FALLBACK_URL)}
                        >
                          Use Render Production Cloud
                        </button>
                        <button 
                          className="btn-primary"
                          onClick={() => { fetchAllData(); showToast("Testing connection..."); }}
                        >
                          Test & Ping
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="section-card" style={{ maxWidth: '640px' }}>
                    <h3 className="section-card-title" style={{ marginBottom: '16px' }}>Platform Commission Rules</h3>
                    <div className="form-grid-2">
                      <div className="form-field">
                        <label className="form-label">Default Barber Commission (%)</label>
                        <input type="number" defaultValue="10" className="form-input-text" />
                      </div>
                      <div className="form-field">
                        <label className="form-label">Default Tailor Commission (%)</label>
                        <input type="number" defaultValue="10" className="form-input-text" />
                      </div>
                    </div>
                    <button className="btn-primary" style={{ marginTop: '12px' }} onClick={() => showToast("Commission rates saved!")}>
                      Save Configuration
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </main>

      {/* MODAL 1: ADD NEW SHOP */}
      {showAddShopModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Add New Shop</h3>
              <button className="modal-close-btn" onClick={() => setShowAddShopModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateShop}>
              <div className="modal-body">
                <div className="form-field">
                  <label className="form-label">Shop Name *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Royal Cuts Salon" 
                    className="form-input-text"
                    value={newShopForm.shopName}
                    onChange={(e) => setNewShopForm(prev => ({ ...prev, shopName: e.target.value }))}
                  />
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Category *</label>
                    <select 
                      className="form-select"
                      value={newShopForm.category}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, category: e.target.value }))}
                    >
                      <option value="barber">Barber</option>
                      <option value="beauty">Beauty Parlour</option>
                      <option value="tailor">Tailor</option>
                    </select>
                  </div>

                  <div className="form-field">
                    <label className="form-label">Initial Status</label>
                    <select 
                      className="form-select"
                      value={newShopForm.approvalStatus}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, approvalStatus: e.target.value }))}
                    >
                      <option value="approved">Approved (Active)</option>
                      <option value="pending">Pending Approval</option>
                    </select>
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">Owner Name *</label>
                    <input 
                      type="text" 
                      required 
                      placeholder="e.g. Amit Kumar" 
                      className="form-input-text"
                      value={newShopForm.ownerName}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, ownerName: e.target.value }))}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">Mobile Number</label>
                    <input 
                      type="text" 
                      placeholder="+91 98765 43210" 
                      className="form-input-text"
                      value={newShopForm.phone}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="form-grid-2">
                  <div className="form-field">
                    <label className="form-label">City</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Delhi" 
                      className="form-input-text"
                      value={newShopForm.city}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, city: e.target.value }))}
                    />
                  </div>

                  <div className="form-field">
                    <label className="form-label">State</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Delhi" 
                      className="form-input-text"
                      value={newShopForm.state}
                      onChange={(e) => setNewShopForm(prev => ({ ...prev, state: e.target.value }))}
                    />
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowAddShopModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Plus size={16} /> Create & Onboard Shop
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: REJECT REASON MODAL */}
      {showRejectModal && rejectingShop && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Reject Shop Application</h3>
              <button className="modal-close-btn" onClick={() => setShowRejectModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: '14px', color: '#64748b', marginBottom: '16px' }}>
                You are about to reject <strong>{rejectingShop.name}</strong> ({rejectingShop.owner}). Please specify the reason below:
              </p>
              <div className="form-field">
                <label className="form-label">Rejection Reason</label>
                <textarea 
                  rows={4}
                  className="form-textarea"
                  placeholder="e.g. Incomplete business address, duplicate registration, or unclear documentation..."
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                />
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowRejectModal(false)}>
                Cancel
              </button>
              <button className="btn-danger-solid" onClick={handleConfirmReject}>
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: VIEW SHOP DETAILS */}
      {showDetailsModal && selectedShop && (
        <div className="modal-backdrop">
          <div className="modal-dialog modal-dialog-large">
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h3 className="modal-title">{selectedShop.name}</h3>
                <span className={`cat-pill ${selectedShop.categoryKey}`}>{selectedShop.category}</span>
                <span className={`status-badge ${selectedShop.status}`}>{selectedShop.status}</span>
                <span style={{ 
                  fontSize: '11px', 
                  padding: '3px 8px', 
                  borderRadius: '12px', 
                  fontWeight: '700', 
                  backgroundColor: selectedShop.isOpen ? '#ecfdf5' : '#f1f5f9',
                  color: selectedShop.isOpen ? '#059669' : '#64748b',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: selectedShop.isOpen ? '#10b981' : '#94a3b8' }}></span>
                  {selectedShop.isOpen ? "Open Now" : "Closed"}
                </span>
              </div>
              <button className="modal-close-btn" onClick={() => setShowDetailsModal(false)}>
                <X size={20} />
              </button>
            </div>
            <div className="modal-body">
              {/* TOP SUMMARY CARDS */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', 
                gap: '14px', 
                marginBottom: '20px', 
                backgroundColor: '#f8fafc', 
                padding: '16px', 
                borderRadius: '14px', 
                border: '1px solid #e2e8f0' 
              }}>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px' }}>Owner & Contact</label>
                  <p style={{ fontWeight: '800', fontSize: '15px', color: '#0f172a', margin: '0 0 4px 0' }}>{selectedShop.owner}</p>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Phone size={13} color="#94a3b8" /> {selectedShop.phone || 'N/A'}
                  </p>
                  <p style={{ color: '#64748b', fontSize: '13px', margin: '2px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Mail size={13} color="#94a3b8" /> {selectedShop.email || 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="form-label" style={{ marginBottom: '6px' }}>Shop & Registration Details</label>
                  <p style={{ fontWeight: '700', fontSize: '14px', color: '#0f172a', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={14} color="#2563eb" /> {selectedShop.city}
                  </p>
                  <p style={{ color: '#64748b', fontSize: '12.5px', margin: '2px 0' }}>
                    Registration Date: <strong>{selectedShop.submittedOn}</strong>
                  </p>
                  {selectedShop.raw?.seatCount && (
                    <p style={{ color: '#64748b', fontSize: '12.5px', margin: '2px 0' }}>
                      Service Seats / Chairs: <strong>{selectedShop.raw.seatCount}</strong>
                    </p>
                  )}
                  {selectedShop.raw?.genderPreference && (
                    <p style={{ color: '#64748b', fontSize: '12.5px', margin: '2px 0', textTransform: 'capitalize' }}>
                      Audience: <strong>{selectedShop.raw.genderPreference.replace('_', ' ')}</strong>
                    </p>
                  )}
                </div>
              </div>

              {/* LIVE ORDERS & PERFORMANCE ANALYTICS */}
              <div style={{ marginBottom: '22px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <ShoppingBag size={18} color="#2563eb" />
                    <h4 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#0f172a' }}>
                      Live Orders & Booking Analytics
                    </h4>
                  </div>
                  <span style={{ fontSize: '11px', backgroundColor: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '12px', fontWeight: '700' }}>
                    MongoDB Real-Time
                  </span>
                </div>

                {shopDetailsLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '30px', gap: '10px', color: '#64748b', fontSize: '13.5px' }}>
                    <RotateCw size={18} className="animate-spin" color="#2563eb" />
                    <span>Loading shop orders and bookings records...</span>
                  </div>
                ) : (
                  <div>
                    {/* 5 KPI METRICS */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                      {/* Total Orders */}
                      <div style={{ backgroundColor: '#eff6ff', border: '1px solid #dbeafe', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#1e40af', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                          Total Orders
                        </span>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#1e3a8a', margin: '4px 0 2px 0' }}>
                          {shopDetailedData?.ordersStats?.total ?? 0}
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#3b82f6' }}>All received</span>
                      </div>

                      {/* Completed Orders */}
                      <div style={{ backgroundColor: '#ecfdf5', border: '1px solid #d1fae5', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#065f46', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                          Completed
                        </span>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#064e3b', margin: '4px 0 2px 0' }}>
                          {shopDetailedData?.ordersStats?.completed ?? 0}
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#10b981' }}>Successfully finished</span>
                      </div>

                      {/* Pending Orders */}
                      <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#92400e', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                          Pending / Active
                        </span>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#78350f', margin: '4px 0 2px 0' }}>
                          {shopDetailedData?.ordersStats?.pending ?? 0}
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#f59e0b' }}>Awaiting / in progress</span>
                      </div>

                      {/* Cancelled Orders */}
                      <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                          Cancelled
                        </span>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#7f1d1d', margin: '4px 0 2px 0' }}>
                          {shopDetailedData?.ordersStats?.cancelled ?? 0}
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#ef4444' }}>Declined / no-show</span>
                      </div>

                      {/* Revenue */}
                      <div style={{ backgroundColor: '#f5f3ff', border: '1px solid #ede9fe', borderRadius: '12px', padding: '12px', textAlign: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: '700', color: '#5b21b6', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block' }}>
                          Total Revenue
                        </span>
                        <div style={{ fontSize: '24px', fontWeight: '800', color: '#4c1d95', margin: '4px 0 2px 0' }}>
                          ₹{(shopDetailedData?.ordersStats?.revenue ?? 0).toLocaleString('en-IN')}
                        </div>
                        <span style={{ fontSize: '10.5px', color: '#8b5cf6' }}>Completed bookings</span>
                      </div>
                    </div>

                    {/* RECENT ORDERS / BOOKINGS TABLE */}
                    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', overflow: 'hidden', marginBottom: '18px' }}>
                      <div style={{ padding: '10px 14px', backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '12.5px', fontWeight: '700', color: '#334155' }}>
                          Recent Orders & Bookings ({shopDetailedData?.recentOrders?.length || 0})
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748b' }}>Latest 20 orders</span>
                      </div>

                      <div className="table-responsive" style={{ maxHeight: '240px', overflowY: 'auto' }}>
                        <table className="smart-table" style={{ fontSize: '12.5px' }}>
                          <thead>
                            <tr>
                              <th style={{ padding: '8px 12px' }}>Order #</th>
                              <th style={{ padding: '8px 12px' }}>Customer</th>
                              <th style={{ padding: '8px 12px' }}>Service / Items</th>
                              <th style={{ padding: '8px 12px' }}>Amount</th>
                              <th style={{ padding: '8px 12px' }}>Status</th>
                              <th style={{ padding: '8px 12px' }}>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {!shopDetailedData?.recentOrders || shopDetailedData.recentOrders.length === 0 ? (
                              <tr>
                                <td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                                  No orders or bookings have been placed with this shop yet.
                                </td>
                              </tr>
                            ) : (
                              shopDetailedData.recentOrders.map((ord) => (
                                <tr key={ord._id}>
                                  <td style={{ fontWeight: '700', color: '#2563eb', padding: '8px 12px' }}>
                                    #{ord.orderNumber}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <div style={{ fontWeight: '700', color: '#0f172a' }}>{ord.customerName}</div>
                                    <div style={{ fontSize: '11px', color: '#64748b' }}>{ord.customerPhone}</div>
                                  </td>
                                  <td style={{ padding: '8px 12px', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                    {ord.services}
                                  </td>
                                  <td style={{ fontWeight: '700', padding: '8px 12px', color: '#0f172a' }}>
                                    ₹{ord.amount}
                                  </td>
                                  <td style={{ padding: '8px 12px' }}>
                                    <span className={`status-badge ${ord.status === 'completed' ? 'approved' : (ord.status === 'cancelled' ? 'rejected' : 'pending')}`} style={{ fontSize: '10.5px', padding: '2px 7px' }}>
                                      {ord.status}
                                    </span>
                                  </td>
                                  <td style={{ fontSize: '11.5px', color: '#64748b', padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                    {ord.date ? new Date(ord.date).toLocaleString("en-GB", { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'N/A'}
                                  </td>
                                </tr>
                              ))
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* SERVICES OFFERED LIST */}
                    {shopDetailedData?.services && shopDetailedData.services.length > 0 && (
                      <div style={{ marginBottom: '18px' }}>
                        <label className="form-label" style={{ marginBottom: '8px' }}>
                          Services & Price Catalog ({shopDetailedData.services.length})
                        </label>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', maxHeight: '120px', overflowY: 'auto', padding: '4px' }}>
                          {shopDetailedData.services.map((s) => (
                            <div key={s._id} style={{ backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '6px 10px', fontSize: '12px' }}>
                              <span style={{ fontWeight: '700', color: '#1e293b' }}>{s.name}</span>
                              <span style={{ color: '#059669', fontWeight: '800', marginLeft: '6px' }}>₹{s.price}</span>
                              {s.duration && <span style={{ color: '#64748b', marginLeft: '4px' }}>({s.duration}m)</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SHOP ACTIONS */}
              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '16px' }}>
                <label className="form-label">Shop Actions</label>
                {selectedShop.status === 'rejected' && selectedShop.raw?.rejectionReason && (
                  <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '10px' }}>
                    <strong>Rejection Reason:</strong> {selectedShop.raw.rejectionReason}
                  </p>
                )}
                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                  {selectedShop.status === 'pending' && (
                    <>
                      <button className="btn-approve" onClick={() => { handleApproveShop(selectedShop); setShowDetailsModal(false); }}>
                        Approve Application
                      </button>
                      <button className="btn-reject" onClick={() => { setShowDetailsModal(false); handleOpenReject(selectedShop); }}>
                        Reject Application
                      </button>
                    </>
                  )}
                  {selectedShop.status === 'approved' && (
                    <>
                      <button 
                        className="btn-secondary" 
                        onClick={() => handleToggleShopStatus(selectedShop)}
                      >
                        {selectedShop.isOpen ? "Mark Shop Closed" : "Mark Shop Open"}
                      </button>
                      <button 
                        className="btn-reject" 
                        onClick={() => { setShowDetailsModal(false); handleOpenReject(selectedShop); }}
                      >
                        Reject Application
                      </button>
                    </>
                  )}
                  {selectedShop.status === 'rejected' && (
                    <button 
                      className="btn-approve" 
                      onClick={() => { handleApproveShop(selectedShop); setShowDetailsModal(false); }}
                    >
                      Accept / Re-approve Shop
                    </button>
                  )}
                </div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDetailsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: SEND NOTIFICATION */}
      {showNotificationModal && (
        <div className="modal-backdrop">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Broadcast Notification</h3>
              <button className="modal-close-btn" onClick={() => setShowNotificationModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSendNotification}>
              <div className="modal-body">
                <div className="form-field">
                  <label className="form-label">Audience Target</label>
                  <select 
                    className="form-select"
                    value={notifForm.target}
                    onChange={(e) => setNotifForm(prev => ({ ...prev, target: e.target.value }))}
                  >
                    <option value="all">All Users & Partners</option>
                    <option value="partners">All Shop Owners & Partners</option>
                    <option value="customers">All App Customers</option>
                  </select>
                </div>

                <div className="form-field">
                  <label className="form-label">Notification Title *</label>
                  <input 
                    type="text" 
                    required 
                    placeholder="e.g. Festival Season Promotion!" 
                    className="form-input-text"
                    value={notifForm.title}
                    onChange={(e) => setNotifForm(prev => ({ ...prev, title: e.target.value }))}
                  />
                </div>

                <div className="form-field">
                  <label className="form-label">Notification Message *</label>
                  <textarea 
                    rows={4}
                    required
                    placeholder="Enter broadcast message details..."
                    className="form-textarea"
                    value={notifForm.body}
                    onChange={(e) => setNotifForm(prev => ({ ...prev, body: e.target.value }))}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn-secondary" onClick={() => setShowNotificationModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-primary">
                  <Send size={15} /> Send Broadcast
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 5: MANAGE USER */}
      {showManageUserModal && selectedUser && (
        <div className="modal-backdrop">
          <div className="modal-dialog" style={{ maxWidth: '540px' }}>
            <div className="modal-header" style={{ padding: '16px 22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h3 className="modal-title" style={{ fontSize: '17px', margin: 0 }}>Manage User</h3>
                <span className="cat-pill other" style={{ textTransform: 'capitalize' }}>
                  {selectedUser.role || 'customer'}
                </span>
                {selectedUser.isBlocked && selectedUser.blockedUntil && new Date(selectedUser.blockedUntil) > new Date() && (
                  <span className="status-badge rejected" style={{ fontSize: '10.5px', padding: '2px 8px' }}>
                    SUSPENDED
                  </span>
                )}
              </div>
              <button className="modal-close-btn" onClick={() => setShowManageUserModal(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '18px 22px' }}>
              {/* COMPACT USER HEADER */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 14px',
                backgroundColor: '#f8fafc',
                borderRadius: '12px',
                border: '1px solid #e2e8f0',
                marginBottom: '16px'
              }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '10px',
                  backgroundColor: '#e0e7ff',
                  color: '#4338ca',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '800',
                  fontSize: '15px',
                  flexShrink: 0
                }}>
                  {selectedUser.name ? selectedUser.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                    <h4 style={{ fontSize: '15px', fontWeight: '800', color: '#0f172a', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {selectedUser.name}
                    </h4>
                    <span style={{ fontSize: '11px', color: '#94a3b8', whiteSpace: 'nowrap' }}>
                      Joined: {selectedUser.createdAt ? new Date(selectedUser.createdAt).toLocaleDateString("en-GB", { day: '2-digit', month: 'short', year: 'numeric' }) : 'N/A'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginTop: '3px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Mail size={12} color="#94a3b8" /> {selectedUser.email || 'No email'}
                    </span>
                    {selectedUser.phone && (
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Phone size={12} color="#94a3b8" /> {selectedUser.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* TEMPORARY ACCOUNT SUSPENSION / BLOCK SECTION */}
              {selectedUser.isBlocked && selectedUser.blockedUntil && new Date(selectedUser.blockedUntil) > new Date() ? (
                <div style={{
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#ffe4e6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#e11d48' }}>
                        <AlertCircle size={16} />
                      </div>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: '700', color: '#9f1239' }}>Account Currently Suspended</div>
                        <div style={{ fontSize: '11.5px', color: '#be123c', marginTop: '1px' }}>
                          Until: <strong>{new Date(selectedUser.blockedUntil).toLocaleString("en-GB", { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</strong>
                        </div>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      style={{
                        backgroundColor: '#059669',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '6px 14px',
                        fontSize: '12px',
                        fontWeight: '600',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      onClick={handleUnblockUser}
                      disabled={isSubmittingBlock}
                    >
                      <CheckCircle2 size={13} />
                      {isSubmittingBlock ? "Processing..." : "Unblock Account"}
                    </button>
                  </div>
                  {selectedUser.blockReason && (
                    <div style={{
                      marginTop: '8px',
                      fontSize: '11.5px',
                      color: '#881337',
                      backgroundColor: '#ffffff',
                      padding: '6px 10px',
                      borderRadius: '6px',
                      border: '1px solid #fecdd3'
                    }}>
                      <strong>Reason:</strong> {selectedUser.blockReason}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '14px',
                  marginBottom: '16px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', color: '#1e293b', fontWeight: '700', fontSize: '13px' }}>
                      <Clock size={15} color="#e11d48" />
                      <span>Temporary Suspension</span>
                    </div>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Sends user notification
                    </span>
                  </div>

                  {/* PRESET PILLS */}
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '10px' }}>
                    {[
                      { l: '12 Hours', v: 12, u: 'hours' },
                      { l: '1 Day', v: 1, u: 'days' },
                      { l: '3 Days', v: 3, u: 'days' },
                      { l: '7 Days', v: 7, u: 'days' },
                      { l: '30 Days', v: 30, u: 'days' }
                    ].map((p) => {
                      const isSelected = Number(blockDurationValue) === p.v && blockDurationUnit === p.u;
                      return (
                        <button
                          key={p.l}
                          type="button"
                          onClick={() => { setBlockDurationValue(p.v); setBlockDurationUnit(p.u); }}
                          style={{
                            border: isSelected ? '1px solid #e11d48' : '1px solid #cbd5e1',
                            backgroundColor: isSelected ? '#ffe4e6' : '#ffffff',
                            color: isSelected ? '#be123c' : '#475569',
                            fontWeight: isSelected ? '700' : '500',
                            fontSize: '11.5px',
                            padding: '3px 9px',
                            borderRadius: '16px',
                            cursor: 'pointer',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          {p.l}
                        </button>
                      );
                    })}
                  </div>

                  {/* CONTROLS ROW */}
                  <div style={{ display: 'grid', gridTemplateColumns: '70px 120px 1fr', gap: '8px', alignItems: 'center', marginBottom: '10px' }}>
                    <input 
                      type="number"
                      min="1"
                      max="365"
                      className="form-input-text"
                      style={{ height: '36px', textAlign: 'center', fontWeight: '700', padding: '0 4px', fontSize: '13px' }}
                      value={blockDurationValue}
                      onChange={(e) => setBlockDurationValue(e.target.value)}
                      placeholder="1"
                    />
                    <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid #cbd5e1', height: '36px' }}>
                      <button
                        type="button"
                        onClick={() => setBlockDurationUnit('hours')}
                        style={{
                          flex: 1,
                          border: 'none',
                          backgroundColor: blockDurationUnit === 'hours' ? '#1e293b' : '#ffffff',
                          color: blockDurationUnit === 'hours' ? '#ffffff' : '#64748b',
                          fontWeight: '600',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Hours
                      </button>
                      <button
                        type="button"
                        onClick={() => setBlockDurationUnit('days')}
                        style={{
                          flex: 1,
                          border: 'none',
                          backgroundColor: blockDurationUnit === 'days' ? '#1e293b' : '#ffffff',
                          color: blockDurationUnit === 'days' ? '#ffffff' : '#64748b',
                          fontWeight: '600',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        Days
                      </button>
                    </div>
                    <input 
                      type="text"
                      className="form-input-text"
                      style={{ height: '36px', fontSize: '12px', padding: '0 10px' }}
                      value={blockReasonInput}
                      onChange={(e) => setBlockReasonInput(e.target.value)}
                      placeholder="Reason (optional)"
                    />
                  </div>

                  {/* ACTION BUTTON */}
                  <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      style={{
                        backgroundColor: '#e11d48',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        padding: '7px 15px',
                        fontSize: '12px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#be123c'}
                      onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#e11d48'}
                      onClick={handleBlockUser}
                      disabled={isSubmittingBlock}
                    >
                      <Clock size={13} />
                      {isSubmittingBlock
                        ? "Suspending..."
                        : `Suspend (${blockDurationValue} ${Number(blockDurationValue) === 1 ? (blockDurationUnit === 'days' ? 'Day' : 'Hour') : (blockDurationUnit === 'days' ? 'Days' : 'Hours')})`}
                    </button>
                  </div>
                </div>
              )}

              {/* ASSIGN ROLE */}
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '11.5px', fontWeight: '700', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.3px', display: 'block', marginBottom: '5px' }}>
                  Assign Account Role
                </label>
                <select 
                  className="form-select"
                  style={{ height: '38px', fontSize: '13px', padding: '0 12px' }}
                  value={editingRole}
                  onChange={(e) => setEditingRole(e.target.value)}
                >
                  <option value="customer">Customer</option>
                  <option value="barber">Barber Partner</option>
                  <option value="tailor">Tailor Partner</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>

              {/* DANGER ZONE */}
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <span style={{ fontSize: '12px', fontWeight: '700', color: '#ef4444', display: 'block' }}>Danger Zone</span>
                  <span style={{ fontSize: '11px', color: '#94a3b8' }}>Permanently remove this account from database.</span>
                </div>
                <button 
                  type="button" 
                  className="btn-danger-solid" 
                  style={{ padding: '6px 12px', fontSize: '11.5px' }}
                  onClick={handleDeleteUser}
                >
                  Delete Account
                </button>
              </div>
            </div>
            <div className="modal-footer" style={{ padding: '14px 22px' }}>
              <button type="button" className="btn-secondary" onClick={() => setShowManageUserModal(false)}>
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={handleUpdateUserRole}>
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
