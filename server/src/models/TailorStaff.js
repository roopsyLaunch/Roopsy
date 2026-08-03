const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
  {
    date:          { type: Date, required: true },
    status:        { type: String, enum: ["present", "absent", "half_day", "leave", "holiday"], default: "present" },
    checkInTime:   { type: String, default: "" },  // "09:15"
    checkOutTime:  { type: String, default: "" },  // "18:30"
    note:          { type: String, default: "" },
  },
  { _id: true }
);

const taskSchema = new mongoose.Schema(
  {
    title:     { type: String, required: true },
    orderId:   { type: mongoose.Schema.Types.ObjectId, ref: "TailorOrder" },
    status:    { type: String, enum: ["pending", "in_progress", "done"], default: "pending" },
    dueDate:   { type: Date },
    note:      { type: String, default: "" },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const tailorStaffSchema = new mongoose.Schema(
  {
    tailorId:   { type: mongoose.Schema.Types.ObjectId, ref: "Tailor", required: true },

    // Identity
    name:       { type: String, required: true, trim: true },
    phone:      { type: String, default: "" },
    email:      { type: String, default: "" },
    avatarUrl:  { type: String, default: "" },
    role: {
      type: String,
      enum: ["owner", "manager", "receptionist", "designer", "master_tailor", "junior_tailor",
             "cutter", "embroidery", "printing", "iron_staff", "packing", "delivery", "accountant"],
      required: true,
    },
    isActive:   { type: Boolean, default: true },
    joinedAt:   { type: Date, default: Date.now },

    // Payroll
    salaryType:       { type: String, enum: ["monthly", "daily", "per_piece", "commission"], default: "monthly" },
    baseSalary:       { type: Number, default: 0 },          // monthly amount or daily rate
    commissionPercent:{ type: Number, default: 0 },          // % of order value if commission-based
    advancePaid:      { type: Number, default: 0 },
    totalEarned:      { type: Number, default: 0 },

    // Attendance & Tasks
    attendance:       { type: [attendanceSchema], default: [] },
    tasks:            { type: [taskSchema],       default: [] },

    // Performance
    ordersHandled:    { type: Number, default: 0 },
    rating:           { type: Number, default: 0, min: 0, max: 5 },
  },
  { timestamps: true }
);

tailorStaffSchema.index({ tailorId: 1, role: 1 });

module.exports = mongoose.model("TailorStaff", tailorStaffSchema);
