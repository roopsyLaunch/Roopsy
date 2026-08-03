const mongoose = require("mongoose");
require("dotenv").config();
const SlotLock = require("./src/models/SlotLock");

async function check() {
  await mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/barberDB');
  try {
    const userId = new mongoose.Types.ObjectId();
    const barberId = new mongoose.Types.ObjectId();
    const start = new Date();
    
    const lock = await SlotLock.findOneAndUpdate(
      { barberId: barberId, time: start, lockedBy: { $ne: userId } },
      { $setOnInsert: { barberId: barberId, time: start, lockedBy: userId, lockedAt: new Date() } },
      { upsert: true, new: true, rawResult: true }
    );
    console.log("Raw Result Keys:", Object.keys(lock));
    console.log("Value:", lock.value);
    console.log("Updated Existing:", lock.lastErrorObject?.updatedExisting);
    console.log("To String:", lock.value.lockedBy.toString());
  } catch(e) {
    console.error("MONGO ERROR:", e.message);
  }
  process.exit(0);
}
check().catch(console.error);
