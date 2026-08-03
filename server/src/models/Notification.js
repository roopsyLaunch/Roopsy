const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    body: { type: String, required: true },
    type: { type: String, default: "general" }, // 'reminder', 'delay', 'promotion', 'system'
    isRead: { type: Boolean, default: false },
    data: { type: mongoose.Schema.Types.Mixed }, // e.g. { bookingId: '...' }
  },
  { timestamps: true }
);

notificationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
