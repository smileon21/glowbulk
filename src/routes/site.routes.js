const express = require('express');
const router = express.Router();
const { body, query, validationResult } = require('express-validator');

const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logActivity } = require('../utils/activityLog');
const {
  listSites,
  findSiteById,
  createSite,
  updateSite,
  setSiteActive,
  findNearestSite
} = require('../models/site.model');

const siteRules = [
  body('name').trim().notEmpty().withMessage('Site name is required'),
  body('address').trim().notEmpty().withMessage('Physical address is required'),
  body('city').trim().notEmpty().withMessage('City is required'),
  body('latitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('longitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('cityRadiusKm').isFloat({ gt: 0, max: 500 }).withMessage('City radius must be between 0 and 500 km')
];

const firstError = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  return true;
};

const readSite = (b) => ({
  name: b.name.trim(),
  address: b.address.trim(),
  city: b.city.trim(),
  latitude: Number(b.latitude),
  longitude: Number(b.longitude),
  cityRadiusKm: Number(b.cityRadiusKm)
});

// List sites: IT manages them, the other staff roles need to read them
router.get(
  '/',
  authenticate,
  authorize('admin', 'marketing', 'pricing', 'finance'),
  async (req, res) => {
    try {
      return res.json({ success: true, data: await listSites() });
    } catch (error) {
      console.error('LIST SITES ERROR:', error);
      return res.status(500).json({ success: false, message: 'Error fetching sites' });
    }
  }
);

// Nearest site + in-zone check. Must stay above '/:id' routes.
// GET /api/sites/nearest?lat=-17.82&lng=31.05
router.get(
  '/nearest',
  authenticate,
  [
    query('lat').isFloat({ min: -90, max: 90 }).withMessage('Valid lat is required'),
    query('lng').isFloat({ min: -180, max: 180 }).withMessage('Valid lng is required')
  ],
  async (req, res) => {
    try {
      if (firstError(req, res)) return;
      const site = await findNearestSite(Number(req.query.lat), Number(req.query.lng));
      if (!site) {
        return res.status(404).json({ success: false, message: 'No active sites available' });
      }
      return res.json({ success: true, data: site });
    } catch (error) {
      console.error('NEAREST SITE ERROR:', error);
      return res.status(500).json({ success: false, message: 'Error finding nearest site' });
    }
  }
);

// Create site: IT only
router.post('/', authenticate, authorize('admin'), siteRules, async (req, res) => {
  try {
    if (firstError(req, res)) return;

    const data = readSite(req.body);
    const site = await createSite({ ...data, createdBy: req.user.id });

    await logActivity({
      actor: req.user,
      action: 'SITE_CREATED',
      targetType: 'site',
      targetId: site.id,
      newValues: site,
      details: `Registered site ${site.name} (${site.city})`,
      ip: req.ip
    });

    return res.status(201).json({ success: true, message: 'Site saved', data: site });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'A site with this name already exists in that city'
      });
    }
    console.error('CREATE SITE ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error saving site' });
  }
});

// Edit site: IT only
router.put('/:id', authenticate, authorize('admin'), siteRules, async (req, res) => {
  try {
    if (firstError(req, res)) return;

    const before = await findSiteById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Site not found' });

    const site = await updateSite(req.params.id, readSite(req.body));

    await logActivity({
      actor: req.user,
      action: 'SITE_UPDATED',
      targetType: 'site',
      targetId: site.id,
      oldValues: before,
      newValues: site,
      details: `Updated site ${site.name} (${site.city})`,
      ip: req.ip
    });

    return res.json({ success: true, message: 'Site updated', data: site });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({
        success: false,
        message: 'A site with this name already exists in that city'
      });
    }
    console.error('UPDATE SITE ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error updating site' });
  }
});

// Activate / deactivate (inactive sites are ignored by the nearest-site search)
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be true or false' });
    }

    const before = await findSiteById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Site not found' });

    const site = await setSiteActive(req.params.id, req.body.isActive);

    await logActivity({
      actor: req.user,
      action: req.body.isActive ? 'SITE_ACTIVATED' : 'SITE_DEACTIVATED',
      targetType: 'site',
      targetId: site.id,
      oldValues: { is_active: before.is_active },
      newValues: { is_active: site.is_active },
      details: `${site.name} (${site.city}) ${site.is_active ? 'activated' : 'deactivated'}`,
      ip: req.ip
    });

    return res.json({ success: true, data: site });
  } catch (error) {
    console.error('SITE STATUS ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error updating site status' });
  }
});

module.exports = router;