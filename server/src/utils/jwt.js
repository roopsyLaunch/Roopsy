const jwt = require("jsonwebtoken");
const { loadConfig } = require("../config");

function signToken(payload) {
  const { jwtSecret } = loadConfig();
  return jwt.sign(payload, jwtSecret, { expiresIn: "7d" });
}

function verifyToken(token) {
  const { jwtSecret } = loadConfig();
  return jwt.verify(token, jwtSecret);
}

module.exports = { signToken, verifyToken };
