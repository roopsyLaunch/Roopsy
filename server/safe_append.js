const fs = require('fs');

let content = fs.readFileSync('src/controllers/bookingController.js', 'utf8');

// Insert imports at the top
content = content.replace('const Booking = require("../models/Booking");', 'const Booking = require("../models/Booking");\nconst SlotLock = require("../models/SlotLock");\n\nconst CHECKIN_WINDOW_START_MINS = 10;\nconst CHECKIN_WINDOW_END_MINS = 5;');

// Append functions at the bottom before module.exports
const appendContent = fs.readFileSync('bookingController_append.txt', 'utf8');
content = content.replace('module.exports = {', appendContent + '\n\nmodule.exports = {');

// Update exports
content = content.replace('verifyOtp,\n};', 'verifyOtp,\n  lockSlot,\n  walkIn,\n  slotAlternatives,\n  expireBooking\n};');

// Also update verifyOtp to have CHECKIN WINDOW logic
const checkinLogic = `
  const checkInStart = new Date(new Date(booking.startTime).getTime() - CHECKIN_WINDOW_START_MINS * 60000);
  const checkInEnd = new Date(new Date(booking.startTime).getTime() + CHECKIN_WINDOW_END_MINS * 60000);
  const now = new Date();
  
  if (now < checkInStart) {
    return res.status(400).json({ error: "Check-in window has not opened yet. Please wait." });
  }
  if (now > checkInEnd) {
    return res.status(400).json({ error: "Booking has expired. The check-in window has closed." });
  }
  
  if (booking.verificationPin !== otp) {
`;
content = content.replace('if (booking.verificationPin !== otp) {', checkinLogic);

fs.writeFileSync('src/controllers/bookingController.js', content);
console.log('Successfully appended missing functions and fixes.');
