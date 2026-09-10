const { getAllAdminEmails } = require('../models/user.model');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const FROM_EMAIL = process.env.EMAIL_FROM || 'GlowBulk <onboarding@resend.dev>';

// =====================================================
// HELPER — Get all active admin emails
// =====================================================

const getAdminRecipients = async function() {
  try {
    const admins = await getAllAdminEmails();
    const emails = admins.map(function(admin) { return admin.email; });

    if (emails.length === 0 && process.env.ADMIN_EMAIL) {
      return [process.env.ADMIN_EMAIL];
    }

    return emails;
  } catch (error) {
    console.error('Error fetching admin emails:', error);
    return process.env.ADMIN_EMAIL ? [process.env.ADMIN_EMAIL] : [];
  }
};

// =====================================================
// OTP EMAIL
// =====================================================

const sendOtpEmail = async function(to, code) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Your GlowBulk verification code',
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #CC0000;">GlowBulk Verification Code</h2>' +
        '<p>Your verification code is:</p>' +
        '<p style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">' + code + '</p>' +
        '<p>This code expires in 5 minutes. If you did not request this, you can ignore this email.</p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send email: ' + errText);
  }
  return response.json();
};

// =====================================================
// PASSWORD RESET EMAIL
// =====================================================

const sendPasswordResetEmail = async function(to, resetLink) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [to],
      subject: 'Reset your GlowBulk password',
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #CC0000;">Reset Your Password</h2>' +
        '<p>We received a request to reset your GlowBulk password.</p>' +
        '<p>Click the button below to create a new password. This link expires in 1 hour.</p>' +
        '<p><a href="' + resetLink + '" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">Reset Password</a></p>' +
        '<p>If you did not request this, you can ignore this email.</p>' +
        '<p style="color: #6b7280; font-size: 12px;">This link expires in 1 hour.</p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send email: ' + errText);
  }
  return response.json();
};

// =====================================================
// OTP GENERATOR
// =====================================================

const generateOtp = function() {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// =====================================================
// FUEL REQUEST — Notify all admins
// =====================================================

const sendNewFuelRequestEmailToAdmin = async function(request, customer) {
  const adminEmails = await getAdminRecipients();
  if (adminEmails.length === 0) {
    console.log('No admin emails to notify');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: adminEmails,
      subject: 'New Fuel Request - ' + request.fuel_type,
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #CC0000;">New Fuel Request Received</h2>' +
        '<p><strong>Customer:</strong> ' + (customer.company_name || (customer.first_name + ' ' + customer.last_name)) + '</p>' +
        '<p><strong>Contact:</strong> ' + (customer.contact_person_email || customer.email) + '</p>' +
        '<p><strong>Fuel Type:</strong> ' + request.fuel_type + '</p>' +
        '<p><strong>Quantity:</strong> ' + request.quantity + ' ' + request.unit + '</p>' +
        '<p><strong>Priority:</strong> ' + request.priority + '</p>' +
        '<p><strong>Delivery Address:</strong> ' + (request.delivery_address || 'Not specified') + '</p>' +
        '<p><a href="' + (process.env.FRONTEND_URL || 'https://glowbulk.vercel.app') + '/fuel-requests" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">Review Request</a></p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send fuel request email: ' + errText);
  }
  return response.json();
};

// =====================================================
// QUOTATION — Notify customer
// =====================================================

const sendQuotationEmailToCustomer = async function(quotation, customer) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [customer.contact_person_email || customer.email],
      subject: 'New Quotation ' + quotation.quotation_number + ' - GlowBulk',
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #CC0000;">Your Quotation is Ready</h2>' +
        '<p>Dear ' + (customer.contact_person_name || customer.first_name) + ',</p>' +
        '<p>We have prepared a quotation for your fuel request. Please review the details below:</p>' +
        '<table style="border-collapse: collapse; width: 100%; max-width: 500px;">' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quotation Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + quotation.quotation_number + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Fuel Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + quotation.fuel_type + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quantity:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + quotation.quantity + ' ' + quotation.unit + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Unit Price:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$' + parseFloat(quotation.unit_price).toFixed(2) + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Subtotal:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$' + parseFloat(quotation.subtotal || quotation.total_amount).toFixed(2) + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Tax:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">$' + parseFloat(quotation.tax_amount || 0).toFixed(2) + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 2px solid #CC0000;"><strong style="color: #CC0000;">Grand Total:</strong></td><td style="padding: 8px; border-bottom: 2px solid #CC0000; color: #CC0000; font-weight: bold; font-size: 18px;">$' + parseFloat(quotation.grand_total).toFixed(2) + '</td></tr>' +
        '</table>' +
        '<p style="margin-top: 20px;"><strong>Valid Until:</strong> ' + new Date(quotation.valid_until).toLocaleDateString() + '</p>' +
        '<p><a href="' + (process.env.FRONTEND_URL || 'https://glowbulk.vercel.app') + '/quotations" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">View & Accept Quotation</a></p>' +
        '<p style="color: #6b7280; font-size: 12px;">Log in to your GlowBulk account to accept or reject this quotation.</p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send quotation email: ' + errText);
  }
  return response.json();
};

