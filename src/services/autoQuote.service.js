const { findNearestPricedSite } = require('../models/sitePrice.model');
const { createQuotation } = require('../models/quotation.model');
const { updateFuelRequestStatus } = require('../models/fuelRequest.model');
const { notifyCustomer } = require('./notification.service');

// Same validity as manual quotations
const QUOTE_VALIDITY_HOURS = 24;

const generateQuotationNumber = () => {
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  return `Q-${ymd}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
};

/**
 * Try to create a quotation automatically for a new fuel request.
 * Only called for customers who do NOT get discounts (see fuelRequest.routes.js).
 *
 * 1. Takes the customer's delivery pin.
 * 2. Finds a site that has a price today for that fuel and belongs to a city zone
 *    whose radius (measured from the CITY CENTRE) covers the pin. The nearest such
 *    site is used; sites without a price today are skipped.
 * 3. Creates a 'sent' quotation at that price.
 *
 * Returns { quotation, site } or null. null means "do it the old way": no pin,
 * no priced site covers the customer, or marketing has not set today's price.
 * The fuel request then stays 'pending' for marketing.
 */
const tryAutoQuote = async (fuelRequest, { latitude, longitude }) => {
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;

  const site = await findNearestPricedSite(lat, lng, fuelRequest.fuel_type);
  if (!site) return null;

  const listPrice = Number(site.unit_price);
  if (!(listPrice > 0)) return null; // never auto-send a zero or negative price

  const quantity = parseFloat(fuelRequest.quantity) || 0;
  const totalAmount = Math.round(quantity * listPrice * 100) / 100;

  const quotation = await createQuotation({
    fuelRequestId: fuelRequest.id,
    customerId: fuelRequest.customer_id,
    quotationNumber: generateQuotationNumber(),
    fuelType: fuelRequest.fuel_type,
    quantity: fuelRequest.quantity,
    unit: fuelRequest.unit,
    unitPrice: listPrice,
    listPricePerLitre: listPrice,
    discountCentsPerLitre: 0,
    totalAmount,
    validUntil: new Date(Date.now() + QUOTE_VALIDITY_HOURS * 3600000).toISOString().slice(0, 10),
    deliveryTerms: undefined,
    paymentTerms: undefined,
    createdBy: null,                // created by the system, no staff account
    preparedBy: site.prepared_by,   // the marketing person who set today's price
    notes: `Automatic quotation using today's price at ${site.name} (${site.city}), ${site.distance_km.toFixed(1)} km from the delivery location.`,
    status: 'sent'
  });

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