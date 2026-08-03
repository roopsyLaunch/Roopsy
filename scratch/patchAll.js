const fs = require('fs');
let code = fs.readFileSync('server/src/controllers/bookingController.js', 'utf8');

// 1. Add SlotLock
if (!code.includes('SlotLock')) {
  code = code.replace(
    'const Booking = require("../models/Booking");',
    'const Booking = require("../models/Booking");\nconst SlotLock = require("../models/SlotLock");\n\nconst CHECKIN_WINDOW_START_MINS = 10;\nconst CHECKIN_WINDOW_END_MINS = 5;'
  );
}

// 2. formatBooking checkIn
if (!code.includes('checkInStart')) {
  code = code.replace(
    '    isHomeService: b.isHomeService,\n  };',
    '    isHomeService: b.isHomeService,\n    checkInStart: new Date(new Date(b.startTime).getTime() - CHECKIN_WINDOW_START_MINS * 60000).toISOString(),\n    checkInEnd: new Date(new Date(b.startTime).getTime() + CHECKIN_WINDOW_END_MINS * 60000).toISOString(),\n  };'
  );
}

// 3. activeLocks in availableSlots
if (!code.includes('activeLocks = await SlotLock.find')) {
  code = code.replace(
    '  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);',
    `  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);
  
  const activeLocks = await SlotLock.find({
    barberId: barber._id,
    time: { $gte: dayStart, $lt: dayEnd },
    lockedBy: { $ne: (req.user ? req.user._id : null) },
    lockedAt: { $gt: new Date(Date.now() - 45000) }
  });`
  );
}
if (!code.includes('for (const lock of activeLocks)')) {
  code = code.replace(
    '    if (overlapCount < capacity) {\n      slots.push(start.toISOString());\n    }',
    `    for (const lock of activeLocks) {
      if (lock.time.getTime() === start.getTime()) {
        overlapCount += 1;
      }
    }
    if (overlapCount < capacity) {
      slots.push(start.toISOString());
    }`
  );
}

// 4. verifyOtp
if (!code.includes('now < checkInStart')) {
  code = code.replace(
    '  if (booking.verificationPin !== otp) {',
    `  const checkInStart = new Date(new Date(booking.startTime).getTime() - CHECKIN_WINDOW_START_MINS * 60000);
  const checkInEnd = new Date(new Date(booking.startTime).getTime() + CHECKIN_WINDOW_END_MINS * 60000);
  const now = new Date();
  
  if (now < checkInStart) {
    return res.status(400).json({ error: "Check-in window has not opened yet. Please wait." });
  }
  if (now > checkInEnd) {
    return res.status(400).json({ error: "Booking has expired. The check-in window has closed." });
  }
  
  if (booking.verificationPin !== otp) {`
  );
}

