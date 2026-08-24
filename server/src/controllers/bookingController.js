const { z } = require("zod");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const SlotLock = require("../models/SlotLock");
const Barber = require("../models/Barber");
const Service = require("../models/Service");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { isWithinWorkingHours, endFitsWorkingHours } = require("../utils/time");
const { availableSeatSlots } = require("../utils/barberSeats");

const CHECKIN_WINDOW_START_MINS = 10;
const CHECKIN_WINDOW_END_MINS = 5;

async function autoSuggestChair(barber, startTime, durationMinutes) {
  const start = new Date(startTime);
  const finish = new Date(start.getTime() + durationMinutes * 60000);
  const buffer = barber.bufferMinutes || 5;
  const finishWithBuffer = new Date(finish.getTime() + buffer * 60000);

  const [y, mo, d] = [start.getFullYear(), start.getMonth() + 1, start.getDate()];
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);

  const { parseHm } = require("../utils/time");

  // Check Lunch Time
  if (barber.lunchTime && barber.lunchTime.isActive) {
    const lStartM = parseHm(barber.lunchTime.startTime || "13:00");
    const lEndM = parseHm(barber.lunchTime.endTime || "14:00");
    const lunchStart = new Date(y, mo - 1, d, Math.floor(lStartM / 60), lStartM % 60, 0, 0);
    const lunchEnd = new Date(y, mo - 1, d, Math.floor(lEndM / 60), lEndM % 60, 0, 0);
    if (start < lunchEnd && finishWithBuffer > lunchStart) {
      return { seatIndex: null, seatLabel: "Waiting", addToQueue: true, queuePosition: 0, conflict: "Shop is on lunch break." };
    }
  }

  // Check breaks
  const breaks = barber.breaks || [];
  for (const br of breaks) {
    const brStartTime = new Date(br.startTime);
    const brEndTime = new Date(br.endTime);
    const brStart = new Date(y, mo - 1, d, brStartTime.getHours(), brStartTime.getMinutes());
    const brEnd = new Date(y, mo - 1, d, brEndTime.getHours(), brEndTime.getMinutes());
    if (start < brEnd && finishWithBuffer > brStart) {
      return { seatIndex: null, seatLabel: "Waiting", addToQueue: true, queuePosition: 0, conflict: "Shop is on break." };
    }
  }

  const existing = await Booking.find({
    barberId: barber._id,
    status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart }
  }).sort({ startTime: 1 });

  const chairs = barber.seats.filter(s => s.isAvailable && s.status !== 'maintenance');
  const schedules = {};
  for (const c of chairs) schedules[c.index] = [];
  const unassigned = [];

  for (const b of existing) {
    let bStart = new Date(b.startTime);
    let bEnd = new Date(b.endTime);
    if (b.status === "in-progress" && b.startedAt) {
      bStart = new Date(b.startedAt);
      bEnd = new Date(bStart.getTime() + b.expectedDuration * 60000);
      if (bEnd < new Date()) bEnd = new Date(Date.now() + 5 * 60000);
    }
    const bEndW = new Date(bEnd.getTime() + buffer * 60000);
    if (b.seatIndex !== undefined && b.seatIndex !== null && schedules[b.seatIndex]) {
      schedules[b.seatIndex].push({ start: bStart, end: bEndW });
    } else {
      unassigned.push({ start: bStart, end: bEndW });
    }
  }

  for (const un of unassigned) {
    for (const c of chairs) {
      let overlap = false;
      for (const block of schedules[c.index]) {
        if (un.start < block.end && un.end > block.start) {
          overlap = true; break;
        }
      }
      if (!overlap) {
        schedules[c.index].push(un);
        break;
      }
    }
  }

  let bestChair = null;
  for (const c of chairs) {
    let overlap = false;
    for (const block of schedules[c.index]) {
      if (start < block.end && finishWithBuffer > block.start) {
        overlap = true; break;
      }
    }
    if (!overlap) {
      bestChair = c;
      break;
    }
  }

  if (bestChair) {
    return {
      seatIndex: bestChair.index,
      seatLabel: bestChair.label,
      addToQueue: false
    };
  }

  const lastInQueue = await Booking.findOne({ barberId: barber._id, status: { $in: ["confirmed", "arrived", "pending"] } }).sort({ queuePosition: -1 });
  const nextPos = (lastInQueue && lastInQueue.queuePosition) ? lastInQueue.queuePosition + 1 : 1;
  return {
    seatIndex: null,
    seatLabel: "Waiting",
    addToQueue: true,
    queuePosition: nextPos,
    conflict: true
  };
}

