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
  name: z.string().min(1),
  phone: z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
  otp: z.string().regex(/^\d{4}$/, "OTP must be a 4-digit code"),
  password: z.string().min(6),
  role: z.enum(["customer", "barber"]).optional(),
  application: applicationSchema.optional(),
  requestId: z.string().optional(),
});

const loginSchema = z.object({
  identifier: z.string().min(1),
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
    const errors = parsed.error.flatten().fieldErrors;
    const msg = errors.phone?.[0] || errors.otp?.[0] || errors.password?.[0] || errors.name?.[0] || "Invalid registration inputs";
    return res.status(400).json({ error: msg });
  }
  const { name, phone, otp, password, role, application, requestId } = parsed.data;

  try {
    const Otp = require("../models/Otp");

    // Check if OTP was already verified, or verify it on the fly
    let otpRecord = await Otp.findOne({ phone });
    if (!otpRecord || !otpRecord.isVerified) {
      if (requestId && otp) {
        const { verifyOtpSms } = require("../services/smsService");
        const success = await verifyOtpSms(requestId, otp);
        if (!success) {
          return res.status(400).json({ error: "Invalid or expired OTP code" });
        }
      } else if (otpRecord && otpRecord.reqId.startsWith("mock_req_id_") && otpRecord.otp === otp) {
        // Mock OTP matched, delete it
        await Otp.deleteOne({ _id: otpRecord._id });
      } else {
        return res.status(400).json({ error: "OTP verification required. Please verify OTP first." });
      }
    } else {
      // Already verified, delete it
      await Otp.deleteOne({ _id: otpRecord._id });
    }

    // Check if phone already registered
    const existing = await User.findOne({ phone });
    if (existing) {
      return res.status(409).json({ error: "Mobile number already registered" });
    }

    const email = `user_${phone}_${Date.now()}@roopsy.com`;
    const passwordHash = await bcrypt.hash(password, 10);
    const userRole = role === "barber" ? "barber" : "customer";
    const user = await User.create({
      email,
      passwordHash,
      name,
      phone,
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
        approvalStatus: "pending",
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
        address: user.address,
      },
      barber: barberSummary(barberDoc),
      tailor: tailorSummary(tailorDoc),
    });
  } catch (error) {
    console.error("register error:", error);
    res.status(500).json({ error: "Server error during registration." });
  }
}

async function login(req, res) {
  if (req.body && req.body.email && !req.body.identifier) {
    req.body.identifier = req.body.email;
  }
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Email/Phone and password are required" });
  }
  const { identifier, password } = parsed.data;
  
  const isEmail = identifier.includes("@");
  let query = {};
  if (isEmail) {
    query = { email: identifier.toLowerCase().trim() };
  } else {
    let cleanPhone = identifier.replace(/\D/g, "");
    if (cleanPhone.length > 10 && cleanPhone.startsWith("91")) {
      cleanPhone = cleanPhone.slice(-10);
    }
    query = { phone: cleanPhone };
  }

  try {
    const user = await User.findOne(query);
    if (!user) {
      return res.status(401).json({ error: "Invalid Email/Phone or password" });
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ error: "Invalid Email/Phone or password" });
    }
    const token = signToken({ sub: user._id.toString(), role: user.role });
    let barberDoc = null;
    let tailorDoc = null;
    if (user.role === "barber" || user.role === "admin") {
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
        address: user.address,
      },
      barber: barberSummary(barberDoc),
      tailor: tailorSummary(tailorDoc),
    });
  } catch (error) {
    console.error("login error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
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
      address: req.user.address,
    },
    barber: barberSummary(barberDoc),
    tailor: tailorSummary(tailorDoc),
  });
}

const patchMeSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  avatarUrl: z.string().optional(),
  address: z.object({
    line1: z.string().optional(),
    city: z.string().optional(),
    pincode: z.string().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
  }).optional(),
});

async function patchMe(req, res) {
  const parsed = patchMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const { name, phone, avatarUrl, address } = parsed.data;
  const user = await User.findById(req.user._id);
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (avatarUrl !== undefined) user.avatarUrl = avatarUrl;
  if (address !== undefined) user.address = address;

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
      address: user.address,
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

async function deleteMe(req, res) {
  try {
    const userId = req.user._id;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (user.role === "barber") {
      await Barber.deleteOne({ userId });
    } else if (user.role === "tailor") {
      await Tailor.deleteOne({ userId });
    }

    await User.deleteOne({ _id: userId });
    res.json({ success: true, message: "Account deleted successfully" });
  } catch (error) {
    console.error("deleteMe err", error);
    res.status(500).json({ error: "Server error" });
  }
}

async function deleteNotification(req, res) {
  try {
    const { id } = req.params;
    const mongoose = require("mongoose");
    const deleted = await Notification.findOneAndDelete({ 
      _id: new mongoose.Types.ObjectId(id), 
      userId: req.user._id 
    });
    console.log("Single delete notification result:", deleted);
    if (!deleted) {
      return res.status(404).json({ error: "Notification not found" });
    }
    res.json({ success: true });
  } catch (error) {
    console.error("deleteNotification err", error);
    res.status(500).json({ error: "Server error" });
  }
}

async function deleteNotificationsBulk(req, res) {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: "Invalid notification IDs" });
    }
    const mongoose = require("mongoose");
    const objectIds = ids.map(id => new mongoose.Types.ObjectId(id));
    const result = await Notification.deleteMany({ 
      _id: { $in: objectIds }, 
      userId: req.user._id 
    });
    console.log("Bulk delete notifications result:", result);
    res.json({ success: true, deletedCount: result.deletedCount });
  } catch (error) {
    console.error("deleteNotificationsBulk err", error);
    res.status(500).json({ error: "Server error" });
  }
}

