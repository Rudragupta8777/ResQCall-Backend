const admin = require("../config/firebase");

exports.sendFallAlert = async (tokens, wearerName, lat, lon) => {
  const message = {
    notification: {
      title: "🚨 EMERGENCY: Fall Detected!",
      body: `${wearerName} needs help immediately!`,
    },
    data: {
      lat: lat.toString(),
      lon: lon.toString(),
      wearerName: wearerName,
    },
    tokens: tokens,
    android: {
      priority: "high",
      notification: { channel_id: "emergency_channel", sound: "default" },
    },
  };
  return admin.messaging().sendEachForMulticast(message);
};
