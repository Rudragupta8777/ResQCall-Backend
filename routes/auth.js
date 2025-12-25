const express = require('express');
const router = express.Router();
const User = require('../models/User');
const admin = require('../config/firebase');

// Register or Sync User (Called on Android login)
router.post('/sync-user', async (req, res) => {
  const { idToken, fcmToken } = req.body; // Receive token from client

  try {
    // 1. Verify the Google ID Token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;

    // 2. Sync with MongoDB
    let user = await User.findOne({ firebaseUid: uid });
    if (!user) {
      user = new User({ firebaseUid: uid, email, name, fcmToken });
    } else {
      user.fcmToken = fcmToken;
    }
    await user.save();
    
    res.status(200).json(user);
  } catch (err) {
    res.status(401).json({ error: "Unauthorized: " + err.message });
  }
});

// ADD CAREGIVER: Called by Family App after scanning Wearer's App QR
router.post('/add-caregiver', async (req, res) => {
  const { wearerUid, caregiverUid } = req.body;

  try {
    const wearer = await User.findOne({ firebaseUid: wearerUid });
    const caregiver = await User.findOne({ firebaseUid: caregiverUid });

    if (!wearer || !caregiver) return res.status(404).send("User not found");

    // Add wearer to caregiver's monitoring list
    if (!caregiver.monitoring.includes(wearer._id)) {
      caregiver.monitoring.push(wearer._id);
      await caregiver.save();
    }

    res.status(200).json({ message: "You are now monitoring " + wearer.name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;