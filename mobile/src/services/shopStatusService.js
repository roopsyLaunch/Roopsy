/**
 * Accurately determines if a tailor shop is open right now.
 * Handles:
 * 1. Explicit partner toggle (isShopOpen === false)
 * 2. Bookings paused (pauseBookings === true)
 * 3. Service mode offers (offersShopService === false, or both shop & home false)
 * 4. Weekly schedule / Day off (workingHours[dayKey]?.isClosed === true)
 * 5. Auto shop status / operating hours if enabled
 */
export function isTailorShopOpen(t) {
  if (!t) return false;

  // 1. Explicit partner close toggle or paused bookings
  if (t.isShopOpen === false || t.pauseBookings === true) {
    return false;
  }

  // 2. If tailor explicitly turned off shop visit service or all services
  if (t.offersShopService === false && t.offersHomeService === false) {
    return false;
  }
  if (t.offersShopService === false) {
    return false;
  }

  // 3. Weekly schedule & working hours check (IST Timezone UTC+05:30)
  if (t.workingHours && typeof t.workingHours === "object") {
    const dayKeys = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
    const now = new Date();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000) + istOffsetMs);
    const dayKey = dayKeys[istDate.getDay()];
    const schedule = t.workingHours[dayKey];

    if (schedule) {
      // Day marked closed/day off
      if (schedule.isClosed === true || schedule.open === false) {
        return false;
      }

      // If auto-managed schedule is active, check open and close times
      if (t.autoShopStatus) {
        const parseMinutes = (str) => {
          if (!str) return 0;
          const s = String(str).toLowerCase().trim();
          const isPM = s.includes("pm");
          const isAM = s.includes("am");
          const clean = s.replace(/[a-z]/g, "").trim();
          const [h, m] = clean.split(":").map(Number);
          let hours = isNaN(h) ? 0 : h;
          const mins = isNaN(m) ? 0 : m;
          if (isPM && hours < 12) hours += 12;
          else if (isAM && hours === 12) hours = 0;
          return hours * 60 + mins;
        };

        const curMinutes = istDate.getHours() * 60 + istDate.getMinutes();
        const openMin = parseMinutes(schedule.open || schedule.start || "09:00");
        const closeMin = parseMinutes(schedule.close || schedule.end || "21:00");

        if (openMin < closeMin && (curMinutes < openMin || curMinutes >= closeMin)) {
          return false;
        }
      }
    }
  }

  // Default to true unless explicitly marked closed
  return t.isShopOpen !== false;
}
