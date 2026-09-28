const Review = require("../models/Review");
const Barber = require("../models/Barber");
const Booking = require("../models/Booking");

async function addReview(req, res) {
  try {
    const { barberId, bookingId, rating, comment } = req.body;
    const userId = req.user._id;

    if (!bookingId) {
      return res.status(400).json({ error: "Booking ID is required" });
    }

    const ratingNum = Number(rating);
    if (isNaN(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5 stars" });
    }

    // Verify booking belongs to this user
    const booking = await Booking.findOne({ _id: bookingId, customerId: userId });
    if (!booking) {
      return res.status(404).json({ error: "Booking not found or does not belong to you" });
    }

    if (booking.status !== "completed") {
      return res.status(400).json({ error: "You can only review a booking after service is completed." });
    }

    const targetBarberId = booking.barberId;
    const cleanComment = typeof comment === "string" ? comment.trim() : "";

    // Check if review already exists for this booking (allow edit/update)
    let review = await Review.findOne({ bookingId });
    let oldRating = 0;
    const isUpdate = !!review;

    if (review) {
      oldRating = review.rating || 0;
      review.rating = ratingNum;
      review.comment = cleanComment;
      await review.save();
    } else {
      review = await Review.create({
        userId,
        barberId: targetBarberId,
        bookingId,
        rating: ratingNum,
        comment: cleanComment,
      });
    }

    // Update Booking document
    booking.rating = ratingNum;
    booking.reviewComment = cleanComment;
    booking.isRated = true;
    booking.ratedAt = new Date();
    await booking.save();

    // Update Barber rating stats
    const barber = await Barber.findById(targetBarberId);
    if (barber) {
      if (isUpdate) {
        barber.ratingSum = Math.max(0, (barber.ratingSum || 0) - oldRating + ratingNum);
      } else {
        barber.ratingSum = (barber.ratingSum || 0) + ratingNum;
        barber.ratingCount = (barber.ratingCount || 0) + 1;
      }
      await barber.save();

      // Send notification to Barber Partner
      if (barber.userId) {
        try {
          const Notification = require("../models/Notification");
          const custName = req.user?.name || "Customer";
          const commentSnippet = cleanComment ? ` "${cleanComment}"` : "";
          await Notification.create({
            userId: barber.userId,
            title: "New Customer Review ⭐️",
            body: `${custName} rated your service ${ratingNum}/5 stars!${commentSnippet}`,
            type: "barber_review",
            data: { bookingId: booking._id, barberId: targetBarberId, rating: ratingNum }
          });
        } catch (nErr) {
          console.error("Failed to notify barber of review", nErr);
        }
      }
    }

    res.json({ message: isUpdate ? "Review updated successfully!" : "Thank you! Review submitted successfully!", review });
  } catch (error) {
    console.error("addReview error", error);
    res.status(500).json({ error: "Server error occurred while saving review." });
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
