const Tailor = require("../models/Tailor");
const TailorOrder = require("../models/TailorOrder");
const User = require("../models/User");
const { Expense } = require("../models/TailorFinance");

exports.getDashboardStats = async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    const Barber = require("../models/Barber");
    const Notification = require("../models/Notification");

    const totalUsers = await User.countDocuments();
    
    // Fetch all barbers and tailors
    const allBarbers = await Barber.find().lean();
    const tailors = await Tailor.find().lean();

    // Split barbers into Barber vs Beauty Parlour
    const parlours = allBarbers.filter(b => /beauty|parlou?r|ladies/i.test(b.businessCategory || b.shopName || ""));
    const barbers = allBarbers.filter(b => !/beauty|parlou?r|ladies/i.test(b.businessCategory || b.shopName || ""));

    const totalBarbers = barbers.length;
    const activeBarbers = barbers.filter(b => b.approvalStatus === "approved" && b.isShopOpen).length;
    const approvedBarbers = barbers.filter(b => b.approvalStatus === "approved").length;
    const pendingBarbers = barbers.filter(b => b.approvalStatus === "pending").length;
    const rejectedBarbers = barbers.filter(b => b.approvalStatus === "rejected").length;

    const totalParlours = parlours.length;
    const activeParlours = parlours.filter(p => p.approvalStatus === "approved" && p.isShopOpen).length;
    const approvedParlours = parlours.filter(p => p.approvalStatus === "approved").length;
    const pendingParlours = parlours.filter(p => p.approvalStatus === "pending").length;
    const rejectedParlours = parlours.filter(p => p.approvalStatus === "rejected").length;

    const totalTailors = tailors.length;
    const activeTailors = tailors.filter(t => t.approvalStatus === "approved" && t.isShopOpen).length;
    const approvedTailors = tailors.filter(t => t.approvalStatus === "approved").length;
    const pendingTailors = tailors.filter(t => t.approvalStatus === "pending").length;
    const rejectedTailors = tailors.filter(t => t.approvalStatus === "rejected").length;

    const totalShops = totalBarbers + totalParlours + totalTailors;
    const pendingApprovals = pendingBarbers + pendingParlours + pendingTailors;

    const totalNotifications = await Notification.countDocuments();
    
    // Fetch all completed bookings & orders to calculate financials
    const bookings = await Booking.find({ status: "completed" }).populate("serviceIds").lean();
    const orders = await TailorOrder.find({ status: "completed" }).lean();
    
    const totalOrders = orders.length + bookings.length;

    // Segment ranges
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    let dailyRevenue = 0;
    let weeklyRevenue = 0;
    let monthlyRevenue = 0;
    let totalRevenue = 0;

    // Summing booking prices
    bookings.forEach(b => {
      let bPrice = 0;
      if (b.serviceIds) {
        b.serviceIds.forEach(s => { bPrice += (s.price || 0); });
      }
      
      const compDate = b.completedAt || b.updatedAt || b.createdAt;
      const date = new Date(compDate);

      totalRevenue += bPrice;
      if (date >= oneDayAgo) dailyRevenue += bPrice;
      if (date >= sevenDaysAgo) weeklyRevenue += bPrice;
      if (date >= thirtyDaysAgo) monthlyRevenue += bPrice;
    });

    // Summing tailor orders prices
    orders.forEach(o => {
      const oPrice = o.totalAmount || 0;
      const compDate = o.updatedAt || o.createdAt;
      const date = new Date(compDate);

      totalRevenue += oPrice;
      if (date >= oneDayAgo) dailyRevenue += oPrice;
      if (date >= sevenDaysAgo) weeklyRevenue += oPrice;
      if (date >= thirtyDaysAgo) monthlyRevenue += oPrice;
    });

    res.json({
      totalUsers,
      totalShops,
      pendingApprovals,
      totalNotifications: totalNotifications || 15,
      
      totalTailors,
      activeTailors,
      approvedTailors,
      pendingTailors,
      rejectedTailors,
      
      totalBarbers,
      activeBarbers,
      approvedBarbers,
      pendingBarbers,
      rejectedBarbers,

      totalParlours,
      activeParlours,
      approvedParlours,
      pendingParlours,
      rejectedParlours,

      totalOrders,
      totalRevenue,
      platformCommission: totalRevenue * 0.10,
      
      dailyRevenue,
      dailyCommission: dailyRevenue * 0.10,
      
      weeklyRevenue,
      weeklyCommission: weeklyRevenue * 0.10,
      
      monthlyRevenue,
      monthlyCommission: monthlyRevenue * 0.10
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllTailors = async (req, res) => {
  try {
    const tailors = await Tailor.find().populate("userId", "name email phone");
    res.json(tailors);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateTailorStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { approvalStatus, isShopOpen, rejectionReason } = req.body;
    
    const updateData = {};
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (isShopOpen !== undefined) updateData.isShopOpen = isShopOpen;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;

    const tailor = await Tailor.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!tailor) return res.status(404).json({ error: "Tailor not found" });
    res.json(tailor);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllOrders = async (req, res) => {
  try {
    const orders = await TailorOrder.find()
      .populate("customerId", "name phone")
      .populate("tailorId", "shopName")
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllCustomers = async (req, res) => {
  try {
    const customers = await User.find({ role: "customer" }).sort({ createdAt: -1 });
    res.json(customers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllBarbers = async (req, res) => {
  try {
    const Barber = require("../models/Barber");
    const barbers = await Barber.find().populate("userId", "name email phone");
    res.json(barbers);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateBarberStatus = async (req, res) => {
  try {
    const Barber = require("../models/Barber");
    const { id } = req.params;
    const { approvalStatus, isShopOpen, rejectionReason } = req.body;
    
    const updateData = {};
    if (approvalStatus !== undefined) updateData.approvalStatus = approvalStatus;
    if (isShopOpen !== undefined) updateData.isShopOpen = isShopOpen;
    if (rejectionReason !== undefined) updateData.rejectionReason = rejectionReason;

    const barber = await Barber.findByIdAndUpdate(
      id,
      { $set: updateData },
      { new: true }
    );
    
    if (!barber) return res.status(404).json({ error: "Barber not found" });
    res.json(barber);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllBookings = async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    const bookings = await Booking.find()
      .populate("customerId", "name email phone")
      .populate("barberId", "shopName")
      .sort({ startTime: -1 });
    res.json(bookings);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateBookingStatus = async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    const { id } = req.params;
    const { status } = req.body;

    const booking = await Booking.findByIdAndUpdate(
      id,
      { $set: { status } },
      { new: true }
    );

    if (!booking) return res.status(404).json({ error: "Booking not found" });
    res.json(booking);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllReviews = async (req, res) => {
  try {
    const Review = require("../models/Review");
    const reviews = await Review.find()
      .populate("userId", "name email phone")
      .populate("barberId", "shopName")
      .sort({ createdAt: -1 });
    res.json(reviews);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteReview = async (req, res) => {
  try {
    const Review = require("../models/Review");
    const { id } = req.params;
    await Review.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllUsers = async (req, res) => {
  try {
    const User = require("../models/User");
    const users = await User.find().sort({ createdAt: -1 });
    res.json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.updateUserRole = async (req, res) => {
  try {
    const User = require("../models/User");
    const { id } = req.params;
    const { role } = req.body;

    const user = await User.findByIdAndUpdate(
      id,
      { $set: { role } },
      { new: true }
    );

    if (!user) return res.status(404).json({ error: "User not found" });
    res.json(user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const User = require("../models/User");
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.blockUser = async (req, res) => {
  try {
    const User = require("../models/User");
    const Notification = require("../models/Notification");
    const { id } = req.params;
    const { durationValue, durationUnit, reason } = req.body;

    const numValue = Number(durationValue);
    if (!numValue || numValue <= 0) {
      return res.status(400).json({ error: "Invalid duration value" });
    }

    const unit = durationUnit === "hours" ? "hours" : "days";
    const millis = unit === "hours" 
      ? numValue * 60 * 60 * 1000 
      : numValue * 24 * 60 * 60 * 1000;

    const blockedUntil = new Date(Date.now() + millis);
    const blockReason = (reason && String(reason).trim()) || "Account temporarily suspended by administrator";

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    if (user.role === "admin") {
      return res.status(400).json({ error: "Cannot block an administrator account" });
    }

    user.isBlocked = true;
    user.blockedUntil = blockedUntil;
    user.blockReason = blockReason;
    await user.save();

    const formattedDate = blockedUntil.toLocaleString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });

    await Notification.create({
      userId: user._id,
      title: "Account Temporarily Suspended",
      body: `Your account has been temporarily suspended for ${numValue} ${unit} (until ${formattedDate}). Reason: ${blockReason}`,
      type: "system",
      data: {
        action: "account_suspended",
        blockedUntil,
        durationValue: numValue,
        durationUnit: unit
      }
    });

    res.json({
      ok: true,
      user,
      message: `User suspended for ${numValue} ${unit} until ${formattedDate}`
    });
  } catch (error) {
    console.error("blockUser error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.unblockUser = async (req, res) => {
  try {
    const User = require("../models/User");
    const Notification = require("../models/Notification");
    const { id } = req.params;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.isBlocked = false;
    user.blockedUntil = null;
    user.blockReason = "";
    await user.save();

    await Notification.create({
      userId: user._id,
      title: "Account Suspension Lifted",
      body: "Your account suspension has been lifted by the administrator. You can now use all platform services normally.",
      type: "system",
      data: {
        action: "account_unblocked"
      }
    });

    res.json({
      ok: true,
      user,
      message: "User unblocked successfully"
    });
  } catch (error) {
    console.error("unblockUser error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getPartnerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    const Barber = require("../models/Barber");
    const Service = require("../models/Service");
    const Booking = require("../models/Booking");
    const Tailor = require("../models/Tailor");
    const TailorService = require("../models/TailorService");
    const TailorOrder = require("../models/TailorOrder");

    let isTailor = type === "tailor";
    let isBarber = type === "barber" || type === "beauty" || type === "beauty_parlour";

    if (!isTailor && !isBarber) {
      // Auto-detect based on existence in Barber model
      const bTest = await Barber.findById(id).select("_id");
      if (bTest) {
        isBarber = true;
      } else {
        isTailor = true;
      }
    }

    if (isBarber) {
      const barber = await Barber.findById(id).populate("userId", "name email phone").lean();
      if (!barber) return res.status(404).json({ error: "Shop not found" });

      const services = await Service.find({ barberId: id }).lean();

      const allBookings = await Booking.find({ barberId: id })
        .populate("customerId", "name email phone")
        .populate("serviceIds", "name price duration")
        .sort({ createdAt: -1 })
        .lean();

      const totalOrders = allBookings.length;
      const completedOrders = allBookings.filter(b => b.status === "completed").length;
      const pendingOrders = allBookings.filter(b => ["pending", "confirmed", "arrived", "in-progress"].includes(b.status)).length;
      const cancelledOrders = allBookings.filter(b => ["cancelled", "expired", "no-show"].includes(b.status)).length;

      let totalRevenue = 0;
      allBookings.forEach(b => {
        if (b.status === "completed") {
          let price = 0;
          if (b.serviceIds && Array.isArray(b.serviceIds)) {
            b.serviceIds.forEach(s => { price += (s.price || 0); });
          }
          totalRevenue += price;
        }
      });

      const isBeauty = /beauty|parlou?r|ladies/i.test(barber.businessCategory || barber.shopName || "");

      return res.json({
        partner: barber,
        category: isBeauty ? "Beauty Parlour" : "Barber",
        categoryKey: isBeauty ? "beauty" : "barber",
        services,
        ordersStats: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          cancelled: cancelledOrders,
          revenue: totalRevenue
        },
        recentOrders: allBookings.slice(0, 20).map(b => {
          let bAmount = 0;
          if (b.serviceIds && Array.isArray(b.serviceIds)) {
            bAmount = b.serviceIds.reduce((sum, s) => sum + (s.price || 0), 0);
          }
          return {
            _id: b._id,
            orderNumber: b._id.toString().slice(-6).toUpperCase(),
            customerName: b.customerId?.name || b.guestName || "Customer",
            customerPhone: b.customerId?.phone || b.guestPhone || "N/A",
            customerEmail: b.customerId?.email || "",
            status: b.status,
            date: b.startTime || b.createdAt,
            services: (b.serviceIds || []).map(s => s.name).join(", ") || "General Service",
            amount: bAmount,
            isHomeService: b.isHomeService || false,
            paymentStatus: b.paymentStatus || "pending"
          };
        })
      });
    } else {
      const tailor = await Tailor.findById(id).populate("userId", "name email phone").lean();
      if (!tailor) return res.status(404).json({ error: "Tailor shop not found" });

      const services = await TailorService.find({ tailorId: id }).lean();

      const allOrders = await TailorOrder.find({ tailorId: id })
        .populate("customerId", "name email phone")
        .sort({ createdAt: -1 })
        .lean();

      const totalOrders = allOrders.length;
      const completedOrders = allOrders.filter(o => o.status === "completed").length;
      const pendingOrders = allOrders.filter(o => !["completed", "cancelled", "declined", "refund"].includes(o.status)).length;
      const cancelledOrders = allOrders.filter(o => ["cancelled", "declined", "refund"].includes(o.status)).length;

      let totalRevenue = 0;
      allOrders.forEach(o => {
        if (o.status === "completed") {
          totalRevenue += (o.totalAmount || 0);
        }
      });

      return res.json({
        partner: tailor,
        category: "Tailor",
        categoryKey: "tailor",
        services,
        ordersStats: {
          total: totalOrders,
          completed: completedOrders,
          pending: pendingOrders,
          cancelled: cancelledOrders,
          revenue: totalRevenue
        },
        recentOrders: allOrders.slice(0, 20).map(o => ({
          _id: o._id,
          orderNumber: o._id.toString().slice(-6).toUpperCase(),
          customerName: o.customerId?.name || "Customer",
          customerPhone: o.customerId?.phone || "N/A",
          customerEmail: o.customerId?.email || "",
          status: o.status,
          date: o.createdAt,
          services: (o.services || []).map(s => s.name).join(", ") || "Custom Tailoring",
          amount: o.totalAmount || 0,
          isHomeService: o.isHomeService || false,
          paymentStatus: o.status === "completed" ? "paid" : "pending"
        }))
      });
    }
  } catch (error) {
    console.error("getPartnerDetails error:", error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getRecentActivity = async (req, res) => {
  try {
    const Barber = require("../models/Barber");
    const Booking = require("../models/Booking");
    const Notification = require("../models/Notification");

    const activities = [];

    // Recent Barber & Parlour registrations/approvals
    const recentBarbers = await Barber.find().sort({ createdAt: -1 }).limit(10).lean();
    for (const b of recentBarbers) {
      const isParlour = /beauty|parlou?r|ladies/i.test(b.businessCategory || b.shopName || "");
      const cat = isParlour ? "Beauty Parlour" : "Barber";
      activities.push({
        type: "shop_registration",
        action: "New shop registration",
        shopName: b.shopName || "Unnamed Shop",
        category: cat,
        status: b.approvalStatus,
        createdAt: b.createdAt || new Date()
      });
      if (b.approvalStatus === "approved") {
        activities.push({
          type: "shop_approved",
          action: "Shop approved",
          shopName: b.shopName || "Unnamed Shop",
          category: cat,
          status: "approved",
          createdAt: b.updatedAt || b.createdAt || new Date()
        });
      }
    }

    // Recent Tailor registrations/approvals
    const recentTailors = await Tailor.find().sort({ createdAt: -1 }).limit(10).lean();
    for (const t of recentTailors) {
      activities.push({
        type: "shop_registration",
        action: "New shop registration",
        shopName: t.shopName || "Unnamed Shop",
        category: "Tailor",
        status: t.approvalStatus,
        createdAt: t.createdAt || new Date()
      });
      if (t.approvalStatus === "approved") {
        activities.push({
          type: "shop_approved",
          action: "Shop approved",
          shopName: t.shopName || "Unnamed Shop",
          category: "Tailor",
          status: "approved",
          createdAt: t.updatedAt || t.createdAt || new Date()
        });
      }
    }

    // Recent Users
    const recentUsers = await User.find({ role: "customer" }).sort({ createdAt: -1 }).limit(5).lean();
    for (const u of recentUsers) {
      activities.push({
        type: "user_signup",
        action: "New user sign up",
        shopName: u.name + " joined the platform.",
        category: "User",
        createdAt: u.createdAt || new Date()
      });
    }

    // Recent notifications
    const recentNotifs = await Notification.find().sort({ createdAt: -1 }).limit(5).lean();
    for (const n of recentNotifs) {
      activities.push({
        type: "system_update",
        action: n.title,
        shopName: n.body,
        category: "Notification",
        createdAt: n.createdAt || new Date()
      });
    }

    // Sort by createdAt descending
    activities.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    res.json(activities.slice(0, 25));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.getAllNotifications = async (req, res) => {
  try {
    const Notification = require("../models/Notification");
    const notifications = await Notification.find().populate("userId", "name email role").sort({ createdAt: -1 }).limit(50);
    res.json(notifications);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.sendNotification = async (req, res) => {
  try {
    const Notification = require("../models/Notification");
    const { target, userId, title, body, type } = req.body;

    if (!title || !body) {
      return res.status(400).json({ error: "Title and body are required" });
    }

    let targetUsers = [];
    if (userId) {
      const u = await User.findById(userId);
      if (u) targetUsers.push(u);
    } else if (target === "all") {
      targetUsers = await User.find();
    } else if (target === "partners") {
      targetUsers = await User.find({ role: { $in: ["barber", "tailor"] } });
    } else if (target === "customers") {
      targetUsers = await User.find({ role: "customer" });
    } else {
      // Default to admin himself if no users specified
      targetUsers = [req.user];
    }

    const created = [];
    for (const user of targetUsers) {
      const notif = await Notification.create({
        userId: user._id,
        title,
        body,
        type: type || "general",
        isRead: false
      });
      created.push(notif);
    }

    res.json({ success: true, count: created.length });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

exports.createShop = async (req, res) => {
  try {
    const Barber = require("../models/Barber");
    const bcrypt = require("bcryptjs");
    const { 
      shopName, 
      category, // 'barber' | 'beauty' | 'tailor'
      ownerName, 
      email, 
      phone, 
      city, 
      state, 
      approvalStatus = "approved" 
    } = req.body;

    if (!shopName || !ownerName) {
      return res.status(400).json({ error: "Shop Name and Owner Name are required" });
    }

    // Find or create associated user
    let user = null;
    const shopEmail = email || `${shopName.toLowerCase().replace(/[^a-z0-9]/g, "")}_${Date.now()}@shopsmart.com`;
    user = await User.findOne({ $or: [{ email: shopEmail }, { phone: phone || "" }] });
    
    if (!user) {
      const passwordHash = await bcrypt.hash("123456", 10);
      user = await User.create({
        email: shopEmail,
        name: ownerName,
        phone: phone || "",
        passwordHash,
        role: category === "tailor" ? "tailor" : "barber"
      });
    }

    if (category === "tailor") {
      const tailor = await Tailor.create({
        userId: user._id,
        shopName,
        ownerName,
        mobileNumber: phone || "",
        approvalStatus,
        isShopOpen: true,
        address: { city: city || "", state: state || "" }
      });
      return res.status(201).json({ success: true, type: "tailor", data: tailor });
    } else {
      const isBeauty = category === "beauty" || /beauty|parlou?r/i.test(category || "");
      const barber = await Barber.create({
        userId: user._id,
        shopName,
        ownerName,
        mobileNumber: phone || "",
        businessCategory: isBeauty ? "Beauty Parlor" : "Barber Shop",
        approvalStatus,
        isShopOpen: true,
        address: { city: city || "", state: state || "" }
      });
      return res.status(201).json({ success: true, type: "barber", data: barber });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Server error" });
  }
};

exports.deleteShop = async (req, res) => {
  try {
    const { type, id } = req.params;
    if (type === "tailor") {
      await Tailor.findByIdAndDelete(id);
    } else {
      const Barber = require("../models/Barber");
      await Barber.findByIdAndDelete(id);
    }
    res.json({ ok: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
