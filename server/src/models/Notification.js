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

// Post-save hook to automatically trigger push notifications
notificationSchema.post("save", async function (doc) {
  try {
    const User = mongoose.model("User");
    const user = await User.findById(doc.userId).select("expoPushToken");
    
    if (user && user.expoPushToken) {
      const { sendPushNotification } = require("../services/notificationService");
      // Asynchronously send push notification
      await sendPushNotification(user.expoPushToken, doc.title, doc.body, doc.data);
    }
  } catch (err) {
    console.error("[Notification Model Hook] Error sending push notification:", err);
  }
});

module.exports = mongoose.model("Notification", notificationSchema);
