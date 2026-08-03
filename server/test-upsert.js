const mongoose = require("mongoose");
const z = require("zod");
require("dotenv").config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barberDB');
  try {
    const lock = await mongoose.connection.collection("slotlocks").findOneAndUpdate(
      { barberId: new mongoose.Types.ObjectId(), time: new Date(), lockedBy: { $ne: new mongoose.Types.ObjectId() } },
      { $setOnInsert: { lockedAt: new Date() } },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true }
    );
    console.log(lock);
  } catch(e) {
    console.error("MONGO ERROR:", e.message);
  }
  process.exit(0);
}
test().catch(console.error);
