function buildSeats(seatCount) {
  const n = Math.max(1, Math.min(50, Number(seatCount) || 1));
  return Array.from({ length: n }, (_, i) => ({
    index: i,
    label: `Chair ${i + 1}`,
    isAvailable: true,
  }));
}

function availableSeatSlots(barber, startTimeStr = null) {
  if (barber.seats && barber.seats.length > 0) {
    return barber.seats.filter((s) => {
      if (!s.isAvailable && !s.occupiedUntil) {
        return false;
      }
      return true;
    }).length;
  }
  return barber.seatCount || 1;
}

/**
 * Calculates live availability, waiting time, and next free timestamp for each chair of a barber/salon.
 */
async function enrichBarberSeats(barber) {
  if (!barber) return [];
  const Booking = require("../models/Booking");
  const now = new Date();
  const buffer = barber.bufferMinutes || 5;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const activeBookings = await Booking.find({
    barberId: barber._id,
    status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
    startTime: { $lt: todayEnd },
    endTime: { $gt: todayStart },
  }).sort({ startTime: 1 });

  let rawSeats = (barber.seats && barber.seats.length > 0)
    ? barber.seats
    : buildSeats(barber.seatCount || 1);

  const chairBookings = {};
  for (const s of rawSeats) {
    chairBookings[s.index] = [];
  }

  const defaultChairIndex = rawSeats[0]?.index ?? 0;

  for (const b of activeBookings) {
    let bStart = new Date(b.startTime);
    let bEnd = new Date(b.endTime);

    if (b.status === "in-progress") {
      const sAt = b.startedAt ? new Date(b.startedAt) : bStart;
      bEnd = new Date(sAt.getTime() + (b.expectedDuration || 30) * 60000);
      if (bEnd < now) bEnd = new Date(now.getTime() + 5 * 60000);
    } else if (b.isWalkIn || b.status === "confirmed" || b.status === "arrived") {
      if (bEnd < now) {
        bEnd = new Date(now.getTime() + (b.expectedDuration || 30) * 60000);
      }
    }
    const bEndWithBuffer = new Date(bEnd.getTime() + buffer * 60000);

    let assignedSeatIndex = b.seatIndex;
    if (assignedSeatIndex === undefined || assignedSeatIndex === null || chairBookings[assignedSeatIndex] === undefined) {
      assignedSeatIndex = defaultChairIndex;
      // Auto-heal legacy / unassigned active booking in DB so seatIndex is permanently saved
      b.seatIndex = assignedSeatIndex;
      b.seatLabel = rawSeats.find(s => s.index === assignedSeatIndex)?.label || `Chair ${assignedSeatIndex + 1}`;
      b.save().catch(() => {});
    }

    if (chairBookings[assignedSeatIndex]) {
      chairBookings[assignedSeatIndex].push({
        bookingId: b._id,
        start: bStart,
        end: bEnd,
        endWithBuffer: bEndWithBuffer,
        status: b.status,
      });
    }
  }

  const enrichedSeats = rawSeats.map((seat) => {
    const seatObj = seat.toObject ? seat.toObject() : { ...seat };
    if (seatObj.status === "maintenance") {
      return {
        ...seatObj,
        isAvailable: false,
        status: "maintenance",
        occupiedUntil: null,
        freeInMinutes: 0,
        nextAvailableAt: null,
        activeBookingsCount: 0,
      };
    }

    const bookings = chairBookings[seat.index] || [];
    // Filter active bookings whose completion + buffer is in the future
    const activeFuture = bookings.filter((b) => b.endWithBuffer > now);

    if (activeFuture.length > 0) {
      let latestEnd = now;
      for (const b of activeFuture) {
        if (b.endWithBuffer > latestEnd) {
          latestEnd = b.endWithBuffer;
        }
      }
      const freeInMinutes = Math.max(1, Math.ceil((latestEnd.getTime() - now.getTime()) / 60000));

      return {
        ...seatObj,
        isAvailable: false,
        status: "occupied",
        occupiedUntil: latestEnd.toISOString(),
        freeInMinutes: freeInMinutes,
        nextAvailableAt: latestEnd.toISOString(),
        activeBookingsCount: activeFuture.length,
      };
    }

    return {
      ...seatObj,
      isAvailable: true,
      status: "available",
      occupiedUntil: null,
      freeInMinutes: 0,
      nextAvailableAt: now.toISOString(),
      activeBookingsCount: 0,
    };
  });

  return enrichedSeats;
}

/**
 * Calculates consecutive slot time on a chair:
 * If the chair has active bookings, automatically finds the earliest time when this customer's turn begins.
 */
async function calculateNextChairFreeTime(barber, seatIndex, requestedStartTime, durationMinutes) {
  const Booking = require("../models/Booking");
  const reqStart = new Date(requestedStartTime);
  const now = new Date();
  const buffer = barber.bufferMinutes || 5;

  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  const seatQuery = (seatIndex === 0 || !barber.seats || barber.seats.length <= 1)
    ? { $or: [{ seatIndex: seatIndex }, { seatIndex: null }, { seatIndex: { $exists: false } }] }
    : { seatIndex: seatIndex };

  const existingBookings = await Booking.find({
    barberId: barber._id,
    ...seatQuery,
    status: { $in: ["confirmed", "arrived", "in-progress", "pending"] },
    startTime: { $lt: todayEnd },
    endTime: { $gt: todayStart },
  }).sort({ startTime: 1 });

  let candidateStart = new Date(Math.max(now.getTime(), reqStart.getTime()));

  for (const b of existingBookings) {
    let bStart = new Date(b.startTime);
    let bEnd = new Date(b.endTime);

    if (b.status === "in-progress") {
      const sAt = b.startedAt ? new Date(b.startedAt) : bStart;
      bEnd = new Date(sAt.getTime() + (b.expectedDuration || 30) * 60000);
      if (bEnd < now) bEnd = new Date(now.getTime() + 5 * 60000);
    } else {
      if (bEnd < now) {
        bEnd = new Date(now.getTime() + (b.expectedDuration || 30) * 60000);
      }
    }
    const bEndWithBuffer = new Date(bEnd.getTime() + buffer * 60000);

    if (candidateStart < bEndWithBuffer) {
      candidateStart = new Date(bEndWithBuffer);
    }
  }

  const finalEndTime = new Date(candidateStart.getTime() + durationMinutes * 60000);
  return {
    startTime: candidateStart,
    endTime: finalEndTime,
  };
}

module.exports = { buildSeats, availableSeatSlots, enrichBarberSeats, calculateNextChairFreeTime };
