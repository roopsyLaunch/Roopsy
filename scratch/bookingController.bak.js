const { z } = require("zod");
const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Barber = require("../models/Barber");
const Service = require("../models/Service");
const { isWithinWorkingHours, endFitsWorkingHours } = require("../utils/time");
const { availableSeatSlots } = require("../utils/barberSeats");

const createSchema = z.object({
  barberId: z.string().length(24),
  serviceIds: z.array(z.string().length(24)).min(1),
  startTime: z.string().datetime(),
  notes: z.string().optional(),
  seatIndex: z.number().int().min(0).optional(),
  isHomeService: z.boolean().optional(),
});

const patchSchema = z.object({
  status: z.enum(["pending", "confirmed", "cancelled", "in-progress", "completed", "declined", "rejected"]).optional(),
});

async function countOverlap(barberId, startTime, endTime, excludeId) {
  const filter = {
    barberId,
    status: { $ne: "cancelled" },
    startTime: { $lt: endTime },
    endTime: { $gt: startTime },
  };
  if (excludeId) {
    filter._id = { $ne: excludeId };
  }
  return Booking.countDocuments(filter);
}

async function create(req, res) {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { barberId, serviceIds, startTime, notes, seatIndex, isHomeService } = parsed.data;
  const barber = await Barber.findById(barberId);
  if (!barber) {
    return res.status(404).json({ error: "Barber not found" });
  }
  if (!barber.isShopOpen) {
    return res.status(400).json({ error: "Shop is closed for new bookings right now" });
  }
  const services = await Service.find({
    _id: { $in: serviceIds.map((id) => new mongoose.Types.ObjectId(id)) },
    barberId: barber._id,
  });
  if (services.length !== serviceIds.length) {
    return res.status(400).json({ error: "One or more services are invalid for this barber" });
  }
  const totalMinutes = services.reduce((sum, s) => sum + s.durationMinutes, 0);
  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalMinutes * 60 * 1000);
  if (Number.isNaN(start.getTime())) {
    return res.status(400).json({ error: "Invalid startTime" });
  }
  if (!isWithinWorkingHours(start, barber.workingHours)) {
    return res.status(400).json({ error: "Start time is outside barber working hours" });
  }
  if (!endFitsWorkingHours(start, end, barber.workingHours)) {
    return res.status(400).json({ error: "Booking would end after closing time" });
  }
  const capacity = availableSeatSlots(barber, start);
  const overlaps = await countOverlap(barber._id, start, end, null);
  if (overlaps >= capacity) {
    return res.status(409).json({ error: "All chairs are busy for this time slot" });
  }
  let seatLabel = "";
  if (seatIndex !== undefined && barber.seats && barber.seats.length > seatIndex) {
    const seat = barber.seats[seatIndex];
    if (!seat.isAvailable) {
      return res.status(400).json({ error: "Selected seat is marked unavailable" });
    }
    seatLabel = seat.label || `Chair ${seatIndex + 1}`;
  }
    const verificationPin = Math.floor(1000 + Math.random() * 9000).toString();
    const booking = await Booking.create({
      customerId: req.user._id,
      barberId: barber._id,
      serviceIds,
      startTime: start,
      endTime: end,
      status: "pending",
      notes: notes || "",
      seatIndex: seatIndex !== undefined ? seatIndex : undefined,
      seatLabel,
      verificationPin,
      isHomeService: isHomeService || false,
    });
    await booking.populate("serviceIds");
  return res.status(201).json({
    booking: formatBooking(booking),
  });
}

function formatBooking(b) {
  const services = (b.serviceIds || []).map((s) =>
    s && s.name
      ? {
          id: s._id,
          name: s.name,
          category: s.category,
          durationMinutes: s.durationMinutes,
          price: s.price,
        }
      : { id: s }
  );
  return {
    id: b._id,
    customerId: b.customerId,
    barberId: b.barberId,
    serviceIds: services.map((x) => x.id),
    services,
    startTime: b.startTime,
    endTime: b.endTime,
    status: b.status,
    notes: b.notes,
    createdAt: b.createdAt,
    seatIndex: b.seatIndex,
    seatLabel: b.seatLabel,
    verificationPin: b.verificationPin,
    isHomeService: b.isHomeService,
  };
}

async function listMine(req, res) {
  const bookings = await Booking.find({ customerId: req.user._id })
    .populate("serviceIds")
    .populate("barberId")
    .sort({ startTime: -1 });
  const out = await Promise.all(
    bookings.map(async (b) => {
      const barber = b.barberId;
      let shopName = "";
      if (barber && barber.shopName) {
        shopName = barber.shopName;
      }
      return {
        ...formatBooking(b),
        barber: barber
          ? { id: barber._id, shopName: barber.shopName || shopName, bio: barber.bio }
          : null,
      };
    })
  );
  res.json({ bookings: out });
}

async function listForBarber(req, res) {
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber) {
    return res.status(404).json({ error: "Barber profile not found" });
  }
  const bookings = await Booking.find({ barberId: barber._id })
    .populate("serviceIds")
    .populate("customerId", "name email phone")
    .sort({ startTime: -1 });
  const out = bookings.map((b) => ({
    ...formatBooking(b),
    customer: b.customerId
      ? {
          id: b.customerId._id,
          name: b.customerId.name,
          email: b.customerId.email,
          phone: b.customerId.phone,
        }
      : null,
  }));
  res.json({ bookings: out });
}

