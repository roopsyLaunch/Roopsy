const express = require("express");
const serviceController = require("../controllers/serviceController");
const { authRequired, requireRole } = require("../middleware/auth");

const router = express.Router();

router.get("/", serviceController.list);
router.post("/", authRequired, requireRole("barber", "admin"), serviceController.create);
router.patch("/:id", authRequired, requireRole("barber", "admin"), serviceController.update);
router.delete("/:id", authRequired, requireRole("barber", "admin"), serviceController.remove);

module.exports = router;
