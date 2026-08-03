require('dotenv').config();
const mongoose = require('mongoose');

mongoose.connect(process.env.MONGODB_URI).then(async () => {
  const Service = require('./src/models/Service');
  const Barber = require('./src/models/Barber');
  const Booking = require('./src/models/Booking');

  const services = await Service.find({ name: { $regex: /beard/i } });
  console.log("SERVICES:", JSON.stringify(services, null, 2));

  const barbers = await Barber.find({});
  if (barbers.length > 0) {
    console.log("BARBERS SEATS:", JSON.stringify(barbers[0].seats, null, 2));
    console.log("BARBER WORKING HOURS:", JSON.stringify(barbers[0].workingHours, null, 2));
  }
  
  const bookings = await Booking.find({ status: { $ne: 'cancelled' } });
  console.log("ACTIVE BOOKINGS:", JSON.stringify(bookings, null, 2));

  process.exit();
});
