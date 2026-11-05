const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');

const { authenticate, authorize } = require('../middleware/auth.middleware');
const { logActivity } = require('../utils/activityLog');
const {
  listZones,
  findZoneById,
  createZone,
  updateZone,
  setZoneActive
} = require('../models/cityZone.model');

const zoneRules = [
  body('name').trim().notEmpty().withMessage('City name is required'),
  body('region').trim().notEmpty().withMessage('Region is required'),
  body('centreLatitude').isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  body('centreLongitude').isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  body('radiusKm').isFloat({ gt: 0, max: 500 }).withMessage('Radius must be between 0 and 500 km')
];

const firstError = (req, res) => {
  const errors = validationResult(req);
  if (errors.isEmpty()) return false;
  res.status(400).json({ success: false, message: errors.array()[0].msg, errors: errors.array() });
  return true;
};

const readZone = (b) => ({
  name: b.name.trim(),
  region: b.region.trim(),
  centreLatitude: Number(b.centreLatitude),
  centreLongitude: Number(b.centreLongitude),
  radiusKm: Number(b.radiusKm)
});

// List zones: IT manages them, the other staff roles need to read them
router.get(
  '/',
  authenticate,
  authorize('admin', 'marketing', 'pricing', 'finance'),
  async (req, res) => {
    try {
      return res.json({ success: true, data: await listZones() });
    } catch (error) {
      console.error('LIST ZONES ERROR:', error);
      return res.status(500).json({ success: false, message: 'Error fetching zones' });
    }
  }
);

// Create zone: IT only
router.post('/', authenticate, authorize('admin'), zoneRules, async (req, res) => {
  try {
    if (firstError(req, res)) return;

    const zone = await createZone({ ...readZone(req.body), createdBy: req.user.id });

    await logActivity({
      actor: req.user,
      action: 'ZONE_CREATED',
      targetType: 'city_zone',
      targetId: zone.id,
      newValues: zone,
      details: `Created zone ${zone.name} (${zone.radius_km} km)`,
      ip: req.ip
    });

    return res.status(201).json({ success: true, message: 'Zone saved', data: zone });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'A zone with this city name already exists' });
    }
    console.error('CREATE ZONE ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error saving zone' });
  }
});

// Edit zone (centre and radius included): IT only
router.put('/:id', authenticate, authorize('admin'), zoneRules, async (req, res) => {
  try {
    if (firstError(req, res)) return;

    const before = await findZoneById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Zone not found' });

    const zone = await updateZone(req.params.id, readZone(req.body));

    await logActivity({
      actor: req.user,
      action: 'ZONE_UPDATED',
      targetType: 'city_zone',
      targetId: zone.id,
      oldValues: before,
      newValues: zone,
      details: `Updated zone ${zone.name} (radius ${before.radius_km} km to ${zone.radius_km} km)`,
      ip: req.ip
    });

    return res.json({ success: true, message: 'Zone updated', data: zone });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(400).json({ success: false, message: 'A zone with this city name already exists' });
    }
    console.error('UPDATE ZONE ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error updating zone' });
  }
});

// Activate / deactivate (inactive zones are ignored by automatic quotes)
router.patch('/:id/status', authenticate, authorize('admin'), async (req, res) => {
  try {
    if (typeof req.body.isActive !== 'boolean') {
      return res.status(400).json({ success: false, message: 'isActive must be true or false' });
    }

    const before = await findZoneById(req.params.id);
    if (!before) return res.status(404).json({ success: false, message: 'Zone not found' });

    const zone = await setZoneActive(req.params.id, req.body.isActive);

    await logActivity({
      actor: req.user,
      action: req.body.isActive ? 'ZONE_ACTIVATED' : 'ZONE_DEACTIVATED',
      targetType: 'city_zone',
      targetId: zone.id,
      oldValues: { is_active: before.is_active },
      newValues: { is_active: zone.is_active },
      details: `${zone.name} zone ${zone.is_active ? 'activated' : 'deactivated'}`,
      ip: req.ip
    });

    return res.json({ success: true, data: zone });
  } catch (error) {
    console.error('ZONE STATUS ERROR:', error);
    return res.status(500).json({ success: false, message: 'Error updating zone status' });
  }
});

module.exports = router;