// MSG91 MOBILE OTP AUTHENTICATION
const sendOtpSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Mobile number must be a 10-digit number")
});

const verifyOtpLoginSchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Mobile number must be a 10-digit number"),
  otp: z.string().regex(/^\d{4}$/, "OTP must be a 4-digit code")
});

async function sendOtp(req, res) {
  const parsed = sendOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten().fieldErrors.phone?.[0] || "Invalid phone number" });
  }
  const { phone } = parsed.data;

  try {
    const Otp = require("../models/Otp");
    const { sendOtpSms } = require("../services/smsService");

    const authKey = process.env.MSG91_AUTH_KEY;
    const widgetId = process.env.MSG91_WIDGET_ID;

    let otpVal = "";
    let reqId = "";
    const isLive = authKey && widgetId && widgetId !== "your_widget_id_here";

    if (!isLive) {
      otpVal = Math.floor(1000 + Math.random() * 9000).toString();
      reqId = "mock_req_id_" + Date.now();
      console.log(`[SMS Service] [MOCK OTP] Mobile: ${phone} | OTP: ${otpVal}`);
    } else {
      const result = await sendOtpSms(phone);
      if (!result || (!result.request_id && !result.message)) {
        return res.status(500).json({ error: "Failed to request OTP from MSG91 Widget." });
      }
      reqId = result.request_id || result.message;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry

    await Otp.findOneAndUpdate(
      { phone },
      { otp: otpVal, reqId, expiresAt },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: isLive ? "OTP sent successfully via MSG91 Widget" : "OTP generated successfully in mock mode" });
  } catch (error) {
    console.error("sendOtp error:", error);
    res.status(500).json({ error: "Failed to send OTP. Server error." });
  }
}

async function verifyOtpLogin(req, res) {
  const parsed = verifyOtpLoginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters. Please provide phone and 4-digit OTP." });
  }
  const { phone, otp } = parsed.data;

  try {
    const Otp = require("../models/Otp");

    // Find and verify OTP record
    const otpRecord = await Otp.findOne({ phone });
    if (!otpRecord) {
      return res.status(400).json({ error: "OTP expired or not sent" });
    }

    if (otpRecord.reqId.startsWith("mock_req_id_")) {
      if (otpRecord.otp !== otp) {
        return res.status(400).json({ error: "Invalid OTP code" });
      }
    } else {
      const { verifyOtpSms } = require("../services/smsService");
      const success = await verifyOtpSms(otpRecord.reqId, otp);
      if (!success) {
        return res.status(400).json({ error: "Invalid or expired OTP code" });
      }
    }

    // Delete verified OTP record
    await Otp.deleteOne({ _id: otpRecord._id });

    // Find or Auto-Create User
    let user = await User.findOne({ phone });
    if (!user) {
      // Auto-register new customer
      const randomEmail = `user_${phone}_${Date.now()}@roopsy.com`;
      const randomPasswordHash = await bcrypt.hash(Math.random().toString(36), 10);
      user = await User.create({
        email: randomEmail,
        passwordHash: randomPasswordHash,
        name: "Roopsy_" + phone.slice(-4),
        phone,
        role: "customer"
      });
    }

    // Generate JWT Access Token
    const token = signToken({ sub: user._id.toString(), role: user.role });

    // Fetch related profiles
    let barberDoc = null;
    let tailorDoc = null;
    if (user.role === "barber" || user.role === "admin") {
      barberDoc = await Barber.findOne({ userId: user._id });
    } else if (user.role === "tailor") {
      tailorDoc = await Tailor.findOne({ userId: user._id });
    }

    res.json({
      token,
      user: {
        id: user._id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        avatarUrl: user.avatarUrl,
        favoriteShops: user.favoriteShops || [],
        address: user.address,
      },
      barber: barberSummary(barberDoc),
      tailor: tailorSummary(tailorDoc)
    });
  } catch (error) {
    console.error("verifyOtpLogin error:", error);
    res.status(500).json({ error: "Failed to verify OTP. Server error." });
  }
}

