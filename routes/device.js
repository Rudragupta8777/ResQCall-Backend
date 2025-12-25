const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');

// PAIRING: Called by Wearer App after scanning QR
router.post('/pair', async (req, res) => {
  const { deviceId, secretPin, firebaseUid } = req.body;

  try {
    const device = await Device.findOne({ deviceId, secretPin });
    if (!device) return res.status(404).json({ error: "Invalid Device ID or PIN" });
    if (device.owner) return res.status(400).json({ error: "Device already paired" });

    const user = await User.findOne({ firebaseUid });
    if (!user) return res.status(404).json({ error: "User not found" });

    // Link device to user and vice versa
    device.owner = user._id;
    user.myWearable = device._id;
    user.role = 'wearer';

    await device.save();
    await user.save();

    res.status(200).json({ message: "ResQcall paired successfully!" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// HEARTBEAT: Called by ESP32 every 2-5 minutes
router.post('/ping', async (req, res) => {
  const { deviceId, battery } = req.body;
  const device = await Device.findOneAndUpdate(
    { deviceId },
    { lastHeartbeat: Date.now(), batteryLevel: battery },
    { new: true }
  );
  
  if (!device) return res.status(404).send("Device not found");
  
  const io = req.app.get('socketio');
  if (device.owner) {
    // We emit to the wearer's ID room so all caregivers listening to this wearer get the update
    io.to(device.owner.toString()).emit('device_status', { 
      status: 'online', 
      battery,
      lastSeen: new Date() 
    });
  }

  res.status(200).send("Pong");
});

module.exports = router;