const createSchema = z.object({
  barberId: z.string().length(24),
  serviceIds: z.array(z.string().length(24)).min(1),
  startTime: z.string().datetime(),
  notes: z.string().optional(),
  seatIndex: z.number().int().min(0).optional(),
  isHomeService: z.boolean().optional(),
  homeServiceAddress: z.string().optional(),
  homeServiceLocation: z.object({
    lat: z.number(),
    lng: z.number(),
  }).optional(),
  selectedVariants: z.record(z.string()).optional(),
  staffId: z.string().length(24).nullable().optional(),
  customerETA: z.number().int().min(0).optional(),
});

async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { barberId, serviceIds, startTime, notes, seatIndex, isHomeService, homeServiceAddress, homeServiceLocation, selectedVariants, staffId, customerETA } = parsed.data;
  
  const barber = await Barber.findById(barberId);
  if (!barber) return res.status(404).json({ error: "Barber not found" });
  if (barber.pauseBookings) return res.status(400).json({ error: "Shop is currently not accepting new bookings." });

  if (isHomeService) {
    if (!barber.offersHomeService) return res.status(400).json({ error: "Home service off" });
  } else {
    if (!barber.isShopOpen) return res.status(400).json({ error: "Shop is currently closed for shop bookings." });
  }

  const services = await Service.find({ _id: { $in: serviceIds.map(id => new mongoose.Types.ObjectId(id)) }, barberId: barber._id });
  if (services.length !== serviceIds.length) return res.status(400).json({ error: "Invalid services" });

  const totalMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalMinutes * 60 * 1000);

  const { parseHm } = require("../utils/time");
  if (barber.lunchTime && barber.lunchTime.isActive) {
    const y = start.getFullYear();
    const mo = start.getMonth();
    const d = start.getDate();
    const lStartM = parseHm(barber.lunchTime.startTime || "13:00");
    const lEndM = parseHm(barber.lunchTime.endTime || "14:00");
    const lunchStart = new Date(y, mo, d, Math.floor(lStartM / 60), lStartM % 60, 0, 0);
    const lunchEnd = new Date(y, mo, d, Math.floor(lEndM / 60), lEndM % 60, 0, 0);
    if (start < lunchEnd && end > lunchStart) {
      return res.status(400).json({ error: "Shop is currently on lunch break." });
    }
  }

  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: "Invalid startTime" });

  const { dayKeyFromDate } = require("../utils/time");
  const dayKey = dayKeyFromDate(start);
  
  // Create an effective working hours object that considers dailyOpenTime and dailyCloseTime 
  // since Partner Registration doesn't explicitly set workingHours, relying on strict defaults.
  const effectiveWorkingHours = JSON.parse(JSON.stringify(barber.workingHours || {}));
  if (barber.dailyOpenTime && barber.dailyCloseTime) {
    if (!effectiveWorkingHours[dayKey]) effectiveWorkingHours[dayKey] = {};
    const dOpen = parseHm(barber.dailyOpenTime);
    const dClose = parseHm(barber.dailyCloseTime);
    const whOpen = parseHm(effectiveWorkingHours[dayKey].open || "09:00");
    const whClose = parseHm(effectiveWorkingHours[dayKey].close || "18:00");
    
    // Expand the window if daily limits are broader
    effectiveWorkingHours[dayKey].open = dOpen < whOpen ? barber.dailyOpenTime : (effectiveWorkingHours[dayKey].open || "09:00");
    effectiveWorkingHours[dayKey].close = dClose > whClose ? barber.dailyCloseTime : (effectiveWorkingHours[dayKey].close || "18:00");
  }

  if (!isWithinWorkingHours(start, effectiveWorkingHours)) return res.status(400).json({ error: "Start time outside working hours" });
  if (!endFitsWorkingHours(start, end, effectiveWorkingHours)) return res.status(400).json({ error: "Booking ends after closing time" });

  const dateString = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
  if (barber.unavailableDates && barber.unavailableDates.includes(dateString)) {
    return res.status(400).json({ error: "Shop is closed on this date." });
  }

  // Prevent user from double-booking themselves in overlapping time slots
  const overlappingUserBooking = await Booking.findOne({
    customerId: req.user._id,
    status: { $in: ["pending", "confirmed", "arrived", "in-progress"] },
    startTime: { $lt: end },
    endTime: { $gt: start }
  });
  if (overlappingUserBooking) {
    return res.status(409).json({ error: "You already have an active booking during this time." });
  }
  // Atomic Booking Protection (Pessimistic Lock via SlotLock)
  const lock = await SlotLock.findOneAndUpdate(
    { barberId: barber._id, time: start, lockedBy: { $ne: req.user._id } },
    { $setOnInsert: { barberId: barber._id, time: start, lockedBy: req.user._id, lockedAt: new Date() } },
    { upsert: true, new: true }
  );
  if (lock && lock.lockedBy && lock.lockedBy.toString() !== req.user._id.toString()) {
     return res.status(409).json({ error: "This slot is currently being locked by another user." });
  }

  const suggestion = await autoSuggestChair(barber, start, totalMinutes);
  if (suggestion.conflict && typeof suggestion.conflict === 'string') {
      await SlotLock.deleteOne({ barberId: barber._id, time: start, lockedBy: req.user._id });
      return res.status(409).json({ error: suggestion.conflict });
  }

  let finalSeatIndex = suggestion.seatIndex;
  let finalSeatLabel = suggestion.seatLabel;
  let queuePosition = suggestion.addToQueue ? suggestion.queuePosition : 0;

  let finalStartTime = start;
  let finalEndTime = end;

  if (seatIndex !== undefined) {
    const seat = barber.seats.find(s => s.index === seatIndex);
    if (seat && seat.status !== 'maintenance') {
      finalSeatIndex = seat.index;
      finalSeatLabel = seat.label || `Chair ${seatIndex + 1}`;
      
      // Calculate when this specific chair will be free
      const existingForChair = await Booking.find({
        barberId: barber._id,
        seatIndex: seatIndex,
        status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
        startTime: { $lt: new Date(start.getTime() + 24 * 3600000) },
        endTime: { $gt: new Date(start.getTime() - 24 * 3600000) }
      }).sort({ startTime: 1 });

      let chairFreeTime = new Date();
      for (const b of existingForChair) {
        let bEnd = new Date(b.endTime);
        if (b.status === "in-progress" && b.startedAt) {
          bEnd = new Date(new Date(b.startedAt).getTime() + b.expectedDuration * 60000);
          if (bEnd < new Date()) bEnd = new Date(Date.now() + 5 * 60000); 
        }
        bEnd = new Date(bEnd.getTime() + 5 * 60000); // 5 min buffer
        if (bEnd > chairFreeTime) chairFreeTime = bEnd;
      }
      
      if (chairFreeTime > finalStartTime) {
        finalStartTime = chairFreeTime;
        finalEndTime = new Date(finalStartTime.getTime() + totalMinutes * 60000);
      }
    }
  }

  const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();
  const booking = await Booking.create({
    customerId: req.user._id,
    barberId: barber._id,
    serviceIds,
    startTime: finalStartTime,
    endTime: finalEndTime,
    expectedDuration: totalMinutes,
    status: "pending",
    notes: notes || "",
    seatIndex: finalSeatIndex,
    seatLabel: finalSeatLabel,
    verificationPin,
    isHomeService: isHomeService || false,
    homeServiceAddress: homeServiceAddress || "",
    homeServiceLocation: homeServiceLocation || undefined,
    selectedVariants: selectedVariants || {},
    queuePosition,
    staffId: staffId || null,
    customerETA: customerETA !== undefined ? customerETA : null,
  });
  await booking.populate("serviceIds");

  // Audit Log
  await AuditLog.create({
    actionType: "Booking Created",
    entityId: booking._id,
    entityModel: "Booking",
    actorId: req.user._id,
    actorModel: "User",
    details: { startTime, services: serviceIds }
  });

  // Send Push Notification to Barber/Parlour Partner & Save to Inbox
  if (barber.userId) {
    try {
      const Notification = require("../models/Notification");
      const customerName = req.user?.name || "Customer";
      const totalAmount = services.reduce((sum, s) => sum + s.price, 0);
      await Notification.create({
        userId: barber.userId,
        title: "New Booking Request 💈",
        body: `${customerName} booked an appointment for ₹${totalAmount}. Please review the request.`,
        type: "general",
        data: { bookingId: booking._id, type: "barber_booking" }
      });
    } catch (e) {
      console.error("Failed to create booking request notification for barber", e);
    }
  }

  // Send Booking OTP via SMS to Customer
  if (req.user?.phone) {
    try {
      const { sendCustomSms } = require("../services/smsService");
      await sendCustomSms(req.user.phone, booking.verificationPin);
    } catch (err) {
      console.error("Failed to send booking verification OTP SMS:", err);
    }
  }

  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
    io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
  }

  // Release lock
  await SlotLock.deleteOne({ barberId: barber._id, time: start, lockedBy: req.user._id });

  return res.status(201).json({ booking: formatBooking(booking) });
}

