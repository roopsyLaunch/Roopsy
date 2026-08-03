const mongoose = require('mongoose');
require('dotenv').config();
const Barber = require('./src/models/Barber');
const User = require('./src/models/User');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const barbers = await Barber.find({});
  console.log("All barbers:");
  barbers.forEach(b => console.log(b.shopName, b.ownerName));
  
  const users = await User.find({ name: { $regex: /hridesh|nauwa/i } });
  console.log("\nUsers matching hridesh:");
  console.log(users.map(u => ({ email: u.email, name: u.name, role: u.role })));

  process.exit(0);
}

run();
