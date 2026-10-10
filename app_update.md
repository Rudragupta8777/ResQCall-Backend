# 🚀 Mobile App Update: Clinical Vitals & Location Tracking

The ResQCall backend has been upgraded with clinical-grade health tracking. We are now batching vitals from the wearable and providing high-performance report endpoints for caregivers.

Please review the following API changes to integrate the new features into the Mobile App frontend.

---

## 1. NEW Caregiver Dashboard APIs

All caregiver routes are mounted under `/api/caregiver/*` and require the standard `x-api-key` header.

### 📍 `GET /api/caregiver/location/:wearerId`
Fetches the last known GPS coordinate of the wearer's device.

**Response:**
```json
{
  "location": {
    "lat": 12.9716,
    "lon": 79.1594,
    "updatedAt": "2026-10-10T19:05:00Z"
  },
  "deviceId": "ESP_123"
}
```

### 📊 `GET /api/caregiver/vitals/:wearerId?range=today|week|month`
This is a smart endpoint designed for charting. It behaves differently depending on the `range` requested to ensure the mobile app stays lightning-fast.

#### Scenario A: `?range=today`
Returns the exact, raw data points for the current day. Use this to draw a highly detailed, minute-by-minute line chart for the last 24 hours.
**Response snippet:**
```json
[
  {
    "dateString": "2026-10-10",
    "stats": { "minBpm": 60, "maxBpm": 115, "avgBpm": 75 },
    "criticalEvents": [
       { "status": "tachycardia_high", "bpm": 115, "timestamp": "2026-10-10T14:30:00Z" }
    ],
    "readings": [
       { "bpm": 72, "timestamp": "2026-10-10T19:00:00Z" },
       { "bpm": 75, "timestamp": "2026-10-10T19:02:30Z" }
       // ... hundreds of points
    ]
  }
]
```

#### Scenario B: `?range=week` or `?range=month`
To save bandwidth, the backend completely strips out the massive `readings` array. 
Use the `stats` object to draw a High/Low bar chart (like Apple Health) for each day, and use `criticalEvents` to list exact timestamps of anomalies below the chart.
**Response snippet:**
```json
[
  {
    "dateString": "2026-10-09",
    "stats": { "minBpm": 45, "maxBpm": 85, "avgBpm": 72 },
    "criticalEvents": [
      { "status": "bradycardia_low", "bpm": 45, "timestamp": "2026-10-09T04:12:00Z" }
    ]
    // Notice: "readings" array is intentionally omitted for speed!
  },
  {
    "dateString": "2026-10-10",
    "stats": { "minBpm": 60, "maxBpm": 90, "avgBpm": 75 },
    "criticalEvents": []
  }
]
```

---

## 2. Real-Time Socket.io Updates
The existing `device_status` Socket.io event has been enriched. When a device pings the server, the server will immediately push the new location and latest BPM to any connected caregivers in the wearer's room.

**New Payload structure:**
```json
{
  "wearerId": "651f9a...",
  "status": "online",
  "battery": 42,
  "lat": 12.9716,      // NEW
  "lon": 79.1594,      // NEW
  "bpm": 75            // NEW (The very last reading from the batch)
}
```
