require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { loadConfig } = require("../src/config");
const User = require("../src/models/User");
const Barber = require("../src/models/Barber");
const Service = require("../src/models/Service");
const { buildSeats } = require("../src/utils/barberSeats");

async function run() {
  const { mongoUri } = loadConfig();
  await mongoose.connect(mongoUri);

  await Service.deleteMany({});
  await Barber.deleteMany({});
  await User.deleteMany({
    email: { $in: ["demo@customer.com", "demo@barber.com", "admin@demo.com"] },
  });

  const hash = await bcrypt.hash("password123", 10);

  await User.create({
    email: "admin@demo.com",
    passwordHash: hash,
    name: "Super Admin",
    phone: "555-0000",
    role: "admin",
  });

  const customer = await User.create({
    email: "demo@customer.com",
    passwordHash: hash,
    name: "Demo Customer",
    phone: "555-0100",
    role: "customer",
  });

  const barberUser = await User.create({
    email: "demo@barber.com",
    passwordHash: hash,
    name: "Alex Cuts",
    phone: "555-0200",
    role: "barber",
  });

  const barber = await Barber.create({
    userId: barberUser._id,
    approvalStatus: "approved",
    shopName: "Alex's Barber Shop",
    bio: "Classic cuts and hot towel shaves.",
    shopPosterUrl: "",
    address: {
      line1: "12 Main Street",
      city: "Mumbai",
      state: "MH",
      pincode: "400001",
    },
    location: { lat: 19.076, lng: 72.8777 },
    seatCount: 2,
    seats: buildSeats(2),
    isShopOpen: true,
    aadhaarLast4: "1234",
    bank: {
      accountHolderName: "Alex Cuts",
      accountNumber: "XXXXXXXX1234",
      ifsc: "HDFC0001234",
      upiId: "alex@upi",
    },
  });

  await Service.insertMany([
    { barberId: barber._id, name: "Haircut", category: "haircut", durationMinutes: 30, price: 25 },
    { barberId: barber._id, name: "Beard Trim", category: "beard", durationMinutes: 20, price: 15 },
    {
      barberId: barber._id,
      name: "Haircut + Beard",
      category: "combo",
      durationMinutes: 45,
      price: 35,
    },
  ]);

  console.log("Seed OK");
  console.log("Admin: admin@demo.com / password123");
  console.log("Customer:", customer.email, "/ password123");
  console.log("Barber (approved):", barberUser.email, "/ password123");

  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
