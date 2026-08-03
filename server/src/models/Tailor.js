const mongoose = require("mongoose");

const dayHoursSchema = new mongoose.Schema(
  {
    open: { type: String, required: true },
    close: { type: String, required: true },
    isClosed: { type: Boolean, default: false },
  },
  { _id: false }
);

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: "" },
    line2: { type: String, default: "" },
    city: { type: String, default: "" },
    state: { type: String, default: "" },
    pincode: { type: String, default: "" },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

const bankSchema = new mongoose.Schema(
  {
    accountHolderName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifsc: { type: String, default: "" },
    upiId: { type: String, default: "" },
  },
  { _id: false }
);

const tailorSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "pending",
    },
    rejectionReason: { type: String, default: "" },
    bio: { type: String, default: "" },
    avatarUrl: { type: String, default: "" },
    shopName: { type: String, default: "", trim: true },
    ownerName: { type: String, default: "" },
    mobileNumber: { type: String, default: "" },
    gallery: { type: [String], default: [] },
    shopPosterUrl: { type: String, default: "" },
    address: { type: addressSchema, default: () => ({}) },
    location: { type: locationSchema, default: undefined },
    
    // Tailor specific fields
    specialties: { type: [String], default: [] }, // e.g., Suits, Dresses, Alterations
    experienceYears: { type: Number, default: 0 },
    isShopOpen: { type: Boolean, default: true },
    offersShopService: { type: Boolean, default: true },
    offersHomeService: { type: Boolean, default: true },
    offersPremiumService: { type: Boolean, default: true },
    acceptsRushOrders: { type: Boolean, default: false },
    rushOrderFee: { type: Number, default: 0 },
    
    aadhaarLast4: { type: String, default: "" },
    bank: { type: bankSchema, default: () => ({}) },
    workingHours: {
      mon: { type: dayHoursSchema, default: () => ({ open: "09:00", close: "18:00" }) },
      tue: { type: dayHoursSchema, default: () => ({ open: "09:00", close: "18:00" }) },
      wed: { type: dayHoursSchema, default: () => ({ open: "09:00", close: "18:00" }) },
      thu: { type: dayHoursSchema, default: () => ({ open: "09:00", close: "18:00" }) },
      fri: { type: dayHoursSchema, default: () => ({ open: "09:00", close: "18:00" }) },
      sat: { type: dayHoursSchema, default: () => ({ open: "09:00", close: "17:00" }) },
      sun: { type: dayHoursSchema, default: () => ({ open: "10:00", close: "16:00" }) },
    },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

tailorSchema.index({ approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Tailor", tailorSchema);