const verifyOtpOnlySchema = z.object({
  phone: z.string().regex(/^\d{10}$/, "Mobile number must be exactly 10 digits"),
  otp: z.string().regex(/^\d{4}$/, "OTP must be a 4-digit code"),
  requestId: z.string().optional(),
});

async function verifyOtpOnly(req, res) {
  const parsed = verifyOtpOnlySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: "Invalid parameters. Please provide phone and 4-digit OTP." });
  }
  const { phone, otp, requestId } = parsed.data;

  try {
    const Otp = require("../models/Otp");

    if (requestId) {
      const { verifyOtpSms } = require("../services/smsService");
      const success = await verifyOtpSms(requestId, otp);
      if (!success) {
        return res.status(400).json({ error: "Invalid or expired OTP code" });
      }
      
      // Update or create Otp record and set isVerified to true
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins expiry
      await Otp.findOneAndUpdate(
        { phone },
        { reqId: requestId, isVerified: true, expiresAt },
        { upsert: true, new: true }
      );
    } else {
      // Mock mode / Server-saved OTP verification
      const otpRecord = await Otp.findOne({ phone });
      if (!otpRecord) {
        return res.status(400).json({ error: "OTP expired or not sent" });
      }

      if (otpRecord.reqId.startsWith("mock_req_id_")) {
        if (otpRecord.otp !== otp) {
          return res.status(400).json({ error: "Invalid OTP code" });
        }
      } else {
        const { verifyOtpSms } = require("../services/smsService");
        const success = await verifyOtpSms(otpRecord.reqId, otp);
        if (!success) {
          return res.status(400).json({ error: "Invalid or expired OTP code" });
        }
      }

      // Mark the record as verified
      otpRecord.isVerified = true;
      await otpRecord.save();
    }

    res.json({ success: true, message: "OTP verified successfully" });
  } catch (error) {
    console.error("verifyOtpOnly error:", error);
    res.status(500).json({ error: "Failed to verify OTP. Server error." });
  }
}


async function forgotPassword(req, res) {
  const { phone } = req.body;
  if (!phone || !/^\d{10}$/.test(phone)) {
    return res.status(400).json({ error: "Please enter a valid 10-digit phone number" });
  }

  try {
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: "No account registered with this mobile number" });
    }

    const Otp = require("../models/Otp");
    const { sendOtpSms } = require("../services/smsService");

    const authKey = process.env.MSG91_AUTH_KEY;
    const widgetId = process.env.MSG91_WIDGET_ID;

    let otpVal = "";
    let reqId = "";
    const isLive = authKey && widgetId && widgetId !== "your_widget_id_here";

    if (!isLive) {
      otpVal = Math.floor(1000 + Math.random() * 9000).toString();
      reqId = "mock_req_id_" + Date.now();
      console.log(`[SMS Service] [MOCK OTP] Mobile: ${phone} | OTP: ${otpVal}`);
    } else {
      const result = await sendOtpSms(phone);
      if (!result || (!result.request_id && !result.message)) {
        return res.status(500).json({ error: "Failed to request reset OTP from MSG91 Widget." });
      }
      reqId = result.request_id || result.message;
    }

    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 mins

    await Otp.findOneAndUpdate(
      { phone },
      { otp: otpVal, reqId, expiresAt },
      { upsert: true, new: true }
    );

    res.json({ success: true, message: isLive ? "Reset OTP code sent successfully via MSG91 Widget" : "Reset OTP generated in mock mode" });
  } catch (error) {
    console.error("forgotPassword error:", error);
    res.status(500).json({ error: "Failed to process request. Server error." });
  }
}

async function resetPassword(req, res) {
  const { phone, otp, requestId, newPassword } = req.body;
  if (!phone || !otp || !newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: "Invalid inputs. New password must be at least 6 characters." });
  }

  try {
    const Otp = require("../models/Otp");

    // Check if OTP was already verified
    const otpRecord = await Otp.findOne({ phone });
    if (!otpRecord || !otpRecord.isVerified) {
      return res.status(400).json({ error: "OTP verification required. Please verify OTP first." });
    }
    // Clear OTP record
    await Otp.deleteOne({ _id: otpRecord._id });

    // Find User
    const user = await User.findOne({ phone });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    // Update password
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ success: true, message: "Your password has been reset successfully! Please sign in with your new password." });
  } catch (error) {
    console.error("resetPassword error:", error);
    res.status(500).json({ error: "Failed to reset password. Server error." });
  }
}

module.exports = { 
  register, 
  login, 
  getMe, 
  patchMe, 
  barberSummary, 
  toggleFavorite, 
  getFavorites, 
  updatePushToken, 
  getUserNotifications, 
  markNotificationsRead,
  deleteMe,
  deleteNotification,
  deleteNotificationsBulk,
  sendOtp,
  verifyOtpLogin,
  forgotPassword,
  resetPassword,
  verifyOtpOnly
};
