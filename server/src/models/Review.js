const mongoose = require("mongoose");

const reviewSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    barberId: { type: mongoose.Schema.Types.ObjectId, ref: "Barber", required: true },
    bookingId: { type: mongoose.Schema.Types.ObjectId, ref: "Booking", required: true },
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, default: "", trim: true },
  },
  { timestamps: true }
);

// Prevent a user from reviewing the same booking multiple times
reviewSchema.index({ bookingId: 1 }, { unique: true });
// Index for fetching reviews for a shop quickly
reviewSchema.index({ barberId: 1, createdAt: -1 });

module.exports = mongoose.model("Review", reviewSchema);
