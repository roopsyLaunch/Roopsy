const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true, default: "" },
    role: {
      type: String,
      enum: ["customer", "barber", "tailor", "admin"],
      default: "customer",
    },
    avatarUrl: { type: String, default: "" },
    favoriteBarbers: [{ type: mongoose.Schema.Types.ObjectId, ref: "Barber" }],
    favoriteShops: [{ type: mongoose.Schema.Types.ObjectId, ref: "Barber" }],
    expoPushToken: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
