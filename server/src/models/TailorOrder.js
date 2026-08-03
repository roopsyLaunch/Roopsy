const mongoose = require("mongoose");

const tailorOrderSchema = new mongoose.Schema(
  {
    customerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tailorId: { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true },
    services: [
      {
        serviceId: { type: mongoose.Schema.Types.ObjectId, ref: "TailorService", required: true },
        name: { type: String, required: true },
        price: { type: Number, required: true },
        quantity: { type: Number, default: 1 },
      }
    ],
    totalAmount: { type: Number, required: true },
    
    measurements: {
      type: Map,
      of: String, // e.g. { "chest": "40 inches", "waist": "32 inches" }
      default: {},
    },
    measurementProfileId: { type: mongoose.Schema.Types.ObjectId, ref: "MeasurementProfile", required: false },
    notes: { type: String, default: "" },
    
    // Phase 2: Fabric & Design
    fabricSource: { type: String, enum: ["customer", "shop"], default: "customer" },
    fabricDetails: {
      name: { type: String },
      color: { type: String },
      pricePerMeter: { type: Number },
      metersNeeded: { type: Number },
      totalFabricCost: { type: Number }
    },
    designPreferences: {
      fit: { type: String },
      collar: { type: String },
      sleeves: { type: String },
      pockets: { type: String },
      referenceImageUrl: { type: String }
    },
    
    // Phase 3: At-Home Tailoring
    isHomeService: { type: Boolean, default: false },
    isPremiumService: { type: Boolean, default: false },
    homeServiceAddress: { type: String, default: "" },
    visitDate: { type: Date, required: false },
    visitFee: { type: Number, default: 0 },
    
    // OTP Verification
    otp: { type: String, default: "" },
    otpExpiresAt: { type: Date },
    isOtpVerified: { type: Boolean, default: false },
    otpVerifiedAt: { type: Date },
    
    // Final Delivery OTP Verification
    deliveryOtp: { type: String, default: "" },
    isDeliveryOtpVerified: { type: Boolean, default: false },
    deliveryOtpVerifiedAt: { type: Date },
    
    // Order lifecycle dates
    fittingDate: { type: Date, required: false },
    deliveryDate: { type: Date, required: false },
    estimatedDays: { type: Number, default: 3 },
    
    // ERP Phase 1: Full production pipeline
    status: {
      type: String,
      enum: [
        "pending", "accepted", "declined", "cancelled",
        "measurement_pending", "fabric_pending", "pattern_making",
        "cutting", "stitching", "embroidery", "trial",
        "alteration", "ironing", "quality_check", "packing",
        "ready", "dispatched", "completed", "refund"
      ],
      default: "pending",
    },
    priority: { type: String, enum: ["normal", "urgent", "rush"], default: "normal" },
    internalNotes: { type: String, default: "" },
    assignedStaff: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false },
    statusHistory: [
      {
        status: { type: String },
        changedAt: { type: Date, default: Date.now },
        note: { type: String, default: "" },
      }
    ],
    // Rating & Review
    rating: { type: Number, min: 1, max: 5 },
    reviewComment: { type: String, default: "" },
    isRated: { type: Boolean, default: false },
    ratedAt: { type: Date },
    
    cancellationReason: { type: String, default: "" },
  },
  { timestamps: true }
);

tailorOrderSchema.index({ tailorId: 1, status: 1 });
tailorOrderSchema.index({ customerId: 1 });

module.exports = mongoose.model("TailorOrder", tailorOrderSchema);
