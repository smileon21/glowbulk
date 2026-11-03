const express = require('express');
const router = express.Router();
const { body, query, param, validationResult } = require('express-validator');

const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logActivity } = require('../utils/activityLog');
const {
  FUEL_TYPES,
  listTodayPrices,
  saveTodayPrices,
  listPriceHistory,
  deleteTodayPrice
} = require('../models/sitePrice.model');

const STAFF = ['marketing', 'pricing', 'finance', 'admin'];

const firstError = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  return true;
};

// Today's prices for every active site (null = not set yet)
router.get('/today', authenticate, authorize(...STAFF), async (req, res) => {
  try {
    return res.json({ success: true, data: await listTodayPrices() });
  } catch (error) {
    console.error('LIST TODAY PRICES ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error fetching today\'s prices' });
  }
});

// Marketing: set or correct today's prices (one or many sites at once)
router.put(
  '/today',
  authenticate,
  authorize('marketing'),
  [
    body('preparedBy')
      .trim()
      .notEmpty().withMessage('Please enter the name of the person setting these prices')
      .isLength({ max: 100 }).withMessage('Name must be 100 characters or less'),
    body('prices').isArray({ min: 1, max: 200 }).withMessage('Send at least one price'),
    body('prices.*.siteId').isInt({ gt: 0 }).withMessage('Each price needs a site'),
    body('prices.*.fuelType').isIn(FUEL_TYPES).withMessage('Fuel type must be diesel or petrol'),
    body('prices.*.unitPrice').isFloat({ gt: 0 }).withMessage('Each price must be greater than 0')
  ],
  async (req, res) => {
    try {
      if (firstError(req, res)) return;

      const prices = req.body.prices.map((p) => ({
        siteId: Number(p.siteId),
        fuelType: p.fuelType,
        unitPrice: Number(p.unitPrice)
      }));

      const saved = await saveTodayPrices(prices, {
        preparedBy: req.body.preparedBy.trim(),
        setBy: req.user.id
      });

      await logActivity({
        actor: req.user,
        action: 'DAILY_PRICES_SET',
        targetType: 'site_price',
        targetId: null,
        newValues: saved,
        details: `${req.body.preparedBy.trim()} set ${saved.length} price(s) for today`,
        ip: req.ip
      });

      return res.json({ success: true, message: `${saved.length} price(s) saved`, data: saved });
    } catch (error) {
      if (error.code === '23503') {
        return res.status(400).json({ success: false, message: 'One of the sites does not exist' });
      }
      console.error('SAVE TODAY PRICES ERROR:', error);
      return res.status(500).json({ success: false, message: 'Error saving prices' });
    }
  }
);

// Marketing: remove a price entered by mistake (today's row only, always logged)
// DELETE /api/site-prices/today/12/diesel?preparedBy=Tendai
router.delete(
  '/today/:siteId/:fuelType',
  authenticate,
  authorize('marketing'),
  [
    param('siteId').isInt({ gt: 0 }).withMessage('Invalid site'),
    param('fuelType').isIn(FUEL_TYPES).withMessage('Fuel type must be diesel or petrol'),
    query('preparedBy')
      .trim()
      .notEmpty().withMessage('Please enter your name before removing a price')
      .isLength({ max: 100 }).withMessage('Name must be 100 characters or less')
  ],
  async (req, res) => {
    try {
      if (firstError(req, res)) return;

      const removed = await deleteTodayPrice(Number(req.params.siteId), req.params.fuelType);
      if (!removed) {
        return res.status(404).json({ success: false, message: 'No price was set for this site today' });
      }

      await logActivity({
        actor: req.user,
        action: 'DAILY_PRICE_REMOVED',
        targetType: 'site_price',
        targetId: removed.id,
        oldValues: removed,
        details: `${req.query.preparedBy.trim()} removed today's ${removed.fuel_type} price (${removed.unit_price}) for site ${removed.site_id}`,
        ip: req.ip
      });

      return res.json({ success: true, message: 'Price removed', data: removed });
    } catch (error) {
      console.error('REMOVE TODAY PRICE ERROR:', error);
      return res.status(500).json({ success: false, message: 'Error removing price' });
    }
  }
);

// Audit / reports: price history
router.get(
  '/history',
  authenticate,
  authorize(...STAFF),
  [
    query('from').optional().isISO8601().withMessage('from must be a date'),
    query('to').optional().isISO8601().withMessage('to must be a date')
  ],
  async (req, res) => {
    try {
      if (firstError(req, res)) return;
      const data = await listPriceHistory({
        from: req.query.from,
        to: req.query.to,
        siteId: req.query.siteId,
        fuelType: req.query.fuelType
      });
      return res.json({ success: true, count: data.length, data });
    } catch (error) {
      console.error('PRICE HISTORY ERROR:', error);
      return res.status(500).json({ success: false, message: 'Error fetching price history' });
    }
  }
);

module.exports = router;