async function patch(req, res) {
  const parsed = patchSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const booking = await Booking.findById(req.params.id);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  const barber = await Barber.findOne({ userId: req.user._id });
  const isCustomer = booking.customerId.toString() === req.user._id.toString();
  const isOwnBarber = barber && booking.barberId.toString() === barber._id.toString();

  if (parsed.data.status === "cancelled") {
    if (!isCustomer && !isOwnBarber && req.user.role !== "admin") {
      return res.status(403).json({ error: "Forbidden" });
    }
  } else if (parsed.data.status === "confirmed" || parsed.data.status === "pending" || parsed.data.status === "completed" || parsed.data.status === "in-progress") {
    if (!isOwnBarber && req.user.role !== "admin") {
      return res.status(403).json({ error: "Only the barber can update this status" });
    }
  }

  if (parsed.data.status !== undefined) {
    const oldStatus = booking.status;
    booking.status = parsed.data.status;
    
    // If booking is completed or cancelled, and it had a seat assigned, free the seat
    if ((parsed.data.status === "completed" || parsed.data.status === "cancelled") && 
        (oldStatus === "in-progress" || oldStatus === "confirmed" || oldStatus === "pending")) {
      if (booking.seatIndex !== undefined && booking.seatIndex !== null) {
        if (barber) {
          const seat = barber.seats.find(s => s.index === booking.seatIndex);
          if (seat) {
            seat.isAvailable = true;
            await barber.save();
            
            const io = req.app.get("io");
            if (io) {
              io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
            }
          }
        }
      }
    }
  }
  await booking.save();
  await booking.populate("serviceIds");
  
  const io = req.app.get("io");
  if (io) {
    io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
    if (barber) {
      io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
    }
  }
  
  res.json({ booking: formatBooking(booking) });
}

const slotsQuery = z.object({
  barberId: z.string().length(24),
  serviceId: z.string().length(24),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

async function availableSlots(req, res) {
  const parsed = slotsQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { barberId, serviceId, date } = parsed.data;
  const barber = await Barber.findById(barberId);
  if (!barber) {
    return res.status(404).json({ error: "Barber not found" });
  }
  if (!barber.isShopOpen) {
    return res.json({ slots: [] });
  }
  const service = await Service.findOne({ _id: serviceId, barberId: barber._id });
  if (!service) {
    return res.status(404).json({ error: "Service not found for this barber" });
  }
  const [y, mo, d] = date.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);

  const existing = await Booking.find({
    barberId: barber._id,
    status: { $ne: "cancelled" },
    startTime: { $lt: new Date(y, mo - 1, d, 23, 59, 59, 999) },
    endTime: { $gt: dayStart },
  }).sort({ startTime: 1 });

  const { dayKeyFromDate, parseHm } = require("../utils/time");
  const key = dayKeyFromDate(dayStart);
  const wh = barber.workingHours[key];
  if (!wh || !wh.open || !wh.close) {
    return res.json({ slots: [] });
  }
  const openM = parseHm(wh.open);
  const closeM = parseHm(wh.close);
  const slotMinutes = 30;
  const duration = service.durationMinutes;
  const slots = [];
  const now = new Date();

  for (let m = openM; m + duration <= closeM; m += slotMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const start = new Date(y, mo - 1, d, h, min, 0, 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    const endM = m + duration;
    if (endM > closeM) break;
    
    // Do not show past slots
    if (start < now) continue;

    const capacity = availableSeatSlots(barber, start);
    let overlapCount = 0;
    for (const b of existing) {
      if (b.startTime < end && b.endTime > start) {
        overlapCount += 1;
      }
    }
    if (overlapCount < capacity) {
      slots.push(start.toISOString());
    }
  }

  res.json({ slots });
}

const verifyOtpSchema = z.object({
  bookingId: z.string().length(24),
  otp: z.string().length(4),
});

async function verifyOtp(req, res) {
  const parsed = verifyOtpSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { bookingId, otp } = parsed.data;
  const booking = await Booking.findById(bookingId);
  if (!booking) {
    return res.status(404).json({ error: "Booking not found" });
  }
  const barber = await Barber.findOne({ userId: req.user._id });
  if (!barber || booking.barberId.toString() !== barber._id.toString()) {
    return res.status(403).json({ error: "Only the assigned barber can verify this booking" });
  }
  if (booking.verificationPin !== otp) {
    return res.status(400).json({ error: "Invalid OTP" });
  }
  if (booking.status === "in-progress" || booking.status === "completed") {
    return res.status(400).json({ error: "Booking already verified or completed" });
  }

  // Auto-assign slot if not already assigned
  let assignedSeatIndex = booking.seatIndex;
  let assignedSeatLabel = booking.seatLabel;

  if (assignedSeatIndex === undefined || assignedSeatIndex === null) {
    const vacantSeat = barber.seats.find(s => s.isAvailable);
    if (vacantSeat) {
      assignedSeatIndex = vacantSeat.index;
      assignedSeatLabel = vacantSeat.label;
      vacantSeat.isAvailable = false;
      await barber.save();
    }
  } else {
    // Mark the specifically assigned seat as unavailable
    const seat = barber.seats.find(s => s.index === assignedSeatIndex);
    if (seat && seat.isAvailable) {
      seat.isAvailable = false;
      await barber.save();
    }
  }

  booking.status = "in-progress";
  booking.seatIndex = assignedSeatIndex;
  booking.seatLabel = assignedSeatLabel;
  await booking.save();
  await booking.populate("serviceIds");

  // Trigger Socket.io broadcast for live slots here
  const io = req.app.get("io");
  if (io) {
    io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { seats: barber.seats });
    io.to(`user_${booking.customerId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
    io.to(`user_${barber.userId.toString()}`).emit("bookingUpdated", { bookingId: booking._id });
  }

  res.json({ booking: formatBooking(booking) });
}

module.exports = {
  create,
  listMine,
  listForBarber,
  patch,
  availableSlots,
  verifyOtp,
};
