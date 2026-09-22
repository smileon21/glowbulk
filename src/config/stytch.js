// src/config/stytch.js
const stytch = require('stytch');

// =====================================================
// VALIDATE ENV VARS AT STARTUP
// =====================================================

if (!process.env.STYTCH_PROJECT_ID) {
  throw new Error('STYTCH_PROJECT_ID is not set in your .env file');
}

if (!process.env.STYTCH_SECRET) {
  throw new Error('STYTCH_SECRET is not set in your .env file');
}

// =====================================================
// CREATE STYTCH CLIENT
// =====================================================
const client = new stytch.Client({
  project_id: process.env.STYTCH_PROJECT_ID,
  secret: process.env.STYTCH_SECRET,
});

console.log('[Stytch] Client initialized for project:', process.env.STYTCH_PROJECT_ID);

module.exports = client;