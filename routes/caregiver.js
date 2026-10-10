const express = require("express");
const router = express.Router();
const Device = require("../models/Device");
const DailyVitals = require("../models/DailyVitals");
const { validateApiKey } = require("../middlewares/auth");

router.use(validateApiKey);

// 1. Live Location Endpoint
router.get("/location/:wearerId", async (req, res) => {
    try {
        const { wearerId } = req.params;
        const device = await Device.findOne({ owner: wearerId });
        
        if (!device) {
            return res.status(404).json({ error: "Device not found for this wearer" });
        }
        
        if (!device.lastLocation || !device.lastLocation.lat) {
             return res.status(404).json({ error: "Location data not available" });
        }

        res.status(200).json({ 
            location: device.lastLocation,
            deviceId: device.deviceId 
        });
    } catch (err) {
        console.error("Location Fetch Error:", err);
        res.status(500).json({ error: "Failed to fetch location" });
    }
});

// 2. Clinical Vitals Report Endpoint
router.get("/vitals/:wearerId", async (req, res) => {
    try {
        const { wearerId } = req.params;
        const range = req.query.range || "today"; // "today", "week", "month"
        
        let startDate = new Date();
        if (range === "week") {
            startDate.setDate(startDate.getDate() - 7);
        } else if (range === "month") {
            startDate.setMonth(startDate.getMonth() - 1);
        } else {
            // today
            startDate.setHours(0, 0, 0, 0);
        }
        
        // Convert to YYYY-MM-DD
        const dateStringQuery = startDate.toISOString().split('T')[0];
        
        const query = {
            wearerId: wearerId,
            dateString: { $gte: dateStringQuery }
        };
        
        let projection = "";
        // For longer ranges, we strip out the raw readings array to keep the payload fast and small.
        if (range === "week" || range === "month") {
            projection = "-readings"; 
        }
        
        const reports = await DailyVitals.find(query).select(projection).sort({ dateString: 1 });
        
        res.status(200).json(reports);
        
    } catch (err) {
        console.error("Vitals Report Error:", err);
        res.status(500).json({ error: "Failed to fetch vitals report" });
    }
});

module.exports = router;
