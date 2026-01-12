const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const User = require("../models/User");
const Alert = require("../models/Alert"); 
const { sendFallAlert } = require("../services/notification");
const { validateApiKey, validateBody, schemas } = require("../middlewares/auth");

router.use(validateApiKey);

router.post("/fall", validateBody(schemas.fall), async (req, res) => {
    const { deviceId, lat, lon, battery } = req.body;

    try {
        const device = await Device.findOne({ deviceId }).populate("owner");
        if (!device || !device.owner) return res.status(404).json({ error: "Device not mapped" });

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

        res.status(200).json({ message: "Alert Recorded", alertId: newAlert._id });
    } catch (err) {
        res.status(500).json({ error: "Server Error during fall processing" });
    }
});

router.post("/resolve", async (req, res) => {
    const { alertId, caregiverId } = req.body; 
    try {
        const alert = await Alert.findByIdAndUpdate(
            alertId,
            { resolved: true, resolvedBy: caregiverId },
            { new: true }
        );

        if (!alert) return res.status(404).send("Alert not found");

        const io = req.app.get('socketio');
        io.to(alert.wearerId.toString()).emit('alert_resolved', { wearerId: alert.wearerId });

        res.status(200).json({ message: "Alert resolved successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;