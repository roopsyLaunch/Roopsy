require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { loadConfig } = require("../src/config");
const User = require("../src/models/User");

async function run() {
  const { mongoUri } = loadConfig();
  await mongoose.connect(mongoUri);

  const hash = await bcrypt.hash("password123", 10);
  
  // Check if admin already exists
  let admin = await User.findOne({ email: "admin@demo.com" });
  if (!admin) {
    await User.create({
      email: "admin@demo.com",
      passwordHash: hash,
      name: "Super Admin",
      phone: "555-0000",
      role: "admin",
    });
    console.log("Admin user created successfully!");
  } else {
    // update password to password123 and role to admin
    admin.passwordHash = hash;
    admin.role = "admin";
    await admin.save();
    console.log("Admin user already existed, updated password and role.");
  }
  
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
