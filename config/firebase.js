const { initializeApp, cert } = require("firebase-admin/app");

// Use environment variable in production, fall back to local file in development
let serviceAccount;
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
  serviceAccount = require("../serviceAccountKey.json");
}

const app = initializeApp({
  credential: cert(serviceAccount),
});

module.exports = app;
