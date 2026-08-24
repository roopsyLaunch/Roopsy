const axios = require("axios");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", ".env") });

async function testUrl(url) {
  const start = Date.now();
  try {
    const response = await axios.post(url, {
      widgetId: process.env.MSG91_WIDGET_ID,
      reqId: "366878674a44323236313134",
      otp: "1234"
    }, {
      headers: {
        "authkey": process.env.MSG91_AUTH_KEY,
        "Content-Type": "application/json",
        "Origin": "https://control.msg91.com",
        "Referer": "https://control.msg91.com/"
      },
      timeout: 10000
    });
    console.log(`${url} responded in ${Date.now() - start}ms:`, response.data);
  } catch (err) {
    console.log(`${url} failed in ${Date.now() - start}ms:`, err?.response?.data || err.message);
  }
}

async function main() {
  console.log("Measuring latencies...");
  await testUrl("https://control.msg91.com/api/v5/widget/verifyOtp");
  await testUrl("https://api.msg91.com/api/v5/widget/verifyOtp");
}

main().catch(console.error);
