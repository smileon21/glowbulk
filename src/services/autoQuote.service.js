const pool = require('../config/database');
const { findNearestPricedSite } = require('../models/sitePrice.model');
const { createQuotation } = require('../models/quotation.model');
const { updateFuelRequestStatus } = require('../models/fuelRequest.model');
const { notifyCustomer } = require('./notification.service');

const QUOTE_VALIDITY_HOURS = 72;

const generateQuotationNumber = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `Q-${ymd}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
};

/**
 * Try to create a quotation automatically for a new fuel request.
 *
 * 1. Takes the customer's delivery pin.
 * 2. Finds the nearest site that has a price today for that fuel AND whose city
 *    radius covers the pin (sites without a price today are skipped).
 * 3. Applies the customer's own discount (customers.discount_cents_per_litre).
 * 4. Creates a 'sent' quotation.
 *
 * Returns { quotation, site } or null. null means "do it the old way": no pin,
 * no priced site covers the customer, or marketing has not set today's price.
 * The fuel request then stays 'pending' for marketing, same as out-of-zone customers.
 */
const tryAutoQuote = async (fuelRequest, { latitude, longitude }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const site = await findNearestPricedSite(lat, lng, fuelRequest.fuel_type);
  if (!site) return null;

  // The customer's agreed discount, in cents per litre
  const cust = await pool.query(
    'SELECT discount_cents_per_litre FROM customers WHERE id = $1',
    [fuelRequest.customer_id]
  );
  const discountCents = Number(cust.rows[0]?.discount_cents_per_litre) || 0;

  const listPrice = Number(site.unit_price);
  const unitPrice = Number((listPrice - discountCents / 100).toFixed(4));
  if (!(unitPrice > 0)) return null; // never auto-send a zero or negative price

  const quantity = parseFloat(fuelRequest.quantity) || 0;

  const quotation = await createQuotation({
    fuelRequestId: fuelRequest.id,
    customerId: fuelRequest.customer_id,
    quotationNumber: generateQuotationNumber(),
    fuelType: fuelRequest.fuel_type,
    quantity: fuelRequest.quantity,
    unit: fuelRequest.unit,
    unitPrice,
    totalAmount: quantity * unitPrice,
    validUntil: new Date(Date.now() + QUOTE_VALIDITY_HOURS * 3600000).toISOString().slice(0, 10),
    deliveryTerms: undefined,
    paymentTerms: undefined,
    createdBy: null,                // created by the system, no staff account
    preparedBy: site.prepared_by,   // the marketing person who set today's price
    notes: `Automatic quotation using today's price at ${site.name} (${site.city}), ${site.distance_km.toFixed(1)} km from the delivery location.`,
    status: 'sent'
  });

  // createQuotation does not store these two, so record them for reports
  await pool.query(
    `UPDATE quotations
        SET list_price_per_litre = $1, discount_cents_per_litre = $2
      WHERE id = $3`,
    [listPrice, discountCents, quotation.id]
  );
  quotation.list_price_per_litre = listPrice;
  quotation.discount_cents_per_litre = discountCents;

  await updateFuelRequestStatus(fuelRequest.id, 'quoted');

  notifyCustomer(quotation.customer_id, {
    type: 'quotation_ready',
    title: 'New response from Glow Petroleum',
    message: `Your quotation ${quotation.quotation_number} is ready. It is valid for ${QUOTE_VALIDITY_HOURS} hours.`,
    link: '/quotations'
  }).catch((err) => console.error('Auto quotation notification failed:', err));

  return { quotation, site };
};

module.exports = { tryAutoQuote };