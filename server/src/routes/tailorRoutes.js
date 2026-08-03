const express = require("express");
const router = express.Router();
const { authRequired, requireRole } = require("../middleware/auth");
const {
  getTailors,
  getTailorById,
  registerTailor,
  updateTailorMe,
  getTailorServices,
  createTailorService,
  updateTailorService,
  deleteTailorService,
  createOrder,
  getTailorOrders,
  getCustomerOrders,
  updateOrderStatus,
  getOrderById,
  verifyOrderOtp,
  generateDeliveryOtp,
  verifyDeliveryOtp,
  cancelCustomerOrder,
  getTailorNotifications,
  getTailorServicesMe,
  rateTailorOrder
} = require("../controllers/tailorController");

// Public routes
router.get("/", getTailors);
router.get("/:id", getTailorById);
router.get("/:tailorId/services", getTailorServices);

// Authenticated customer routes
router.post("/register", authRequired, registerTailor); // Upgrades user to tailor
router.post("/orders", authRequired, createOrder);
router.get("/me/orders/customer", authRequired, getCustomerOrders);
router.patch("/orders/:id/cancel", authRequired, cancelCustomerOrder);
router.post("/orders/:id/rate", authRequired, rateTailorOrder);

// Tailor only routes
router.patch("/me", authRequired, requireRole("tailor"), updateTailorMe);
router.get("/me/orders", authRequired, requireRole("tailor"), getTailorOrders);
router.get("/me/services", authRequired, requireRole("tailor"), getTailorServicesMe);
router.get("/me/notifications", authRequired, requireRole("tailor"), getTailorNotifications);
router.get("/orders/:id", authRequired, requireRole("tailor"), getOrderById);
router.patch("/orders/:id/status", authRequired, requireRole("tailor"), updateOrderStatus);
router.post("/orders/:id/verify-otp", authRequired, requireRole("tailor"), verifyOrderOtp);
router.post("/orders/:id/generate-delivery-otp", authRequired, requireRole("tailor"), generateDeliveryOtp);
router.post("/orders/:id/verify-delivery-otp", authRequired, requireRole("tailor"), verifyDeliveryOtp);
router.post("/services", authRequired, requireRole("tailor"), createTailorService);
router.patch("/services/:id", authRequired, requireRole("tailor"), updateTailorService);
router.delete("/services/:id", authRequired, requireRole("tailor"), deleteTailorService);

module.exports = router;
