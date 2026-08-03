const { verifyToken } = require("../utils/jwt.js");
const User = require("../models/User");

async function optionalAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");
  if (type !== "Bearer" || !token) {
    req.user = null;
    return next();
  }
  try {
    const decoded = verifyToken(token);
    const user = await User.findById(decoded.sub).select("-passwordHash");
    req.user = user || null;
  } catch {
    req.user = null;
  }
  next();
}

module.exports = { optionalAuth };
