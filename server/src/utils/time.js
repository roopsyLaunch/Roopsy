const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const DAY_MAP = {
  sunday: "sun",
  sun: "sun",
  monday: "mon",
  mon: "mon",
  tuesday: "tue",
  tue: "tue",
  wednesday: "wed",
  wed: "wed",
  thursday: "thu",
  thu: "thu",
  friday: "fri",
  fri: "fri",
  saturday: "sat",
  sat: "sat"
};

/**
 * Normalizes working hours across different schemas and day formats (full names or short keys, AM/PM or 24h).
 * Guarantees short keys ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] with { open, close, isClosed }.
 */
function normalizeWorkingHours(workingHours, fallbackOpen = "09:00", fallbackClose = "21:00") {
  const result = {
    sun: { open: fallbackOpen, close: fallbackClose, isClosed: false },
    mon: { open: fallbackOpen, close: fallbackClose, isClosed: false },
    tue: { open: fallbackOpen, close: fallbackClose, isClosed: false },
    wed: { open: fallbackOpen, close: fallbackClose, isClosed: false },
    thu: { open: fallbackOpen, close: fallbackClose, isClosed: false },
    fri: { open: fallbackOpen, close: fallbackClose, isClosed: false },
    sat: { open: fallbackOpen, close: fallbackClose, isClosed: false }
  };

  if (!workingHours || typeof workingHours !== "object") {
    return result;
  }

  for (const [key, val] of Object.entries(workingHours)) {
    if (!val) continue;
    const lowerKey = String(key).trim().toLowerCase();
    const shortKey = DAY_MAP[lowerKey] || DAY_MAP[lowerKey.slice(0, 3)];
    if (!shortKey) continue;

    let open = fallbackOpen;
    let close = fallbackClose;
    let isClosed = false;

    // Format A: { open: boolean, start: "09:00 AM", end: "09:00 PM" } (from PartnerHoursScreen)
    if (typeof val.open === "boolean") {
      isClosed = !val.open;
      if (val.start) open = String(val.start).trim();
      if (val.end) close = String(val.end).trim();
    }
    // Format B: { open: "09:00", close: "18:00", isClosed: boolean }
    else {
      if (val.open && typeof val.open === "string") open = val.open.trim();
      if (val.close && typeof val.close === "string") close = val.close.trim();
      if (val.isClosed !== undefined) isClosed = Boolean(val.isClosed);
    }

    result[shortKey] = { open, close, isClosed };
  }

  return result;
}

/**
 * Returns date parts in Indian Standard Time (Asia/Kolkata, UTC+05:30)
 * Ensures consistency across local dev, cloud servers (UTC), and Android bundle.
 */
function getISTComponents(d) {
  const dateObj = (d instanceof Date) ? d : new Date(d);
  if (isNaN(dateObj.getTime())) {
    const now = new Date();
    return { weekday: DAY_KEYS[now.getDay()], hour: now.getHours(), minute: now.getMinutes(), day: now.getDate(), month: now.getMonth() + 1, year: now.getFullYear(), minutes: now.getHours() * 60 + now.getMinutes() };
  }

  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Kolkata',
      weekday: 'short',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: false
    });
    
    const parts = formatter.formatToParts(dateObj);
    let weekday = '';
    let hour = 0;
    let minute = 0;
    let day = 1;
    let month = 1;
    let year = 2026;

    for (const part of parts) {
      if (part.type === 'weekday') weekday = part.value.toLowerCase().slice(0, 3);
      else if (part.type === 'hour') hour = parseInt(part.value, 10);
      else if (part.type === 'minute') minute = parseInt(part.value, 10);
      else if (part.type === 'day') day = parseInt(part.value, 10);
      else if (part.type === 'month') month = parseInt(part.value, 10);
      else if (part.type === 'year') year = parseInt(part.value, 10);
    }

    if (hour === 24) hour = 0;
    return { weekday, hour, minute, day, month, year, minutes: hour * 60 + minute };
  } catch (err) {
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istDate = new Date(dateObj.getTime() + istOffsetMs);
    const hour = istDate.getUTCHours();
    const minute = istDate.getUTCMinutes();
    const day = istDate.getUTCDate();
    const month = istDate.getUTCMonth() + 1;
    const year = istDate.getUTCFullYear();
    const weekday = DAY_KEYS[istDate.getUTCDay()];
    return { weekday, hour, minute, day, month, year, minutes: hour * 60 + minute };
  }
}

