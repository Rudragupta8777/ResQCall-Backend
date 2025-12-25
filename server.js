const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const connectDB = require('./config/db');
const emergencyRoutes = require('./routes/emergency');
const authRoutes = require('./routes/auth');
const deviceRoutes = require('./routes/device');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.json());
connectDB();

// Emergency Routes
app.use('/api/emergency', emergencyRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/device', deviceRoutes);

// Socket.io for Live Status
io.on('connection', (socket) => {
  console.log('App connected:', socket.id);
  
  socket.on('subscribe_to_wearer', (wearerId) => {
    socket.join(wearerId);
  });
});

// Middleware to inject io for routes if needed
app.set('socketio', io);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 ResQcall Server on port ${PORT}`));