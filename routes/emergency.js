const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const User = require("../models/User");
const Alert = require("../models/Alert"); // Added this
const { sendFallAlert } = require("../services/notification");

router.post("/fall", async (req, res) => {
  const { deviceId, lat, lon, battery } = req.body;

  try {
    const device = await Device.findOne({ deviceId }).populate("owner");
    if (!device || !device.owner)
      return res.status(404).send("Device not mapped to a user");

    // 1. Save to Alert History
    const newAlert = await Alert.create({
      deviceId,
      wearerId: device.owner._id,
      location: { lat, lon },
    });

    // 2. Find caregivers and send FCM
    const caregivers = await User.find({ monitoring: device.owner._id });
    const tokens = caregivers.map((c) => c.fcmToken).filter((t) => t);

    if (tokens.length > 0) {
      await sendFallAlert(tokens, device.owner.name, lat, lon);
    }

    // 3. Update device status
    device.lastHeartbeat = Date.now();
    device.batteryLevel = battery;
    await device.save();

    res
      .status(200)
      .json({ message: "Alert Recorded and Sent", alertId: newAlert._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
