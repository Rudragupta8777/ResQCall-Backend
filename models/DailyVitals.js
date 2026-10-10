const mongoose = require("mongoose");

const dailyVitalsSchema = new mongoose.Schema({
  wearerId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  dateString: { type: String, required: true }, // Format: "YYYY-MM-DD"
  
  // Daily Aggregations for fast week/month charts
  stats: {
    minBpm: { type: Number, default: 0 },
    maxBpm: { type: Number, default: 0 },
    avgBpm: { type: Number, default: 0 }
  },

  // Exact anomalies for timeline markers (e.g., Apple Health style)
  criticalEvents: [
    {
      status: { type: String, enum: ["bradycardia_low", "tachycardia_high"] },
      bpm: { type: Number },
      timestamp: { type: Date }
    }
  ],

  // The raw data points for the high-fidelity "Today" chart
  readings: [
    {
      bpm: { type: Number, required: true },
      timestamp: { type: Date, required: true }
    }
  ]
});

// Index to quickly fetch a wearer's vitals for a specific date range
dailyVitalsSchema.index({ wearerId: 1, dateString: 1 }, { unique: true });

module.exports = mongoose.model("DailyVitals", dailyVitalsSchema);
