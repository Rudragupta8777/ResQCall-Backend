const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const User = require("../models/User");
const Alert = require("../models/Alert"); 
const { sendFallAlert } = require("../services/notification");

router.post("/fall", async (req, res) => {
    const { deviceId, lat, lon, battery } = req.body;

    try {
        const device = await Device.findOne({ deviceId }).populate("owner");
        if (!device || !device.owner) return res.status(404).send("Device not mapped");

        const wearerPhone = device.owner.phoneNumber || ""; 

        const newAlert = new Alert({
            deviceId,
            wearerId: device.owner._id,
            location: { lat, lon }
        });
        await newAlert.save();

        const caregivers = await User.find({ "monitoring.wearer": device.owner._id });

        const notificationPromises = caregivers.map(async (caregiver) => {
            if (!caregiver.fcmToken) return;

            const monitoringEntry = caregiver.monitoring.find(
                (m) => m.wearer.toString() === device.owner._id.toString()
            );
            
            const displayName = (monitoringEntry && monitoringEntry.nickname) 
                                ? monitoringEntry.nickname 
                                : device.owner.name;

            return sendFallAlert(caregiver.fcmToken, displayName, lat, lon, wearerPhone);
        });

        await Promise.all(notificationPromises);

        res.status(200).json({ message: "Alert Recorded and Sent", alertId: newAlert._id });
    } catch (err) {
        console.error("Database Error:", err);
        res.status(500).json({ error: err.message });
    }
});

router.post("/resolve", async (req, res) => {
    const { alertId } = req.body;
    try {
        // Update the alert status
        const alert = await Alert.findByIdAndUpdate(
            alertId,
            { resolved: true },
            { new: true }
        );

        if (!alert) return res.status(404).send("Alert not found");

        // IMPORTANT: Tell all connected apps to "shrink" the card via Socket
        const io = req.app.get('socketio');
        io.emit('alert_resolved', { wearerId: alert.wearerId });

        res.status(200).json({ message: "Alert resolved successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