// =====================================================
// QUOTATION RESPONSE — Notify all admins
// =====================================================

const sendQuotationResponseEmailToAdmin = async function(quotation, customer, accepted) {
  const adminEmails = await getAdminRecipients();
  if (adminEmails.length === 0) {
    console.log('No admin emails to notify');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: adminEmails,
      subject: 'Quotation ' + quotation.quotation_number + ' has been ' + (accepted ? 'ACCEPTED' : 'REJECTED'),
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: ' + (accepted ? '#2f7a3f' : '#CC0000') + ';">Quotation ' + (accepted ? 'Accepted' : 'Rejected') + '</h2>' +
        '<p><strong>Customer:</strong> ' + (customer.company_name || (customer.first_name + ' ' + customer.last_name)) + '</p>' +
        '<p><strong>Quotation Number:</strong> ' + quotation.quotation_number + '</p>' +
        '<p><strong>Fuel Type:</strong> ' + quotation.fuel_type + '</p>' +
        '<p><strong>Grand Total:</strong> $' + parseFloat(quotation.grand_total).toFixed(2) + '</p>' +
        '<p><a href="' + (process.env.FRONTEND_URL || 'https://glowbulk.vercel.app') + '/quotations" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">View in Dashboard</a></p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send quotation response email: ' + errText);
  }
  return response.json();
};

// =====================================================
// NEW ORDER — Notify all admins
// =====================================================

const sendNewOrderEmailToAdmin = async function(order, customer) {
  const adminEmails = await getAdminRecipients();
  if (adminEmails.length === 0) {
    console.log('No admin emails to notify');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: adminEmails,
      subject: 'New Order ' + order.order_number + ' - GlowBulk',
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #CC0000;">New Order Created</h2>' +
        '<p><strong>Order Number:</strong> ' + order.order_number + '</p>' +
        '<p><strong>Customer:</strong> ' + (customer.company_name || (customer.first_name + ' ' + customer.last_name)) + '</p>' +
        '<p><strong>Fuel Type:</strong> ' + order.fuel_type + '</p>' +
        '<p><strong>Quantity:</strong> ' + order.quantity + ' ' + order.unit + '</p>' +
        '<p><strong>Grand Total:</strong> $' + parseFloat(order.grand_total).toFixed(2) + '</p>' +
        '<p><strong>Status:</strong> ' + order.status + '</p>' +
        '<p><a href="' + (process.env.FRONTEND_URL || 'https://glowbulk.vercel.app') + '/orders" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">View Order</a></p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send order email: ' + errText);
  }
  return response.json();
};

// =====================================================
// ORDER CONFIRMATION — Notify customer
// =====================================================

const sendOrderConfirmationEmailToCustomer = async function(order, customer) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [customer.contact_person_email || customer.email],
      subject: 'Order ' + order.order_number + ' Confirmed - GlowBulk',
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #CC0000;">Order Confirmed</h2>' +
        '<p>Dear ' + (customer.contact_person_name || customer.first_name) + ',</p>' +
        '<p>Your order has been created successfully. Please complete payment to proceed.</p>' +
        '<table style="border-collapse: collapse; width: 100%; max-width: 500px;">' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Order Number:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + order.order_number + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Fuel Type:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + order.fuel_type + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 1px solid #eee;"><strong>Quantity:</strong></td><td style="padding: 8px; border-bottom: 1px solid #eee;">' + order.quantity + ' ' + order.unit + '</td></tr>' +
        '<tr><td style="padding: 8px; border-bottom: 2px solid #CC0000;"><strong style="color: #CC0000;">Amount Due:</strong></td><td style="padding: 8px; border-bottom: 2px solid #CC0000; color: #CC0000; font-weight: bold; font-size: 18px;">$' + parseFloat(order.grand_total).toFixed(2) + '</td></tr>' +
        '</table>' +
        '<p style="margin-top: 20px;"><strong>Next Steps:</strong></p>' +
        '<ol><li>Make payment via your usual company channel</li><li>Upload proof of payment in your GlowBulk account</li><li>Wait for our team to verify your payment</li></ol>' +
        '<p><a href="' + (process.env.FRONTEND_URL || 'https://glowbulk.vercel.app') + '/orders" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">View Order & Upload Proof</a></p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send order confirmation email: ' + errText);
  }
  return response.json();
};

