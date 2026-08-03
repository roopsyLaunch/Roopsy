require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Barber = require('./src/models/Barber');
  const Booking = require('./src/models/Booking');
  const Service = require('./src/models/Service');
  const { availableSeatSlots } = require('./src/utils/barberSeats');

  const barber = await Barber.findById("6a3d849d569eee2df913300c");
  const service = await Service.findById("6a4158f5ccc2720dcb933feb");

  const date = "2026-06-30";
  const [y, mo, d] = date.split("-").map(Number);
  const dayStart = new Date(y, mo - 1, d, 0, 0, 0, 0);
  const dayEnd = new Date(y, mo - 1, d, 23, 59, 59, 999);

  const existing = await Booking.find({
    barberId: barber._id,
    status: { $ne: "cancelled" },
    startTime: { $lt: dayEnd },
    endTime: { $gt: dayStart },
  }).sort({ startTime: 1 });

  const { dayKeyFromDate, parseHm } = require("./src/utils/time");
  const key = dayKeyFromDate(dayStart);
  const wh = barber.workingHours[key];
  
  const openM = parseHm(wh.open);
  const closeM = parseHm(wh.close);
  const duration = service.durationMinutes;
  const slotMinutes = duration > 0 ? duration : 30;
  
  const slots = [];
  const now = new Date();

  for (let m = openM; m + duration <= closeM; m += slotMinutes) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const start = new Date(y, mo - 1, d, h, min, 0, 0);
    const end = new Date(start.getTime() + duration * 60 * 1000);
    
    const capacity = availableSeatSlots(barber, start);
    let overlapCount = 0;
    for (const b of existing) {
      if (b.startTime < end && b.endTime > start) {
        overlapCount += 1;
      }
    }
    
    const isPast = start < now;
    const isBooked = overlapCount >= capacity;
    
    if (!isPast && !isBooked) {
      slots.push(start.toISOString());
    }
  }
  
  console.log("SERVER NOW:", now.toString());
  console.log("SERVER NOW (ISO):", now.toISOString());
  console.log("AVAILABLE SLOTS:", slots);
  process.exit();
});
