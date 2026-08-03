const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const authRoutes = require("./routes/authRoutes");
const barberRoutes = require("./routes/barberRoutes");
const serviceRoutes = require("./routes/serviceRoutes");
const bookingRoutes = require("./routes/bookingRoutes");
const adminRoutes = require("./routes/adminRoutes");
const uploadRoutes = require("./routes/uploadRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const tailorRoutes      = require("./routes/tailorRoutes");
const measurementRoutes = require("./routes/measurementRoutes");
const crmRoutes         = require("./routes/crmRoutes");
const inventoryRoutes   = require("./routes/inventoryRoutes");
const staffRoutes       = require("./routes/staffRoutes");
const financeRoutes     = require("./routes/financeRoutes");
const adminPanelRoutes  = require("./routes/adminPanelRoutes");

const app = express();

app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || "*",
    credentials: true,
  })
);
app.use(express.json());

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/api/auth", authRoutes);
app.use("/api/barbers", barberRoutes);
app.use("/api/services", serviceRoutes);
app.use("/api/bookings", bookingRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/tailors",       tailorRoutes);
app.use("/api/measurements",  measurementRoutes);
app.use("/api/tailor-crm",    crmRoutes);
app.use("/api/tailor-inventory", inventoryRoutes);
app.use("/api/tailor-staff",     staffRoutes);
app.use("/api/tailor-finance",   financeRoutes);
app.use("/api/admin-panel",      adminPanelRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
});

module.exports = app;
