const pool = require('../config/database');

const COLUMNS = `id, name, region, city, latitude::float AS latitude,
  longitude::float AS longitude, city_radius_km::float AS city_radius_km,
  is_active, created_at, updated_at`;

const listSites = async () => {
  const result = await pool.query(
    `SELECT ${COLUMNS} FROM sites ORDER BY city, name`
  );
  return result.rows;
};

const findSiteById = async (id) => {
  const result = await pool.query(`SELECT ${COLUMNS} FROM sites WHERE id = $1`, [id]);
  return result.rows[0] || null;
};

const createSite = async ({ name, region, city, latitude, longitude, cityRadiusKm, createdBy }) => {
  const result = await pool.query(
    `INSERT INTO sites (name, region, city, latitude, longitude, city_radius_km, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING ${COLUMNS}`,
    [name, region, city, latitude, longitude, cityRadiusKm, createdBy]
  );
  return result.rows[0];
};

const updateSite = async (id, { name, region, city, latitude, longitude, cityRadiusKm }) => {
  const result = await pool.query(
    `UPDATE sites
     SET name = $1, region = $2, city = $3, latitude = $4, longitude = $5,
         city_radius_km = $6, updated_at = CURRENT_TIMESTAMP
     WHERE id = $7
     RETURNING ${COLUMNS}`,
    [name, region, city, latitude, longitude, cityRadiusKm, id]
  );
  return result.rows[0] || null;
};

const setSiteActive = async (id, isActive) => {
  const result = await pool.query(
    `UPDATE sites SET is_active = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING ${COLUMNS}`,
    [isActive, id]
  );
  return result.rows[0] || null;
};

// Nearest ACTIVE site to a point (Haversine, km) and whether the point is inside
// that site's city zone (distance <= city_radius_km).
// The automatic quotation will call this with the customer's coordinates.
const findNearestSite = async (latitude, longitude) => {
  const result = await pool.query(
    `SELECT ${COLUMNS},
            distance_km,
            (distance_km <= city_radius_km) AS in_zone
     FROM (
       SELECT s.*,
              6371 * 2 * ASIN(SQRT(LEAST(1,
                POWER(SIN(RADIANS(s.latitude - $1) / 2), 2) +
                COS(RADIANS($1)) * COS(RADIANS(s.latitude)) *
                POWER(SIN(RADIANS(s.longitude - $2) / 2), 2)
              )))::float AS distance_km
       FROM sites s
       WHERE s.is_active = TRUE
     ) t
     ORDER BY distance_km
     LIMIT 1`,
    [latitude, longitude]
  );
  return result.rows[0] || null;
};

module.exports = {
  listSites,
  findSiteById,
  createSite,
  updateSite,
  setSiteActive,
  findNearestSite
};