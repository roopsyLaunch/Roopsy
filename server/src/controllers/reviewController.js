const Review = require("../models/Review");
const Barber = require("../models/Barber");
const Booking = require("../models/Booking");

async function addReview(req, res) {
  try {
    const { barberId, bookingId, rating, comment } = req.body;
    const userId = req.user._id;

    let targetBarberId = barberId;
    if (barberId && typeof barberId === "object") {
      targetBarberId = barberId._id || barberId.id;
    }

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }

    // Verify booking belongs to user and is completed
    const booking = await Booking.findOne({ _id: bookingId, customerId: userId, barberId: targetBarberId });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found or not yours" });
    }
    if (booking.status !== "completed") {
      return res.status(400).json({ error: "Can only review completed bookings" });
    }

    // Check if review already exists
    const existing = await Review.findOne({ bookingId });
    if (existing) {
      return res.status(400).json({ error: "You have already reviewed this booking" });
    }

    // Create review
    const review = await Review.create({
      userId,
      barberId: targetBarberId,
      bookingId,
      rating,
      comment,
    });

    // Update Barber rating stats
    await Barber.findByIdAndUpdate(targetBarberId, {
      $inc: { ratingSum: rating, ratingCount: 1 }
    });

    res.json({ message: "Review added successfully", review });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ error: "You have already reviewed this booking" });
    }
    console.error("addReview error", error);
    res.status(500).json({ error: "Server error" });
  }
}

async function getBarberReviews(req, res) {
  try {
    const { barberId } = req.params;
    const reviews = await Review.find({ barberId })
      .populate("userId", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(50); // limit to recent 50 for now

    res.json({ reviews });
  } catch (error) {
    console.error("getBarberReviews error", error);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { addReview, getBarberReviews };
