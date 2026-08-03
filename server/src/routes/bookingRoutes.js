const express = require("express");
const bookingController = require("../controllers/bookingController");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/availability", bookingController.availableSlots);
router.get("/slot-alternatives", bookingController.slotAlternatives);
router.post("/lock-slot", authRequired, bookingController.lockSlot);
router.post("/", authRequired, bookingController.create);
router.get("/me", authRequired, bookingController.listMine);
router.get("/barber", authRequired, requireRole("barber", "admin"), bookingController.listForBarber);
router.get("/queue", authRequired, requireRole("barber", "admin"), bookingController.getUnifiedQueue);
router.post("/walk-in", authRequired, requireRole("barber"), bookingController.walkIn);
router.post("/verify-otp", authRequired, requireRole("barber", "admin"), bookingController.verifyOtp);
router.post("/:id/reschedule", authRequired, bookingController.reschedule);
router.post("/:id/cancel", authRequired, bookingController.cancel);
router.patch("/:id", authRequired, bookingController.patch);

module.exports = router;
