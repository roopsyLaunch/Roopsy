const express = require("express");
const adminController = require("../controllers/adminController");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/barbers/pending", authRequired, requireRole("admin"), adminController.listPending);
router.patch("/barbers/:id/decision", authRequired, requireRole("admin"), adminController.decide);

module.exports = router;
