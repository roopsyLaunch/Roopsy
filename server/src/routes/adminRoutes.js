const express = require("express");
const adminController = require("../controllers/adminController");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/barbers/pending", authRequired, requireRole("admin"), adminController.listPending);
router.patch("/barbers/:id/decision", authRequired, requireRole("admin"), adminController.decide);
router.get("/tailors/pending", authRequired, requireRole("admin"), adminController.listPendingTailors);
router.patch("/tailors/:id/decision", authRequired, requireRole("admin"), adminController.decideTailor);

module.exports = router;
