const express = require("express");
const multer = require("multer");
const uploadController = require("../controllers/uploadController");
const { authRequired } = require("../middleware/auth");

const router = express.Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", authRequired, upload.single("image"), uploadController.uploadImage);

module.exports = router;
