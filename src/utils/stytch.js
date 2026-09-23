// src/utils/stytch.js
const STYTCH_PROJECT_ID = process.env.STYTCH_PROJECT_ID;
const STYTCH_SECRET = process.env.STYTCH_SECRET;

if (!STYTCH_PROJECT_ID || !STYTCH_SECRET) {
  throw new Error('STYTCH_PROJECT_ID and STYTCH_SECRET must be set');
}

// LIVE base URL — you're using a project-live-... ID
const STYTCH_BASE_URL = 'https://api.stytch.com';

const authHeader =
  'Basic ' +
  Buffer.from(STYTCH_PROJECT_ID + ':' + STYTCH_SECRET).toString('base64');

// Sends the OTP email via Stytch. Returns an email_id you must store
// and pass back in when verifying the code.
const sendStytchOtp = async function(email) {
  const response = await fetch(
    STYTCH_BASE_URL + '/v1/otps/email/login_or_create',
    {
      method: 'POST',
      headers: {
        Authorization: authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: email }),
    }
  );

  const data = await response.json();

  if (!response.ok) {
    console.error('Stytch send OTP error:', data);
    throw new Error(data.error_message || 'Failed to send verification code');
  }

  return data.email_id;
};

// Verifies the code the user typed in against the given email_id.
const verifyStytchOtp = async function(emailId, code) {
  const response = await fetch(STYTCH_BASE_URL + '/v1/otps/authenticate', {
    method: 'POST',
    headers: {
      Authorization: authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ method_id: emailId, code: code }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('Stytch verify OTP error:', data);
    return false;
  }

  return true;
};

module.exports = { sendStytchOtp, verifyStytchOtp };