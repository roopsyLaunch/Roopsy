const mongoose = require('mongoose');
require('dotenv').config();
const User = require('./src/models/User');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const users = await User.find({}, 'name email phone role');
    console.log("USERS_LIST:");
    console.log(JSON.stringify(users, null, 2));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    process.exit(0);
  }
}

run();
