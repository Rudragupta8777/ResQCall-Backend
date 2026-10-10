const express = require('express');
const router = express.Router();
const Device = require('../models/Device');
const User = require('../models/User');
const { sendBatteryReminder } = require('../services/notification');
const { validateApiKey, validateBody, schemas } = require("../middlewares/auth");
const DailyVitals = require('../models/DailyVitals');

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
  const { deviceId, battery, lat, lon, vitals_log } = req.body;

  try {
    const device = await Device.findOne({ deviceId }).populate('owner');
    if (!device) return res.status(404).send("Device not found");

    // Reseting offline status because as we just got a ping
    device.lastHeartbeat = Date.now();
    device.batteryLevel = battery;
    device.isOfflineAlertSent = false; 

    if (lat !== undefined && lon !== undefined) {
      device.lastLocation = { lat, lon, updatedAt: Date.now() };
    }

    let latestBpm = null;

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

      // Process vitals
      if (vitals_log && vitals_log.length > 0) {
        latestBpm = vitals_log[vitals_log.length - 1].bpm;
        const dateString = new Date().toISOString().split('T')[0];
        
        let dailyVitals = await DailyVitals.findOne({ wearerId: device.owner._id, dateString });
        if (!dailyVitals) {
          dailyVitals = new DailyVitals({ wearerId: device.owner._id, dateString, readings: [], criticalEvents: [] });
        }
        
        for (const reading of vitals_log) {
          dailyVitals.readings.push(reading);
          if (reading.bpm < 50) {
            dailyVitals.criticalEvents.push({ status: "bradycardia_low", bpm: reading.bpm, timestamp: reading.timestamp });
          } else if (reading.bpm > 100) {
            dailyVitals.criticalEvents.push({ status: "tachycardia_high", bpm: reading.bpm, timestamp: reading.timestamp });
          }
        }
        
        // Recalculate stats
        if (dailyVitals.readings.length > 0) {
          const bpms = dailyVitals.readings.map(r => r.bpm);
          dailyVitals.stats.minBpm = Math.min(...bpms);
          dailyVitals.stats.maxBpm = Math.max(...bpms);
          dailyVitals.stats.avgBpm = Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length);
        }
        
        await dailyVitals.save();
      }

      // Updating App UI
      const io = req.app.get('socketio');
      const statusPayload = { wearerId: device.owner._id.toString(), battery, status: 'online' };
      if (latestBpm !== null) statusPayload.bpm = latestBpm;
      if (lat !== undefined) {
        statusPayload.lat = lat;
        statusPayload.lon = lon;
      }
      io.to(device.owner._id.toString()).emit('device_status', statusPayload);
    }

    await device.save();
    
    let command = "none";
    if (battery < 15) {
      command = "charge_warning";
    }
    
    res.status(200).json({ status: "success", command });
  } catch (err) {
    console.error("Ping Error:", err);
    res.status(500).json({ error: "Internal Error" });
  }
});

module.exports = router;