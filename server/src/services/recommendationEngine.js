const Barber = require("../models/Barber");
const Booking = require("../models/Booking");
const SlotLock = require("../models/SlotLock");
const { dayKeyFromDate, parseHm } = require("../utils/time");
const { haversineDistance } = require("../utils/distance");
const { availableSeatSlots } = require("../utils/barberSeats");

async function checkSlotAvailability(barber, start, durationMinutes, allBookings, allLocks) {
  const end = new Date(start.getTime() + durationMinutes * 60 * 1000);
  const capacity = availableSeatSlots(barber, start);
  
  let overlaps = 0;
  for (const b of allBookings) {
    if (b.barberId.toString() === barber._id.toString() && b.startTime < end && b.endTime > start) {
      overlaps++;
    }
  }
  
  for (const lock of allLocks) {
    if (lock.barberId.toString() === barber._id.toString() && lock.time.getTime() === start.getTime()) {
      overlaps++;
    }
  }
  
  return overlaps < capacity;
}

function calculateScore({ isSameShop, distance, timeDiffMinutes, isExactTime, isSameDay }) {
  let score = 0;
  if (isSameShop) score += 80;
  if (isExactTime) score += 100;
  if (isSameDay) score += 50;
  
  // Penalty for distance (approx 5 pts per km)
  if (!isSameShop && distance != null) {
    score -= (distance * 5);
  }
  
  // Penalty for time difference (approx 1 pt per 5 minutes)
  if (timeDiffMinutes != null) {
    score -= (timeDiffMinutes / 5);
  }
  
  return score;
}

async function getRecommendations({
  targetBarberId,
  durationMinutes,
  requestedDateStr, // "YYYY-MM-DD"
  requestedTimeIso, // "2026-07-01T15:00:00.000Z" (optional)
  slotMinutes = 30
}) {
  const targetBarber = await Barber.findById(targetBarberId).lean();
  if (!targetBarber) return [];

  // Parse dates
  const [y, mo, d] = requestedDateStr.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  
  // Prepare time range for querying (today + next 2 days to have enough buffer)
  const queryEnd = new Date(dayStart);
  queryEnd.setDate(queryEnd.getDate() + 3);
  queryEnd.setHours(23, 59, 59, 999);

  // Find all similar/nearby barbers
  let similarBarbers = await Barber.find({
    approvalStatus: "approved",
    businessCategory: targetBarber.businessCategory,
  }).lean();

  // Calculate distances and filter within 15km
  similarBarbers = similarBarbers.map(b => {
    if (b._id.toString() === targetBarber._id.toString()) {
      b.distance = 0;
    } else if (b.location?.lat != null && targetBarber.location?.lat != null) {
      b.distance = haversineDistance(targetBarber.location, b.location);
    } else {
      b.distance = Infinity;
    }
    return b;
  }).filter(b => b.distance <= 15);

  const barberIds = similarBarbers.map(b => b._id);

  // Fetch all relevant bookings and locks at once to optimize performance
  const allBookings = await Booking.find({
    barberId: { $in: barberIds },
    status: { $ne: "cancelled" },
    startTime: { $lt: queryEnd },
    endTime: { $gt: dayStart }
  }).lean();

  const allLocks = await SlotLock.find({
    barberId: { $in: barberIds },
    time: { $gte: dayStart, $lt: queryEnd },
    lockedAt: { $gt: new Date(Date.now() - 45000) }
  }).lean();

  const recommendations = [];
  const now = new Date();
  const reqTime = requestedTimeIso ? new Date(requestedTimeIso) : null;

  // Generate slots for each barber for the next 3 days
  for (const b of similarBarbers) {
    const isSameShop = b._id.toString() === targetBarber._id.toString();

    for (let offset = 0; offset <= 2; offset++) {
      const currentD = new Date(dayStart);
      currentD.setDate(currentD.getDate() + offset);
      
      const key = dayKeyFromDate(currentD);
      const wh = b.workingHours && b.workingHours[key];
      if (!wh || !wh.open || !wh.close || wh.isClosed) continue;
      
      const openM = parseHm(wh.open);
      const closeM = parseHm(wh.close);
      
      for (let m = openM; m + durationMinutes <= closeM; m += slotMinutes) {
        const h = Math.floor(m / 60);
        const min = m % 60;
        const start = new Date(currentD.getFullYear(), currentD.getMonth(), currentD.getDate(), h, min, 0, 0);
        
        if (start < now) continue;

        // Skip exact requested time if it's the same shop (because we know it's full if they are asking for recommendations)
        if (reqTime && isSameShop && start.getTime() === reqTime.getTime()) {
          continue;
        }

        const isAvailable = await checkSlotAvailability(b, start, durationMinutes, allBookings, allLocks);
        if (isAvailable) {
          const isSameDay = offset === 0;
          const isExactTime = reqTime ? (start.getTime() === reqTime.getTime()) : false;
          const timeDiffMinutes = reqTime ? Math.abs(start.getTime() - reqTime.getTime()) / 60000 : 0;
          
          // Only suggest things within a reasonable time difference (e.g., 4 hours) if requesting a specific time
          if (reqTime && timeDiffMinutes > 240 && !isSameShop) continue;

          const score = calculateScore({ isSameShop, distance: b.distance, timeDiffMinutes, isExactTime, isSameDay });
          
          recommendations.push({
            barber: {
              id: b._id,
              shopName: b.shopName,
              distance: b.distance,
              address: b.address,
              shopPosterUrl: b.shopPosterUrl
            },
            time: start.toISOString(),
            score,
            isSameShop,
            isExactTime,
            timeDiffMinutes
          });
        }
      }
    }
  }

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Return top 15 unique combinations (avoiding overwhelming the UI)
  // We want a mix of same shop and nearby shops
  const finalRecs = [];
  const seenCombos = new Set();
  
  for (const r of recommendations) {
    const key = `${r.barber.id}_${r.time}`;
    if (!seenCombos.has(key)) {
      seenCombos.add(key);
      finalRecs.push(r);
      if (finalRecs.length >= 10) break;
    }
  }

  return finalRecs;
}

module.exports = {
  getRecommendations
};
