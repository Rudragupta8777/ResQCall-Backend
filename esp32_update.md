# 🚀 ESP32 Firmware Update: Vitals Batching & Location

The ResQCall backend has been upgraded. We are now batching vitals from the MAX30102 sensor and sending GPS coordinates periodically to save battery and reduce HTTP overhead.

Please review the following API changes to integrate the new features into the ESP32 firmware.

---

## `POST /api/device/ping`
The ping payload from the ESP32 must now include the batched vitals and GPS coordinates. This should be sent once every 5 minutes.

**Request Payload:**
```json
{
  "deviceId": "ESP_123",
  "battery": 42,
  "lat": 12.9716,          // NEW (Optional, send if GPS lock acquired)
  "lon": 79.1594,          // NEW (Optional, send if GPS lock acquired)
  "vitals_log": [          // NEW (Optional) array of readings taken over the last 5 mins
    { "bpm": 72, "timestamp": "2026-10-10T19:00:00Z" },
    { "bpm": 75, "timestamp": "2026-10-10T19:02:30Z" }
  ]
}
```

**Response payload:**
The server will now return a `command` attribute that the ESP32 can act upon. For example, you can flash a warning on the OLED if `command` is `"charge_warning"`.
```json
{
  "status": "success",
  "command": "none" // Changes to "charge_warning" if battery < 15%
}
```

---

## `POST /api/emergency/fall`
This endpoint now supports **Store-and-Forward Idempotency**. If the device loses internet connection, you can save the JSON payload to SPIFFS and safely loop retries.

The backend will check the exact `original_timestamp`. If it matches an alert we already recorded, we return a `200 OK` (so you can clear your retry queue) but we will *not* send a duplicate push notification.

**Request Payload:**
```json
{
  "deviceId": "ESP_123",
  "lat": 12.9716,
  "lon": 79.1594,
  "battery": 41,
  "type": "fall_detected",                       // NEW (Optional)
  "original_timestamp": "2026-10-10T19:10:05Z"   // NEW (Optional but highly recommended for retries)
}
```

**Response Payload (Success or Ignored Duplicate):**
```json
{
  "message": "Alert Recorded", // Or "Alert already recorded" if duplicate
  "alertId": "651f9b..."
}
```
