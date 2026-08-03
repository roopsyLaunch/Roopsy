const mongoose = require("mongoose");

const tailorServiceSchema = new mongoose.Schema(
  {
    tailorId: { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, min: 0 },
    estimatedDays: { type: Number, default: 1, min: 1 }, // Delivery time estimate
    category: { type: String, default: "Custom Stitching" }, // e.g., Alteration, Custom Stitching
    serviceMode: {
      type: String,
      enum: ["shop", "premium", "home"],
      default: "shop",
    },
    isActive: { type: Boolean, default: true },
    genderCategory: {
      type: String,
      enum: ["men", "women", "kids", "unisex"],
      default: "unisex",
    },
    images: { type: [String], default: [] },
  },
  { timestamps: true }
);

tailorServiceSchema.index({ tailorId: 1 });

module.exports = mongoose.model("TailorService", tailorServiceSchema);
