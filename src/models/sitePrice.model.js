const pool = require('../config/database');

// "Today" is always the Africa/Harare calendar day, decided by the database,
// so the new day starts at midnight CAT no matter where the server runs.
const TODAY_HARARE = "(NOW() AT TIME ZONE 'Africa/Harare')::date";

const FUEL_TYPES = ['diesel', 'petrol'];

// Every active site with today's diesel and petrol price (null = not set yet)
const listTodayPrices = async () => {
  const { rows } = await pool.query(
    `SELECT s.id AS site_id, s.name, s.city, s.region,
            d.unit_price AS diesel_price, d.prepared_by AS diesel_prepared_by,
            p.unit_price AS petrol_price, p.prepared_by AS petrol_prepared_by,
            ${TODAY_HARARE}::text AS price_date
       FROM sites s
       LEFT JOIN site_prices d ON d.site_id = s.id AND d.fuel_type = 'diesel' AND d.price_date = ${TODAY_HARARE}
       LEFT JOIN site_prices p ON p.site_id = s.id AND p.fuel_type = 'petrol' AND p.price_date = ${TODAY_HARARE}
      WHERE s.is_active = TRUE
      ORDER BY s.city, s.name`
  );
  return rows;
};

// Set or correct today's prices for many sites in one transaction
const saveTodayPrices = async (prices, { preparedBy, setBy }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const saved = [];
    for (const p of prices) {
      const { rows } = await client.query(
        `INSERT INTO site_prices (site_id, fuel_type, price_date, unit_price, prepared_by, set_by)
         VALUES ($1, $2, ${TODAY_HARARE}, $3, $4, $5)
         ON CONFLICT (site_id, fuel_type, price_date)
         DO UPDATE SET unit_price = EXCLUDED.unit_price,
                       prepared_by = EXCLUDED.prepared_by,
                       set_by = EXCLUDED.set_by,
                       updated_at = NOW()
         RETURNING *`,
        [p.siteId, p.fuelType, p.unitPrice, preparedBy, setBy]
      );
      saved.push(rows[0]);
    }
    await client.query('COMMIT');
    return saved;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Today's price for one site + fuel type, or null if marketing has not set it
const getActivePrice = async (siteId, fuelType) => {
  const { rows } = await pool.query(
    `SELECT * FROM site_prices
      WHERE site_id = $1 AND fuel_type = $2 AND price_date = ${TODAY_HARARE}`,
    [siteId, String(fuelType).toLowerCase()]
  );
  return rows[0] || null;
};

// Audit / reports: past prices, optionally filtered
const listPriceHistory = async ({ from, to, siteId, fuelType } = {}) => {
  const params = [];
  const where = [];
  if (from) { params.push(from); where.push(`sp.price_date >= $${params.length}`); }
  if (to) { params.push(to); where.push(`sp.price_date <= $${params.length}`); }
  if (siteId) { params.push(siteId); where.push(`sp.site_id = $${params.length}`); }
  if (fuelType) { params.push(fuelType); where.push(`sp.fuel_type = $${params.length}`); }

  const { rows } = await pool.query(
    `SELECT sp.*, sp.price_date::text AS price_date_text, s.name AS site_name, s.city
       FROM site_prices sp
       JOIN sites s ON s.id = sp.site_id
      ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
      ORDER BY sp.price_date DESC, s.city, s.name, sp.fuel_type
      LIMIT 2000`,
    params
  );
  return rows;
};

// Remove a price entered by mistake. Only TODAY's row can be removed;
// past days stay untouched for audit. Returns the removed row, or null.
const deleteTodayPrice = async (siteId, fuelType) => {
  const { rows } = await pool.query(
    `DELETE FROM site_prices
      WHERE site_id = $1 AND fuel_type = $2 AND price_date = ${TODAY_HARARE}
      RETURNING *`,
    [siteId, String(fuelType).toLowerCase()]
  );
  return rows[0] || null;
};

// The site whose zone covers the customer AND that has a price set today for this fuel.
// Sites with no price today (for example sites that don't sell bulk fuel) are ignored,
// so the customer gets the nearest site that actually has a price.
// Returns null when no priced site covers the customer: the request then stays manual.
const findNearestPricedSite = async (latitude, longitude, fuelType) => {
  const { rows } = await pool.query(
    `SELECT *
       FROM (
         SELECT s.id AS site_id, s.name, s.city, s.region,
                s.city_radius_km::float AS city_radius_km,
                sp.id AS price_id, sp.unit_price::float AS unit_price, sp.prepared_by,
                6371 * 2 * ASIN(SQRT(LEAST(1,
                  POWER(SIN(RADIANS(s.latitude - $1::float8) / 2), 2) +
                  COS(RADIANS($1::float8)) * COS(RADIANS(s.latitude)) *
                  POWER(SIN(RADIANS(s.longitude - $2::float8) / 2), 2)
                )))::float AS distance_km
           FROM sites s
           JOIN site_prices sp
             ON sp.site_id = s.id
            AND sp.fuel_type = $3
            AND sp.price_date = ${TODAY_HARARE}
          WHERE s.is_active = TRUE
       ) t
      WHERE distance_km <= city_radius_km
      ORDER BY distance_km
      LIMIT 1`,
    [latitude, longitude, String(fuelType).toLowerCase()]
  );
  return rows[0] || null;
};

module.exports = {
  FUEL_TYPES,
  listTodayPrices,
  saveTodayPrices,
  getActivePrice,
  listPriceHistory,
  findNearestPricedSite,
  deleteTodayPrice
};