require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const { loadConfig } = require("../src/config");
const User = require("../src/models/User");

async function run() {
  const { mongoUri } = loadConfig();
  await mongoose.connect(mongoUri);

  const hash = await bcrypt.hash("testerpassword123", 10);
  
  // Check if tester already exists
  let tester = await User.findOne({ email: "tester@roopsy.com" });
  if (!tester) {
    await User.create({
      email: "tester@roopsy.com",
      passwordHash: hash,
      name: "Play Store Tester",
      phone: "9876543210",
      role: "customer",
    });
    console.log("Tester user created successfully!");
  } else {
    // update password to testerpassword123
    tester.passwordHash = hash;
    tester.role = "customer";
    await tester.save();
    console.log("Tester user already existed, updated password.");
  }
  
  await mongoose.disconnect();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
