const Tailor = require("../models/Tailor");
const TailorOrder = require("../models/TailorOrder");
const User = require("../models/User");
const { Expense } = require("../models/TailorFinance");

exports.getDashboardStats = async (req, res) => {
  try {
    const Booking = require("../models/Booking");
    const Barber = require("../models/Barber");

    const totalUsers = await User.countDocuments({ role: "customer" });
    
    // Barbers (Barber Shop Category)
    const barbers = await Barber.find({ businessCategory: { $regex: /barber/i } });
    const totalBarbers = barbers.length;
    const activeBarbers = barbers.filter(b => b.approvalStatus === "approved" && b.isShopOpen).length;
    const pendingBarbers = barbers.filter(b => b.approvalStatus === "pending").length;

    // Beauty Parlours
    const parlours = await Barber.find({ businessCategory: { $regex: /beauty/i } });
    const totalParlours = parlours.length;
    const activeParlours = parlours.filter(p => p.approvalStatus === "approved" && p.isShopOpen).length;
    const pendingParlours = parlours.filter(p => p.approvalStatus === "pending").length;

    // Tailors
    const tailors = await Tailor.find();
    const totalTailors = tailors.length;
    const activeTailors = tailors.filter(t => t.isVerified && t.isActive).length;
    const pendingTailors = tailors.filter(t => !t.isVerified).length;
    
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
      totalTailors,
      activeTailors,
      pendingTailors,
      
      totalBarbers,
      activeBarbers,
      pendingBarbers,

      totalParlours,
      activeParlours,
      pendingParlours,

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
    const { isVerified, isActive } = req.body;
    
    const tailor = await Tailor.findByIdAndUpdate(
      id,
      { $set: { isVerified, isActive } },
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
    const { approvalStatus, isShopOpen } = req.body;
    
    const barber = await Barber.findByIdAndUpdate(
      id,
      { $set: { approvalStatus, isShopOpen } },
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

exports.getPartnerDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const { type } = req.query;

    if (type === "barber") {
      const Barber = require("../models/Barber");
      const Service = require("../models/Service");
      
      const barber = await Barber.findById(id).populate("userId", "name email phone");
      if (!barber) return res.status(404).json({ error: "Barber not found" });

      const services = await Service.find({ barberId: id });
      return res.json({ partner: barber, services });
    } else {
      const Tailor = require("../models/Tailor");
      const TailorService = require("../models/TailorService");

      const tailor = await Tailor.findById(id).populate("userId", "name email phone");
      if (!tailor) return res.status(404).json({ error: "Tailor not found" });

      const services = await TailorService.find({ tailorId: id });
      return res.json({ partner: tailor, services });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