function formatBooking(b) {
  const services = (b.serviceIds || []).map(s => s && s.name ? { id: s._id, name: s.name, category: s.category, durationMinutes: s.durationMinutes, price: s.price } : { id: s });
  
  let arrivalTime = b.startTime;
  if (b.customerETA != null && b.createdAt) {
    arrivalTime = new Date(new Date(b.createdAt).getTime() + b.customerETA * 60000);
  }

  return {
    id: b._id, customerId: b.customerId, barberId: b.barberId, serviceIds: services.map(x => x.id), services,
    startTime: b.startTime, arrivalTime: arrivalTime, endTime: b.endTime, expectedDuration: b.expectedDuration, status: b.status, notes: b.notes,
    createdAt: b.createdAt, seatIndex: b.seatIndex, seatLabel: b.seatLabel, verificationPin: b.verificationPin,
    isHomeService: b.isHomeService, homeServiceAddress: b.homeServiceAddress, homeServiceLocation: b.homeServiceLocation, selectedVariants: b.selectedVariants,
    isWalkIn: b.isWalkIn, guestName: b.guestName, guestPhone: b.guestPhone,
    queuePosition: b.queuePosition, arrivedAt: b.arrivedAt, startedAt: b.startedAt, completedAt: b.completedAt, delayMinutes: b.delayMinutes,
    staffId: b.staffId, paymentStatus: b.paymentStatus, customerETA: b.customerETA, barberETA: b.barberETA, barberArrivalTime: b.barberArrivalTime,
    isOtpVerified: b.isOtpVerified || false, otpVerifiedAt: b.otpVerifiedAt
  };
}

