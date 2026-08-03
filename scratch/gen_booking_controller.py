import os

file_content = """const { z } = require("zod");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const SlotLock = require("../models/SlotLock");
const Barber = require("../models/Barber");
const Service = require("../models/Service");
const { isWithinWorkingHours, endFitsWorkingHours } = require("../utils/time");
const { availableSeatSlots } = require("../utils/barberSeats");

const CHECKIN_WINDOW_START_MINS = 10;
const CHECKIN_WINDOW_END_MINS = 5;

// HELPER: Auto Suggest Chair
async function autoSuggestChair(barber, startTime, durationMinutes) {
  const start = new Date(startTime);
  const finish = new Date(start.getTime() + durationMinutes * 60000);
  const buffer = barber.bufferMinutes || 5;
  const finishWithBuffer = new Date(finish.getTime() + buffer * 60000);

  const overlappingBookings = await Booking.find({
    barberId: barber._id,
    status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
    endTime: { $gt: start },
    startTime: { $lt: finishWithBuffer }
  });

  const occupiedSeatIndices = overlappingBookings
    .filter(b => b.seatIndex !== undefined && b.seatIndex !== null)
    .map(b => b.seatIndex);

  const availableSeats = barber.seats.filter(s => s.isAvailable && !occupiedSeatIndices.includes(s.index));

  if (availableSeats.length > 0) {
    return {
      seatIndex: availableSeats[0].index,
      seatLabel: availableSeats[0].label,
      addToQueue: false
    };
  }

  // Find max queue position for this barber
  const lastInQueue = await Booking.findOne({ barberId: barber._id, status: { $in: ["confirmed", "arrived", "pending"] } }).sort({ queuePosition: -1 });
  const nextPos = (lastInQueue && lastInQueue.queuePosition) ? lastInQueue.queuePosition + 1 : 1;

  return {
    seatIndex: null,
    seatLabel: "Waiting",
    addToQueue: true,
    queuePosition: nextPos
  };
}

const createSchema = z.object({
  barberId: z.string().length(24),
  serviceIds: z.array(z.string().length(24)).min(1),
  startTime: z.string().datetime(),
  notes: z.string().optional(),
  seatIndex: z.number().int().min(0).optional(),
  isHomeService: z.boolean().optional(),
});

async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { barberId, serviceIds, startTime, notes, seatIndex, isHomeService } = parsed.data;
  const barber = await Barber.findById(barberId);
  if (!barber) return res.status(404).json({ error: "Barber not found" });
  if (!barber.isShopOpen) return res.status(400).json({ error: "Shop is closed for new bookings right now" });

  const services = await Service.find({ _id: { $in: serviceIds.map(id => new mongoose.Types.ObjectId(id)) }, barberId: barber._id });
  if (services.length !== serviceIds.length) return res.status(400).json({ error: "Invalid services" });

  const totalMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalMinutes * 60 * 1000);

  if (Number.isNaN(start.getTime())) return res.status(400).json({ error: "Invalid startTime" });
  if (!isWithinWorkingHours(start, barber.workingHours)) return res.status(400).json({ error: "Start time outside working hours" });
  if (!endFitsWorkingHours(start, end, barber.workingHours)) return res.status(400).json({ error: "Booking ends after closing time" });

  const suggestion = await autoSuggestChair(barber, start, totalMinutes);
  let finalSeatIndex = suggestion.seatIndex;
  let finalSeatLabel = suggestion.seatLabel;
  let queuePosition = suggestion.addToQueue ? suggestion.queuePosition : 0;

  if (seatIndex !== undefined && !suggestion.addToQueue) {
    const seat = barber.seats.find(s => s.index === seatIndex);
    if (seat && seat.isAvailable) {
      finalSeatIndex = seat.index;
      finalSeatLabel = seat.label || `Chair ${seatIndex + 1}`;
    }
  }

  const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();
  const booking = await Booking.create({
    customerId: req.user._id,
    barberId: barber._id,
    serviceIds,
    startTime: start,
    endTime: end,
    expectedDuration: totalMinutes,
    status: "pending",
    notes: notes || "",
    seatIndex: finalSeatIndex,
    seatLabel: finalSeatLabel,
    verificationPin,
    isHomeService: isHomeService || false,
    queuePosition
  });
  await booking.populate("serviceIds");

  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
    io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
  }

  return res.status(201).json({ booking: formatBooking(booking) });
}

function formatBooking(b) {
  const services = (b.serviceIds || []).map(s => s && s.name ? { id: s._id, name: s.name, category: s.category, durationMinutes: s.durationMinutes, price: s.price } : { id: s });
  return {
    id: b._id, customerId: b.customerId, barberId: b.barberId, serviceIds: services.map(x => x.id), services,
    startTime: b.startTime, endTime: b.endTime, expectedDuration: b.expectedDuration, status: b.status, notes: b.notes,
    createdAt: b.createdAt, seatIndex: b.seatIndex, seatLabel: b.seatLabel, verificationPin: b.verificationPin,
    isHomeService: b.isHomeService, isWalkIn: b.isWalkIn, guestName: b.guestName, guestPhone: b.guestPhone,
    queuePosition: b.queuePosition, arrivedAt: b.arrivedAt, startedAt: b.startedAt, completedAt: b.completedAt, delayMinutes: b.delayMinutes
  };
}

async function listMine(req, res) {
  const bookings = await Booking.find({ customerId: req.user._id }).populate("serviceIds").populate("barberId").sort({ startTime: -1 });
  const out = bookings.map((b) => {
    const barber = b.barberId;
    return {
      ...formatBooking(b),
      barber: barber ? { id: barber._id, shopName: barber.shopName, bio: barber.bio } : null,
    };
  });
  res.json({ bookings: out });
}

async function listForBarber(req, res) {
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber) return res.status(404).json({ error: "Barber profile not found" });
  const bookings = await Booking.find({ barberId: barber._id }).populate("serviceIds").populate("customerId", "name email phone").sort({ startTime: -1 });
  const out = bookings.map(b => ({
    ...formatBooking(b),
    customer: b.customerId ? { id: b.customerId._id, name: b.customerId.name, email: b.customerId.email, phone: b.customerId.phone } : null,
  }));
  res.json({ bookings: out });
}

const patchSchema = z.object({
  status: z.enum(["pending", "confirmed", "arrived", "cancelled", "in-progress", "completed", "declined", "rejected", "no-show"]).optional(),
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
    if (booking.status === "in-progress") booking.startedAt = now;
    if (booking.status === "completed") booking.completedAt = now;
    if (booking.status === "no-show") booking.noShowAt = now;

    if (["completed", "cancelled", "no-show"].includes(booking.status) && ["in-progress", "arrived", "confirmed", "pending"].includes(oldStatus)) {
      booking.queuePosition = 0; // Remove from queue
    }
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
  res.json({ booking: formatBooking(booking) });
}

// UNIFIED QUEUE
async function getUnifiedQueue(req, res) {
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber) return res.status(404).json({ error: "Barber not found" });

  const startOfDay = new Date(); startOfDay.setHours(0,0,0,0);
  const endOfDay = new Date(); endOfDay.setHours(23,59,59,999);

  const bookings = await Booking.find({
    barberId: barber._id,
    status: { $in: ["pending", "confirmed", "arrived", "in-progress"] },
    startTime: { $lt: endOfDay }
  }).populate("serviceIds").populate("customerId", "name phone").sort({ startTime: 1 });

  // Priority sorting: In-Progress > Arrived > Online/Walk-in (by startTime)
  bookings.sort((a, b) => {
    const pA = a.status === "in-progress" ? 3 : a.status === "arrived" ? 2 : 1;
    const pB = b.status === "in-progress" ? 3 : b.status === "arrived" ? 2 : 1;
    if (pA !== pB) return pB - pA;
    return new Date(a.startTime).getTime() - new Date(b.startTime).getTime();
  });

  const out = bookings.map(b => ({
    ...formatBooking(b),
    customer: b.customerId ? { name: b.customerId.name, phone: b.customerId.phone } : { name: b.guestName, phone: b.guestPhone }
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
  const { barberId, serviceId, date } = parsed.data;
  const barber = await Barber.findById(barberId);
  if (!barber || !barber.isShopOpen) return res.json({ slots: [] });

  const service = await Service.findOne({ _id: serviceId, barberId: barber._id });
  if (!service) return res.status(404).json({ error: "Service not found" });

  const [y, mo, d] = date.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);

  const existing = await Booking.find({
    barberId: barber._id,
    status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
  });

  const { dayKeyFromDate, parseHm } = require("../utils/time");
  const wh = barber.workingHours[dayKeyFromDate(dayStart)];
  if (!wh || !wh.open || !wh.close) return res.json({ slots: [] });

  const openM = parseHm(wh.open);
  const closeM = parseHm(wh.close);
  const slotMinutes = 30;
  const duration = service.durationMinutes;
  const buffer = barber.bufferMinutes || 5;
  const totalNeeded = duration + buffer;
  const slots = [];
  const now = new Date();

  for (let m = openM; m + totalNeeded <= closeM; m += slotMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const start = new Date(y, mo - 1, d, h, min, 0, 0);
    const endWithBuffer = new Date(start.getTime() + totalNeeded * 60000);
    
    if (start < now) continue;

    const capacity = barber.seats.filter(s => s.isAvailable).length;
    let overlapCount = 0;
    for (const b of existing) {
      const bEndWithBuffer = new Date(new Date(b.endTime).getTime() + buffer * 60000);
      if (b.startTime < endWithBuffer && bEndWithBuffer > start) overlapCount++;
    }
    if (overlapCount < capacity) slots.push(start.toISOString());
  }
  res.json({ slots });
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
  await booking.save();
  
  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
    if(booking.customerId) io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated");
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
  
  const io = req.app.get("io");
  if (io) io.to(`barber_${barber._id.toString()}`).emit("queueUpdated");
  
  res.json({ message: "Walk-in added", booking: formatBooking(booking) });
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
  create, listMine, listForBarber, patch, availableSlots, verifyOtp, lockSlot, walkIn, slotAlternatives, getUnifiedQueue
};
"""

path = r"C:\Users\ULTRA\Pictures\Desktop\BARBER\server\src\controllers\bookingController.js"
with open(path, "w", encoding="utf-8") as f:
    f.write(file_content)

print("bookingController.js generated successfully!")