// 5. Append missing functions
if (!code.includes('async function walkIn')) {
  const missingCode = `
const { z } = require('zod');

const lockSlotSchema = z.object({
  barberId: z.string().length(24),
  time: z.string(),
});
async function lockSlot(req, res) {
  const parsed = lockSlotSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { barberId, time } = parsed.data;
  await SlotLock.deleteMany({ lockedAt: { $lt: new Date(Date.now() - 45000) } });
  const existingLock = await SlotLock.findOne({ barberId, time: new Date(time) });
  if (existingLock && existingLock.lockedBy.toString() !== req.user.id) {
    return res.status(409).json({ error: "Slot is currently being booked by someone else." });
  }
  await SlotLock.findOneAndUpdate(
    { barberId, time: new Date(time) },
    { lockedBy: req.user.id, lockedAt: new Date() },
    { upsert: true, new: true }
  );
  res.json({ success: true });
}

const walkInSchema = z.object({
  serviceIds: z.array(z.string().length(24)).min(1),
  startTime: z.string().datetime(),
  customerName: z.string().optional(),
});
async function walkIn(req, res) {
  const parsed = walkInSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const barber = await Barber.findOne({ userId: req.user.id });
  if (!barber) return res.status(404).json({ error: "Barber not found" });
  const { serviceIds, startTime, customerName } = parsed.data;
  const services = await Service.find({ _id: { $in: serviceIds }, barberId: barber._id });
  let totalDuration = 0;
  for (const s of services) totalDuration += s.durationMinutes || 30;
  const start = new Date(startTime);
  const end = new Date(start.getTime() + totalDuration * 60 * 1000);
  const booking = new Booking({
    customerId: req.user.id,
    barberId: barber._id,
    serviceIds,
    startTime: start,
    endTime: end,
    status: "in-progress",
    notes: \`Walk-In: \${customerName || 'Customer'}\`,
    seatIndex: 0,
    seatLabel: "Walk-in Chair",
    verificationPin: "WALK",
  });
  await booking.save();
  const io = req.app.get("io");
  if (io) {
    io.to(\`barber_\${barber._id.toString()}\`).emit("slotsUpdated", { barberId: barber._id });
    io.to(\`user_\${req.user.id}\`).emit("bookingUpdated");
  }
  res.json({ message: "Walk-in booked", booking });
}

const slotAlternativesQuery = z.object({
  barberId: z.string().length(24),
  serviceIds: z.string(),
  time: z.string(),
});
async function slotAlternatives(req, res) {
  const parsed = slotAlternativesQuery.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  const { barberId, serviceIds, time } = parsed.data;
  const idArray = serviceIds.split(",").filter(Boolean);
  const services = await Service.find({ _id: { $in: idArray } });
  const totalDuration = services.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
  const { getRecommendations } = require("../services/recommendationEngine");
  const recommendations = await getRecommendations({
    targetBarberId: barberId,
    durationMinutes: totalDuration > 0 ? totalDuration : 30,
    requestedDateStr: time.split("T")[0],
    requestedTimeIso: time,
  });
  res.json({ recommendations });
}

async function expireBooking(bookingId, app) {
  const booking = await Booking.findById(bookingId);
  if (!booking || booking.status !== "confirmed") return;
  booking.status = "expired";
  booking.verificationPin = "";
  
  if (booking.seatIndex !== undefined && booking.seatIndex !== null) {
    const barber = await Barber.findById(booking.barberId);
    if (barber) {
      const seat = barber.seats.find(s => s.index === booking.seatIndex);
      if (seat) {
        seat.isAvailable = true;
        seat.occupiedUntil = null;
        await barber.save();
        if (app) {
          const io = app.get("io");
          if (io) {
            io.to(\`barber_\${barber._id.toString()}\`).emit("slotsUpdated", { seats: barber.seats });
          }
        }
      }
    }
  }
  await booking.save();
  if (app) {
    const io = app.get("io");
    if (io) {
      io.to(\`user_\${booking.customerId.toString()}\`).emit("bookingUpdated", { bookingId: booking._id });
      if (booking.barberId) {
        const barber = await Barber.findById(booking.barberId);
        if (barber && barber.userId) {
          io.to(\`user_\${barber.userId.toString()}\`).emit("bookingUpdated", { bookingId: booking._id });
        }
      }
    }
  }
}
`;
  
  // replace exports
  code = code.replace(
    /module\.exports = \{[\s\S]*?\};/,
    missingCode + '\nmodule.exports = {\n  create,\n  listMine,\n  listForBarber,\n  patch,\n  availableSlots,\n  verifyOtp,\n  lockSlot,\n  walkIn,\n  slotAlternatives,\n  expireBooking\n};'
  );
}

// 6. Fix socket emits in create
if (!code.includes('emit("newBooking"')) {
  code = code.replace(
    '    await booking.populate("serviceIds");\n  return res.status(201).json({',
    '    await booking.populate("serviceIds");\n    const io = req.app.get("io");\n    if (io) {\n      io.to(`barber_${barber._id.toString()}`).emit("slotsUpdated", { barberId: barber._id });\n      if (barber.userId) {\n        io.to(`user_${barber.userId.toString()}`).emit("newBooking", { bookingId: booking._id });\n      }\n      io.to(`user_${req.user._id.toString()}`).emit("bookingUpdated", { bookingId: booking._id });\n    }\n    await SlotLock.deleteMany({ barberId: barber._id, time: start, lockedBy: req.user._id });\n  return res.status(201).json({'
  );
}

fs.writeFileSync('server/src/controllers/bookingController.js', code);
console.log('Patched bookingController.js fully.');
