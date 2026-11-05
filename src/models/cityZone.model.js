const pool = require('../config/database');

const COLUMNS = `z.id, z.name, z.region,
  z.centre_latitude::float AS centre_latitude,
  z.centre_longitude::float AS centre_longitude,
  z.radius_km::float AS radius_km,
  z.is_active, z.created_at, z.updated_at,
  (SELECT COUNT(*)::int FROM sites s WHERE s.city_zone_id = z.id) AS site_count`;

const listZones = async () => {
  const result = await pool.query(`SELECT ${COLUMNS} FROM city_zones z ORDER BY z.name`);
  return result.rows;
};

const findZoneById = async (id) => {
  const result = await pool.query(`SELECT ${COLUMNS} FROM city_zones z WHERE z.id = $1`, [id]);
  return result.rows[0] || null;
};

const createZone = async ({ name, region, centreLatitude, centreLongitude, radiusKm, createdBy }) => {
  const result = await pool.query(
    `INSERT INTO city_zones (name, region, centre_latitude, centre_longitude, radius_km, created_by)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING id`,
    [name, region, centreLatitude, centreLongitude, radiusKm, createdBy]
  );
  return findZoneById(result.rows[0].id);
};

// Updating a zone also refreshes the city name and region saved on its sites,
// so the other pages (Daily Prices, search) keep showing the right city.
const updateZone = async (id, { name, region, centreLatitude, centreLongitude, radiusKm }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const updated = await client.query(
      `UPDATE city_zones
       SET name = $1, region = $2, centre_latitude = $3, centre_longitude = $4,
           radius_km = $5, updated_at = CURRENT_TIMESTAMP
       WHERE id = $6
       RETURNING id`,
      [name, region, centreLatitude, centreLongitude, radiusKm, id]
    );
    if (updated.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }
    await client.query(
      `UPDATE sites SET city = $1, region = $2, updated_at = CURRENT_TIMESTAMP
       WHERE city_zone_id = $3`,
      [name, region, id]
    );
    await client.query('COMMIT');
    return findZoneById(id);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

const setZoneActive = async (id, isActive) => {
  const result = await pool.query(
    `UPDATE city_zones SET is_active = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING id`,
    [isActive, id]
  );
  if (result.rows.length === 0) return null;
  return findZoneById(id);
};

module.exports = { listZones, findZoneById, createZone, updateZone, setZoneActive };