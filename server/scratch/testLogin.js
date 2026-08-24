const mongoose = require("mongoose");
const path = require("path");
const bcrypt = require("bcryptjs");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const User = require("../src/models/User");

async function main() {
  const mongoUri = process.env.MONGODB_URI;
  console.log("Connecting to MongoDB...");
  await mongoose.connect(mongoUri);
  console.log("MongoDB Connected.");

  const identifier = "8299403010";
  const password = "123456";

  const isEmail = identifier.includes("@");
  let query = {};
  if (isEmail) {
    query = { email: identifier.toLowerCase().trim() };
  } else {
    let cleanPhone = identifier.replace(/\D/g, "");
    if (cleanPhone.length > 10 && cleanPhone.startsWith("91")) {
      cleanPhone = cleanPhone.slice(-10);
    }
    query = { phone: cleanPhone };
  }

  console.log("Constructed query:", query);
  
  const user = await User.findOne(query);
  if (!user) {
    console.error("FAIL: User not found with query", query);
    await mongoose.disconnect();
    return;
  }
  console.log("SUCCESS: User found:", {
    id: user._id,
    phone: user.phone,
    email: user.email
  });

  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) {
    console.error("FAIL: Password hash does not match!");
  } else {
    console.log("SUCCESS: Password verified!");
  }

  await mongoose.disconnect();
}

main().catch(console.error);