async function listMine(req, res) {
  const bookings = await Booking.find({ customerId: req.user._id }).populate("serviceIds").populate("barberId").sort({ createdAt: -1 });
  const out = bookings.map((b) => {
    const barber = b.barberId;
    return {
      ...formatBooking(b),
      barber: barber ? { id: barber._id, shopName: barber.shopName, bio: barber.bio, phone: barber.mobileNumber, businessCategory: barber.businessCategory, genderPreference: barber.genderPreference } : null,
    };
  });
  res.json({ bookings: out });
}

async function listForBarber(req, res) {
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber) return res.json({ bookings: [] });
  const bookings = await Booking.find({ barberId: barber._id }).populate("serviceIds").populate("customerId", "name email phone avatarUrl").sort({ createdAt: -1 });
  const out = bookings.map(b => ({
    ...formatBooking(b),
    customer: b.customerId ? { id: b.customerId._id, name: b.customerId.name, email: b.customerId.email, phone: b.customerId.phone, avatarUrl: b.customerId.avatarUrl } : null,
  }));
  res.json({ bookings: out });
}

const patchSchema = z.object({
  status: z.enum(["pending", "confirmed", "arrived", "cancelled", "in-progress", "completed", "declined", "rejected", "no-show"]).optional(),
  barberETA: z.number().int().min(0).optional(),
});

