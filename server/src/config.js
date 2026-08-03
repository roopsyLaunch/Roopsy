const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

const requiredInProd = ["MONGODB_URI", "JWT_SECRET"];

function loadConfig() {
  const nodeEnv = process.env.NODE_ENV || "development";
  const missing = requiredInProd.filter((k) => !process.env[k]);
  if (nodeEnv === "production" && missing.length) {
    throw new Error(`Missing env: ${missing.join(", ")}`);
  }

  return {
    port: Number(process.env.PORT) || 5000,
    mongoUri: process.env.MONGODB_URI || "mongodb://10.130.207.5:27017/barber_app",
    jwtSecret: process.env.JWT_SECRET || "dev-only-change-me",
    nodeEnv,
  };
}

module.exports = { loadConfig };
