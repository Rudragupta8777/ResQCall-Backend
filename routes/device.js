const express = require('express');
const router = express.Router();
const { validateApiKey, validateBody, schemas } = require("../middlewares/auth");
const Device = require('../models/Device');
const User = require('../models/User');

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
    const device = await Device.findOneAndUpdate(
      { deviceId },
      { lastHeartbeat: Date.now(), batteryLevel: battery },
      { new: true }
    ).populate('owner');
    
    if (!device) return res.status(404).send("Device not found");

    if (battery < 20 && device.owner) {
      const caregivers = await User.find({ monitoring: device.owner._id });
      const tokens = caregivers.map(c => c.fcmToken).filter(t => t);

      if (tokens.length > 0) {
        await sendBatteryReminder(tokens, device.owner.name, battery);
      }
    }

    const io = req.app.get('socketio');
    if (device.owner) {
        io.to(device.owner._id.toString()).emit('device_status', { 
            wearerId: device.owner._id.toString(), 
            battery: battery,
            status: 'online'
        });
    }

    res.status(200).send("Pong");
  } catch (err) {
    console.error("Ping Error:", err);
    res.status(500).send("Internal Error");
  }
});

module.exports = router;