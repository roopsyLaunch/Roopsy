const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../src/models/User");
const Barber = require("../src/models/Barber");
const Tailor = require("../src/models/Tailor");
const Booking = require("../src/models/Booking");
const TailorOrder = require("../src/models/TailorOrder");
const Otp = require("../src/models/Otp");
const Review = require("../src/models/Review");
const SlotLock = require("../src/models/SlotLock");
const MeasurementProfile = require("../src/models/MeasurementProfile");
const TailorCustomer = require("../src/models/TailorCustomer");
const { Expense, CashbookEntry } = require("../src/models/TailorFinance");
const TailorInventory = require("../src/models/TailorInventory");
const TailorService = require("../src/models/TailorService");
const TailorStaff = require("../src/models/TailorStaff");
const Service = require("../src/models/Service");
const AuditLog = require("../src/models/AuditLog");
const Notification = require("../src/models/Notification");

const models = [
  User,
  Barber,
  Tailor,
  Booking,
  TailorOrder,
  Otp,
  Review,
  SlotLock,
  MeasurementProfile,
  TailorCustomer,
  Expense,
  CashbookEntry,
  TailorInventory,
  TailorService,
  TailorStaff,
  Service,
  AuditLog,
  Notification
];

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  if (!mongoUri) {
    console.error("MONGODB_URI not found in environment variables");
    process.exit(1);
  }

  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("MongoDB Connected.");

  console.log("\nStarting Database Cleanup...");
  for (const model of models) {
    try {
      const modelName = model.modelName || model.displayName;
      const res = await model.deleteMany({});
      console.log(`- Cleared model ${modelName}: Deleted ${res.deletedCount} documents.`);
    } catch (err) {
      console.error(`- Error clearing model:`, err.message);
    }
  }

  console.log("\nDatabase cleanup finished. Closing DB connection.");
  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Error executing script:", err);
  process.exit(1);
});
