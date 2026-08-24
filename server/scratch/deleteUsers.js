const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../src/models/User");
const Barber = require("../src/models/Barber");
const Tailor = require("../src/models/Tailor");
const Otp = require("../src/models/Otp");
const Booking = require("../src/models/Booking");
const TailorOrder = require("../src/models/TailorOrder");

const phones = ["8299403010", "8933010366"];

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in environment variables");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("MongoDB Connected.");

  for (const phone of phones) {
    console.log(`\n--- Processing phone number: ${phone} ---`);
    
    // Check various formats of the phone number
    const formats = [phone, "91" + phone, "+91" + phone];
    
    // Find users
    const users = await User.find({ phone: { $in: formats } });
    if (users.length === 0) {
      console.log(`No user found with phone number format in: ${JSON.stringify(formats)}`);
    } else {
      console.log(`Found ${users.length} user(s).`);
      for (const user of users) {
        const userId = user._id;
        console.log(`Deleting data for User ID: ${userId} (Name: ${user.name}, Email: ${user.email}, Phone: ${user.phone})`);
        
        // Delete bookings
        const bookingDel = await Booking.deleteMany({ customerId: userId });
        console.log(`- Deleted ${bookingDel.deletedCount} bookings.`);
        
        // Delete tailor orders
        const orderDel = await TailorOrder.deleteMany({ customerId: userId });
        console.log(`- Deleted ${orderDel.deletedCount} tailor orders.`);
        
        // Delete barber profile
        const barberDel = await Barber.deleteMany({ userId });
        console.log(`- Deleted ${barberDel.deletedCount} barber profile(s).`);
        
        // Delete tailor profile
        const tailorDel = await Tailor.deleteMany({ userId });
        console.log(`- Deleted ${tailorDel.deletedCount} tailor profile(s).`);
        
        // Delete user
        await User.deleteOne({ _id: userId });
        console.log(`- Deleted User document.`);
      }
    }
    
    // Delete OTP records for these phone numbers
    const otpDel = await Otp.deleteMany({ phone: { $in: formats } });
    console.log(`- Deleted ${otpDel.deletedCount} OTP record(s) matching phone.`);
  }

  console.log("\nFinished. Closing DB connection.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
