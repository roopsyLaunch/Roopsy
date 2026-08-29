const axios = require("axios");

/**
 * Check MSG91 configuration.
 */
function getMsg91Config() {
  const authKey = process.env.MSG91_AUTH_KEY;
  const widgetId = process.env.MSG91_WIDGET_ID;

  if (!authKey) {
    throw new Error("MSG91_AUTH_KEY is missing in environment variables");
  }

  if (!widgetId) {
    throw new Error("MSG91_WIDGET_ID is missing in environment variables");
  }

  return {
    authKey: String(authKey).trim(),
    widgetId: String(widgetId).trim()
  };
}

/**
 * Format Indian mobile number.
 */
function formatMobile(phone) {
  if (!phone) {
    throw new Error("Mobile number is required");
  }

  let mobile = String(phone).replace(/\D/g, "");

  // If number has 10 digits, add India country code
  if (mobile.length === 10) {
    mobile = `91${mobile}`;
  }

  // Handle +91 or already formatted numbers
  if (mobile.length !== 12 || !mobile.startsWith("91")) {
    throw new Error("Invalid Indian mobile number");
  }

  return mobile;
}

/**
 * Send OTP using MSG91 Widget API.
 */
async function sendOtpSms(phone) {
  try {
    const { authKey, widgetId } = getMsg91Config();
    const identifier = formatMobile(phone);

    console.log(
      `[SMS Service] Sending OTP to ${identifier}`
    );

    const response = await axios.post(
      "https://control.msg91.com/api/v5/widget/sendOtp",
      {
        widgetId,
        identifier
      },
      {
        headers: {
          authkey: authKey,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log(
      "[SMS Service] MSG91 Send response:",
      response.data
    );

    return response.data;

  } catch (error) {
    const errorData =
      error?.response?.data || error?.message;

    console.error(
      "[SMS Service] Failed to send OTP:",
      errorData
    );

    throw error;
  }
}

/**
 * Verify OTP using MSG91 Widget API.
 */
async function verifyOtpSms(reqId, otp) {
  try {
    const { authKey, widgetId } = getMsg91Config();

    if (!reqId) {
      throw new Error("OTP request ID (reqId) is missing");
    }

    if (!otp) {
      throw new Error("OTP is required");
    }

    const cleanOtp = String(otp).trim();

    console.log(
      `[SMS Service] Verifying OTP for request ID: ${reqId}`
    );

    const response = await axios.post(
      "https://control.msg91.com/api/v5/widget/verifyOtp",
      {
        widgetId,
        reqId,
        otp: cleanOtp
      },
      {
        headers: {
          authkey: authKey,
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log(
      "[SMS Service] MSG91 Verify response:",
      response.data
    );

    return response.data?.type === "success";

  } catch (error) {
    const errorData =
      error?.response?.data || error?.message;

    console.error(
      "[SMS Service] Failed to verify OTP:",
      errorData
    );

    return false;
  }
}

/**
 * Send custom transactional OTP.
 */
async function sendCustomSms(phone, otp) {
  const authKey = process.env.MSG91_AUTH_KEY;
  const templateId = process.env.MSG91_TEMPLATE_ID;

  if (!authKey || !templateId) {
    console.warn(
      "[SMS Service] Transactional SMS configuration missing"
    );
    return false;
  }

  try {
    const mobile = formatMobile(phone);

    const response = await axios.post(
      "https://control.msg91.com/api/v5/otp",
      {
        otp: String(otp)
      },
      {
        params: {
          template_id: String(templateId).trim(),
          mobile,
          authkey: String(authKey).trim()
        },
        headers: {
          "Content-Type": "application/json"
        },
        timeout: 15000
      }
    );

    console.log(
      "[SMS Service] Transactional SMS response:",
      response.data
    );

    return true;

  } catch (error) {
    console.error(
      "[SMS Service] Failed to send transactional SMS:",
      error?.response?.data || error?.message
    );

    return false;
  }
}

module.exports = {
  sendOtpSms,
  verifyOtpSms,
  sendCustomSms
};
