const { z } = require("zod");
const Barber = require("../models/Barber");
const User = require("../models/User");
const Tailor = require("../models/Tailor");

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

async function listPendingTailors(req, res) {
  try {
    const tailors = await Tailor.find({ approvalStatus: "pending" })
      .populate("userId", "name email phone createdAt")
      .sort({ createdAt: 1 });
    res.json({
      requests: tailors.map((t) => ({
        id: t._id,
        createdAt: t.createdAt,
        shopName: t.shopName,
        bio: t.bio,
        address: t.address,
        location: t.location,
        aadhaarLast4: t.aadhaarLast4,
        bank: t.bank,
        user: t.userId
          ? {
              id: t.userId._id,
              name: t.userId.name,
              email: t.userId.email,
              phone: t.userId.phone,
            }
          : null,
      })),
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}

async function decideTailor(req, res) {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const tailor = await Tailor.findById(req.params.id);
    if (!tailor) {
      return res.status(404).json({ error: "Request not found" });
    }
    if (tailor.approvalStatus !== "pending") {
      return res.status(400).json({ error: "This application is not pending" });
    }
    tailor.approvalStatus = parsed.data.status;
    tailor.rejectionReason =
      parsed.data.status === "rejected" ? parsed.data.rejectionReason || "Not eligible" : "";
    await tailor.save();
    res.json({
      ok: true,
      tailor: {
        id: tailor._id,
        approvalStatus: tailor.approvalStatus,
        rejectionReason: tailor.rejectionReason,
      },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
}

module.exports = { listPending, decide, listPendingTailors, decideTailor };
