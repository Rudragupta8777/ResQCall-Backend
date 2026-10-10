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
