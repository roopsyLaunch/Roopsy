const express = require("express");
const rateLimit = require("express-rate-limit");
const authController = require("../controllers/authController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
});

router.post("/register", authLimiter, authController.register);
router.post("/login", authLimiter, authController.login);
router.post("/send-otp", authLimiter, authController.sendOtp);
router.post("/verify-otp-login", authLimiter, authController.verifyOtpLogin);
router.post("/verify-otp", authLimiter, authController.verifyOtpOnly);
router.post("/forgot-password", authLimiter, authController.forgotPassword);
router.post("/reset-password", authLimiter, authController.resetPassword);
router.get("/me", authRequired, authController.getMe);
router.patch("/me", authRequired, authController.patchMe);
router.delete("/me", authRequired, authController.deleteMe);

router.post("/favorites/toggle", authRequired, authController.toggleFavorite);
router.get("/favorites", authRequired, authController.getFavorites);
router.patch("/push-token", authRequired, authController.updatePushToken);
router.get("/notifications", authRequired, authController.getUserNotifications);
router.patch("/notifications/read-all", authRequired, authController.markNotificationsRead);
router.delete("/notifications/:id", authRequired, authController.deleteNotification);
router.post("/notifications/delete-bulk", authRequired, authController.deleteNotificationsBulk);

module.exports = router;
