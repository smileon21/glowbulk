const { Pool } = require('pg');
require('dotenv').config();

  const pool = isProduction
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    })
  : new Pool({
      // ...local config unchanged
    });



pool.connect((err, client, release) => {
  if (err) {
    console.error('PostgreSQL connection error:', err.stack);
  } else {
    console.log(' Connected to PostgreSQL successfully!');
    release();
  }
});

module.exports = pool;