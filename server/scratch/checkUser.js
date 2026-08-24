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

  const formats = ["8299403010", "918299403010", "+918299403010"];
  const users = await User.find({ phone: { $in: formats } });
  console.log(`Found ${users.length} users with these formats.`);
  for (const user of users) {
    const isPasswordMatch = await bcrypt.compare("123456", user.passwordHash);
    console.log({
      id: user._id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      passwordMatches123456: isPasswordMatch
    });
  }

  await mongoose.disconnect();
}

main().catch(console.error);
