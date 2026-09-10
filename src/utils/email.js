const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'GlowBulk <onboarding@resend.dev>';

const sendOtpEmail = async (to, code) => {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Your GlowBulk verification code',
      html: `
        <div style="font-family: sans-serif; padding: 20px;">
          <h2 style="color: #CC0000;">GlowBulk Verification Code</h2>
          <p>Your verification code is:</p>
          <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${code}</p>
          <p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>
        </div>
      `
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send email: ' + errText);
  }

  return response.json();
};

const generateOtp = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

module.exports = { sendOtpEmail, generateOtp };