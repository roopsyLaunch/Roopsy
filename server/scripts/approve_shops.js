const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const BarberSchema = new mongoose.Schema({
  approvalStatus: String
}, { collection: "barbers", strict: false });

const Barber = mongoose.model("Barber", BarberSchema);

async function run() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("MONGODB_URI is not set in .env");
    process.exit(1);
  }
  
  console.log("Connecting to database...");
  await mongoose.connect(uri);
  
  console.log("Updating all pending barbers/salons to approved...");
  const res = await Barber.updateMany(
    { approvalStatus: "pending" },
    { $set: { approvalStatus: "approved" } }
  );
  
  console.log(`Successfully approved ${res.modifiedCount} barbers/salons.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
