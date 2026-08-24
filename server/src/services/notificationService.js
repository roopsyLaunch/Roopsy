const { Expo } = require("expo-server-sdk");
const expo = new Expo();

/**
 * Sends a push notification to a specific Expo Push Token.
 * 
 * @param {string} targetExpoToken - The recipient's Expo push token.
 * @param {string} title - The notification title.
 * @param {string} body - The notification text.
 * @param {object} [data] - Optional metadata payload.
 */
async function sendPushNotification(targetExpoToken, title, body, data = {}) {
  if (!targetExpoToken) return;

  // Validate the Expo push token
  if (!Expo.isExpoPushToken(targetExpoToken)) {
    console.warn(`[Push Service] Target token "${targetExpoToken}" is not a valid Expo push token.`);
    return;
  }

  // Construct message payload
  const messages = [{
    to: targetExpoToken,
    sound: "default",
    title: title,
    body: body,
    data: data,
    badge: 1,
    priority: "high"
  }];

  try {
    const chunks = expo.chunkPushNotifications(messages);
    const tickets = [];
    for (let chunk of chunks) {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    }
    console.log(`[Push Service] Push dispatched successfully. Tickets:`, tickets);
  } catch (error) {
    console.error(`[Push Service] Failed to send push notification via Expo:`, error);
  }
}

module.exports = { sendPushNotification };
