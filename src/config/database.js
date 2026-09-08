const { Pool } = require('pg');
require('dotenv').config();

const isProduction = process.env.NODE_ENV === 'production';

// Fix libpq / pg SSL warning while keeping rejectUnauthorized: false
const getConnectionString = () => {
  let url = process.env.DATABASE_URL || '';
  if (!url) return '';
  
  if (url.includes('?')) {
    return url.includes('uselibpqcompat=true') ? url : `${url}&uselibpqcompat=true`;
  }
  return `${url}?uselibpqcompat=true`;
};

const pool = isProduction
  ? new Pool({
      connectionString: getConnectionString(),
      ssl: { rejectUnauthorized: false },
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    })
  : new Pool({
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: process.env.DB_NAME,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

pool.connect((err, client, release) => {
  if (err) {
    console.error('PostgreSQL connection error:', err.stack);
  } else {
    console.log('Connected to PostgreSQL successfully!');
    release();
  }
});

module.exports = pool;