const TailorOrder    = require("../models/TailorOrder");
const Tailor         = require("../models/Tailor");
const TailorCustomer = require("../models/TailorCustomer");
const MeasurementProfile = require("../models/MeasurementProfile");
const mongoose = require("mongoose");

/**
 * GET /tailors/crm/customers
 * Returns all unique customers of this tailor, enriched with CRM data.
 */
exports.getCRMCustomers = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    // Get all orders grouped by customerId
    const orders = await TailorOrder.find({ tailorId: tailor._id })
      .populate("customerId", "name phone email avatarUrl")
      .sort({ createdAt: -1 });

    // Aggregate per customer
    const customerMap = {};
    for (const order of orders) {
      if (!order.customerId) continue;
      const cid = order.customerId._id.toString();
      if (!customerMap[cid]) {
        customerMap[cid] = {
          customer: order.customerId,
          totalOrders: 0,
          totalSpend: 0,
          lastOrderAt: order.createdAt,
          statuses: [],
        };
      }
      customerMap[cid].totalOrders += 1;
      customerMap[cid].totalSpend  += order.totalAmount || 0;
      customerMap[cid].statuses.push(order.status);
      if (new Date(order.createdAt) > new Date(customerMap[cid].lastOrderAt)) {
        customerMap[cid].lastOrderAt = order.createdAt;
      }
    }

    // Merge with CRM records
    const crmRecords = await TailorCustomer.find({ tailorId: tailor._id });
    const crmMap = {};
    for (const r of crmRecords) crmMap[r.customerId.toString()] = r;

    const result = Object.values(customerMap).map(entry => ({
      ...entry,
      crm: crmMap[entry.customer._id.toString()] || null,
    }));

    res.json({ customers: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * GET /tailors/crm/customers/:customerId
 * Full customer profile: orders, measurements, CRM record.
 */
exports.getCRMCustomerDetail = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const { customerId } = req.params;

    const orders = await TailorOrder.find({ tailorId: tailor._id, customerId })
      .sort({ createdAt: -1 });

    const measurements = await MeasurementProfile.find({ userId: customerId });

    let crm = await TailorCustomer.findOne({ tailorId: tailor._id, customerId });
    if (!crm) {
      // Auto-create on first view
      crm = await TailorCustomer.create({
        tailorId: tailor._id,
        customerId,
        totalOrders: orders.length,
        totalSpend: orders.reduce((s, o) => s + (o.totalAmount || 0), 0),
        lastOrderAt: orders[0]?.createdAt,
      });
    }

    res.json({ orders, measurements, crm });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * PATCH /tailors/crm/customers/:customerId
 * Update CRM record: tags, note, loyalty points, communication log, flag.
 */
exports.updateCRMCustomer = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const { customerId } = req.params;
    const { tags, privateNote, loyaltyPoints, isFlagged, logEntry } = req.body;

    const updatePayload = {};
    if (tags        !== undefined) updatePayload.tags         = tags;
    if (privateNote !== undefined) updatePayload.privateNote  = privateNote;
    if (loyaltyPoints !== undefined) updatePayload.loyaltyPoints = loyaltyPoints;
    if (isFlagged   !== undefined) updatePayload.isFlagged    = isFlagged;

    let crm = await TailorCustomer.findOneAndUpdate(
      { tailorId: tailor._id, customerId },
      { $set: updatePayload },
      { new: true, upsert: true }
    );

    // Add communication log entry if provided
    if (logEntry) {
      crm = await TailorCustomer.findOneAndUpdate(
        { tailorId: tailor._id, customerId },
        { $push: { communicationLog: { ...logEntry, loggedAt: new Date() } } },
        { new: true }
      );
    }

    res.json({ crm });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

/**
 * PATCH /tailors/crm/customers/:customerId/measurements/:measurementId
 * Tailor can add a note or lock a measurement (read-only patch).
 * Full measurement editing stays with the customer on their own profile.
 */
exports.getMeasurementVault = async (req, res) => {
  try {
    const tailor = await Tailor.findOne({ userId: req.user._id });
    if (!tailor) return res.status(403).json({ error: "Not a tailor" });

    const { customerId } = req.params;

    // Verify the customer has placed an order with this tailor
    const hasOrder = await TailorOrder.exists({ tailorId: tailor._id, customerId });
    if (!hasOrder) return res.status(403).json({ error: "No orders from this customer" });

    const measurements = await MeasurementProfile.find({ userId: customerId });
    res.json({ measurements });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};
