const mongoose = require("mongoose");

const slotLockSchema = new mongoose.Schema(
  {
    barberId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Barber",
      required: true,
    },
    lockedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    time: {
      type: Date,
      required: true,
    },
    lockedAt: {
      type: Date,
      default: Date.now,
      expires: 45, // Automatically deletes the document 45 seconds after lockedAt
    },
  }
);

// Compound index to quickly find locks for a specific barber and time
slotLockSchema.index({ barberId: 1, time: 1 });

module.exports = mongoose.model("SlotLock", slotLockSchema);
