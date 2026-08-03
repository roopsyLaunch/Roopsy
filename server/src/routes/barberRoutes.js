const express = require("express");
const barberController = require("../controllers/barberController");
const { authRequired, requireRole } = require("../middleware/auth");
const { optionalAuth } = require("../middleware/optionalAuth");

const router = express.Router();

router.get("/", barberController.list);
router.get("/me", authRequired, requireRole("barber"), barberController.getMine);
router.patch("/me", authRequired, requireRole("barber"), barberController.updateMine);
router.post("/upgrade", authRequired, barberController.upgrade);
router.get("/analytics", authRequired, requireRole("barber"), barberController.getAnalytics);
router.get("/export", authRequired, requireRole("barber"), barberController.exportReport);
router.get("/customer-history/:phone", authRequired, requireRole("barber"), barberController.getCustomerHistory);
router.get("/:id", optionalAuth, barberController.getById);

module.exports = router;
