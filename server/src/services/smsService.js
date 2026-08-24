const axios = require("axios");

/**
 * Initiates an OTP dispatch via MSG91 Widget API (for Authentication).
 * Bypasses DLT requirements for signup/login flows.
 * 
 * @param {string} phone - The recipient's mobile number.
 * @returns {Promise<object>} The MSG91 response containing request_id.
 */
async function sendOtpSms(phone) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const widgetId = process.env.MSG91_WIDGET_ID;

  let formattedMobile = phone.replace(/\D/g, "");
  if (formattedMobile.length === 10) {
    formattedMobile = "91" + formattedMobile;
  }

  try {
    const response = await axios.post("https://control.msg91.com/api/v5/widget/sendOtp", {
      widgetId,
      identifier: formattedMobile
    }, {
      headers: {
        "authkey": authKey,
        "Content-Type": "application/json",
        "Origin": "https://control.msg91.com",
        "Referer": "https://control.msg91.com/"
      }
    });

    console.log(`[SMS Service] MSG91 Send response for ${formattedMobile}:`, response.data);
    return response.data;
  } catch (error) {
    console.error(`[SMS Service] Failed to send OTP via MSG91 Widget:`, error?.response?.data || error.message);
    throw error;
  }
}

/**
 * Verifies an OTP code via MSG91 Widget API (for Authentication).
 * 
 * @param {string} reqId - The request ID returned from sendOtpSms.
 * @param {string|number} otp - The user-provided OTP code.
 * @returns {Promise<boolean>} True if verified successfully.
 */
async function verifyOtpSms(reqId, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const widgetId = process.env.MSG91_WIDGET_ID;

  try {
    const response = await axios.post("https://control.msg91.com/api/v5/widget/verifyOtp", {
      widgetId,
      reqId,
      otp: String(otp).trim()
    }, {
      headers: {
        "authkey": authKey,
        "Content-Type": "application/json",
        "Origin": "https://control.msg91.com",
        "Referer": "https://control.msg91.com/"
      }
    });

    console.log(`[SMS Service] MSG91 Verify response:`, response.data);

    // Debug file logging
    try {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.join(__dirname, "..", "..", "verification_debug.log");
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] reqId: ${reqId} | otp: ${otp} | response: ${JSON.stringify(response.data)}\n`);
    } catch (fsErr) {
      console.error("FS Log error:", fsErr);
    }

    return response.data?.type === "success";
  } catch (error) {
    const errData = error?.response?.data || error.message;
    console.error(`[SMS Service] Failed to verify OTP via MSG91 Widget:`, errData);

    try {
      const fs = require("fs");
      const path = require("path");
      const logPath = path.join(__dirname, "..", "..", "verification_debug.log");
      fs.appendFileSync(logPath, `[${new Date().toISOString()}] ERROR reqId: ${reqId} | otp: ${otp} | error: ${JSON.stringify(errData)}\n`);
    } catch (fsErr) {
      console.error("FS Log error:", fsErr);
    }

    return false;
  }
}

/**
 * Sends a custom transactional OTP/PIN (for booking & delivery verification).
 * Uses standard SendOTP v5 and prints to console for mock development.
 * 
 * @param {string} phone - Customer mobile number.
 * @param {string|number} otp - Generated verification code.
 */
async function sendCustomSms(phone, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  let formattedMobile = phone.replace(/\D/g, "");
  if (formattedMobile.length === 10) {
    formattedMobile = "91" + formattedMobile;
  }

  // Always log transactional PIN to server console for testing
  console.log(`[SMS Service] [OTP LOG] Mobile: ${formattedMobile} | Transactional PIN: ${otp}`);

  if (!authKey || !templateId || templateId === "your_template_id_here") {
    return;
  }

  try {
    await axios.post("https://control.msg91.com/api/v5/otp", {
      otp: String(otp)
    }, {
      params: {
        template_id: templateId,
        mobile: formattedMobile,
        authkey: authKey
      },
      headers: {
        "Content-Type": "application/json"
      }
    });
  } catch (error) {
    console.error(`[SMS Service] Failed to send transactional SMS to ${formattedMobile}:`, error?.response?.data || error.message);
  }
}

module.exports = { sendOtpSms, verifyOtpSms, sendCustomSms };
