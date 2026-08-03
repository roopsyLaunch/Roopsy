const mongoose = require("mongoose");

const tailorCustomerSchema = new mongoose.Schema(
  {
    tailorId:    { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true },
    customerId:  { type: mongoose.Schema.Types.ObjectId, ref: "User",   required: true },

    // CRM fields
    tags:        { type: [String], default: [] },        // e.g. ["VIP", "Bride", "Corporate"]
    privateNote: { type: String,   default: "" },        // internal note only tailor can see
    loyaltyPoints: { type: Number, default: 0 },
    totalOrders:   { type: Number, default: 0 },
    totalSpend:    { type: Number, default: 0 },
    isFlagged:     { type: Boolean, default: false },
    lastOrderAt:   { type: Date },

    // Communication log
    communicationLog: [
      {
        type:     { type: String, enum: ["call", "whatsapp", "sms", "visit", "note"], default: "note" },
        message:  { type: String, default: "" },
        loggedAt: { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
);

tailorCustomerSchema.index({ tailorId: 1, customerId: 1 }, { unique: true });
tailorCustomerSchema.index({ tailorId: 1, lastOrderAt: -1 });

module.exports = mongoose.model("TailorCustomer", tailorCustomerSchema);
