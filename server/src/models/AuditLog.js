const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema(
  {
    actionType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    entityModel: { type: String, required: true }, // 'Booking', 'Barber', 'User'
    actorId: { type: mongoose.Schema.Types.ObjectId },
    actorModel: { type: String }, // 'User', 'Barber', 'Admin', 'System'
    details: { type: mongoose.Schema.Types.Mixed },
  },
  { timestamps: true }
);

auditLogSchema.index({ entityId: 1, actionType: 1 });
auditLogSchema.index({ actorId: 1 });

module.exports = mongoose.model("AuditLog", auditLogSchema);
