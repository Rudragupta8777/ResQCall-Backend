const mongoose = require("mongoose");

const alertSchema = new mongoose.Schema({
  deviceId: {
    type: String,
    required: true,
  },
  wearerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
  location: {
    lat: {
      type: Number,
      required: true,
    },
    lon: {
      type: Number,
      required: true,
    },
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  resolved: {
    type: Boolean,
    default: false,
  }, 
  resolvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
  },
});

module.exports = mongoose.model("Alert", alertSchema);
