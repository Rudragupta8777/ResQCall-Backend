const express = require('express');
const router = express.Router();
const User = require('../models/User');
const Alert = require('../models/Alert'); 
const admin = require('../config/firebase');

router.post('/sync-user', async (req, res) => {
    const { idToken, fcmToken } = req.body;

    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken, true);
        const { uid, email, name } = decodedToken;

        let user = await User.findOne({ firebaseUid: uid });
        
        if (!user) {
            user = new User({ firebaseUid: uid, email, name, fcmToken });
        } else {
            user.fcmToken = fcmToken;
        }
        await user.save();
        
        const tempUser = await User.findOne({ firebaseUid: uid })
            .populate({
                path: 'monitoring.wearer', 
                populate: { path: 'myWearable' } 
            })
            .populate('myWearable');

        const monitoringWithAlerts = await Promise.all(tempUser.monitoring.map(async (item) => {
            const activeAlert = await Alert.findOne({ 
                wearerId: item.wearer._id, 
                resolved: false 
            }).sort({ timestamp: -1 });

            return {
                wearer: item.wearer,
                nickname: item.nickname,
                activeAlert: activeAlert 
            };
        }));

        // 3. Prepare the final response
        const populatedUser = tempUser.toObject();
        populatedUser.monitoring = monitoringWithAlerts;

        console.log(`User ${user.email} synced with FCM Token: ${user.fcmToken ? 'YES' : 'NO'}`);
        res.status(200).json(populatedUser);

    } catch (err) {
        console.error("Sync Error:", err.message);
        res.status(401).json({ error: "Unauthorized: " + err.message });
    }
});

router.post('/add-caregiver', async (req, res) => {
    const { wearerUid, caregiverUid } = req.body;
    try {
        const wearer = await User.findOne({ firebaseUid: wearerUid });
        const caregiver = await User.findOne({ firebaseUid: caregiverUid });

        if (!wearer || !caregiver) return res.status(404).json({error: "User not found"});

        const alreadyMonitoring = caregiver.monitoring.some(
            (m) => m.wearer.toString() === wearer._id.toString()
        );

        if (!alreadyMonitoring) {
            caregiver.monitoring.push({ 
                wearer: wearer._id, 
                nickname: "" 
            });
            await caregiver.save();
        }
        res.status(200).json({ message: "Linked successfully" });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/update-role', async (req, res) => {
    try {
        const { role, firebaseUid, phoneNumber } = req.body; 
        const updateData = { role: role };
        
        if (phoneNumber) {
            updateData.phoneNumber = phoneNumber;
        }

        const user = await User.findOneAndUpdate(
            { firebaseUid: firebaseUid },
            { $set: updateData },
            { new: true }
        );
        res.status(200).json(user);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

router.post('/rename-wearer', async (req, res) => {
    const { caregiverUid, wearerId, newNickname } = req.body;
    try {
        const caregiver = await User.findOne({ firebaseUid: caregiverUid });
        if (!caregiver) return res.status(404).send("Caregiver not found");

        const entry = caregiver.monitoring.find(m => m.wearer.toString() === wearerId);
        if (entry) {
            entry.nickname = newNickname;
            await caregiver.save();
            res.status(200).json({ message: "Renamed successfully" });
        } else {
            res.status(404).send("Wearer not found in list");
        }
    } catch (err) {
        res.status(500).send(err.message);
    }
});

module.exports = router;