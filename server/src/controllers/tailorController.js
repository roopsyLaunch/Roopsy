const User = require("../models/User");
const Tailor = require("../models/Tailor");
const TailorService = require("../models/TailorService");
const TailorOrder = require("../models/TailorOrder");
const Notification = require("../models/Notification");
const { haversineDistance } = require("../utils/distance");
const { calculateIsShopOpen, normalizeWorkingHours } = require("../utils/time");

exports.registerTailor = async (req, res) => {
  try {
    const existing = await Tailor.findOne({ userId: req.user._id });
    if (existing) {
      return res.status(400).json({ error: "Tailor profile already exists" });
    }

    const { shopName, category, ownerName, mobileNumber, address, location, workingHours, gallery, seatCount } = req.body;
    
    const tailor = await Tailor.create({
      userId: req.user._id,
      shopName,
      ownerName,
      mobileNumber,
      address,
      location,
      workingHours: normalizeWorkingHours(workingHours),
      gallery,
      specialties: category ? [category] : [],
      approvalStatus: "pending"
    });

    // Update user role to tailor
    await User.findByIdAndUpdate(req.user._id, { role: "tailor" });

    res.status(201).json({ tailor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getTailors = async (req, res) => {
  try {
    const { lat, lng } = req.query;
    let tailors = await Tailor.find({ approvalStatus: "approved" }).lean();

    tailors = tailors.map(t => {
      if (lat && lng && t.location && t.location.lat != null && t.location.lng != null) {
        t.distance = haversineDistance({ lat: parseFloat(lat), lng: parseFloat(lng) }, t.location);
      } else {
        t.distance = Infinity;
      }
      t.averageRating = t.ratingCount ? (t.ratingSum / t.ratingCount).toFixed(1) : "0.0";
      t.isShopOpen = calculateIsShopOpen(t);
      return t;
    });

    if (lat && lng) {
      tailors.sort((a, b) => a.distance - b.distance);
    }

    res.json({ tailors });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getTailorById = async (req, res) => {
  try {
    const tailor = await Tailor.findById(req.params.id).lean();
    if (!tailor) return res.status(404).json({ error: "Tailor not found" });
    tailor.averageRating = tailor.ratingCount ? (tailor.ratingSum / tailor.ratingCount).toFixed(1) : "0.0";
    tailor.isShopOpen = calculateIsShopOpen(tailor);
    res.json({ tailor });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateTailorMe = async (req, res) => {
  try {
    const updates = req.body;
    if (updates.workingHours !== undefined) {
      updates.workingHours = normalizeWorkingHours(updates.workingHours);
    }
    if (updates.homeServiceFee !== undefined) {
      const fee = Math.max(0, Number(updates.homeServiceFee) || 0);
      updates.homeServiceFee = fee;
      updates.visitFee = fee;
    } else if (updates.visitFee !== undefined) {
      const fee = Math.max(0, Number(updates.visitFee) || 0);
      updates.visitFee = fee;
      updates.homeServiceFee = fee;
    }
    if (updates.premiumServiceFee !== undefined) {
      updates.premiumServiceFee = Math.max(0, Number(updates.premiumServiceFee) || 0);
    }
    const tailor = await Tailor.findOneAndUpdate(
      { userId: req.user._id },
      { $set: updates },
      { new: true }
    );
    if (!tailor) return res.status(404).json({ error: "Tailor not found" });
    const tailorObj = tailor.toObject ? tailor.toObject() : tailor;
    const computedIsOpen = calculateIsShopOpen(tailorObj);
    tailorObj.isShopOpen = computedIsOpen;

    if (tailor.isShopOpen !== computedIsOpen) {
      await Tailor.updateOne({ _id: tailor._id }, { $set: { isShopOpen: computedIsOpen } });
    }

    // Real-time broadcast: notify all connected customer apps at that exact time!
    const io = req.app.get("io");
    if (io) {
      io.emit("shopStatusUpdated", {
        tailorId: tailor._id.toString(),
        shopId: tailor._id.toString(),
        category: "tailor",
        isShopOpen: computedIsOpen,
        shopName: tailorObj.shopName
      });
    }

    res.json({ tailor: tailorObj });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Services
exports.getTailorServices = async (req, res) => {
  try {
    let targetTailorId = req.params.tailorId;
    if (targetTailorId === "me" && req.user) {
      const t = await Tailor.findOne({ userId: req.user._id });
      if (t) targetTailorId = t._id;
    }
    const services = await TailorService.find({ tailorId: targetTailorId }).sort({ createdAt: -1 });
    res.json({ services });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getTailorServicesMe = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const services = await TailorService.find({ tailorId: tailor._id }).sort({ createdAt: -1 });
    res.json({ services });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.createTailorService = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const trimmedName = (req.body.name || "").trim();
    const serviceMode = req.body.serviceMode || "shop";
    const escapeRegex = (string) => string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

    const existing = await TailorService.findOne({
      tailorId: tailor._id,
      name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
      serviceMode,
    });
    if (existing) {
      Object.assign(existing, req.body);
      await existing.save();

      // Clean up any historical duplicates
      await TailorService.deleteMany({
        tailorId: tailor._id,
        name: { $regex: new RegExp(`^${escapeRegex(trimmedName)}$`, "i") },
        serviceMode,
        _id: { $ne: existing._id },
      });

      return res.status(200).json({ service: existing });
    }

    const service = await TailorService.create({
      ...req.body,
      tailorId: tailor._id,
    });
    res.status(201).json({ service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateTailorService = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const service = await TailorService.findOneAndUpdate(
      { _id: req.params.id, tailorId: tailor._id },
      { $set: req.body },
      { new: true }
    );
    if (!service) return res.status(404).json({ error: "Service not found" });
    res.json({ service });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.deleteTailorService = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    await TailorService.findOneAndDelete({ _id: req.params.id, tailorId: tailor._id });
    res.json({ success: true });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

// Orders
exports.createOrder = async (req, res) => {
  try {
    const { 
      tailorId, services, totalAmount, measurements, notes, fittingDate, deliveryDate,
      fabricSource, fabricDetails, designPreferences, measurementProfileId,
      isHomeService, isPremiumService, homeServiceAddress, visitDate, visitFee
    } = req.body;
    
    const targetTailor = await Tailor.findById(tailorId);
    if (!targetTailor) return res.status(404).json({ error: "Tailor not found" });

    const tailorOwnerId = (targetTailor.userId?._id || targetTailor.userId)?.toString();
    const requesterId = req.user?._id?.toString();
    if (tailorOwnerId && requesterId && tailorOwnerId === requesterId) {
      return res.status(403).json({ error: "You cannot book services at your own tailor shop." });
    }

    const isShopCurrentlyOpen = calculateIsShopOpen(targetTailor);
    if (!isShopCurrentlyOpen) {
      return res.status(400).json({ error: "This tailor shop is currently closed. Bookings are not allowed while the shop is closed." });
    }

    const serviceIds = (services || []).map(s => s.serviceId || s._id || s.id).filter(Boolean);
    const dbServices = serviceIds.length > 0 ? await TailorService.find({ _id: { $in: serviceIds } }).lean() : [];

    const normalizedServices = (services || []).map(s => {
      const dbSvc = dbServices.find(d => d._id.toString() === (s.serviceId || s._id || s.id)?.toString());
      const sMode = s.serviceMode || dbSvc?.serviceMode || "shop";
      const cTime = (s.completionTime || dbSvc?.completionTime || "").trim();
      return {
        serviceId: s.serviceId || s._id || s.id,
        name: s.name || dbSvc?.name || "Stitching Service",
        price: Number(s.price ?? dbSvc?.price ?? 0),
        quantity: s.quantity || 1,
        serviceMode: sMode,
        completionTime: cTime,
      };
    });

    const hasPremium = Boolean(
      isPremiumService ||
      normalizedServices.some(s => s.serviceMode === "premium" || (s.name && /premium|vip/i.test(s.name))) ||
      dbServices.some(d => d.serviceMode === "premium" || (d.name && /premium|vip/i.test(d.name)))
    );

    if (hasPremium && normalizedServices.length > 1) {
      return res.status(400).json({
        error: "VIP services operate on a fixed delivery timeline and cannot be combined with other services. Please book the VIP service individually."
      });
    }

    let orderCompletionTime = (req.body.completionTime || "").trim();
    let orderEstimatedDays = req.body.estimatedDays;

    if (hasPremium) {
      if (!orderCompletionTime) {
        const pSvc = normalizedServices.find(s => s.serviceMode === "premium" || (s.name && /premium|vip/i.test(s.name)) || s.completionTime)
          || dbServices.find(d => d.serviceMode === "premium" || (d.name && /premium|vip/i.test(d.name)) || d.completionTime);
        if (pSvc && pSvc.completionTime) {
          orderCompletionTime = pSvc.completionTime;
        } else {
          orderCompletionTime = "12 Hours";
        }
      }

      const matchHours = orderCompletionTime.match(/(\d+)\s*(?:hour|hr)/i);
      const matchDays = orderCompletionTime.match(/(\d+)\s*(?:day)/i);
      if (matchHours) {
        orderEstimatedDays = Math.max(1, Math.ceil(parseInt(matchHours[1], 10) / 24));
      } else if (matchDays) {
        orderEstimatedDays = Math.max(1, parseInt(matchDays[1], 10));
      } else {
        orderEstimatedDays = 1;
      }
    }

    let calculatedDeliveryDate = deliveryDate;
    if (!calculatedDeliveryDate && orderCompletionTime) {
      const matchHours = orderCompletionTime.match(/(\d+)\s*(?:hour|hr)/i);
      const matchDays = orderCompletionTime.match(/(\d+)\s*(?:day)/i);
      if (matchHours) {
        calculatedDeliveryDate = new Date(Date.now() + parseInt(matchHours[1], 10) * 60 * 60 * 1000);
      } else if (matchDays) {
        calculatedDeliveryDate = new Date(Date.now() + parseInt(matchDays[1], 10) * 24 * 60 * 60 * 1000);
      }
    }

    // OTP will be generated ONLY when tailor partner confirms/accepts the booking
    const order = await TailorOrder.create({
      customerId: req.user._id,
      tailorId,
      services: normalizedServices,
      totalAmount,
      measurements,
      measurementProfileId,
      notes,
      fabricSource,
      fabricDetails,
      designPreferences,
      isHomeService,
      isPremiumService: hasPremium,
      homeServiceAddress,
      visitDate,
      visitFee,
      fittingDate,
      deliveryDate: calculatedDeliveryDate,
      estimatedDays: orderEstimatedDays || (hasPremium ? 1 : 3),
      completionTime: orderCompletionTime,
      otp: "",
      isOtpVerified: false,
      status: "pending"
    });

    // Notify Tailor Partner
    if (targetTailor && targetTailor.userId) {
      const customerName = req.user?.name || "Customer";
      const serviceNames = (services || []).map(s => s.name).join(", ");
      const addr = (homeServiceAddress || "").trim();
      const notifTitle = hasPremium
        ? `👑 VIP PREMIUM BOOKING: ${customerName}`
        : isHomeService 
          ? `New Home Tailoring: ${customerName} 🏠` 
          : `New Tailor Booking: ${customerName} ✂️`;
      const notifBody = `${hasPremium ? "👑 PRIORITY VIP ORDER\n" : ""}👤 Customer: ${customerName}\n✂️ Services: ${serviceNames || "Stitching"} (₹${totalAmount})${addr ? `\n📍 Address: ${addr}` : ""}`;
      
      await Notification.create({
        userId: targetTailor.userId,
        title: notifTitle,
        body: notifBody,
        type: "general",
        data: {
          orderId: order._id,
          type: "tailor_order",
          customerName,
          services: serviceNames,
          totalAmount,
          address: addr,
          isHomeService: !!isHomeService,
        }
      }).catch(err => console.error("Notification create error:", err));



      const io = req.app.get("io");
      if (io) {
        io.to(`user_${targetTailor.userId.toString()}`).emit("tailorNewOrder", { order });
        io.to(`user_${targetTailor.userId.toString()}`).emit("bookingUpdated", { orderId: order._id, status: "pending" });
      }
    }

    res.status(201).json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

const enrichOrderTimeline = (order) => {
  const o = order.toObject ? order.toObject() : { ...order };
  if (o.tailorId) {
    const tPhone = o.tailorId.mobileNumber || o.tailorId.phone || o.tailorId.userId?.phone || "";
    o.tailorId.mobileNumber = tPhone;
    o.tailorId.phone = tPhone;
  }
  const isPrem = Boolean(
    o.isPremiumService ||
    (o.services || []).some(s => s.serviceMode === "premium" || (s.name && /premium|vip/i.test(s.name)))
  );
  if (isPrem) {
    o.isPremiumService = true;
    if (!o.completionTime) {
      const pSvc = (o.services || []).find(s => s.serviceMode === "premium" || s.completionTime || (s.name && /premium|vip/i.test(s.name)));
      o.completionTime = pSvc?.completionTime || "12 Hours";
    }
    if (!o.estimatedDays || o.estimatedDays > 1) {
      const matchHours = (o.completionTime || "").match(/(\d+)\s*(?:hour|hr)/i);
      if (matchHours) {
        o.estimatedDays = Math.max(1, Math.ceil(parseInt(matchHours[1], 10) / 24));
      } else {
        o.estimatedDays = 1;
      }
    }
  }
  return o;
};

exports.getTailorOrders = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const orders = await TailorOrder.find({ tailorId: tailor._id }).populate("customerId", "name email phone avatarUrl").sort({ createdAt: -1 });
    res.json({ orders: orders.map(enrichOrderTimeline) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getCustomerOrders = async (req, res) => {
  try {
    const orders = await TailorOrder.find({ customerId: req.user._id })
      .populate({
        path: "tailorId",
        select: "shopName address avatarUrl mobileNumber ownerName userId",
        populate: { path: "userId", select: "phone name" }
      })
      .sort({ createdAt: -1 });
    res.json({ orders: orders.map(enrichOrderTimeline) });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.cancelCustomerOrder = async (req, res) => {
  try {
    const { cancellationReason } = req.body;
    const order = await TailorOrder.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status === "completed" || order.status === "cancelled" || order.status === "declined") {
      return res.status(400).json({ error: `Cannot cancel an order that is already ${order.status}` });
    }

    if (order.isOtpVerified) {
      return res.status(400).json({ error: "Cannot cancel booking after OTP has been verified by the tailor 🔒" });
    }

    order.status = "cancelled";
    order.cancellationReason = cancellationReason || "Cancelled by customer";
    order.statusHistory.push({
      status: "cancelled",
      changedAt: new Date(),
      note: cancellationReason || "Cancelled by customer"
    });

    await order.save();

    // Notify tailor partner
    const tailor = await Tailor.findById(order.tailorId);
    if (tailor && tailor.userId) {
      const customerName = req.user?.name || "Customer";
      const notifBody = `${customerName} cancelled tailor booking #${order._id.toString().slice(-6)}`;

      await Notification.create({
        userId: tailor.userId,
        title: "Booking Cancelled by Customer ❌",
        body: notifBody,
        type: "general",
        data: { orderId: order._id, type: "tailor_order_cancelled" }
      }).catch(err => console.error("Notification create error:", err));

      const io = req.app.get("io");
      if (io) {
        io.to(`user_${tailor.userId.toString()}`).emit("bookingUpdated", { orderId: order._id, status: "cancelled" });
      }
    }

    res.json({ success: true, message: "Booking cancelled successfully", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getTailorNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(30);
    res.json({ notifications });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verifyOrderOtp = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: "OTP is required" });

    const order = await TailorOrder.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Check 4-hour expiration ONLY for Shop Service
    if (!order.isHomeService && order.otpExpiresAt && new Date() > new Date(order.otpExpiresAt)) {
      return res.status(400).json({ error: "OTP expired! Shop service OTP is valid for 4 hours after booking confirmation." });
    }

    if (order.otp !== String(otp).trim()) {
      return res.status(400).json({ error: "Invalid OTP code. Verification failed." });
    }

    order.isOtpVerified = true;
    order.otpVerifiedAt = new Date();
    if (order.status === "pending") {
      order.status = "accepted";
    }
    order.statusHistory.push({
      status: order.status,
      changedAt: new Date(),
      note: "OTP verified by Tailor Partner"
    });

    await order.save();

    await Notification.create({
      userId: order.customerId,
      title: "Booking OTP Verified ✅",
      body: `Your tailor booking order #${order._id.toString().slice(-6)} has been OTP verified by the tailor.`,
      type: "general",
      data: { orderId: order._id }
    }).catch(err => console.error("Notification create error:", err));

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.customerId.toString()}`).emit("bookingUpdated", { orderId: order._id, status: order.status, isOtpVerified: true });
    }

    res.json({ success: true, message: "OTP verified successfully!", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.generateDeliveryOtp = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const order = await TailorOrder.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!order.isOtpVerified) {
      return res.status(400).json({ error: "Initial booking OTP must be verified before generating delivery OTP." });
    }

    // Generate random 4-digit Delivery OTP
    const generatedDeliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
    order.deliveryOtp = generatedDeliveryOtp;
    if (order.status !== "ready" && order.status !== "dispatched") {
      order.status = "ready";
    }
    order.statusHistory.push({
      status: order.status,
      changedAt: new Date(),
      note: "Delivery OTP generated by Tailor Partner"
    });

    await order.save();

    // Notify Customer
    const custId = order.customerId;
    const notifTitle = "Order Complete & Ready 📦";
    const notifBody = `Your order #${order._id.toString().slice(-6)} is ready! Your Completion & Handover OTP is: ${generatedDeliveryOtp}. Share this OTP with the tailor upon receiving your outfit to confirm delivery.`;

    await Notification.create({
      userId: custId,
      title: notifTitle,
      body: notifBody,
      type: "general",
      data: { orderId: order._id, deliveryOtp: generatedDeliveryOtp }
    }).catch(err => console.error("Notification create error:", err));

    // Send Delivery OTP via SMS to Customer
    const customer = await User.findById(custId);
    if (customer && customer.phone) {
      try {
        const { sendCustomSms } = require("../services/smsService");
        await sendCustomSms(customer.phone, generatedDeliveryOtp);
      } catch (err) {
        console.error("Failed to send tailor delivery OTP SMS:", err);
      }
    }

    const io = req.app.get("io");
    if (io) {
      io.to(`user_${custId.toString()}`).emit("bookingUpdated", { orderId: order._id, status: order.status, deliveryOtp: generatedDeliveryOtp });
    }

    res.json({ success: true, message: "Delivery OTP generated successfully!", deliveryOtp: generatedDeliveryOtp, order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.verifyDeliveryOtp = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const { otp } = req.body;
    if (!otp) return res.status(400).json({ error: "Delivery OTP is required" });

    const order = await TailorOrder.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (!order.deliveryOtp) {
      return res.status(400).json({ error: "Delivery OTP has not been generated yet. Tap Deliver Order first." });
    }

    if (order.deliveryOtp !== String(otp).trim()) {
      return res.status(400).json({ error: "Invalid Delivery OTP code. Verification failed." });
    }

    order.isDeliveryOtpVerified = true;
    order.deliveryOtpVerifiedAt = new Date();
    order.status = "completed";
    order.statusHistory.push({
      status: "completed",
      changedAt: new Date(),
      note: "Delivery OTP verified & Order Completed ✅"
    });

    await order.save();

    const notifTitle = "Order Delivered & Completed ✅";
    const notifBody = `Your tailor order #${order._id.toString().slice(-6)} has been successfully delivered! Tap to rate your experience ⭐️`;

    await Notification.create({
      userId: order.customerId,
      title: notifTitle,
      body: notifBody,
      type: "general",
      data: { orderId: order._id, tailorId: order.tailorId, requestRating: true }
    }).catch(err => console.error("Notification create error:", err));



    const io = req.app.get("io");
    if (io) {
      io.to(`user_${order.customerId.toString()}`).emit("bookingUpdated", { orderId: order._id, status: "completed", isDeliveryOtpVerified: true, requestRating: true });
      io.to(`user_${order.customerId.toString()}`).emit("tailorOrderCompleted", { orderId: order._id, tailorId: order.tailorId, requestRating: true });
    }

    res.json({ success: true, message: "Delivery OTP verified & Order Completed successfully! 🎉", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.rateTailorOrder = async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ratingNum = Number(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5 stars" });
    }

    const order = await TailorOrder.findOne({
      _id: req.params.id,
      customerId: req.user._id
    });

    if (!order) {
      return res.status(404).json({ error: "Order not found" });
    }

    if (order.status !== "completed" && !order.isDeliveryOtpVerified) {
      return res.status(400).json({ error: "Order must be completed & delivery verified before rating." });
    }

    const isAlreadyRated = order.isRated;
    const oldRating = order.rating || 0;

    order.rating = ratingNum;
    order.reviewComment = (comment || "").trim();
    order.isRated = true;
    order.ratedAt = new Date();

    await order.save();

    // Update Tailor rating stats
    const tailor = await Tailor.findById(order.tailorId);
    if (tailor) {
      if (isAlreadyRated) {
        tailor.ratingSum = Math.max(0, (tailor.ratingSum || 0) - oldRating + ratingNum);
      } else {
        tailor.ratingSum = (tailor.ratingSum || 0) + ratingNum;
        tailor.ratingCount = (tailor.ratingCount || 0) + 1;
      }
      await tailor.save();

      // Send notification to Tailor Partner
      if (tailor.userId) {
        const custName = req.user?.name || "Customer";
        const notifMsg = `${custName} rated your tailoring service ${ratingNum}/5 stars! ${comment ? `"${comment}"` : ""}`;
        
        await Notification.create({
          userId: tailor.userId,
          title: "New Customer Rating ⭐️",
          body: notifMsg,
          type: "general",
          data: { orderId: order._id, type: "tailor_rating" }
        }).catch(err => console.error("Notification create error:", err));



        const io = req.app.get("io");
        if (io) {
          io.to(`user_${tailor.userId.toString()}`).emit("tailorRatingReceived", { orderId: order._id, rating: ratingNum, comment });
        }
      }
    }

    res.json({ success: true, message: "Thank you for rating your experience! ⭐️", order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.updateOrderStatus = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const { status, cancellationReason, internalNotes, priority, note, estimatedDays, completionTime, deliveryDate, visitFee } = req.body;
    
    const order = await TailorOrder.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Guard: Order completion REQUIRES Delivery OTP verification!
    if (status === "completed" && !order.isDeliveryOtpVerified) {
      return res.status(400).json({
        error: "Delivery OTP Verification Required 📦. Please generate and verify the customer's 4-digit Delivery OTP to complete the order."
      });
    }

    // Strict Guard: Order status CANNOT advance to production/process steps unless customer OTP is verified!
    const ALLOWED_UNVERIFIED_STATUSES = ["accepted", "confirmed", "declined", "cancelled"];
    if (status && status !== order.status && !ALLOWED_UNVERIFIED_STATUSES.includes(status) && !order.isOtpVerified) {
      return res.status(400).json({
        error: "OTP Verification Required 🔒. Customer 4-digit OTP must be verified before proceeding to any further process stage."
      });
    }

    // Strict Guard: Order CANNOT be cancelled or declined after customer OTP is verified!
    const CANCELLATION_STATUSES = ["cancelled", "declined"];
    if (status && CANCELLATION_STATUSES.includes(status) && order.isOtpVerified) {
      return res.status(400).json({
        error: "Cannot cancel or decline booking after OTP has been verified 🔒"
      });
    }

    // Build update payload
    const updatePayload = {};
    if (status) updatePayload.status = status;
    if (cancellationReason !== undefined) updatePayload.cancellationReason = cancellationReason;
    if (internalNotes !== undefined) updatePayload.internalNotes = internalNotes;
    const isPremOrder = Boolean(
      order.isPremiumService ||
      (order.services || []).some(s => s.serviceMode === "premium" || (s.name && /premium|vip/i.test(s.name)))
    );

    if (completionTime !== undefined) {
      updatePayload.completionTime = completionTime;
    } else if (isPremOrder && !order.completionTime) {
      updatePayload.completionTime = "12 Hours";
    }

    if (estimatedDays !== undefined) {
      const daysNum = Number(estimatedDays) || (isPremOrder ? 1 : 3);
      updatePayload.estimatedDays = daysNum;
      if (deliveryDate === undefined) {
        const finalComp = updatePayload.completionTime || order.completionTime || (isPremOrder ? "12 Hours" : "");
        const matchHours = finalComp ? finalComp.match(/(\d+)\s*(?:hour|hr)/i) : null;
        if (matchHours) {
          updatePayload.deliveryDate = new Date(Date.now() + parseInt(matchHours[1], 10) * 60 * 60 * 1000);
        } else {
          const targetDate = new Date();
          targetDate.setDate(targetDate.getDate() + daysNum);
          updatePayload.deliveryDate = targetDate;
        }
      }
    }
    if (deliveryDate !== undefined) updatePayload.deliveryDate = deliveryDate;

    if (order.isHomeService && visitFee !== undefined) {
      const feeNum = Number(visitFee);
      if (!isNaN(feeNum) && feeNum >= 0) {
        updatePayload.visitFee = feeNum;
        const servicesTotal = order.services.reduce((acc, s) => acc + (s.price || 0) * (s.quantity || 1), 0);
        const fabricTotal = order.fabricDetails?.totalFabricCost || 0;
        updatePayload.totalAmount = servicesTotal + fabricTotal + feeNum;
      }
    }

    // Generate OTP ONLY when order is confirmed/accepted by Tailor
    let generatedOtp = order.otp;
    if ((status === "accepted" || status === "confirmed") && (!order.otp || order.otp === "")) {
      generatedOtp = Math.floor(1000 + Math.random() * 9000).toString();
      updatePayload.otp = generatedOtp;
      // 4-Hour Expiration ONLY for Shop Service
      if (!order.isHomeService) {
        updatePayload.otpExpiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
      }
    }

    // Append status history entry
    if (status && status !== order.status) {
      updatePayload.$push = {
        statusHistory: { status, changedAt: new Date(), note: note || "" }
      };
    }

    const updated = await TailorOrder.findByIdAndUpdate(
      req.params.id,
      status && status !== order.status
        ? { $set: updatePayload, $push: updatePayload.$push }
        : { $set: updatePayload },
      { new: true }
    ).populate("customerId", "name email phone avatarUrl");

    if (status && updated && updated.customerId) {
      const custId = updated.customerId._id || updated.customerId;
      const finalOtp = updated.otp || generatedOtp;
      const notifTitle = (status === "accepted" || status === "confirmed") ? "Booking Confirmed! ✂️" : status === "declined" ? "Booking Declined" : `Booking Update: ${status}`;
      const deliveryInfo = updated.deliveryDate
        ? ` • Delivery: ${new Date(updated.deliveryDate).toLocaleDateString("en-IN", { day: "numeric", month: "short" })} (${updated.completionTime || `${updated.estimatedDays || 1} Days`})`
        : "";
      const notifBody = (status === "accepted" || status === "confirmed")
        ? `Tailor partner confirmed your booking! Your OTP is: ${finalOtp}${deliveryInfo}`
        : `Your booking status has been updated to ${status}.`;

      await Notification.create({
        userId: custId,
        title: notifTitle,
        body: notifBody,
        type: "general",
        data: { orderId: updated._id, otp: finalOtp }
      }).catch(err => console.error("Notification create error:", err));

      // Send Initial OTP SMS to Customer on Acceptance
      if ((status === "accepted" || status === "confirmed") && updated.customerId && updated.customerId.phone) {
        try {
          const { sendCustomSms } = require("../services/smsService");
          await sendCustomSms(updated.customerId.phone, finalOtp);
        } catch (err) {
          console.error("Failed to send tailor booking initial OTP SMS:", err);
        }
      }

      const io = req.app.get("io");
      if (io) {
        io.to(`user_${custId.toString()}`).emit("bookingUpdated", { orderId: updated._id, status, otp: finalOtp });
      }
    }

    res.json({ order: updated });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};

exports.getOrderById = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const order = await TailorOrder.findOne({ _id: req.params.id, tailorId: tailor._id })
      .populate("customerId", "name email phone avatarUrl")
      .populate("measurementProfileId");

    if (!order) return res.status(404).json({ error: "Order not found" });
    res.json({ order });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
};
