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
  phoneNumber: {
    type: String,
    default: ""
  },
  role: {
    type: String,
    enum: ["wearer", "caregiver"],
    default: null,
  },
  fcmToken: {
    type: String,
  },
  myWearable: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Device",
  }, // For Wearer
  monitoring: [
    {
      wearer: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      nickname: { type: String, default: "" } // "Dad", "Mom", etc.
    },
  ], // For Caregiver
});

module.exports = mongoose.model("User", userSchema);
