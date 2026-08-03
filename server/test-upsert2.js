const mongoose = require("mongoose");
const z = require("zod");
require("dotenv").config();

async function test() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barberDB');
  try {
    const userId = new mongoose.Types.ObjectId();
    const barberId = new mongoose.Types.ObjectId();
    const start = new Date();
    
    const lock = await mongoose.connection.collection("slotlocks").findOneAndUpdate(
      { barberId: barberId, time: start, lockedBy: { $ne: userId } },
      { $setOnInsert: { barberId: barberId, time: start, lockedBy: userId, lockedAt: new Date() } },
      { upsert: true, returnDocument: 'after', includeResultMetadata: true }
    );
    console.log(lock);
    console.log("Locked By:", lock.value.lockedBy);
    console.log("To String:", lock.value.lockedBy.toString());
  } catch(e) {
    console.error("MONGO ERROR:", e.message);
  }
  process.exit(0);
}
test().catch(console.error);
