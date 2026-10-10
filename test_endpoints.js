const mongoose = require('mongoose');
require('dotenv').config();
const DailyVitals = require('./models/DailyVitals');
const Device = require('./models/Device');

const API_KEY = process.env.API_KEY;
const PORT = process.env.PORT || 3000;
const BASE_URL = `http://localhost:${PORT}/api`;

const WEARER_ID = "69d7e13308f14dc797d57238";
const DEVICE_ID = "AB:11:BB:22:CC:33";

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

async function runTest() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log("✅ Connected to DB");

  console.log(`👤 Using Hardcoded Wearer ID: ${WEARER_ID}`);
  console.log(`⌚ Using Hardcoded Device ID: ${DEVICE_ID}`);

  // 1. Existing data is preserved

  // 2. Seed 30 days of rich data
  console.log("🌱 Seeding 30 days of rich vitals data...");
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 30; i >= 1; i--) {
    const currentDay = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
    const dateString = currentDay.toISOString().split('T')[0];
    
    let readings = [];
    let criticalEvents = [];
    
    // Create ~12 readings for the day (every 2 hours)
    for (let j = 0; j < 12; j++) {
      let bpm = randomInt(65, 85); // Normal range
      
      // Add anomalies based on randomness
      const r = Math.random();
      if (r < 0.15) {
        bpm = randomInt(105, 130); // Tachycardia
      } else if (r > 0.85) {
        bpm = randomInt(40, 48); // Bradycardia
      }

      const timestamp = new Date(currentDay.getTime() + j * 2 * 60 * 60 * 1000); 
      
      readings.push({ bpm, timestamp });
      
      if (bpm < 50) {
        criticalEvents.push({ status: "bradycardia_low", bpm, timestamp });
      } else if (bpm > 100) {
        criticalEvents.push({ status: "tachycardia_high", bpm, timestamp });
      }
    }
    
    const bpms = readings.map(r => r.bpm);
    const stats = {
      minBpm: Math.min(...bpms),
      maxBpm: Math.max(...bpms),
      avgBpm: Math.round(bpms.reduce((a, b) => a + b, 0) / bpms.length)
    };

    await DailyVitals.findOneAndUpdate(
      { wearerId: WEARER_ID, dateString },
      { $set: { stats, criticalEvents, readings } },
      { upsert: true }
    );
  }
  console.log("✅ Seeding complete.");

  // 3. Simulate a live Ping for "today" (This hits your actual endpoint!)
  const now = new Date();
  const vitalsLog = [
    { bpm: 72, timestamp: new Date(now.getTime() - 10 * 60000).toISOString() },
    { bpm: 115, timestamp: new Date(now.getTime() - 5 * 60000).toISOString() }, // Tachycardia spike today
    { bpm: 75, timestamp: now.toISOString() }
  ];

  console.log("\n🔄 1. Sending POST /api/device/ping (simulating live device)...");
  const pingRes = await fetch(`${BASE_URL}/device/ping`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
    body: JSON.stringify({
      deviceId: DEVICE_ID,
      battery: 12, // Below 15% to trigger command
      lat: 12.9716,
      lon: 79.1594,
      vitals_log: vitalsLog
    })
  });
  
  const pingData = await pingRes.json();
  console.log("Ping Response:", pingData);

  // 4. Test Caregiver Location Endpoint
  console.log("\n📍 2. Fetching GET /api/caregiver/location/:wearerId...");
  const locRes = await fetch(`${BASE_URL}/caregiver/location/${WEARER_ID}`, {
    headers: { 'x-api-key': API_KEY }
  });
  console.log("Location Response:", await locRes.json());

  // 5. Test Caregiver Vitals Report (Today)
  console.log("\n📈 3. Fetching GET /api/caregiver/vitals/:wearerId?range=today...");
  const vitalsToday = await fetch(`${BASE_URL}/caregiver/vitals/${WEARER_ID}?range=today`, {
    headers: { 'x-api-key': API_KEY }
  });
  const todayData = await vitalsToday.json();
  console.log(`Vitals Today: ${todayData.length} records found.`);
  if (todayData.length > 0) {
     console.log("Today's Stats:", todayData[todayData.length - 1].stats);
     console.log(`Today's Critical Events: ${todayData[todayData.length - 1].criticalEvents.length}`);
     console.log(`Today's Raw Readings: ${todayData[todayData.length - 1].readings.length}`);
  }

  // 6. Test Caregiver Vitals Report (Week)
  console.log("\n📊 4. Fetching GET /api/caregiver/vitals/:wearerId?range=week...");
  const vitalsWeek = await fetch(`${BASE_URL}/caregiver/vitals/${WEARER_ID}?range=week`, {
    headers: { 'x-api-key': API_KEY }
  });
  const weekData = await vitalsWeek.json();
  console.log(`Vitals Week: ${weekData.length} daily records found.`);
  if (weekData.length > 0) {
      console.log(`Sample Day (Notice 'readings' is excluded!):`, JSON.stringify(weekData[weekData.length - 2], null, 2));
  }

  // 7. Test Caregiver Vitals Report (Month)
  console.log("\n📅 5. Fetching GET /api/caregiver/vitals/:wearerId?range=month...");
  const vitalsMonth = await fetch(`${BASE_URL}/caregiver/vitals/${WEARER_ID}?range=month`, {
    headers: { 'x-api-key': API_KEY }
  });
  const monthData = await vitalsMonth.json();
  console.log(`Vitals Month: ${monthData.length} daily records found.`);

  await mongoose.disconnect();
}

runTest().catch(console.error);
