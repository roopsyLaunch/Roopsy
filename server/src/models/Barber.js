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

const seatSchema = new mongoose.Schema(
  {
    index: { type: Number, required: true },
    label: { type: String, default: "Chair" },
    isAvailable: { type: Boolean, default: true },
    status: { type: String, enum: ["available", "occupied", "reserved", "maintenance"], default: "available" },
    occupiedUntil: { type: Date, default: null },
  },
  { _id: false }
);

const breakSchema = new mongoose.Schema(
  {
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    type: { type: String, default: "Custom" }, // Lunch, Tea, Prayer
  },
  { _id: true }
);

const staffSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    role: { type: String, default: "" },
    serviceIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Service" }],
    avatarUrl: { type: String, default: "" },
    portfolioImages: { type: [String], default: [] },
    unavailableDates: { type: [String], default: [] }, // e.g. ["2026-07-15", "2026-07-20"]
  },
  { _id: true }
);

const barberSchema = new mongoose.Schema(
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
    businessCategory: { type: String, default: "" },
    genderPreference: {
      type: String,
      enum: ["unisex", "women_only", "men_only"],
      default: "unisex",
    },
    ownerName: { type: String, default: "" },
    mobileNumber: { type: String, default: "" },
    gallery: { type: [String], default: [] },
    shopPosterUrl: { type: String, default: "" },
    address: { type: addressSchema, default: () => ({}) },
    location: { type: locationSchema, default: undefined },
    seatCount: { type: Number, default: 1, min: 1 },
    seats: { type: [seatSchema], default: [] },
    staff: { type: [staffSchema], default: [] },
    breaks: { type: [breakSchema], default: [] },
    pauseBookings: { type: Boolean, default: false },
    isShopOpen: { type: Boolean, default: true },
    autoShopStatus: { type: Boolean, default: false },
    dailyOpenTime: { type: String, default: "09:00" },
    dailyCloseTime: { type: String, default: "21:00" },
    offersHomeService: { type: Boolean, default: false },
    homeServiceFee: { type: Number, default: 0 },
    maxAdvanceBookingDays: { type: Number, default: 1 },
    unavailableDates: { type: [String], default: [] },
    /** Last 4 digits only; full Aadhaar must not be stored in plain text in production */
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
    lunchTime: {
      startTime: { type: String, default: "13:00" },
      endTime: { type: String, default: "14:00" },
      isActive: { type: Boolean, default: false }
    },
    bufferMinutes: { type: Number, default: 5 },
    gracePeriodMinutes: { type: Number, default: 10 },
    slotIntervalMinutes: { type: Number, default: 15 },
    ratingSum: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

barberSchema.index({ approvalStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Barber", barberSchema);
