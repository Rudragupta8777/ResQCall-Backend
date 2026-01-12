const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const emergencyRoutes = require("./routes/emergency");
const authRoutes = require("./routes/auth");
const deviceRoutes = require("./routes/device");
const { validateApiKey } = require("./middlewares/auth");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
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

io.on("connection", (socket) => {
  console.log("📱 App connected:", socket.id);

  socket.on("subscribe_to_wearer", (mongoId) => {
    console.log(`Joining Room: ${mongoId}`);
    socket.join(mongoId); 
  });

  socket.on("disconnect", (reason) => {
    console.log(`❌ App disconnected: ${socket.id} (Reason: ${reason})`);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 ResQcall Server running on port ${PORT}`);
});