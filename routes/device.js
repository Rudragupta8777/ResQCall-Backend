const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const { sendBatteryReminder } = require('../services/notification');
const { validateApiKey, validateBody, schemas } = require("../middlewares/auth");

router.use(validateApiKey);

router.post('/pair', validateBody(schemas.pair), async (req, res) => {
    const { deviceId, secretPin, firebaseUid } = req.body;
    try {
        const device = await Device.findOne({ deviceId, secretPin });
        if (!device) return res.status(404).json({ error: "Invalid Device ID or PIN" });
        if (device.owner) return res.status(400).json({ error: "Device already paired" });

        const user = await User.findOne({ firebaseUid });
        if (!user) return res.status(404).json({ error: "User not found" });

        device.owner = user._id;
        user.myWearable = device._id;
        user.role = 'wearer';

        await device.save();
        await user.save();
        res.status(200).json({ message: "ResQcall paired successfully!" });
    } catch (err) {
        res.status(500).json({ error: "Pairing process failed" });
    }
});

router.post('/ping', validateBody(schemas.ping), async (req, res) => {
  const { deviceId, battery } = req.body;

  try {
    const device = await Device.findOne({ deviceId }).populate('owner');
    if (!device) return res.status(404).send("Device not found");

    // Reseting offline status because as we just got a ping
    device.lastHeartbeat = Date.now();
    device.batteryLevel = battery;
    device.isOfflineAlertSent = false; 

    if (device.owner) {
      const now = Date.now();
      const oneHour = 60 * 60 * 1000;
      const shouldNotify = !device.lastBatteryAlertSent || (now - device.lastBatteryAlertSent > oneHour);

      if (shouldNotify) {
        let sent = false;

        // Battery <= 10% (Both)
        if (battery <= 10) {
          const caregivers = await User.find({ "monitoring.wearer": device.owner._id });
          const cgTokens = caregivers.map(c => c.fcmToken).filter(t => t);
          if (cgTokens.length > 0) await sendBatteryReminder(cgTokens, device.owner.name, battery, "caregiver");
          if (device.owner.fcmToken) await sendBatteryReminder([device.owner.fcmToken], "You", battery, "wearer");
          sent = true;
        } 
        // Battery < 20% (Wearer Only)
        else if (battery < 20) {
          if (device.owner.fcmToken) await sendBatteryReminder([device.owner.fcmToken], "You", battery, "wearer");
          sent = true;
        }

        if (sent) device.lastBatteryAlertSent = now;
      }

      // Updating App UI
      const io = req.app.get('socketio');
      io.to(device.owner._id.toString()).emit('device_status', { 
          wearerId: device.owner._id.toString(), battery, status: 'online' 
      });
    }

    await device.save();
    res.status(200).send("Pong");
  } catch (err) {
    res.status(500).send("Internal Error");
  }
});

module.exports = router;