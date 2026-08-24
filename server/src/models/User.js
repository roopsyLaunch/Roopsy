const mongoose = require("mongoose");

const userAddressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: "" },
    city: { type: String, default: "" },
    pincode: { type: String, default: "" },
    lat: { type: Number },
    lng: { type: Number },
  },
  { _id: false }
);

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
    address: { type: userAddressSchema, default: undefined },
  },
  { timestamps: true }
);

module.exports = mongoose.model("User", userSchema);
