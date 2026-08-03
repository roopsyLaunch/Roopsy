const mongoose = require("mongoose");

const measurementProfileSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    profileName: { type: String, required: true, trim: true }, // e.g., "My Suit Size", "Brother's Shirt"
    gender: { type: String, enum: ["male", "female", "other"], default: "male" },
    
    // Type of measurement: "standard" (S, M, L, XL) or "custom" (manual inches/cm)
    measurementType: { type: String, enum: ["standard", "custom"], default: "custom" },
    
    // If standard, what size? (e.g. S, M, L, XL, XXL)
    standardSize: { type: String, default: "" },
    
    // If custom, what unit?
    unit: { type: String, enum: ["inches", "cm"], default: "inches" },
    
    // Key-value pair of manual measurements
    measurements: {
      neck: { type: Number },
      chest: { type: Number },
      waist: { type: Number },
      hips: { type: Number },
      shoulder: { type: Number },
      sleeve: { type: Number },
      length: { type: Number },
      inseam: { type: Number },
      thigh: { type: Number },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("MeasurementProfile", measurementProfileSchema);
