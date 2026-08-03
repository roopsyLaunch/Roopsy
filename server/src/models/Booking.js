const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    barberId: { type: mongoose.Schema.Types.ObjectId, ref: "Barber", required: true },
    serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    expectedDuration: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ["pending", "confirmed", "arrived", "in-progress", "completed", "cancelled", "expired", "no-show"],
      default: "pending",
    },
    notes: { type: String, default: "" },
    seatIndex: { type: Number, min: 0 },
    seatLabel: { type: String, default: "" },
    verificationPin: { type: String, default: "" },
    isHomeService: { type: Boolean, default: false },
    homeServiceAddress: { type: String, default: "" }, // Full string address or JSON string
    homeServiceLocation: {
      lat: { type: Number },
      lng: { type: Number },
    },
    selectedVariants: { type: Map, of: String, default: {} }, // map of serviceId -> variantName
    isWalkIn: { type: Boolean, default: false },
    guestName: { type: String, default: "" },
    guestPhone: { type: String, default: "" },
    queuePosition: { type: Number, default: 0 },
    arrivedAt: { type: Date },
    startedAt: { type: Date },
    completedAt: { type: Date },
    noShowAt: { type: Date },
    isOtpVerified: { type: Boolean, default: false },
    otpVerifiedAt: { type: Date },
    delayMinutes: { type: Number, default: 0 },
    paymentStatus: { type: String, enum: ["pending", "advance_paid", "paid", "refunded"], default: "pending" },
    cancellationReason: { type: String, default: "" },
    cancellationRule: { type: String, default: "" },
    staffId: { type: mongoose.Schema.Types.ObjectId },
    customerETA: { type: Number, default: null }, // Added for ETA (in minutes)
    barberETA: { type: Number, default: null }, // ETA for barber arriving at customer's home
    barberArrivalTime: { type: Date, default: null }, // Exact time barber is expected to arrive
  },
  { timestamps: true }
);

bookingSchema.index({ barberId: 1, startTime: 1 });
bookingSchema.index({ customerId: 1, startTime: -1 });

module.exports = mongoose.model("Booking", bookingSchema);