async function patch(req, res) {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const barber = await Barber.findOne({ userId: req.user._id });
  const isCustomer = booking.customerId && booking.customerId.toString() === req.user._id.toString();
  const isOwnBarber = barber && booking.barberId.toString() === barber._id.toString();

  if (parsed.data.status === "cancelled") {
    if (!isCustomer && !isOwnBarber && req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  } else if (parsed.data.status) {
    if (!isOwnBarber && req.user.role !== "admin") return res.status(403).json({ error: "Only the barber can update this status" });
  }

  if (parsed.data.status !== undefined && parsed.data.status !== booking.status) {
    const oldStatus = booking.status;
    booking.status = parsed.data.status;
    const now = new Date();

    if (booking.status === "arrived") booking.arrivedAt = now;
    if (booking.status === "in-progress") {
      booking.startedAt = now;
      if (barber && booking.seatIndex !== null && booking.seatIndex !== undefined) {
        const seat = barber.seats.find(s => s.index === booking.seatIndex);
        if (seat) {
          seat.isAvailable = false;
          seat.occupiedUntil = new Date(booking.startedAt.getTime() + (booking.expectedDuration || 30) * 60000);
          await barber.save();
        }
      }
    }
    
    // Check if delayed
    if (booking.status === "completed") {
       booking.completedAt = now;
       if (booking.startedAt) {
          const actualDuration = (now.getTime() - booking.startedAt.getTime()) / 60000;
          if (actualDuration > booking.expectedDuration + 5) {
             booking.delayMinutes = Math.floor(actualDuration - booking.expectedDuration);
          }
       }
    }
    if (booking.status === "no-show") booking.noShowAt = now;

    if (["completed", "cancelled", "no-show"].includes(booking.status) && ["in-progress", "arrived", "confirmed", "pending"].includes(oldStatus)) {
      booking.queuePosition = 0; // Remove from queue
      if (barber && booking.seatIndex !== null && booking.seatIndex !== undefined) {
        const seat = barber.seats.find(s => s.index === booking.seatIndex);
        if (seat && !seat.isAvailable) {
          seat.isAvailable = true;
          seat.occupiedUntil = null;
          await barber.save();
        }
      }
    }
    
    await AuditLog.create({
      actionType: `Status Changed to ${booking.status}`,
      entityId: booking._id,
      entityModel: "Booking",
      actorId: req.user._id,
      actorModel: isCustomer ? "User" : "Barber",
      details: { oldStatus, newStatus: booking.status }
    });
  }
  
  if (parsed.data.barberETA !== undefined) {
    booking.barberETA = parsed.data.barberETA;
    booking.barberArrivalTime = new Date(Date.now() + parsed.data.barberETA * 60000);
  }

  await booking.save();
  await booking.populate("serviceIds");

  const io = req.app.get("io");
  if (io) {
    if (booking.customerId) io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
    if (barber) {
      io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
      io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
      io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
    }
  }

  // Send Push Notification to Customer & Save to Notification Inbox
  if (booking.customerId && parsed.data.status !== undefined) {
    let title = "Booking Update";
    let body = `Your booking status is now: ${parsed.data.status}`;
    if (parsed.data.status === "confirmed") {
      title = "Booking Confirmed!";
      body = barber ? `Your booking at ${barber.shopName} has been confirmed.` : "Your booking is confirmed.";
    } else if (parsed.data.status === "cancelled") {
      title = "Booking Cancelled";
      body = barber ? `Your booking at ${barber.shopName} has been cancelled.` : "Your booking is cancelled.";
    } else if (parsed.data.status === "in-progress") {
      title = "Haircut Started";
      body = "You are now in the chair!";
    } else if (parsed.data.status === "completed") {
      title = "Thank You!";
      body = "Your booking is complete. Don't forget to leave a review!";
    }

    try {
      const Notification = require("../models/Notification");
      await Notification.create({
        userId: booking.customerId,
        title,
        body,
        type: "booking_status",
        data: { bookingId: booking._id }
      });
    } catch (e) {
      console.error("Failed to create booking update notification", e);
    }
  }

  res.json({ booking: formatBooking(booking) });
}

// UNIFIED QUEUE
async function getUnifiedQueue(req, res) {
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber) return res.status(404).json({ error: "Barber not found" });

  let targetDate = new Date();
  if (req.query.date) {
    const [y, m, d] = req.query.date.split('-');
    targetDate = new Date(y, m - 1, d);
  }

  const startOfDay = new Date(targetDate); startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(targetDate); endOfDay.setHours(23,59,59,999);

  const bookings = await Booking.find({
    barberId: barber._id,
    status: { $in: ["pending", "confirmed", "arrived", "in-progress", "cancelled"] },
    startTime: { $gte: startOfDay, $lt: endOfDay }
  }).populate("serviceIds").populate("customerId", "name phone avatarUrl").sort({ startTime: 1 });

  // Priority sorting: In-Progress > Arrived > Online/Walk-in (by startTime)
  bookings.sort((a, b) => {
    const pA = a.status === "in-progress" ? 3 : a.status === "arrived" ? 2 : 1;
    const pB = b.status === "in-progress" ? 3 : b.status === "arrived" ? 2 : 1;
    if (pA !== pB) return pB - pA;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const out = bookings.map(b => ({
    ...formatBooking(b),
    customer: b.customerId ? { name: b.customerId.name, phone: b.customerId.phone, avatarUrl: b.customerId.avatarUrl } : { name: b.guestName, phone: b.guestPhone }
  }));
  res.json({ queue: out });
}

const slotsQuery = z.object({
  barberId: z.string().length(24),
  serviceIds: z.string(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function availableSlots(req, res) {
  const parsed = slotsQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { barberId, serviceIds, date } = parsed.data;
  const barber = await Barber.findById(barberId);
  if (!barber || barber.pauseBookings) return res.json({ slots: [] });

  if (barber.unavailableDates && barber.unavailableDates.includes(date)) {
    return res.json({ slots: [] });
  }

  const serviceIdArray = serviceIds.split(",").map(id => id.trim()).filter(id => id);
  const services = await Service.find({ _id: { $in: serviceIdArray }, barberId: barber._id });
  if (!services || services.length !== serviceIdArray.length) return res.status(404).json({ error: "One or more services not found" });

  const isHomeService = services.some(s => s.isHomeService);
  if (isHomeService) {
    if (!barber.offersHomeService) return res.json({ slots: [] });
  } else {
    if (!barber.isShopOpen) return res.json({ slots: [] });
  }

  const totalMinutes = services.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
  const buffer = barber.bufferMinutes || 5;
  const totalNeededMinutes = totalMinutes + buffer;

  const [y, mo, d] = date.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);

  const existing = await Booking.find({
    barberId: barber._id,
    status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
  }).sort({ startTime: 1 });

  const { dayKeyFromDate, parseHm } = require("../utils/time");
  const wh = barber.workingHours[dayKeyFromDate(dayStart)];
  if (!wh || !wh.open || !wh.close || wh.isClosed) return res.json({ slots: [] });

  const openM = parseHm(wh.open);
  const closeM = parseHm(wh.close);
  const shopOpenDate = new Date(y, mo - 1, d, Math.floor(openM / 60), openM % 60, 0, 0);
  let shopCloseDate = new Date(y, mo - 1, d, Math.floor(closeM / 60), closeM % 60, 0, 0);
  if (closeM < openM) shopCloseDate = new Date(shopCloseDate.getTime() + 24 * 60 * 60 * 1000);

  const chairs = barber.seats.filter(s => s.isAvailable && s.status !== 'maintenance');
  if (chairs.length === 0) return res.json({ slots: [] });

  // Initialize schedules per chair
  const schedules = {};
  for (const c of chairs) schedules[c.index] = [];

  // Add Lunch Time block
  if (barber.lunchTime && barber.lunchTime.isActive) {
    const lStartM = parseHm(barber.lunchTime.startTime || "13:00");
    const lEndM = parseHm(barber.lunchTime.endTime || "14:00");
    const lunchStart = new Date(y, mo - 1, d, Math.floor(lStartM / 60), lStartM % 60, 0, 0);
    const lunchEnd = new Date(y, mo - 1, d, Math.floor(lEndM / 60), lEndM % 60, 0, 0);
    for (const c of chairs) {
      schedules[c.index].push({ start: lunchStart, end: lunchEnd });
    }
  }

  // Add breaks to all chairs
  const breaks = barber.breaks || [];
  for (const br of breaks) {
    // Treat break dates as time only for the given day
    const brStartTime = new Date(br.startTime);
    const brEndTime = new Date(br.endTime);
    const brStart = new Date(y, mo - 1, d, brStartTime.getHours(), brStartTime.getMinutes());
    const brEnd = new Date(y, mo - 1, d, brEndTime.getHours(), brEndTime.getMinutes());
    for (const c of chairs) {
      schedules[c.index].push({ start: brStart, end: brEnd });
    }
  }

  // Add bookings to schedules
  const unassignedBookings = [];
  for (const b of existing) {
    let bStart = new Date(b.startTime);
    let bEnd = new Date(b.endTime);
    
    // Check if delayed
    if (b.status === "in-progress" && b.startedAt) {
      bStart = new Date(b.startedAt);
      bEnd = new Date(bStart.getTime() + b.expectedDuration * 60000);
      if (bEnd < new Date()) bEnd = new Date(Date.now() + 5 * 60000); // give 5 min grace if overtime
    }
    
    const bEndWithBuffer = new Date(bEnd.getTime() + buffer * 60000);
    
    if (b.seatIndex !== undefined && b.seatIndex !== null && schedules[b.seatIndex]) {
      schedules[b.seatIndex].push({ start: bStart, end: bEndWithBuffer });
    } else {
      unassignedBookings.push({ start: bStart, end: bEndWithBuffer });
    }
  }

  // Tentatively assign unassigned bookings to earliest valid gap to accurately reduce capacity
  for (const un of unassignedBookings) {
    let assigned = false;
    for (const c of chairs) {
      let overlap = false;
      for (const block of schedules[c.index]) {
        if (un.start < block.end && un.end > block.start) {
          overlap = true;
          break;
        }
      }
      if (!overlap) {
        schedules[c.index].push(un);
        assigned = true;
        break;
      }
    }
  }

  const slotIntervalMinutes = barber.slotIntervalMinutes || 15;
  const validSlots = new Set();
  const now = new Date();

  // Find free gaps for each chair and generate slots
  for (const c of chairs) {
    // Sort blocks by start time
    const blocks = schedules[c.index].sort((a, b) => a.start - b.start);
    let currentStart = new Date(shopOpenDate);
    
    const gaps = [];
    for (const block of blocks) {
      if (currentStart < block.start) {
        gaps.push({ start: new Date(currentStart), end: new Date(block.start) });
      }
      if (currentStart < block.end) {
        currentStart = new Date(block.end);
      }
    }
    if (currentStart < shopCloseDate) {
      gaps.push({ start: new Date(currentStart), end: new Date(shopCloseDate) });
    }

    console.log("Chair", c.index, "Gaps:", gaps, "Now:", now, "TotalNeeded:", totalNeededMinutes);

    // Generate valid slots from gaps
    for (const gap of gaps) {
      const gapDurMins = (gap.end - gap.start) / 60000;
      if (gapDurMins >= totalNeededMinutes) {
        // Step through the gap using the slot interval
        let slotTime = new Date(gap.start);
        
        // Round up to nearest interval if the gap doesn't start exactly on an interval boundary
        // E.g. gap starts at 10:07, interval is 15. The first displayed slot could be 10:15
        const msSinceMidnight = slotTime.getTime() - new Date(slotTime).setHours(0,0,0,0);
        const minsSinceMidnight = msSinceMidnight / 60000;
        const remainder = minsSinceMidnight % slotIntervalMinutes;
        if (remainder !== 0) {
           slotTime = new Date(slotTime.getTime() + (slotIntervalMinutes - remainder) * 60000);
        }

        while (slotTime.getTime() + totalNeededMinutes * 60000 <= gap.end.getTime()) {
          if (slotTime > now) {
            validSlots.add(slotTime.toISOString());
          }
          slotTime = new Date(slotTime.getTime() + slotIntervalMinutes * 60000);
        }
      }
    }
  }

  // Sort and return unique slots
  const sortedSlots = Array.from(validSlots).sort();

  // Generate all possible slots for the UI grid
  const allSlots = [];
  let currentGridSlot = new Date(shopOpenDate);
  // Generate visual slots all the way up to closing time for UI completeness
  while (currentGridSlot.getTime() < shopCloseDate.getTime()) {
    const iso = currentGridSlot.toISOString();
    const isPast = currentGridSlot <= now;
    // It's considered booked if it's not in the validSlots set, BUT only if it's in the future.
    // Past slots should just be greyed out, not marked as "Booked".
    const isBooked = !validSlots.has(iso) && !isPast;
    
    allSlots.push({
      time: iso,
      isBooked,
      isPast
    });
    
    currentGridSlot = new Date(currentGridSlot.getTime() + slotIntervalMinutes * 60000);
  }

  res.json({ 
    slots: sortedSlots,
    allSlots,
    totalSlotsForDay: allSlots.length,
    bookedSlotsForDay: allSlots.filter(s => s.isBooked && !s.isPast).length
  });
}

const verifyOtpSchema = z.object({ bookingId: z.string().length(24), otp: z.string().length(4) });
async function verifyOtp(req, res) {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { bookingId, otp } = parsed.data;
  const booking = await Booking.findById(bookingId);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber || booking.barberId.toString() !== barber._id.toString()) return res.status(403).json({ error: "Forbidden" });

  if (booking.verificationPin !== otp) return res.status(400).json({ error: "Invalid OTP" });
  booking.status = "in-progress";
  booking.startedAt = new Date();
  booking.isOtpVerified = true;
  booking.otpVerifiedAt = new Date();
  await booking.save();
  
  if (booking.seatIndex !== null && booking.seatIndex !== undefined) {
    const seat = barber.seats.find(s => s.index === booking.seatIndex);
    if (seat) {
      seat.isAvailable = false;
      seat.occupiedUntil = new Date(booking.startedAt.getTime() + (booking.expectedDuration || 30) * 60000);
      await barber.save();
    }
  }
  
  await AuditLog.create({
    actionType: "OTP Verified",
    entityId: booking._id,
    entityModel: "Booking",
    actorId: req.user._id,
    actorModel: "Barber",
    details: {}
  });

  // Create Notification for Customer
  if (booking.customerId) {
    try {
      const Notification = require("../models/Notification");
      await Notification.create({
        userId: booking.customerId,
        title: "OTP Verified ✅",
        body: `Your OTP for ${barber.shopName || "salon appointment"} has been verified! Service in progress.`,
        type: "booking_otp_verified",
        data: { bookingId: booking._id }
      });
    } catch (e) {
      console.error("Failed to create OTP notification", e);
    }
  }

  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
    if (booking.customerId) {
      io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { 
        bookingId: booking._id,
        status: "in-progress",
        isOtpVerified: true,
        message: "OTP Verified ✅"
      });
    }
  }
  res.json({ booking: formatBooking(booking) });
}

const lockSlotSchema = z.object({ barberId: z.string().length(24), time: z.string() });
async function lockSlot(req, res) {
  const parsed = lockSlotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  await SlotLock.deleteMany({ lockedAt: { $lt: new Date(Date.now() - 45000) } });
  await SlotLock.findOneAndUpdate(
    { barberId: parsed.data.barberId, time: new Date(parsed.data.time) },
    { lockedBy: req.user.id, lockedAt: new Date() },
    { upsert: true, new: true }
  );
  res.json({ success: true });
}

const walkInSchema = z.object({
  serviceIds: z.array(z.string().length(24)).min(1),
  customerName: z.string().optional(),
  customerPhone: z.string().optional(),
});

async function walkIn(req, res) {
  const parsed = walkInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const barber = await Barber.findOne({ userId: req.user.id });
  if (!barber) return res.status(404).json({ error: "Barber not found" });
  if (!barber.isShopOpen || barber.pauseBookings) return res.status(400).json({ error: "Shop is currently not accepting new bookings." });
  
  const { serviceIds, customerName, customerPhone } = parsed.data;
  const services = await Service.find({ _id: { $in: serviceIds }, barberId: barber._id });
  const totalDuration = services.reduce((s, x) => s + (x.durationMinutes || 30), 0);
  
  const start = new Date();
  const end = new Date(start.getTime() + totalDuration * 60000);
  const suggestion = await autoSuggestChair(barber, start, totalDuration);
  
  const booking = new Booking({
    barberId: barber._id,
    serviceIds,
    startTime: start,
    endTime: end,
    expectedDuration: totalDuration,
    status: "in-progress",
    isWalkIn: true,
    guestName: customerName || "Walk-In",
    guestPhone: customerPhone || "",
    seatIndex: suggestion.seatIndex,
    seatLabel: suggestion.seatLabel,
    queuePosition: suggestion.addToQueue ? suggestion.queuePosition : 0,
    startedAt: new Date(),
    verificationPin: "WALK",
  });
  await booking.save();
  await booking.populate("serviceIds");
  
  await AuditLog.create({
    actionType: "Walk-In Created",
    entityId: booking._id,
    entityModel: "Booking",
    actorId: req.user._id,
    actorModel: "Barber",
    details: { name: customerName }
  });

  if (suggestion.seatIndex !== null && suggestion.seatIndex !== undefined) {
    const seat = barber.seats.find(s => s.index === suggestion.seatIndex);
    if (seat) {
      seat.isAvailable = false;
      seat.occupiedUntil = new Date(booking.startedAt.getTime() + totalDuration * 60000);
      await barber.save();
    }
  }

  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
  }
  
  res.json({ message: "Walk-in added", booking: formatBooking(booking) });
}

