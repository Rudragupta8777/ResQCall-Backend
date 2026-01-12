const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
    unique: true,
  },
  secretPin: {
    type: String,
    required: true,
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  lastHeartbeat: {
    type: Date,
    default: Date.now,
  },
  batteryLevel: {
    type: Number,
    default: 0,
  },
  lastBatteryAlertSent: {
    type: Date,
    default: null,
  },
  isOfflineAlertSent: {
    type: Boolean,
    default: false,
  },
});
module.exports = mongoose.model("Device", deviceSchema);
