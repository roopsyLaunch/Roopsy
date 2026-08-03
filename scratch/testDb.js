const mongoose = require("mongoose");
const Booking = require("../server/src/models/Booking");
const Service = require("../server/src/models/Service");

async function run() {
  await mongoose.connect("mongodb://127.0.0.1:27017/barber", { useNewUrlParser: true, useUnifiedTopology: true });
  const bookings = await Booking.find().populate("serviceIds").populate("customerId");
  console.log("Bookings:", JSON.stringify(bookings, null, 2));
  mongoose.disconnect();
}
run();
