const fs = require('fs');

let content = fs.readFileSync('src/controllers/bookingController.js', 'utf8');

// Update slotsQuery
content = content.replace(/const slotsQuery = z\.object\(\{[\s\S]*?\}\);/, `const slotsQuery = z.object({
  barberId: z.string().length(24),
  serviceIds: z.string(),
  date: z.string().regex(/^\\d{4}-\\d{2}-\\d{2}$/),
});`);

// Update availableSlots
const newAvailableSlots = `async function availableSlots(req, res) {
  const parsed = slotsQuery.safeParse(req.query);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const { barberId, serviceIds, date } = parsed.data;
  const barber = await Barber.findById(barberId);
  if (!barber) {
    return res.status(404).json({ error: "Barber not found" });
  }
  if (!barber.isShopOpen) {
    return res.json({ slots: [] });
  }
  const idArray = serviceIds.split(",").filter(Boolean);
  const services = await Service.find({ _id: { $in: idArray }, barberId: barber._id });
  if (services.length === 0) {
    return res.status(404).json({ error: "Services not found for this barber" });
  }
  const [y, mo, d] = date.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);
  
  const activeLocks = await SlotLock.find({
    barberId: barber._id,
    time: { $gte: dayStart, $lt: dayEnd },
    lockedBy: { $ne: (req.user ? req.user._id : null) },
    lockedAt: { $gt: new Date(Date.now() - 45000) }
  });

  const existing = await Booking.find({
    barberId: barber._id,
    status: { $in: ["pending", "confirmed", "in-progress"] },
    startTime: { $lt: new Date(y, mo - 1, d, 23, 59, 59, 999) },
    endTime: { $gt: dayStart },
  });

  const { dayKeyFromDate, parseHm, availableSeatSlots } = require("../utils/time");
  // availableSeatSlots is actually in utils/barberSeats, let's fix that
  const { availableSeatSlots: getCapacity } = require("../utils/barberSeats");
  
  const key = dayKeyFromDate(dayStart);
  const wh = barber.workingHours[key];
  if (!wh || !wh.open || !wh.close || wh.isClosed) {
    return res.json({ slots: [] });
  }
  const openM = parseHm(wh.open);
  const closeM = parseHm(wh.close);
  const slotMinutes = 30; // Granularity
  const duration = services.reduce((sum, s) => sum + (s.durationMinutes || 30), 0);
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

    const capacity = getCapacity(barber, start);
    
    // Count locks exactly at this start time
    const locksCount = activeLocks.filter(l => l.time.getTime() === start.getTime()).length;

    // Sweep-line algorithm to find maximum concurrent bookings in [start, end)
    let events = [];
    for (const b of existing) {
      const eS = b.startTime < start ? start : b.startTime;
      const eE = b.endTime > end ? end : b.endTime;
      if (eS < eE) {
        events.push({ time: eS.getTime(), type: 1 }); // start
        events.push({ time: eE.getTime(), type: -1 }); // end
      }
    }
    
    events.sort((a, b) => {
      if (a.time === b.time) return a.type - b.type; // end (-1) comes before start (1)
      return a.time - b.time;
    });

    let current = 0;
    let maxConcurrent = 0;
    for (const e of events) {
      current += e.type;
      if (current > maxConcurrent) maxConcurrent = current;
    }

    if (maxConcurrent + locksCount < capacity) {
      slots.push(start.toISOString());
    }
  }

  res.json({ slots });
}`;

// Replace availableSlots function
content = content.replace(/async function availableSlots\(req, res\) \{[\s\S]*?\n\}\n\nconst verifyOtpSchema/m, newAvailableSlots + '\n\nconst verifyOtpSchema');

fs.writeFileSync('src/controllers/bookingController.js', content);
console.log('Successfully updated availableSlots logic.');
