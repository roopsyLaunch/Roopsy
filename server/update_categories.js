require('dotenv').config();
const mongoose = require('mongoose');
const Barber = require('./src/models/Barber');

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const res = await Barber.updateMany(
    { $or: [{ businessCategory: { $exists: false } }, { businessCategory: "" }, { businessCategory: null }] },
    { $set: { businessCategory: "Barber Shop" } }
  );
  console.log("Update Result:", res);
  process.exit(0);
}
run().catch(console.error);
