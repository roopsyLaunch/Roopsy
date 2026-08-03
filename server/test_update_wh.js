require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Barber = require('./src/models/Barber');
  const b = await Barber.findOne({ _id: '6a3d849d569eee2df913300c' });
  
  if (!b) return console.log("Not found");
  
  const updateData = {
    mon: { open: "08:00", close: "20:00", isClosed: false },
    sun: { open: "00:00", close: "00:00", isClosed: true }
  };
  
  for (const [day, data] of Object.entries(updateData)) {
    if (b.workingHours[day]) {
      b.workingHours[day].open = data.open;
      b.workingHours[day].close = data.close;
      b.workingHours[day].isClosed = data.isClosed;
    }
  }
  b.markModified('workingHours');
  await b.save();
  
  const b2 = await Barber.findOne({ _id: '6a3d849d569eee2df913300c' });
  console.log("UPDATED MON:", b2.workingHours.mon);
  console.log("UPDATED SUN:", b2.workingHours.sun);
  process.exit();
});
