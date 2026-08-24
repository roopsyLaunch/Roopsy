const { verifyOtpSms } = require("../src/services/smsService");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function main() {
  console.log("Testing verifyOtpSms with Env:");
  console.log("MSG91_AUTH_KEY:", process.env.MSG91_AUTH_KEY);
  console.log("MSG91_WIDGET_ID:", process.env.MSG91_WIDGET_ID);

  const reqId = "366878674a44323236313134"; // From user's logs
  const otp = "1234"; // Dummy OTP to test the request call structure

  const result = await verifyOtpSms(reqId, otp);
  console.log("Verification result:", result);
}

main().catch(console.error);
