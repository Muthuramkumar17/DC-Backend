require('dotenv').config();

const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');

const connectDB = require('./src/config/db');
const AuditLog = require('./src/models/AuditLog');

// Import controllers for direct endpoints
const userController = require('./src/controllers/userController');

// Import routes
const userRoutes = require('./src/routes/userRoutes');
const roleRoutes = require('./src/routes/roleRoutes');
const customerRoutes = require('./src/routes/customerRoutes');
const bookingRoutes = require('./src/routes/bookingRoutes');
const serviceDurationRoutes = require('./src/routes/serviceDurationRoutes');
const serviceFrequencyRoutes = require('./src/routes/serviceFrequencyRoutes');
const subscriptionTypeRoutes = require('./src/routes/subscriptionTypeRoutes');
const subscriptionRoutes = require('./src/routes/subscriptionRoutes');
const timeSlotRoutes = require('./src/routes/timeSlotRoutes');
const paymentMethodRoutes = require('./src/routes/paymentMethodRoutes');
const paymentAccountRoutes = require('./src/routes/paymentAccountRoutes');
const invoiceRoutes = require('./src/routes/invoiceRoutes');
const pricingRoutes = require('./src/routes/pricingRoutes');
const bathroomCountRoutes = require('./src/routes/bathroomCountRoutes');
const paymentMasterRoutes = require('./src/routes/paymentMasterRoutes');
const servicePaymentRoutes = require('./src/routes/servicePaymentRoutes');
const visitRoutes = require('./src/routes/visitRoutes');
const bookingDateRoutes = require('./src/routes/bookingDateRoutes');

const app = express();

// Middlewares
app.use(
  cors({
    origin: 'http://localhost:5173',
    credentials: true,
  })
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid request body' });
  }
  return next(err);
});

// Primary audit trail: record write operations without storing high-volume reads.
// This is intentionally centralized so new controllers/routes are covered automatically.
app.use((req, res, next) => {
  const operationByMethod = {
    POST: 'create',
    PUT: 'update',
    PATCH: 'update',
    DELETE: 'delete',
  };
  const isLogin = /^\/api\/login\/?$/i.test(req.path);
  const isLogout = /^\/api\/logout\/?$/i.test(req.path);
  const operation = operationByMethod[req.method];

  if ((!operation && !isLogin && !isLogout) || !req.originalUrl.startsWith('/api/')) {
    return next();
  }

  res.on('finish', () => {
    const pathParts = req.path.split('/').filter(Boolean);
    const collectionName = pathParts[1] || 'api';
    const possibleId = pathParts[pathParts.length - 1];
    const recordId = mongoose.isValidObjectId(possibleId) ? possibleId : null;
    const userId = req.user?.userId || req.user?._id || null;
    const bodyKeys = Object.keys(req.body || {}).map((key) => key.toLowerCase());
    const path = req.path.toLowerCase();
    let auditOperation = isLogin ? 'LOGIN' : isLogout ? 'LOGOUT' : operation;

    if (bodyKeys.some((key) => key.includes('status') || key === 'isactive' || key === 'isavailable')) {
      auditOperation = operation === 'update' ? 'STATUS_CHANGE' : auditOperation;
    } else if (path.includes('payment') || bodyKeys.some((key) => key.includes('payment'))) {
      auditOperation = operation === 'update' || operation === 'create' || operation === 'delete'
        ? 'PAYMENT_CHANGE'
        : auditOperation;
    }

    AuditLog.create({
      userId,
      actionBy: userId,
      operation: auditOperation,
      collectionName,
      recordId,
      details: {
        method: req.method,
        path: req.path,
        query: req.query,
        statusCode: res.statusCode,
        success: res.statusCode < 400,
      },
    }).catch((error) => {
      // Auditing must never change or fail the API response.
      console.error('Primary audit log write failed:', error.message);
    });
  });

  return next();
});

// Request logging in development
if (process.env.NODE_ENV !== 'test') {
  app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
  });
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'OK',
    message: 'Jolly Home Needs API is running',
    timestamp: new Date().toISOString(),
  });
});

// Authentication endpoint
app.post('/api/login', userController.login);

// Resource API Routes
app.use(['/api/users', '/api/user'], userRoutes);
app.use(['/api/roles', '/api/role'], roleRoutes);
app.use(['/api/customers', '/api/customer'], customerRoutes);
app.use(['/api/bookings', '/api/booking'], bookingRoutes);
app.use(['/api/service-durations', '/api/service-duration', '/api/servicedurations', '/api/durations'], serviceDurationRoutes);
app.use(['/api/service-frequencies', '/api/service-frequency', '/api/servicefrequencies', '/api/frequencies'], serviceFrequencyRoutes);
app.use('/api/subscription-types', subscriptionTypeRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use(['/api/time-slots', '/api/time-slot', '/api/timeslots', '/api/slots'], timeSlotRoutes);
app.use(['/api/payments', '/api/payment-methods', '/api/payment-method', '/api/methods'], paymentMethodRoutes);
app.use(['/api/accounts', '/api/payment-accounts', '/api/payment-account'], paymentAccountRoutes);
app.use(['/api/invoices', '/api/invoice'], invoiceRoutes);
app.use('/api/pricing', pricingRoutes);
app.use(['/api/bathroom-counts', '/api/bathroom-count', '/api/bathroomcounts', '/api/bathrooms'], bathroomCountRoutes);
app.use('/api/payment-masters', paymentMasterRoutes);
app.use('/api/service-payments', servicePaymentRoutes);
app.use('/api/visits', visitRoutes);
app.use('/api/booking-dates', bookingDateRoutes);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({ message: `Route ${req.method} ${req.originalUrl} not found` });
});

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  if (err.code === 11000) return res.status(409).json({ message: 'Duplicate value already exists' });
  if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ message: 'Invalid request data' });
  return res.status(err.status && err.status < 500 ? err.status : 500).json({ message: 'Unable to process request' });
});

// Start Server
const PORT = process.env.PORT || 5000;

const startServer = async () => {
  try {
    await connectDB();
    const server = app.listen(PORT, () => {
      console.log(`=================================================`);
      console.log(`🚀 Jolly Home Needs API Server running on port ${PORT}`);
      console.log(`🌐 Base URL: http://localhost:${PORT}`);
      console.log(`=================================================`);
    });

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

if (process.env.NODE_ENV !== 'test') {
  startServer();
}

module.exports = app;
