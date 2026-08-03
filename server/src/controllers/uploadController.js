const cloudinary = require("../utils/cloudinary");
const streamifier = require("streamifier");

async function uploadImage(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: "No image file provided" });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "barber_app" },
      (error, result) => {
        if (error) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ error: "Failed to upload image" });
        }
        res.json({ url: result.secure_url });
      }
    );

    streamifier.createReadStream(req.file.buffer).pipe(uploadStream);
  } catch (err) {
    console.error("Upload error:", err);
    res.status(500).json({ error: "Server error during upload" });
  }
}

module.exports = {
  uploadImage,
};
