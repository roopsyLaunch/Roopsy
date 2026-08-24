const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema(
  {
    phone: { type: String, required: true, trim: true },
    otp: { type: String }, // Optional (used in Mock mode, not required for live widget)
    reqId: { type: String, required: true }, // Store the MSG91 request ID
    isVerified: { type: Boolean, default: false },
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// TTL index to automatically remove the document when expired
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("Otp", otpSchema);
