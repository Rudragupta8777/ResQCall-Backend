const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
  },
  name: {
    type: String,
  },
  role: {
    type: String,
    enum: ["wearer", "caregiver"],
    default: "caregiver",
  },
  fcmToken: {
    type: String,
  }, // Token from Android app
  myWearable: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device",
  }, // For Wearer
  monitoring: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  ], // For Caregiver
});

module.exports = mongoose.model("User", userSchema);
