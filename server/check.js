const mongoose = require("mongoose");
const Barber = require("../server/src/models/Barber");
const { loadConfig } = require("../server/src/config");

async function check() {
  const { mongoUri } = loadConfig();
  await mongoose.connect(mongoUri);
  const barbers = await Barber.find({});
  const Service = require("../server/src/models/Service");
  for (const b of barbers) {
    const svcs = await Service.find({ barberId: b._id });
    console.log("Barber:", b.shopName, "services count:", svcs.length);
  }
  mongoose.disconnect();
}
check();
