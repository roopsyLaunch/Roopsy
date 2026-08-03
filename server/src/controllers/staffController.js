const Tailor      = require("../models/Tailor");
const TailorStaff = require("../models/TailorStaff");

const getTailor = async (userId) => {
  const tailor = await Tailor.findOne({ userId });
  if (!tailor) throw new Error("NOT_TAILOR");
  return tailor;
};

/** GET /tailor-staff */
exports.listStaff = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const staff  = await TailorStaff.find({ tailorId: tailor._id }).sort({ isActive: -1, role: 1 });
    res.json({ staff });
  } catch (err) {
    if (err.message === "NOT_TAILOR") return res.status(403).json({ error: "Not a tailor" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** POST /tailor-staff */
exports.addStaff = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const member = await TailorStaff.create({ tailorId: tailor._id, ...req.body });
    res.status(201).json({ member });
  } catch (err) {
    if (err.message === "NOT_TAILOR") return res.status(403).json({ error: "Not a tailor" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** GET /tailor-staff/:id */
exports.getStaffById = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const member = await TailorStaff.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!member) return res.status(404).json({ error: "Staff not found" });
    res.json({ member });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** PATCH /tailor-staff/:id */
exports.updateStaff = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const { tasks, attendance, ...rest } = req.body; // prevent direct array override via rest
    const member = await TailorStaff.findOneAndUpdate(
      { _id: req.params.id, tailorId: tailor._id },
      { $set: rest },
      { new: true }
    );
    if (!member) return res.status(404).json({ error: "Staff not found" });
    res.json({ member });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** DELETE /tailor-staff/:id */
exports.deleteStaff = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    await TailorStaff.findOneAndUpdate(
      { _id: req.params.id, tailorId: tailor._id },
      { $set: { isActive: false } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** POST /tailor-staff/:id/attendance */
exports.markAttendance = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const { date, status, checkInTime, checkOutTime, note } = req.body;

    const member = await TailorStaff.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!member) return res.status(404).json({ error: "Staff not found" });

    // Remove existing entry for same date if any
    member.attendance = member.attendance.filter(
      a => new Date(a.date).toDateString() !== new Date(date).toDateString()
    );
    member.attendance.push({ date: new Date(date), status, checkInTime, checkOutTime, note });
    await member.save();

    res.json({ member });
  } catch (err) {
    if (err.message === "NOT_TAILOR") return res.status(403).json({ error: "Not a tailor" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** POST /tailor-staff/:id/tasks */
exports.addTask = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const member = await TailorStaff.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!member) return res.status(404).json({ error: "Staff not found" });

    member.tasks.push({ ...req.body, createdAt: new Date() });
    await member.save();

    res.json({ member });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** PATCH /tailor-staff/:staffId/tasks/:taskId */
exports.updateTask = async (req, res) => {
  try {
    const tailor  = await getTailor(req.user._id);
    const member  = await TailorStaff.findOne({ _id: req.params.staffId, tailorId: tailor._id });
    if (!member) return res.status(404).json({ error: "Staff not found" });

    const task = member.tasks.id(req.params.taskId);
    if (!task) return res.status(404).json({ error: "Task not found" });

    Object.assign(task, req.body);
    await member.save();
    res.json({ member });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
