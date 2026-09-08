require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const pool = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth.routes');
const customerRoutes = require('./routes/customer.routes');
const fuelRequestRoutes = require('./routes/fuelRequest.routes');
const quotationRoutes = require('./routes/quotation.routes');
const orderRoutes = require('./routes/order.routes');
const contentRoutes = require('./routes/content.routes');
const adminRoutes = require('./routes/admin.routes');
const exportRoutes = require('./routes/export.routes');

const app = express();


// =====================================================
// CORS - Allow Vercel frontend and localhost
// =====================================================

// Allow all origins for simplicity
app.use(cors({
  origin: function(origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:5173',
      'https://glowbulk.vercel.app'
    ];
    // Allow requests with no origin (like mobile apps, curl, Postman)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));


// =====================================================
// SECURITY MIDDLEWARE
// =====================================================

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));


// =====================================================
// RATE LIMITING
// =====================================================

const limiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: 1000,
  message: 'Too many requests, please try again later.'
});

app.use('/api', limiter);


// =====================================================
// BODY PARSING
// =====================================================

app.use(express.json({
  limit: '10mb'
}));

app.use(express.urlencoded({
  extended: true,
  limit: '10mb'
}));


// =====================================================
// API ROUTES
// =====================================================

app.use('/api/auth', authRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/fuel-requests', fuelRequestRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/content', contentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/export', exportRoutes);


// =====================================================
// HOME / API STATUS
// =====================================================

app.get('/', function(req, res) {
  res.json({
    success: true,
    message: 'GlowBulk API Server is running!',
    database: process.env.DB_NAME,
    status: 'connected',
    endpoints: {
      auth: '/api/auth/register, /api/auth/login',
      customers: '/api/customers',
      fuelRequests: '/api/fuel-requests',
      quotations: '/api/quotations',
      orders: '/api/orders',
      content: '/api/content',
      admin: '/api/admin',
      export: '/api/export/customers, /api/export/monthly-report, /api/export/monthly-orders-report'
    }
  });
});


// =====================================================
// HEALTH CHECK
// =====================================================

app.get('/api/health', function(req, res) {
  res.json({
    success: true,
    status: 'OK',
    message: 'GlowBulk API is running',
    timestamp: new Date().toISOString()
  });
});


// =====================================================
// TEST DATABASE CONNECTION
// =====================================================

app.get('/api/test-db', async function(req, res) {
  try {
    const result = await pool.query('SELECT NOW() AS current_time');
    res.json({
      success: true,
      message: 'Database connected successfully!',
      time: result.rows[0].current_time
    });
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});


// =====================================================
// 404 HANDLER
// =====================================================

app.use(function(req, res) {
  res.status(404).json({
    success: false,
    message: 'API endpoint not found',
    path: req.originalUrl
  });
});


// =====================================================
// ERROR HANDLER
// =====================================================

app.use(function(err, req, res, next) {
  console.error('Server Error:', err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Something went wrong!'
  });
});


// =====================================================
// START SERVER
// =====================================================

const PORT = process.env.PORT || 5000;

app.listen(PORT, function() {
  console.log('='.repeat(50));
  console.log('GlowBulk Server Started');
  console.log('URL: http://localhost:' + PORT);
  console.log('Database: ' + process.env.DB_NAME);
  console.log('='.repeat(50));
});