const mongoose = require("mongoose");
require("dotenv").config();
const Service = require("./src/models/Service");

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barberDB');
  const services = await Service.find();
  console.log(services.map(s => ({ name: s.name, dur: s.durationMinutes })));
  process.exit(0);
}
check().catch(console.error);
