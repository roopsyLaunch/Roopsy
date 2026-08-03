const express = require("express");
const router = express.Router();
const measurementController = require("../controllers/measurementController");
const { authRequired } = require("../middleware/auth");

router.post("/", authRequired, measurementController.createProfile);
router.get("/", authRequired, measurementController.getProfiles);
router.put("/:id", authRequired, measurementController.updateProfile);
router.delete("/:id", authRequired, measurementController.deleteProfile);

module.exports = router;