async function reschedule(req, res) {
  const parsed = z.object({ newStartTime: z.string().datetime() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { newStartTime } = parsed.data;
  
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  
  if (booking.status === "in-progress" || booking.status === "completed") {
      return res.status(400).json({ error: "Cannot reschedule an active or completed booking." });
  }

  const start = new Date(newStartTime);
  const end = new Date(start.getTime() + booking.expectedDuration * 60000);
  booking.startTime = start;
  booking.endTime = end;
  booking.status = "pending"; // resetting status to wait for confirm
  await booking.save();
  
  await AuditLog.create({
    actionType: "Booking Rescheduled",
    entityId: booking._id,
    entityModel: "Booking",
    actorId: req.user._id,
    actorModel: "User",
    details: { newStartTime }
  });

  const io = req.app.get("io");
  if (io) {
    io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
    const barber = await Barber.findById(booking.barberId);
    if(barber) {
        io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
        io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
    }
  }

  res.json({ message: "Rescheduled successfully", booking: formatBooking(booking) });
}

async function cancel(req, res) {
  const parsed = z.object({ reason: z.string().optional() }).safeParse(req.body);
  const booking = await Booking.findById(req.params.id);
  if (!booking) return res.status(404).json({ error: "Booking not found" });
  
  if (booking.status === "in-progress" || booking.status === "completed") {
      return res.status(400).json({ error: "Cannot cancel an active or completed booking." });
  }

  booking.status = "cancelled";
  booking.queuePosition = 0;
  if(parsed.data && parsed.data.reason) {
      booking.cancellationReason = parsed.data.reason;
  }
  await booking.save();
  
  await AuditLog.create({
    actionType: "Booking Cancelled",
    entityId: booking._id,
    entityModel: "Booking",
    actorId: req.user._id,
    actorModel: "User",
    details: { reason: booking.cancellationReason }
  });

  const io = req.app.get("io");
  if (io) {
    if (booking.customerId) io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
    const barber = await Barber.findById(booking.barberId);
    if(barber) {
        io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
        io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
        io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
    }
  }
  res.json({ message: "Cancelled successfully", booking: formatBooking(booking) });
}

async function slotAlternatives(req, res) {
  const parsed = z.object({ barberId: z.string().length(24), serviceIds: z.string(), time: z.string() }).safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { getRecommendations } = require("../services/recommendationEngine");
  const services = await Service.find({ _id: { $in: parsed.data.serviceIds.split(",") } });
  const duration = services.reduce((s, x) => s + (x.durationMinutes||30), 0);
  const recommendations = await getRecommendations({ targetBarberId: parsed.data.barberId, durationMinutes: duration, requestedDateStr: parsed.data.time.split("T")[0], requestedTimeIso: parsed.data.time });
  res.json({ recommendations });
}

module.exports = {
  create, listMine, listForBarber, patch, availableSlots, verifyOtp, lockSlot, walkIn, slotAlternatives, getUnifiedQueue, reschedule, cancel
};
