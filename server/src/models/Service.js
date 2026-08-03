const mongoose = require("mongoose");

const serviceSchema = new mongoose.Schema(
  {
    barberId: { type: mongoose.Schema.Types.ObjectId, ref: "Barber", required: true },
    name: { type: String, required: true, trim: true },
    category: {
      type: String,
      default: "other",
    },
    subcategory: { type: String, default: "" }, // E.g., 'Hair Coloring', 'Bridal Makeup'
    durationMinutes: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    originalPrice: { type: Number, default: 0 },
    discountAmount: { type: Number, default: 0 },
    variants: [
      {
        name: { type: String, required: true }, // E.g., 'Short Hair', 'Long Hair'
        price: { type: Number, required: true },
        durationMinutes: { type: Number, required: true },
      }
    ],
    images: { type: [String], default: [] },
    isHomeService: { type: Boolean, default: false },
    isPackage: { type: Boolean, default: false }, // True for Combos/Bridal Packages
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

serviceSchema.index({ barberId: 1 });

module.exports = mongoose.model("Service", serviceSchema);
