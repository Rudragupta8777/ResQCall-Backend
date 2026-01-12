const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cron = require('node-cron'); 
const connectDB = require("./config/db");
const emergencyRoutes = require("./routes/emergency");
const authRoutes = require("./routes/auth");
const deviceRoutes = require("./routes/device");
const { validateApiKey } = require("./middlewares/auth");


const Device = require('./models/Device');
const Alert = require('./models/Alert');
const User = require('./models/User');
const { sendOfflineAlert } = require('./services/notification');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST", "DELETE"] },
  pingTimeout: 60000,
  pingInterval: 25000,
});

app.use(express.json());
app.use(validateApiKey);

connectDB();
app.set("socketio", io);

app.use("/api/emergency", emergencyRoutes);
app.use("/api/auth", authRoutes);
app.use("/api/device", deviceRoutes);


// Runs every 5 minutes
cron.schedule('*/5 * * * *', async () => {
  const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000);

  const silentDevices = await Device.find({
    lastHeartbeat: { $lt: tenMinsAgo },
    isOfflineAlertSent: false,
    owner: { $ne: null }
  }).populate('owner');

  for (let device of silentDevices) {
    const lastAlert = await Alert.findOne({ wearerId: device.owner._id }).sort({ timestamp: -1 });
    const location = lastAlert ? lastAlert.location : { lat: 0, lon: 0 };

    const caregivers = await User.find({ "monitoring.wearer": device.owner._id });
    const tokens = caregivers.map(c => c.fcmToken).filter(t => t);

    if (tokens.length > 0) {
      await sendOfflineAlert(tokens, device.owner.name, location);
      device.isOfflineAlertSent = true; 
      await device.save();
    }

    io.to(device.owner._id.toString()).emit('device_status', { status: 'offline' });
  }
});

io.on("connection", (socket) => {
  socket.on("subscribe_to_wearer", (mongoId) => { socket.join(mongoId); });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => { console.log(`🚀 ResQcall Server running on port ${PORT}`); });