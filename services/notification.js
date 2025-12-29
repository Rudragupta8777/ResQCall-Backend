const admin = require("../config/firebase");

exports.sendFallAlert = async (token, displayName, lat, lon, wearerPhone) => {
  const message = {
    token: token,
    data: {
      type: "FALL_DETECTED",
      lat: lat.toString(),
      lon: lon.toString(),
      wearerName: displayName,
      wearerPhone: wearerPhone.toString(), // Add this to the data payload
      title: "🚨 EMERGENCY: Fall Detected!",
      body: `${displayName} needs help immediately!`,
    },
    android: {
      priority: "high",
    },
  };
  return admin.messaging().send(message);
};

// --- NORMAL PRIORITY BATTERY REMINDER ---
exports.sendBatteryReminder = async (tokens, wearerName, level) => {
  const message = {
    notification: {
      title: "🔋 Device Battery Low",
      body: `${wearerName}'s device is at ${level}%. Please charge it soon.`,
    },
    data: {
      type: "BATTERY_LOW",
      level: level.toString(),
    },
    tokens: tokens,
    android: {
      priority: "normal", // Non-emergency, battery-efficient delivery
      notification: { 
        channel_id: "reminder_channel", // App should handle this quietly
        icon: "ic_battery_alert" 
      },
    },
  };
  return admin.messaging().sendEachForMulticast(message);
};