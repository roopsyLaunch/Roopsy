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
      // If it's not available AND has no occupiedUntil, it might be permanently disabled.
      // Otherwise, it's either fully available or temporarily occupied (which DB overlap logic handles).
      if (!s.isAvailable && !s.occupiedUntil) {
        return false;
      }
      return true;
    }).length;
  }
  return barber.seatCount || 1;
}

module.exports = { buildSeats, availableSeatSlots };
