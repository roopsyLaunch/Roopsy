const bcrypt = require("bcryptjs");
const { z } = require("zod");
const User = require("../models/User");
const Barber = require("../models/Barber");
const Tailor = require("../models/Tailor");
const { signToken } = require("../utils/jwt.js");
const { buildSeats } = require("../utils/barberSeats");

const applicationSchema = z.object({
  shopName: z.string().min(1),
  bio: z.string().optional(),
  address: z.object({
    line1: z.string().min(1),
    line2: z.string().optional(),
    city: z.string().min(1),
    state: z.string().min(1),
    pincode: z.string().min(1),
  }),
  location: z
    .object({
      lat: z.number(),
      lng: z.number(),
    })
    .optional(),
  seatCount: z.number().int().min(1).max(50).optional(),
  aadhaarLast4: z.string().regex(/^\d{4}$/).optional(),
  bank: z
    .object({
      accountHolderName: z.string().optional(),
      accountNumber: z.string().optional(),
      ifsc: z.string().optional(),
      upiId: z.string().optional(),
    })
    .optional(),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  phone: z.string().optional(),
  role: z.enum(["customer", "barber"]).optional(),
  application: applicationSchema.optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function barberSummary(b) {
  if (!b) return null;
  return {
    id: b._id,
    approvalStatus: b.approvalStatus,
    rejectionReason: b.rejectionReason,
    shopName: b.shopName,
    businessCategory: b.businessCategory,
    bio: b.bio,
    shopPosterUrl: b.shopPosterUrl,
    address: b.address,
    location: b.location,
    seatCount: b.seatCount,
    isShopOpen: b.isShopOpen,
    hasBankOnFile: !!(b.bank && (b.bank.accountNumber || b.bank.upiId)),
    aadhaarLast4: b.aadhaarLast4 || "",
  };
}

function tailorSummary(t) {
  if (!t) return null;
  return {
    id: t._id,
    approvalStatus: t.approvalStatus,
    rejectionReason: t.rejectionReason,
    shopName: t.shopName,
    specialties: t.specialties,
    bio: t.bio,
    shopPosterUrl: t.shopPosterUrl,
    address: t.address,
    location: t.location,
    isShopOpen: t.isShopOpen,
    offersShopService: t.offersShopService !== false,
    offersHomeService: t.offersHomeService !== false,
    offersPremiumService: t.offersPremiumService !== false,
    hasBankOnFile: !!(t.bank && (t.bank.accountNumber || t.bank.upiId)),
    aadhaarLast4: t.aadhaarLast4 || "",
  };
}

async function register(req, res) {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password, name, phone, role, application } = parsed.data;
  const existing = await User.findOne({ email });
  if (existing) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const userRole = role === "barber" ? "barber" : "customer";
  const user = await User.create({
    email,
    passwordHash,
    name,
    phone: phone || "",
    role: userRole,
  });

  let barberDoc = null;
  let tailorDoc = null;
  if (userRole === "barber") {
    const app = application;
    const seatCount = app?.seatCount || 1;
    const seats = buildSeats(seatCount);
    barberDoc = await Barber.create({
      userId: user._id,
      approvalStatus: "pending", // admin must approve barbers
      businessCategory: app?.category || "Barber Shop",
      shopName: app?.shopName || `${name}'s Shop`,
      bio: app?.bio || "",
      shopPosterUrl: "",
      address: app?.address || { line1: "", city: "", state: "", pincode: "" },
      location: app?.location,
      seatCount,
      seats,
      aadhaarLast4: app?.aadhaarLast4 || "",
      bank: app?.bank || {},
    });
  }

  const token = signToken({ sub: user._id.toString(), role: user.role });
  return res.status(201).json({
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      favoriteShops: user.favoriteShops || [],
    },
    barber: barberSummary(barberDoc),
    tailor: tailorSummary(tailorDoc),
  });
}

async function login(req, res) {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { email, password } = parsed.data;
  const user = await User.findOne({ email });
  if (!user) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  const token = signToken({ sub: user._id.toString(), role: user.role });
  let barberDoc = null;
  let tailorDoc = null;
  if (user.role === "barber") {
    barberDoc = await Barber.findOne({ userId: user._id });
  } else if (user.role === "tailor") {
    tailorDoc = await Tailor.findOne({ userId: user._id });
  }
  return res.json({
    token,
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      favoriteShops: user.favoriteShops || [],
    },
    barber: barberSummary(barberDoc),
    tailor: tailorSummary(tailorDoc),
  });
}

async function getMe(req, res) {
  let barberDoc = null;
  let tailorDoc = null;
  if (req.user.role === "barber") {
    barberDoc = await Barber.findOne({ userId: req.user._id });
  } else if (req.user.role === "tailor") {
    tailorDoc = await Tailor.findOne({ userId: req.user._id });
  }
  return res.json({
    user: {
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
      avatarUrl: req.user.avatarUrl,
      favoriteShops: req.user.favoriteShops || [],
    },
    barber: barberSummary(barberDoc),
    tailor: tailorSummary(tailorDoc),
  });
}

const patchMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
});

async function patchMe(req, res) {
  const parsed = patchMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, phone, avatarUrl } = parsed.data;
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;

  await user.save();

  let barberDoc = null;
  let tailorDoc = null;
  if (user.role === "barber") {
    barberDoc = await Barber.findOne({ userId: user._id });
  } else if (user.role === "tailor") {
    tailorDoc = await Tailor.findOne({ userId: user._id });
  }

  return res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      phone: user.phone,
      role: user.role,
      avatarUrl: user.avatarUrl,
      favoriteShops: user.favoriteShops,
    },
    barber: barberSummary(barberDoc),
    tailor: tailorSummary(tailorDoc),
  });
}

async function toggleFavorite(req, res) {
  try {
    const { barberId } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    const index = user.favoriteShops.indexOf(barberId);
    if (index > -1) {
      user.favoriteShops.splice(index, 1);
    } else {
      user.favoriteShops.push(barberId);
    }
    await user.save();
    res.json({ favoriteShops: user.favoriteShops });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
}

async function getFavorites(req, res) {
  try {
    const user = await User.findById(req.user._id).populate("favoriteShops");
    if (!user) return res.status(404).json({ error: "User not found" });

    // Format like publicBarberCard but avoid importing from barberController to prevent circular deps
    const { publicBarberCard } = require("./barberController");
    const barbers = user.favoriteShops.map(b => {
      // Need to populate or calculate fields if necessary, but we can just use the public card
      return publicBarberCard ? publicBarberCard(b) : b;
    });

    res.json({ favorites: barbers });
  } catch (error) {
    console.error("getFavorites err", error);
    res.status(500).json({ error: "Server error" });
  }
}

const Notification = require("../models/Notification");

async function updatePushToken(req, res) {
  try {
    const { token } = req.body;
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: "User not found" });

    user.expoPushToken = token;
    await user.save();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: "Server error" });
  }
}

async function getUserNotifications(req, res) {
  try {
    const notifications = await Notification.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(40);
    const unreadCount = await Notification.countDocuments({ userId: req.user._id, isRead: false });
    res.json({ notifications, unreadCount });
  } catch (error) {
    console.error("getUserNotifications err", error);
    res.status(500).json({ error: "Server error" });
  }
}

async function markNotificationsRead(req, res) {
  try {
    await Notification.updateMany({ userId: req.user._id, isRead: false }, { isRead: true });
    res.json({ success: true });
  } catch (error) {
    console.error("markNotificationsRead err", error);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { register, login, getMe, patchMe, barberSummary, toggleFavorite, getFavorites, updatePushToken, getUserNotifications, markNotificationsRead };
