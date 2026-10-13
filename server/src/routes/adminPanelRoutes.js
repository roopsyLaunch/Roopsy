const express = require("express");
const router = express.Router();
const { authRequired, requireRole } = require("../middleware/auth");
const ctrl = require("../controllers/adminPanelController");

// Use requireRole("admin") if you have an admin role, or just use authRequired for testing
router.get("/dashboard-stats", authRequired, requireRole("admin"), ctrl.getDashboardStats);
router.get("/tailors",         authRequired, requireRole("admin"), ctrl.getAllTailors);
router.patch("/tailors/:id",   authRequired, requireRole("admin"), ctrl.updateTailorStatus);
router.get("/barbers",         authRequired, requireRole("admin"), ctrl.getAllBarbers);
router.patch("/barbers/:id",   authRequired, requireRole("admin"), ctrl.updateBarberStatus);
router.get("/orders",          authRequired, requireRole("admin"), ctrl.getAllOrders);
router.get("/customers",       authRequired, requireRole("admin"), ctrl.getAllCustomers);

// Extended Admin Panel Management Routes
router.get("/bookings",        authRequired, requireRole("admin"), ctrl.getAllBookings);
router.patch("/bookings/:id",  authRequired, requireRole("admin"), ctrl.updateBookingStatus);
router.get("/reviews",         authRequired, requireRole("admin"), ctrl.getAllReviews);
router.delete("/reviews/:id",  authRequired, requireRole("admin"), ctrl.deleteReview);
router.get("/users",           authRequired, requireRole("admin"), ctrl.getAllUsers);
router.patch("/users/:id/role",authRequired, requireRole("admin"), ctrl.updateUserRole);
router.patch("/users/:id/block",authRequired, requireRole("admin"), ctrl.blockUser);
router.patch("/users/:id/unblock",authRequired, requireRole("admin"), ctrl.unblockUser);
router.delete("/users/:id",    authRequired, requireRole("admin"), ctrl.deleteUser);
router.get("/partners/:id/details", authRequired, requireRole("admin"), ctrl.getPartnerDetails);

// Additional Shop & Notification features
router.get("/recent-activity", authRequired, requireRole("admin"), ctrl.getRecentActivity);
router.get("/notifications",   authRequired, requireRole("admin"), ctrl.getAllNotifications);
router.post("/notifications",  authRequired, requireRole("admin"), ctrl.sendNotification);
router.post("/shops",          authRequired, requireRole("admin"), ctrl.createShop);
router.delete("/shops/:type/:id", authRequired, requireRole("admin"), ctrl.deleteShop);

module.exports = router;
