const { z } = require("zod");
const Barber = require("../models/Barber");
const User = require("../models/User");

const decisionSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  rejectionReason: z.string().optional(),
});

async function listPending(req, res) {
  const barbers = await Barber.find({ approvalStatus: "pending" })
    .populate("userId", "name email phone createdAt")
    .sort({ createdAt: 1 });
  res.json({
    requests: barbers.map((b) => ({
      id: b._id,
      createdAt: b.createdAt,
      shopName: b.shopName,
      bio: b.bio,
      address: b.address,
      location: b.location,
      seatCount: b.seatCount,
      aadhaarLast4: b.aadhaarLast4,
      bank: b.bank,
      user: b.userId
        ? {
            id: b.userId._id,
            name: b.userId.name,
            email: b.userId.email,
            phone: b.userId.phone,
          }
        : null,
    })),
  });
}

async function decide(req, res) {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  const barber = await Barber.findById(req.params.id);
  if (!barber) {
    return res.status(404).json({ error: "Request not found" });
  }
  if (barber.approvalStatus !== "pending") {
    return res.status(400).json({ error: "This application is not pending" });
  }
  barber.approvalStatus = parsed.data.status;
  barber.rejectionReason =
    parsed.data.status === "rejected" ? parsed.data.rejectionReason || "Not eligible" : "";
  await barber.save();
  res.json({
    ok: true,
    barber: {
      id: barber._id,
      approvalStatus: barber.approvalStatus,
      rejectionReason: barber.rejectionReason,
    },
  });
}

module.exports = { listPending, decide };
