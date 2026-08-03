const mongoose = require("mongoose");

const tailorInventorySchema = new mongoose.Schema(
  {
    tailorId:     { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true },

    // Item identity
    name:         { type: String, required: true, trim: true }, // "Linen Fabric - Blue"
    category:     {
      type: String,
      enum: ["fabric", "thread", "button", "zip", "elastic", "label", "lining", "padding", "packaging", "accessory", "machine", "other"],
      required: true,
    },
    sku:          { type: String, default: "" }, // barcode / custom SKU
    description:  { type: String, default: "" },
    imageUrl:     { type: String, default: "" },
    color:        { type: String, default: "" },
    supplier:     { type: String, default: "" },

    // Stock
    unit:              { type: String, enum: ["meters", "yards", "pcs", "rolls", "kg", "grams", "box", "set"], default: "pcs" },
    currentStock:      { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    costPerUnit:       { type: Number, default: 0 }, // purchase price per unit
    sellingPricePerUnit: { type: Number, default: 0 }, // for shop fabric sales

    // Tracking
    lastRestockedAt:   { type: Date },
    totalPurchased:    { type: Number, default: 0 },
    totalUsed:         { type: Number, default: 0 },

    // Stock transactions log
    transactions: [
      {
        type:       { type: String, enum: ["in", "out", "adjustment", "waste", "return"], default: "in" },
        qty:        { type: Number, required: true },
        note:       { type: String, default: "" },
        orderId:    { type: mongoose.Schema.Types.ObjectId, ref: "TailorOrder" },
        loggedAt:   { type: Date, default: Date.now },
      }
    ],
  },
  { timestamps: true }
);

tailorInventorySchema.index({ tailorId: 1, category: 1 });
tailorInventorySchema.virtual("isLowStock").get(function () {
  return this.currentStock <= this.lowStockThreshold;
});

module.exports = mongoose.model("TailorInventory", tailorInventorySchema);
