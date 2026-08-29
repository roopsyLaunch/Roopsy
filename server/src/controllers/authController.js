const axios = require("axios");

/**
 * Get MSG91 configuration.
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
    widgetId: String(widgetId).trim(),
  };
}

/**
 * Format Indian mobile number.
 * Example:
 * 9876543210 -> 919876543210
 * +919876543210 -> 919876543210
 */
function formatMobile(phone) {
  if (!phone) {
    throw new Error("Mobile number is required");
  }

  let mobile = String(phone).replace(/\D/g, "");

  if (mobile.length === 10) {
    mobile = `91${mobile}`;
  }

  if (mobile.length !== 12 || !mobile.startsWith("91")) {
    throw new Error("Invalid Indian mobile number");
  }

  return mobile;
}

/**
 * Send OTP using MSG91 Widget API.
 */
async function sendOtpSms(phone) {
  const { authKey, widgetId } = getMsg91Config();
  const identifier = formatMobile(phone);

  try {
    console.log(`[SMS Service] Sending OTP to ${identifier}`);

    const response = await axios.post(
      "https://api.msg91.com/api/v5/widget/sendOtp",
      {
        widgetId,
        identifier,
      },
      {
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log(
      "[SMS Service] MSG91 Send response:",
      JSON.stringify(response.data)
    );

    const reqId =
      response.data?.reqId ||
      response.data?.request_id;

    if (!reqId) {
      console.error(
        "[SMS Service] MSG91 did not return reqId:",
        JSON.stringify(response.data)
      );

      throw new Error("MSG91 did not return OTP request ID");
    }

    return {
      success: true,
      reqId: String(reqId).trim(),
    };
  } catch (error) {
    console.error(
      "[SMS Service] Failed to send OTP:",
      JSON.stringify(error?.response?.data || error?.message)
    );

    throw error;
  }
}

/**
 * Verify OTP using MSG91 Widget API.
 */
async function verifyOtpSms(reqId, otp) {
  const { authKey, widgetId } = getMsg91Config();

  if (!reqId) {
    throw new Error("OTP request ID (reqId) is missing");
  }

  if (!otp) {
    throw new Error("OTP is required");
  }

  try {
    const cleanReqId = String(reqId).trim();
    const cleanOtp = String(otp).trim();

    console.log(
      `[SMS Service] Verifying OTP. reqId: ${cleanReqId}`
    );

    const response = await axios.post(
      "https://api.msg91.com/api/v5/widget/verifyOtp",
      {
        widgetId,
        reqId: cleanReqId,
        otp: cleanOtp,
      },
      {
        headers: {
          authkey: authKey,
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log(
      "[SMS Service] MSG91 Verify response:",
      JSON.stringify(response.data)
    );

    return response.data?.type === "success";
  } catch (error) {
    console.error(
      "[SMS Service] Failed to verify OTP:",
      JSON.stringify(error?.response?.data || error?.message)
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
        otp: String(otp).trim(),
      },
      {
        params: {
          template_id: String(templateId).trim(),
          mobile,
          authkey: String(authKey).trim(),
        },
        headers: {
          "Content-Type": "application/json",
        },
        timeout: 15000,
      }
    );

    console.log(
      "[SMS Service] Transactional SMS response:",
      JSON.stringify(response.data)
    );

    return true;
  } catch (error) {
    console.error(
      "[SMS Service] Failed to send transactional SMS:",
      JSON.stringify(error?.response?.data || error?.message)
    );

    return false;
  }
}

module.exports = {
  sendOtpSms,
  verifyOtpSms,
  sendCustomSms,
};
