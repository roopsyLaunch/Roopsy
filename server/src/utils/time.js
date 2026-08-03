const DAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function dayKeyFromDate(d) {
  return DAY_KEYS[d.getDay()];
}

function parseHm(str) {
  const [h, m] = str.split(":").map(Number);
  return h * 60 + m;
}

function isWithinWorkingHours(date, workingHours) {
  const key = dayKeyFromDate(date);
  const wh = workingHours[key];
  if (!wh || !wh.open || !wh.close) {
    return false;
  }
  const minutes = date.getHours() * 60 + date.getMinutes();
  const openM = parseHm(wh.open);
  const closeM = parseHm(wh.close);
  return minutes >= openM && minutes < closeM;
}

function endFitsWorkingHours(startDate, endDate, workingHours) {
  const key = dayKeyFromDate(startDate);
  const wh = workingHours[key];
  if (!wh || !wh.open || !wh.close) {
    return false;
  }
  const closeM = parseHm(wh.close);
  const endMinutes = endDate.getHours() * 60 + endDate.getMinutes();
  if (endDate.getDate() !== startDate.getDate() || endDate.getMonth() !== startDate.getMonth()) {
    return false;
  }
  return endMinutes <= closeM;
}

module.exports = { dayKeyFromDate, isWithinWorkingHours, endFitsWorkingHours, parseHm, DAY_KEYS };