// =====================================================
// PAYMENT PROOF — Notify all admins
// =====================================================

const sendPaymentProofEmailToAdmin = async function(order, customer) {
  const adminEmails = await getAdminRecipients();
  if (adminEmails.length === 0) {
    console.log('No admin emails to notify');
    return;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: adminEmails,
      subject: 'Payment Proof Uploaded - ' + order.order_number,
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #E8A33D;">Payment Proof Uploaded</h2>' +
        '<p><strong>Order Number:</strong> ' + order.order_number + '</p>' +
        '<p><strong>Customer:</strong> ' + (customer.company_name || (customer.first_name + ' ' + customer.last_name)) + '</p>' +
        '<p><strong>Amount:</strong> $' + parseFloat(order.grand_total).toFixed(2) + '</p>' +
        '<p>A customer has uploaded proof of payment. Please verify the payment in your company records and confirm it in the system.</p>' +
        '<p><a href="' + (process.env.FRONTEND_URL || 'https://glowbulk.vercel.app') + '/orders" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">Verify Payment</a></p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send payment proof email: ' + errText);
  }
  return response.json();
};

// =====================================================
// PAYMENT CONFIRMED — Notify customer
// =====================================================

const sendPaymentConfirmedEmailToCustomer = async function(order, customer) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [customer.contact_person_email || customer.email],
      subject: 'Payment Confirmed - Order ' + order.order_number,
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #2f7a3f;">Payment Confirmed</h2>' +
        '<p>Dear ' + (customer.contact_person_name || customer.first_name) + ',</p>' +
        '<p>Great news! Your payment has been verified and your order is now being processed.</p>' +
        '<p><strong>Order Number:</strong> ' + order.order_number + '</p>' +
        '<p><strong>Amount:</strong> $' + parseFloat(order.grand_total).toFixed(2) + '</p>' +
        '<p><strong>Status:</strong> Processing</p>' +
        '<p>We will notify you once your order is completed.</p>' +
        '<p><a href="' + (process.env.FRONTEND_URL || 'https://glowbulk.vercel.app') + '/orders" style="display: inline-block; background: #CC0000; color: white; padding: 12px 30px; border-radius: 5px; text-decoration: none; font-weight: bold;">View Order</a></p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send payment confirmed email: ' + errText);
  }
  return response.json();
};

// =====================================================
// ORDER COMPLETED — Notify customer
// =====================================================

const sendOrderCompletedEmailToCustomer = async function(order, customer) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [customer.contact_person_email || customer.email],
      subject: 'Order Completed - ' + order.order_number,
      html: '<div style="font-family: sans-serif; padding: 20px;">' +
        '<h2 style="color: #2f7a3f;">Order Completed</h2>' +
        '<p>Dear ' + (customer.contact_person_name || customer.first_name) + ',</p>' +
        '<p>Your order has been completed. Thank you for choosing GlowBulk!</p>' +
        '<p><strong>Order Number:</strong> ' + order.order_number + '</p>' +
        '<p><strong>Fuel Type:</strong> ' + order.fuel_type + '</p>' +
        '<p><strong>Quantity:</strong> ' + order.quantity + ' ' + order.unit + '</p>' +
        '<p>We hope to serve you again soon.</p>' +
        '<p style="margin-top: 20px;"><em>GlowBulk - We Go Further...</em></p>' +
        '</div>'
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error('Failed to send order completed email: ' + errText);
  }
  return response.json();
};

module.exports = {
  sendOtpEmail,
  generateOtp,
  sendPasswordResetEmail,
  sendNewFuelRequestEmailToAdmin,
  sendQuotationEmailToCustomer,
  sendQuotationResponseEmailToAdmin,
  sendNewOrderEmailToAdmin,
  sendOrderConfirmationEmailToCustomer,
  sendPaymentProofEmailToAdmin,
  sendPaymentConfirmedEmailToCustomer,
  sendOrderCompletedEmailToCustomer
};