function makeISTDate(year, month1Indexed, day, hour = 0, minute = 0, second = 0) {
  const y = String(year).padStart(4, '0');
  const mo = String(month1Indexed).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  const h = String(hour).padStart(2, '0');
  const mi = String(minute).padStart(2, '0');
  const s = String(second).padStart(2, '0');
  return new Date(`${y}-${mo}-${d}T${h}:${mi}:${s}+05:30`);
}

function dayKeyFromDate(d) {
  const { weekday } = getISTComponents(d);
  if (DAY_KEYS.includes(weekday)) return weekday;
  const dateObj = (d instanceof Date) ? d : new Date(d);
  return DAY_KEYS[dateObj.getDay()];
}

/**
 * Parses a time string into minutes from midnight (0 - 1439).
 * Seamlessly handles:
 * - "09:00", "21:00", "18:30" (24h)
 * - "09:00 AM", "09:00 PM", "12:00 PM", "12:00 AM" (12h with AM/PM)
 */
function parseHm(str) {
  if (typeof str !== "string") {
    if (typeof str === "number") return str;
    return 0;
  }
  const s = str.trim().toLowerCase();
  if (!s) return 0;
  const isPM = s.includes("pm");
  const isAM = s.includes("am");
  const clean = s.replace(/[a-z]/g, "").trim();
  const parts = clean.split(":").map(Number);
  let h = isNaN(parts[0]) ? 0 : parts[0];
  const m = isNaN(parts[1]) ? 0 : parts[1];

  if (isPM && h < 12) {
    h += 12;
  } else if (isAM && h === 12) {
    h = 0;
  }
  return h * 60 + m;
}

function isWithinWorkingHours(date, workingHours) {
  return true;
}

function endFitsWorkingHours(startDate, endDate, workingHours) {
  return true;
}

/**
 * Calculates whether a shop (Barber, Salon, Tailor) is currently open right now.
 * Respects manual toggle (isShopOpen), paused bookings (pauseBookings), tailor service offers (offersShopService),
 * weekly schedule (workingHours[day]), day off (isClosed), and working hours.
 */
function calculateIsShopOpen(shop) {
  if (!shop) return false;

  // 1. If partner paused all bookings
  if (shop.pauseBookings) {
    return false;
  }

  // 2. If shop is explicitly marked closed (partner turned toggle OFF)
  if (shop.isShopOpen === false) {
    return false;
  }

  // 3. For tailor shops: if shop service is disabled or all services are disabled
  if (shop.offersShopService === false && shop.offersHomeService === false) {
    return false;
  }
  if (shop.offersShopService === false) {
    return false;
  }

  // 4. Working hours & Day off schedule check
  if (shop.workingHours && typeof shop.workingHours === "object") {
    const { weekday, minutes } = getISTComponents(new Date());
    const daySchedule = shop.workingHours[weekday];
    if (daySchedule) {
      // If partner marked today as closed/day-off
      if (daySchedule.isClosed === true || daySchedule.open === false) {
        return false;
      }
      // If autoShopStatus is enabled, check working hours open/close
      if (shop.autoShopStatus) {
        const openMin = parseHm(daySchedule.open || daySchedule.start || "09:00");
        const closeMin = parseHm(daySchedule.close || daySchedule.end || "21:00");
        if (openMin < closeMin) {
          if (minutes < openMin || minutes >= closeMin) {
            return false;
          }
        }
      }
    }
  }

  // 5. Default is open if not marked closed
  return true;
}

module.exports = { 
  dayKeyFromDate, 
  isWithinWorkingHours, 
  endFitsWorkingHours, 
  parseHm, 
  DAY_KEYS, 
  getISTComponents, 
  calculateIsShopOpen,
  makeISTDate,
  normalizeWorkingHours
};
