# ResQcall Backend — API Routes

Express + MongoDB backend for the ResQcall fall-detection/wearable device system. Handles user auth sync (Firebase), caregiver-wearer linking, device pairing/heartbeats, and fall emergency alerts, with Socket.io for real-time push updates.

## Authentication

All routes below (`/api/emergency/*` and `/api/device/*`) require an API key via request header:

```
x-api-key: <API_KEY>
```

Enforced globally in [server.js](server.js) via `validateApiKey` middleware ([middlewares/auth.js](middlewares/auth.js)), and again per-router in [routes/emergency.js](routes/emergency.js) and [routes/device.js](routes/device.js). Requests without a valid key get `403 Access Denied`.

Some routes additionally validate their request body against a Joi schema (`validateBody`) — invalid payloads return `400` with the validation error message.

---

## `/api/auth` — [routes/auth.js](routes/auth.js)

User identity, caregiver↔wearer relationships. Not Joi-validated; relies on Firebase ID token verification.

| Method | Path | Description |
|---|---|---|
| POST | `/sync-user` | Verifies a Firebase `idToken`, creates the `User` if new (or updates their `fcmToken`), then returns the full user profile populated with their `monitoring` list (wearers they watch) and `myWearable` device, each wearer enriched with their latest unresolved `Alert` if any. Called on app login/startup. |
| POST | `/add-caregiver` | Links a caregiver to a wearer by Firebase UID. Adds the wearer to the caregiver's `monitoring` array (no-op if already linked). |
| POST | `/update-role` | Sets a user's `role` (e.g. `wearer`/`caregiver`) and optionally their `phoneNumber`, looked up by `firebaseUid`. |
| POST | `/rename-wearer` | Lets a caregiver set a custom `nickname` for one of the wearers in their `monitoring` list. |
| DELETE | `/remove-wearer` | Removes a wearer from a caregiver's `monitoring` list. |

---

## `/api/emergency` — [routes/emergency.js](routes/emergency.js)

Fall alert lifecycle. All routes require `x-api-key`.

| Method | Path | Description |
|---|---|---|
| POST | `/fall` | **Core emergency endpoint.** Device reports a fall with `deviceId`, `lat`, `lon`, `battery` (validated by `schemas.fall`). Looks up the device's owner, creates an `Alert` record, finds all caregivers monitoring that wearer, and pushes a fall notification (via FCM, `sendFallAlert`) to each caregiver with the wearer's nickname/name, location, and phone number. |
| POST | `/resolve` | Marks an `Alert` as `resolved` (recording `resolvedBy` caregiver), then emits a Socket.io `alert_resolved` event to the room for that wearer so connected caregiver apps update live. |
| GET | `/history/:wearerId` | Returns all alerts for a given wearer, newest first, with `resolvedBy` populated (name/email). |

---

## `/api/device` — [routes/device.js](routes/device.js)

Device pairing and heartbeat/battery monitoring. All routes require `x-api-key`.

| Method | Path | Description |
|---|---|---|
| POST | `/pair` | Pairs a physical device to a user, given `deviceId`, `secretPin`, and `firebaseUid` (validated by `schemas.pair`). Fails if the PIN doesn't match, the device is already paired, or the user doesn't exist. Sets the device's `owner` and the user's `myWearable`, and promotes the user's `role` to `wearer`. |
| POST | `/ping` | Device heartbeat, sent periodically with `deviceId` and `battery` (validated by `schemas.ping`). Updates `lastHeartbeat`, `batteryLevel`, and clears the offline-alert flag. Sends low-battery push notifications (≤10%: wearer + caregivers; <20%: wearer only) at most once per hour. Emits a Socket.io `device_status` (`online`) event to the owner's room for live UI updates. |

---

## Background job — [server.js](server.js)

Not an HTTP route, but part of the same alerting pipeline:

- **Cron job (every 5 minutes)**: Finds devices whose `lastHeartbeat` is older than 10 minutes and that haven't already had an offline alert sent. For each, looks up the wearer's last known location, notifies caregivers (`sendOfflineAlert`), marks `isOfflineAlertSent`, and emits a `device_status` (`offline`) Socket.io event to the wearer's room.

## Real-time events (Socket.io)

Clients connect and join a room per wearer:

```js
socket.emit("subscribe_to_wearer", mongoId);
```

Events the server emits into a wearer's room:

| Event | Emitted when |
|---|---|
| `device_status` | Device pings in (`online`, with battery) or is detected offline by the cron job (`offline`). |
| `alert_resolved` | A caregiver resolves an active fall alert via `/api/emergency/resolve`. |

## Data models

- **[User](models/User.js)** — Firebase-linked account; has a `role` (wearer/caregiver), `fcmToken`, optional `myWearable` device, and a `monitoring` list of wearers (with nicknames) for caregivers.
- **[Device](models/Device.js)** — Physical wearable; has `deviceId`, `secretPin`, `owner`, battery/heartbeat/alert-sent tracking fields.
- **[Alert](models/Alert.js)** — A fall event; has `deviceId`, `wearerId`, `location`, `resolved`/`resolvedBy`, `timestamp`.
