const Tailor       = require("../models/Tailor");
const TailorOrder  = require("../models/TailorOrder");
const TailorStaff  = require("../models/TailorStaff");
const { Expense, CashbookEntry } = require("../models/TailorFinance");

const getTailor = async (userId) => {
  const t = await Tailor.findOne({ userId });
  if (!t) throw Object.assign(new Error("NOT_TAILOR"), { status: 403 });
  return t;
};

const wrap = (fn) => async (req, res) => {
  try {
    await fn(req, res);
  } catch (err) {
    if (err.status === 403) return res.status(403).json({ error: "Not a tailor" });
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
};

// ─── Revenue Summary ─────────────────────────────────────────────────────────

exports.getRevenueSummary = wrap(async (req, res) => {
  const tailor = await getTailor(req.user._id);
  const now    = new Date();

  const dayStart   = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const weekStart  = new Date(dayStart); weekStart.setDate(dayStart.getDate() - dayStart.getDay());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart  = new Date(now.getFullYear(), 0, 1);

  const completedOrders = await TailorOrder.find({ tailorId: tailor._id, status: "completed" });

  const sum = (orders, from) =>
    orders.filter(o => new Date(o.updatedAt) >= from).reduce((s, o) => s + (o.totalAmount || 0), 0);

  // Last 7 days daily breakdown
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const d   = new Date(dayStart); d.setDate(d.getDate() - i);
    const end = new Date(d); end.setDate(d.getDate() + 1);
    const rev = completedOrders
      .filter(o => new Date(o.updatedAt) >= d && new Date(o.updatedAt) < end)
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    last7.push({
      date:  d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric" }),
      revenue: rev,
    });
  }

  // Top services
  const svcMap = {};
  for (const order of completedOrders) {
    for (const svc of order.services || []) {
      if (!svcMap[svc.name]) svcMap[svc.name] = { name: svc.name, count: 0, revenue: 0 };
      svcMap[svc.name].count   += svc.quantity || 1;
      svcMap[svc.name].revenue += svc.price * (svc.quantity || 1);
    }
  }
  const topServices = Object.values(svcMap).sort((a, b) => b.revenue - a.revenue).slice(0, 5);

  // Expenses
  const expenses = await Expense.find({ tailorId: tailor._id });
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const monthExpenses = expenses.filter(e => new Date(e.date) >= monthStart).reduce((s, e) => s + e.amount, 0);

  // All orders KPIs
  const allOrders = await TailorOrder.find({ tailorId: tailor._id });

  res.json({
    revenue: {
      today:  sum(completedOrders, dayStart),
      week:   sum(completedOrders, weekStart),
      month:  sum(completedOrders, monthStart),
      year:   sum(completedOrders, yearStart),
      total:  sum(completedOrders, new Date(0)),
    },
    orders: {
      total:     allOrders.length,
      completed: completedOrders.length,
      pending:   allOrders.filter(o => o.status === "pending").length,
      cancelled: allOrders.filter(o => ["cancelled", "declined"].includes(o.status)).length,
    },
    expenses: { total: totalExpenses, thisMonth: monthExpenses },
    profit:   { month: sum(completedOrders, monthStart) - monthExpenses },
    last7,
    topServices,
  });
});

// ─── Expenses ────────────────────────────────────────────────────────────────

exports.listExpenses = wrap(async (req, res) => {
  const tailor   = await getTailor(req.user._id);
  const { month, year } = req.query;
  const filter   = { tailorId: tailor._id };
  if (month && year) {
    const from = new Date(Number(year), Number(month) - 1, 1);
    const to   = new Date(Number(year), Number(month), 1);
    filter.date = { $gte: from, $lt: to };
  }
  const expenses = await Expense.find(filter).sort({ date: -1 });
  const total    = expenses.reduce((s, e) => s + e.amount, 0);
  res.json({ expenses, total });
});

exports.addExpense = wrap(async (req, res) => {
  const tailor  = await getTailor(req.user._id);
  const expense = await Expense.create({ tailorId: tailor._id, ...req.body });
  res.status(201).json({ expense });
});

exports.deleteExpense = wrap(async (req, res) => {
  const tailor = await getTailor(req.user._id);
  await Expense.findOneAndDelete({ _id: req.params.id, tailorId: tailor._id });
  res.json({ ok: true });
});

// ─── Cashbook ────────────────────────────────────────────────────────────────

exports.getCashbook = wrap(async (req, res) => {
  const tailor  = await getTailor(req.user._id);
  const entries = await CashbookEntry.find({ tailorId: tailor._id }).sort({ date: -1 }).limit(100);
  const totalCredit = entries.filter(e => e.type === "credit").reduce((s, e) => s + e.amount, 0);
  const totalDebit  = entries.filter(e => e.type === "debit").reduce((s, e) => s + e.amount, 0);
  res.json({ entries, balance: totalCredit - totalDebit, totalCredit, totalDebit });
});

exports.addCashbookEntry = wrap(async (req, res) => {
  const tailor = await getTailor(req.user._id);
  const entry  = await CashbookEntry.create({ tailorId: tailor._id, ...req.body });
  res.status(201).json({ entry });
});

// ─── Analytics ───────────────────────────────────────────────────────────────

exports.getAnalytics = wrap(async (req, res) => {
  const tailor   = await getTailor(req.user._id);
  const allOrders = await TailorOrder.find({ tailorId: tailor._id }).populate("customerId", "name");

  // Order status distribution
  const statusDist = {};
  for (const o of allOrders) {
    statusDist[o.status] = (statusDist[o.status] || 0) + 1;
  }

  // Last 30-day daily orders + revenue
  const now      = new Date();
  const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last30   = [];
  for (let i = 29; i >= 0; i--) {
    const d   = new Date(dayStart); d.setDate(d.getDate() - i);
    const end = new Date(d);        end.setDate(d.getDate() + 1);
    const dayOrders = allOrders.filter(o => new Date(o.createdAt) >= d && new Date(o.createdAt) < end);
    last30.push({
      date:    d.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      orders:  dayOrders.length,
      revenue: dayOrders.filter(o => o.status === "completed").reduce((s, o) => s + (o.totalAmount || 0), 0),
    });
  }

  // Repeat customers
  const custMap = {};
  for (const o of allOrders) {
    const cid = o.customerId?._id?.toString() || String(o.customerId);
    custMap[cid] = (custMap[cid] || 0) + 1;
  }
  const repeatCx = Object.values(custMap).filter(c => c > 1).length;
  const totalCx  = Object.keys(custMap).length;

  // Monthly revenue for last 6 months
  const last6Months = [];
  for (let i = 5; i >= 0; i--) {
    const d     = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end   = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const month = d.toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
    const rev   = allOrders
      .filter(o => o.status === "completed" && new Date(o.updatedAt) >= d && new Date(o.updatedAt) < end)
      .reduce((s, o) => s + (o.totalAmount || 0), 0);
    last6Months.push({ month, revenue: rev });
  }

  res.json({
    statusDist,
    last30,
    last6Months,
    customers: { total: totalCx, repeat: repeatCx, repeatRate: totalCx > 0 ? Math.round((repeatCx / totalCx) * 100) : 0 },
  });
});
