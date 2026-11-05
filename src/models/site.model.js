const pool = require('../config/database');

// A site belongs to a city zone. The zone (not the site) owns the radius.
// The city and region saved on the site are copied from its zone.
const COLUMNS = `s.id, s.name, s.region, s.city, s.city_zone_id,
  s.latitude::float AS latitude, s.longitude::float AS longitude,
  z.radius_km::float AS city_radius_km,
  s.is_active, s.created_at, s.updated_at`;

const FROM = `FROM sites s LEFT JOIN city_zones z ON z.id = s.city_zone_id`;

const listSites = async () => {
  const result = await pool.query(
    `SELECT ${COLUMNS} ${FROM} ORDER BY s.city, s.name`
  );
  return result.rows;
};

const findSiteById = async (id) => {
  const result = await pool.query(`SELECT ${COLUMNS} ${FROM} WHERE s.id = $1`, [id]);
  return result.rows[0] || null;
};

// Returns null when the chosen zone does not exist
const createSite = async ({ name, cityZoneId, latitude, longitude, createdBy }) => {
  const result = await pool.query(
    `INSERT INTO sites (name, region, city, city_zone_id, latitude, longitude, created_by)
     SELECT $1, z.region, z.name, z.id, $3, $4, $5
     FROM city_zones z
     WHERE z.id = $2
     RETURNING id`,
    [name, cityZoneId, latitude, longitude, createdBy]
  );
  if (result.rows.length === 0) return null;
  return findSiteById(result.rows[0].id);
};

// Returns null when the site or the chosen zone does not exist
const updateSite = async (id, { name, cityZoneId, latitude, longitude }) => {
  const result = await pool.query(
    `UPDATE sites
     SET name = $1, region = z.region, city = z.name, city_zone_id = z.id,
         latitude = $3, longitude = $4, updated_at = CURRENT_TIMESTAMP
     FROM city_zones z
     WHERE z.id = $2 AND sites.id = $5
     RETURNING sites.id`,
    [name, cityZoneId, latitude, longitude, id]
  );
  if (result.rows.length === 0) return null;
  return findSiteById(id);
};

const setSiteActive = async (id, isActive) => {
  const result = await pool.query(
    `UPDATE sites SET is_active = $1, updated_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING id`,
    [isActive, id]
  );
  if (result.rows.length === 0) return null;
  return findSiteById(id);
};

// Distance in km between a point and a column pair (Haversine)
const haversineKm = (lat, lng, pLat, pLng) => `(6371 * 2 * ASIN(SQRT(LEAST(1,
  POWER(SIN(RADIANS((${lat})::float8 - ${pLat}::float8) / 2), 2) +
  COS(RADIANS(${pLat}::float8)) * COS(RADIANS((${lat})::float8)) *
  POWER(SIN(RADIANS((${lng})::float8 - ${pLng}::float8) / 2), 2)
))))::float8`;

// Nearest ACTIVE site to a point, and whether the point is inside that site's
// city zone: distance from the CITY CENTRE <= the zone radius.
const findNearestSite = async (latitude, longitude) => {
  const result = await pool.query(
    `SELECT ${COLUMNS},
            ${haversineKm('s.latitude', 's.longitude', '$1', '$2')} AS distance_km,
            COALESCE(
              ${haversineKm('z.centre_latitude', 'z.centre_longitude', '$1', '$2')} <= z.radius_km,
              FALSE
            ) AS in_zone
     ${FROM}
     WHERE s.is_active = TRUE
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