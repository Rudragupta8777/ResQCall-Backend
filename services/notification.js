require("../config/firebase");
const { getMessaging } = require("firebase-admin/messaging");

exports.sendFallAlert = async (token, displayName, lat, lon, wearerPhone) => {
  const message = {
    token: token,
    data: {
      type: "FALL_DETECTED",
      lat: lat.toString(),
      lon: lon.toString(),
      wearerName: displayName,
      wearerPhone: wearerPhone.toString(), 
      title: "🚨 EMERGENCY: Fall Detected!",
      body: `${displayName} needs help immediately!`,
    },
    android: {
      priority: "high",
    },
  };
  return getMessaging().send(message);
};

// Handle Battery Alerts 
exports.sendBatteryReminder = async (tokens, wearerName, level, target) => {
  const isWearer = target === "wearer";
  const message = {
    notification: {
      title: isWearer ? "🔋 Charge Your Device" : "🔋 Wearable Battery Low",
      body: isWearer 
        ? `Your ResQcall is at ${level}%. Please plug it in now.` 
        : `${wearerName}'s device is at ${level}%. Please remind them to charge it.`,
    },
    data: { type: "BATTERY_LOW", level: level.toString() },
    tokens: tokens,
  };
  return getMessaging().sendEachForMulticast(message);
};

// Handle Offline Alert
exports.sendOfflineAlert = async (tokens, wearerName, lastLocation) => {
  const mapLink = `https://www.google.com/maps?q=${lastLocation.lat},${lastLocation.lon}`;
  const message = {
    notification: {
      title: "⚠️ Device Offline",
      body: `${wearerName}'s ResQcall has lost connection. Last seen at: ${mapLink}`,
    },
    data: { 
      type: "DEVICE_OFFLINE", 
      lat: lastLocation.lat.toString(), 
      lon: lastLocation.lon.toString() 
    },
    tokens: tokens,
  };
  return getMessaging().sendEachForMulticast(message);
};