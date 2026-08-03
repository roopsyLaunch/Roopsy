const { Expo } = require("expo-server-sdk");

const expo = new Expo();

async function sendPushNotification(pushToken, title, body, data = {}) {
  if (!Expo.isExpoPushToken(pushToken)) {
    console.error(`Push token ${pushToken} is not a valid Expo push token`);
    return;
  }

  const messages = [
    {
      to: pushToken,
      sound: "default",
      title,
      body,
      data,
    },
  ];

  const chunks = expo.chunkPushNotifications(messages);
  const tickets = [];

  for (let chunk of chunks) {
    try {
      const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
      tickets.push(...ticketChunk);
    } catch (error) {
      console.error("Error sending push notification chunk", error);
    }
  }

  return tickets;
}

module.exports = { sendPushNotification };
