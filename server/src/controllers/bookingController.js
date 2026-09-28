const { z } = require("zod");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const SlotLock = require("../models/SlotLock");
const Barber = require("../models/Barber");
const Service = require("../models/Service");
const AuditLog = require("../models/AuditLog");
const User = require("../models/User");
const { 
  isWithinWorkingHours, 
  endFitsWorkingHours, 
  dayKeyFromDate, 
  parseHm, 
  makeISTDate, 
  getISTComponents, 
  calculateIsShopOpen, 
  normalizeWorkingHours 
} = require("../utils/time");
const { availableSeatSlots } = require("../utils/barberSeats");

const CHECKIN_WINDOW_START_MINS = 10;
const CHECKIN_WINDOW_END_MINS = 5;

async function autoSuggestChair(barber, startTime, durationMinutes) {
  const start = new Date(startTime);
  const finish = new Date(start.getTime() + durationMinutes * 60000);
  const buffer = barber.bufferMinutes || 5;
  const finishWithBuffer = new Date(finish.getTime() + buffer * 60000);

  const { parseHm, makeISTDate, getISTComponents } = require("../utils/time");
  const startIST = getISTComponents(start);
  const [y, mo, d] = [startIST.year, startIST.month, startIST.day];
  const dayStart = makeISTDate(y, mo, d, 0, 0, 0);
  const dayEnd = makeISTDate(y, mo, d, 23, 59, 59);

  // Check Lunch Time
  if (barber.lunchTime && barber.lunchTime.isActive) {
    const lStartM = parseHm(barber.lunchTime.startTime || "13:00");
    const lEndM = parseHm(barber.lunchTime.endTime || "14:00");
    const lunchStart = makeISTDate(y, mo, d, Math.floor(lStartM / 60), lStartM % 60, 0);
    const lunchEnd = makeISTDate(y, mo, d, Math.floor(lEndM / 60), lEndM % 60, 0);
    if (start < lunchEnd && finishWithBuffer > lunchStart) {
      return { seatIndex: null, seatLabel: "Waiting", addToQueue: true, queuePosition: 0, conflict: "Shop is on lunch break." };
    }
  }

  // Check breaks
  const breaks = barber.breaks || [];
  for (const br of breaks) {
    const brStartComp = getISTComponents(br.startTime);
    const brEndComp = getISTComponents(br.endTime);
    const brStart = makeISTDate(y, mo, d, brStartComp.hour, brStartComp.minute, 0);
    const brEnd = makeISTDate(y, mo, d, brEndComp.hour, brEndComp.minute, 0);
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

  const { buildSeats } = require("../utils/barberSeats");
  let chairs = (barber.seats && barber.seats.length > 0)
    ? barber.seats.filter(s => s.status !== 'maintenance')
    : buildSeats(barber.seatCount || 1);
  if (chairs.length === 0) {
    chairs = buildSeats(barber.seatCount || 1);
  }
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

  const ownerUserId = (barber.userId?._id || barber.userId)?.toString();
  const requesterId = req.user?._id?.toString();
  if (ownerUserId && requesterId && ownerUserId === requesterId) {
    const isBeauty = /beauty/i.test(barber.businessCategory || "");
    const shopLabel = isBeauty ? "beauty parlor" : "barber shop";
    return res.status(403).json({ error: `You cannot book services at your own ${shopLabel}.` });
  }

  if (barber.pauseBookings) return res.status(400).json({ error: "Shop is currently not accepting new bookings." });

  const start = new Date(startTime);
  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: "Invalid startTime" });

  // Shop Status Check: Booking is allowed only when the shop partner has turned the shop ON
  const shopIsOpen = barber.isShopOpen !== false && !barber.pauseBookings;
  if (!shopIsOpen) {
    return res.status(400).json({ error: "Shop is currently closed. Bookings are not allowed while the shop is closed." });
  }

  if (isHomeService && !barber.offersHomeService) {
    return res.status(400).json({ error: "Home service is not offered by this shop." });
  }

  const services = await Service.find({ _id: { $in: serviceIds.map(id => new mongoose.Types.ObjectId(id)) }, barberId: barber._id });
  if (services.length !== serviceIds.length) return res.status(400).json({ error: "Invalid services" });

  const totalMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const end = new Date(start.getTime() + totalMinutes * 60 * 1000);
  const startIST = getISTComponents(start);

  const dateString = `${startIST.year}-${String(startIST.month).padStart(2, '0')}-${String(startIST.day).padStart(2, '0')}`;
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
      
      const { calculateNextChairFreeTime } = require("../utils/barberSeats");
      const { startTime: nextStart, endTime: nextEnd } = await calculateNextChairFreeTime(
        barber,
        seatIndex,
        start,
        totalMinutes
      );
      finalStartTime = nextStart;
      finalEndTime = nextEnd;
    }
  }

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
    verificationPin: "", // Generated upon confirmation by barber partner
    otpExpiresAt: null,
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
      const serviceNames = (services || []).map(s => s.name).join(", ");
      const addr = (homeServiceAddress || "").trim();

      const notifTitle = isHomeService ? `New Home Booking: ${customerName} 🏠` : `New Booking: ${customerName} 💈`;
      const notifBody = `👤 Customer: ${customerName}\n✂️ Services: ${serviceNames || "Grooming"} (₹${totalAmount})${addr ? `\n📍 Address: ${addr}` : ""}`;

      await Notification.create({
        userId: barber.userId,
        title: notifTitle,
        body: notifBody,
        type: "general",
        data: {
          bookingId: booking._id,
          type: "barber_booking",
          customerName,
          services: serviceNames,
          totalAmount,
          address: addr,
          isHomeService: !!isHomeService,
        }
      });
    } catch (e) {
      console.error("Failed to create booking request notification for barber", e);
    }
  }

  // Update barber's live seats with latest occupancy & waiting times
  const { enrichBarberSeats } = require("../utils/barberSeats");
  const enrichedSeats = await enrichBarberSeats(barber);
  barber.seats = enrichedSeats.map(s => ({
    index: s.index,
    label: s.label,
    isAvailable: s.isAvailable,
    status: s.status,
    occupiedUntil: s.occupiedUntil ? new Date(s.occupiedUntil) : null,
  }));
  await barber.save();

  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: enrichedSeats });
    io.emit(`shop_${barber._id.toString()}_seats`, { seats: enrichedSeats });
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
    isOtpVerified: b.isOtpVerified || false, otpVerifiedAt: b.otpVerifiedAt,
    otpExpiresAt: b.otpExpiresAt,
    completionPin: b.completionPin || "",
    isCompletionOtpVerified: b.isCompletionOtpVerified || false,
    completionOtpVerifiedAt: b.completionOtpVerifiedAt,
    completionRequestedAt: b.completionRequestedAt,
    rating: b.rating,
    reviewComment: b.reviewComment || "",
    isRated: b.isRated || false,
    ratedAt: b.ratedAt
  };
}

