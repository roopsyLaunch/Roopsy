const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const Barber = mongoose.model("Barber", new mongoose.Schema({}, { collection: "barbers", strict: false }));
const Tailor = mongoose.model("Tailor", new mongoose.Schema({}, { collection: "tailors", strict: false }));

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const barbers = await Barber.find({}).lean();
  const tailors = await Tailor.find({}).lean();
  
  console.log("=== BARBERS/SALONS ===");
  barbers.forEach(b => {
    console.log(JSON.stringify(b, null, 2));
  });
  
  console.log("=== TAILORS ===");
  tailors.forEach(t => console.log(`Name: ${t.shopName}, Status: ${t.approvalStatus}, Lat/Lng:`, t.location));
  
  process.exit(0);
}

run().catch(err => { console.error(err); process.exit(1); });
