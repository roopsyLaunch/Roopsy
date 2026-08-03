const Tailor          = require("../models/Tailor");
const TailorInventory = require("../models/TailorInventory");

// Ensure the requesting user is a tailor
const getTailor = async (userId) => {
  const tailor = await Tailor.findOne({ userId });
  if (!tailor) throw new Error("NOT_TAILOR");
  return tailor;
};

/** GET /tailor-inventory */
exports.listInventory = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const { category, lowStock } = req.query;

    const filter = { tailorId: tailor._id };
    if (category && category !== "all") filter.category = category;

    const items = await TailorInventory.find(filter).sort({ category: 1, name: 1 });

    const enriched = items.map(item => ({
      ...item.toObject(),
      isLowStock: item.currentStock <= item.lowStockThreshold,
    }));

    const result = lowStock === "true" ? enriched.filter(i => i.isLowStock) : enriched;
    res.json({ items: result });
  } catch (err) {
    if (err.message === "NOT_TAILOR") return res.status(403).json({ error: "Not a tailor" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** POST /tailor-inventory */
exports.createInventoryItem = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const { name, category, sku, description, color, supplier, unit,
            currentStock, lowStockThreshold, costPerUnit, sellingPricePerUnit } = req.body;

    const item = await TailorInventory.create({
      tailorId: tailor._id, name, category, sku, description, color,
      supplier, unit, currentStock, lowStockThreshold, costPerUnit,
      sellingPricePerUnit, totalPurchased: currentStock,
      lastRestockedAt: new Date(),
    });

    res.status(201).json({ item });
  } catch (err) {
    if (err.message === "NOT_TAILOR") return res.status(403).json({ error: "Not a tailor" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** PATCH /tailor-inventory/:id */
exports.updateInventoryItem = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const item = await TailorInventory.findOneAndUpdate(
      { _id: req.params.id, tailorId: tailor._id },
      { $set: req.body },
      { new: true }
    );
    if (!item) return res.status(404).json({ error: "Item not found" });
    res.json({ item });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** DELETE /tailor-inventory/:id */
exports.deleteInventoryItem = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    await TailorInventory.findOneAndDelete({ _id: req.params.id, tailorId: tailor._id });
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/** POST /tailor-inventory/:id/transaction — stock in/out/adjustment */
exports.addTransaction = async (req, res) => {
  try {
    const tailor = await getTailor(req.user._id);
    const { type, qty, note, orderId } = req.body;

    const item = await TailorInventory.findOne({ _id: req.params.id, tailorId: tailor._id });
    if (!item) return res.status(404).json({ error: "Item not found" });

    // Adjust stock
    if (type === "in" || type === "return") {
      item.currentStock   += qty;
      item.totalPurchased += qty;
      item.lastRestockedAt = new Date();
    } else if (type === "out" || type === "waste") {
      item.currentStock -= qty;
      item.totalUsed    += qty;
    } else if (type === "adjustment") {
      item.currentStock = qty; // direct set
    }

    item.transactions.push({ type, qty, note, orderId, loggedAt: new Date() });
    await item.save();

    res.json({ item });
  } catch (err) {
    if (err.message === "NOT_TAILOR") return res.status(403).json({ error: "Not a tailor" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
