const mongoose = require("mongoose");
const dotenv = require("dotenv");
const path = require("path");

dotenv.config({ path: path.join(__dirname, "../.env") });

const BarberSchema = new mongoose.Schema({
  businessCategory: String,
  shopName: String
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
  
  console.log("Updating barbers/salons with empty categories...");
  const res = await Barber.updateMany(
    { $or: [ { businessCategory: "" }, { businessCategory: { $exists: false } } ] },
    { $set: { businessCategory: "Barber Shop" } }
  );
  
  console.log(`Successfully updated ${res.modifiedCount} shops.`);
  process.exit(0);
}

run().catch(err => {
  console.error(err);
  process.exit(1);
});
