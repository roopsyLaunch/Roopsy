const mongoose = require("mongoose");
const z = require("zod");
const Barber = require("./src/models/Barber");
const Service = require("./src/models/Service");
const Booking = require("./src/models/Booking");
require("dotenv").config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barberDB');
  const barber = await Barber.findOne();
  if (!barber) { console.log("No barber found"); return; }
  const service = await Service.findOne({ barberId: barber._id });
  if (!service) { console.log("No service found"); return; }
  
  console.log("Barber:", barber._id);
  console.log("Service:", service._id);
  
  const date = "2026-07-02"; // today
  
  // mock req, res
  const req = {
     query: { barberId: barber._id.toString(), serviceIds: service._id.toString(), date }
  };
  const res = {
     status: (code) => ({ json: (data) => console.log("STATUS", code, data) }),
     json: (data) => {
         console.log("SLOTS FOUND:", data.slots.length);
         if(data.slots.length > 0) console.log("First slot:", data.slots[0]);
         else console.log("DATA:", data);
     }
  };

  const { availableSlots } = require("./src/controllers/bookingController");
  // Monkey-patch console.log in the test script to see controller logs?
  // We can just add logs in bookingController.js and run it.
  await availableSlots(req, res);
  process.exit(0);
}
test().catch(console.error);