async function listMine(req, res) {
  const bookings = await Booking.find({ customerId: req.user._id })
    .populate("serviceIds")
    .populate({
      path: "barberId",
      populate: { path: "userId", select: "phone name" }
    })
    .sort({ createdAt: -1 });

  const out = bookings.map((b) => {
    const barber = b.barberId;
    const partnerPhone = barber ? (barber.mobileNumber || barber.phone || barber.userId?.phone || "") : "";
    return {
      ...formatBooking(b),
      barber: barber
        ? {
            id: barber._id,
            shopName: barber.shopName,
            bio: barber.bio,
            phone: partnerPhone,
            mobileNumber: partnerPhone,
            businessCategory: barber.businessCategory,
            genderPreference: barber.genderPreference,
          }
        : null,
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

    // Generate Check-in OTP on confirmation by barber partner with 12 hours validity
    if (booking.status === "confirmed") {
      if (!booking.verificationPin || booking.verificationPin === "WALK") {
        booking.verificationPin = Math.floor(1000 + Math.random() * 9000).toString();
      }
      booking.otpExpiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000); // 12 hours expiry
    }

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
       booking.isCompletionOtpVerified = true;
       booking.completionOtpVerifiedAt = now;
       if (booking.startedAt) {
          const actualDuration = (now.getTime() - booking.startedAt.getTime()) / 60000;
          if (actualDuration > (booking.expectedDuration || 30) + 5) {
             booking.delayMinutes = Math.floor(actualDuration - (booking.expectedDuration || 30));
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
    if (booking.customerId) {
      io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { 
        bookingId: booking._id,
        barberId: booking.barberId,
        status: booking.status,
        verificationPin: booking.verificationPin,
        otpExpiresAt: booking.otpExpiresAt,
        isCompletionOtpVerified: booking.isCompletionOtpVerified,
        requestReview: booking.status === "completed",
        message: booking.status === "completed" ? "Service Completed ✅" : `Status updated to ${booking.status}`
      });
      if (booking.status === "completed") {
        io.to(`user_${booking.customerId.toString()}`).emit("serviceCompleted", {
          bookingId: booking._id,
          barberId: booking.barberId,
          requestReview: true
        });
      }
    }
    if (barber) {
      io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
      io.to(`barber_${barber._id.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
      io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
      io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
    }
  }

  // Send Push Notification & SMS to Customer upon confirmation
  if (booking.customerId && parsed.data.status !== undefined) {
    let title = "Booking Update";
    let body = `Your booking status is now: ${parsed.data.status}`;
    if (parsed.data.status === "confirmed") {
      title = "Booking Confirmed! ✅";
      body = barber 
        ? `Your appointment at ${barber.shopName} has been confirmed. Your Check-in OTP is: ${booking.verificationPin} (valid for 12 hours).` 
        : `Your appointment has been confirmed. Your Check-in OTP is: ${booking.verificationPin} (valid for 12 hours).`;

      // Send SMS with confirmed OTP
      try {
        User.findById(booking.customerId).then(cust => {
          if (cust?.phone) {
            const { sendCustomSms } = require("../services/smsService");
            sendCustomSms(cust.phone, booking.verificationPin).catch(() => {});
          }
        }).catch(() => {});
      } catch (err) {
        console.error("SMS notification error:", err);
      }
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

  if (barber) {
    const { enrichBarberSeats } = require("../utils/barberSeats");
    const enrichedSeats = await enrichBarberSeats(barber);
    barber.seats = enrichedSeats.map(s => ({
      index: s.index,
      label: s.label,
      isAvailable: s.isAvailable,
      status: s.status,
      occupiedUntil: s.occupiedUntil ? new Date(s.occupiedUntil) : null,
    }));
    await barber.save();
    if (io) {
      io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: enrichedSeats });
      io.emit(`shop_${barber._id.toString()}_seats`, { seats: enrichedSeats });
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
  }

  const totalMinutes = services.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
  const buffer = barber.bufferMinutes || 5;
  const totalNeededMinutes = totalMinutes + buffer;

  const [y, mo, d] = date.split("-").map(Number);
  const { dayKeyFromDate, parseHm, makeISTDate, getISTComponents } = require("../utils/time");
  const dayStart = makeISTDate(y, mo, d, 0, 0, 0);
  const dayEnd = makeISTDate(y, mo, d, 23, 59, 59);

  const existing = await Booking.find({
    barberId: barber._id,
    status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
  }).sort({ startTime: 1 });

  const now = new Date();
  const isShopOpenCurrently = barber.isShopOpen !== false && !barber.pauseBookings;

  if (!isShopOpenCurrently) return res.json({ slots: [], allSlots: [], totalSlotsForDay: 0, bookedSlotsForDay: 0 });

  const openM = parseHm(barber.dailyOpenTime || "08:00");
  const closeM = parseHm(barber.dailyCloseTime || "22:00");
  const shopOpenDate = makeISTDate(y, mo, d, Math.floor(openM / 60), openM % 60, 0);
  let shopCloseDate = makeISTDate(y, mo, d, Math.floor(closeM / 60), closeM % 60, 0);
  if (closeM <= openM) shopCloseDate = new Date(shopCloseDate.getTime() + 24 * 60 * 60 * 1000);

  const { buildSeats } = require("../utils/barberSeats");
  let chairs = (barber.seats && barber.seats.length > 0)
    ? barber.seats.filter(s => s.status !== 'maintenance')
    : buildSeats(barber.seatCount || 1);
  if (chairs.length === 0) {
    chairs = buildSeats(barber.seatCount || 1);
  }

  // Initialize schedules per chair
  const schedules = {};
  for (const c of chairs) schedules[c.index] = [];

  // Add Lunch Time block
  if (barber.lunchTime && barber.lunchTime.isActive) {
    const lStartM = parseHm(barber.lunchTime.startTime || "13:00");
    const lEndM = parseHm(barber.lunchTime.endTime || "14:00");
    const lunchStart = makeISTDate(y, mo, d, Math.floor(lStartM / 60), lStartM % 60, 0);
    const lunchEnd = makeISTDate(y, mo, d, Math.floor(lEndM / 60), lEndM % 60, 0);
    for (const c of chairs) {
      schedules[c.index].push({ start: lunchStart, end: lunchEnd });
    }
  }

  // Add breaks to all chairs
  const breaks = barber.breaks || [];
  for (const br of breaks) {
    const brStartComp = getISTComponents(br.startTime);
    const brEndComp = getISTComponents(br.endTime);
    const brStart = makeISTDate(y, mo, d, brStartComp.hour, brStartComp.minute, 0);
    const brEnd = makeISTDate(y, mo, d, brEndComp.hour, brEndComp.minute, 0);
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

  if (booking.otpExpiresAt && new Date() > new Date(booking.otpExpiresAt)) {
    return res.status(400).json({ error: "OTP expired! Check-in OTP is valid for 12 hours after booking confirmation." });
  }

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

const generateCompletionOtpSchema = z.object({ bookingId: z.string().length(24) });
async function generateCompletionOtp(req, res) {
  const bookingId = req.params.id || req.body.bookingId;
  const parsed = generateCompletionOtpSchema.safeParse({ bookingId });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const booking = await Booking.findById(bookingId).populate("serviceIds");
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber || booking.barberId.toString() !== barber._id.toString()) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  }

  // Generate 4-digit completion OTP
  const completionPin = Math.floor(1000 + Math.random() * 9000).toString();
  booking.completionPin = completionPin;
  booking.completionRequestedAt = new Date();
  await booking.save();

  const serviceNames = (booking.serviceIds || []).map(s => s?.name || "Service").join(", ");
  const shopName = barber?.shopName || "Salon / Parlor";

  if (booking.customerId) {
    try {
      const Notification = require("../models/Notification");
      await Notification.create({
        userId: booking.customerId,
        title: "Service Finished - Completion OTP 🎉",
        body: `Your service (${serviceNames}) at ${shopName} is finished! Your Completion OTP is: ${completionPin}. Share this OTP with the partner to confirm completion.`,
        type: "booking_completion_otp",
        data: { bookingId: booking._id, completionPin, serviceNames, shopName }
      });

      const customer = await User.findById(booking.customerId);
      if (customer && customer.phone) {
        try {
          const { sendCustomSms } = require("../services/smsService");
          await sendCustomSms(customer.phone, completionPin);
        } catch (smsErr) {
          console.error("Failed to send completion OTP SMS", smsErr);
        }
      }
    } catch (err) {
      console.error("Failed to notify customer of completion OTP", err);
    }
  }

  const io = req.app.get("io");
  if (io) {
    if (booking.customerId) {
      io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", {
        bookingId: booking._id,
        completionPin,
        status: booking.status,
        message: "Service Finished - Completion OTP Generated 🎉"
      });
      io.to(`user_${booking.customerId.toString()}`).emit("completionOtpGenerated", {
        bookingId: booking._id,
        completionPin
      });
    }
    io.to(`barber_${booking.barberId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
  }

  res.json({ success: true, message: "Completion OTP generated and sent to customer!", completionPin, booking: formatBooking(booking) });
}

const verifyCompletionOtpSchema = z.object({ bookingId: z.string().length(24), otp: z.string().length(4) });
async function verifyCompletionOtp(req, res) {
  const bookingId = req.params.id || req.body.bookingId;
  const otp = req.body.otp;
  const parsed = verifyCompletionOtpSchema.safeParse({ bookingId, otp });
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  const booking = await Booking.findById(bookingId).populate("serviceIds");
  if (!booking) return res.status(404).json({ error: "Booking not found" });

  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber || booking.barberId.toString() !== barber._id.toString()) {
    if (req.user.role !== "admin") return res.status(403).json({ error: "Forbidden" });
  }

  if (!booking.completionPin) {
    return res.status(400).json({ error: "Completion OTP has not been generated yet. Please generate OTP first." });
  }

  if (booking.completionPin !== String(otp).trim()) {
    return res.status(400).json({ error: "Invalid Completion OTP code. Please enter the correct 4-digit code." });
  }

  const now = new Date();
  booking.status = "completed";
  booking.completedAt = now;
  booking.isCompletionOtpVerified = true;
  booking.completionOtpVerifiedAt = now;
  booking.queuePosition = 0;

  if (booking.startedAt) {
    const actualDuration = (now.getTime() - booking.startedAt.getTime()) / 60000;
    if (actualDuration > (booking.expectedDuration || 30) + 5) {
      booking.delayMinutes = Math.floor(actualDuration - (booking.expectedDuration || 30));
    }
  }

  if (barber && booking.seatIndex !== null && booking.seatIndex !== undefined) {
    const seat = barber.seats.find(s => s.index === booking.seatIndex);
    if (seat && !seat.isAvailable) {
      seat.isAvailable = true;
      seat.occupiedUntil = null;
      await barber.save();
    }
  }

  await booking.save();

  await AuditLog.create({
    actionType: "Completion OTP Verified & Service Completed",
    entityId: booking._id,
    entityModel: "Booking",
    actorId: req.user._id,
    actorModel: "Barber",
    details: {}
  });

  const shopName = barber?.shopName || "Salon / Parlor";
  if (booking.customerId) {
    try {
      const Notification = require("../models/Notification");
      await Notification.create({
        userId: booking.customerId,
        title: "Service Completed & Confirmed! ✅",
        body: `Your service at ${shopName} has been successfully completed and confirmed! Tap to leave a review ⭐️`,
        type: "booking_completed",
        data: { bookingId: booking._id, barberId: booking.barberId, requestReview: true }
      });
    } catch (e) {
      console.error("Failed to create completion notification", e);
    }
  }

  const io = req.app.get("io");
  if (io) {
    let enrichedSeats = barber ? barber.seats : [];
    if (barber) {
      const { enrichBarberSeats } = require("../utils/barberSeats");
      enrichedSeats = await enrichBarberSeats(barber);
      barber.seats = enrichedSeats.map(s => ({
        index: s.index,
        label: s.label,
        isAvailable: s.isAvailable,
        status: s.status,
        occupiedUntil: s.occupiedUntil ? new Date(s.occupiedUntil) : null,
      }));
      await barber.save();
    }
    io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: enrichedSeats });
    io.emit(`shop_${barber._id.toString()}_seats`, { seats: enrichedSeats });
    if (booking.customerId) {
      io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", {
        bookingId: booking._id,
        barberId: booking.barberId,
        status: "completed",
        isCompletionOtpVerified: true,
        requestReview: true,
        message: "Service Completed & Confirmed! ✅"
      });
      io.to(`user_${booking.customerId.toString()}`).emit("serviceCompleted", {
        bookingId: booking._id,
        barberId: booking.barberId,
        requestReview: true
      });
    }
  }

  res.json({ success: true, message: "Completion OTP verified & service marked completed! 🎉", booking: formatBooking(booking) });
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
  const { calculateIsShopOpen } = require("../utils/time");
  const shopIsOpen = calculateIsShopOpen(barber) || barber.isShopOpen;
  if (!shopIsOpen || barber.pauseBookings) return res.status(400).json({ error: "Shop is currently not accepting new bookings." });
  
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
        const { enrichBarberSeats } = require("../utils/barberSeats");
        const enrichedSeats = await enrichBarberSeats(barber);
        barber.seats = enrichedSeats.map(s => ({
          index: s.index,
          label: s.label,
          isAvailable: s.isAvailable,
          status: s.status,
          occupiedUntil: s.occupiedUntil ? new Date(s.occupiedUntil) : null,
        }));
        await barber.save();

        io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
        io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
        io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: enrichedSeats });
        io.emit(`shop_${barber._id.toString()}_seats`, { seats: enrichedSeats });
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
  create, listMine, listForBarber, patch, availableSlots, verifyOtp, generateCompletionOtp, verifyCompletionOtp, lockSlot, walkIn, slotAlternatives, getUnifiedQueue, reschedule, cancel
};
