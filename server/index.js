const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');
const { Server } = require('socket.io');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

dotenv.config();
const authRoutes = require('./routes/auth');
const productRoutes = require('./routes/products');
const saleRoutes = require('./routes/sales');
const expenseRoutes = require('./routes/expenses');
const reportRoutes = require('./routes/reports');
const tenantRoutes = require('./routes/tenants');
const userRoutes = require('./routes/users');
const auditRoutes = require('./routes/audit');
const applicationRoutes = require('./routes/applications');
const superAdminRoutes = require('./routes/superAdmin');
const customerRoutes = require('./routes/customers');
const securityRequestRoutes = require('./routes/securityRequests');
const ownerRoutes = require('./routes/owner');
const branchRoutes = require('./routes/branches');
const platformRoutes = require('./routes/platform');
const marketIntelligenceRoutes = require('./routes/marketIntelligence');
// Retail module routes
const stockTransferRoutes = require('./routes/stockTransfers');
const categoryRoutes = require('./routes/categories');
const stockAdjustmentRoutes = require('./routes/stockAdjustments');
// Services module routes
const attendantRoutes = require('./routes/attendants');
// Restaurant module routes
const tableRoutes = require('./routes/tables');
const orderRoutes = require('./routes/orders');
const kdsRoutes = require('./routes/kds');
const modifierRoutes = require('./routes/modifiers');
// Hospitality module routes
const roomRoutes = require('./routes/rooms');
const bookingRoutes = require('./routes/bookings');
const guestRoutes = require('./routes/guests');
const folioRoutes = require('./routes/folios');
const housekeepingRoutes = require('./routes/housekeeping');
const {
  generalLimiter,
  loginLimiter,
  apiExportLimiter,
  adminOperationsLimiter,
  ddosProtection,
  detectSuspiciousActivity,
  helmetConfig,
  sanitizeBody,
  errorHandler
} = require('./middleware/security');

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server and Socket.IO
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.NODE_ENV === 'production'
      ? process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000'
      : 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true
  }
});

// Make io accessible to routes
app.set('io', io);

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`Client connected: ${socket.id}`);

  // Join tenant-specific room for targeted broadcasts
  socket.on('join-tenant', (tenantId) => {
    if (tenantId) {
      socket.join(`tenant:${tenantId}`);
      console.log(`Socket ${socket.id} joined tenant:${tenantId}`);
    }
  });

  // Join branch-specific room for kitchen displays
  socket.on('join-branch', ({ tenantId, branchId }) => {
    if (tenantId && branchId) {
      socket.join(`kitchen:${tenantId}:${branchId}`);
      console.log(`Socket ${socket.id} joined kitchen:${tenantId}:${branchId}`);
    }
  });

  // Join kitchen room (for all kitchens in a tenant)
  socket.on('join-kitchen', (tenantId) => {
    if (tenantId) {
      socket.join(`kitchen:${tenantId}`);
      console.log(`Socket ${socket.id} joined kitchen:${tenantId}`);
    }
  });

  // Leave rooms on disconnect
  socket.on('disconnect', () => {
    console.log(`Client disconnected: ${socket.id}`);
  });
});

// Export io for use in routes
module.exports = { io };

// Security middleware
app.use(helmetConfig);

// Note: DDoS protection disabled for internal management system
// app.use(ddosProtection);

// CORS configuration
const corsOptions = {
  origin: process.env.NODE_ENV === 'production'
    ? process.env.ALLOWED_ORIGINS?.split(',') || 'http://localhost:3000'
    : 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Input sanitization
app.use(sanitizeBody);

// Note: Suspicious activity detection disabled for internal management system
// app.use(detectSuspiciousActivity);

// Serve static files for uploads
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

// Note: Rate limiting disabled for internal management system
// If needed in production, uncomment the following:
// app.use('/api', generalLimiter);
// app.use('/api/auth/login', loginLimiter);
// app.use('/api/super-admin', adminOperationsLimiter);
// app.use('/api/platform', adminOperationsLimiter);
// app.use('/api/market-intelligence/export', apiExportLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/expenses', expenseRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/users', userRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/security-requests', securityRequestRoutes);
app.use('/api/owner', ownerRoutes);
app.use('/api/branches', branchRoutes);
app.use('/api/platform', platformRoutes);
app.use('/api/market-intelligence', marketIntelligenceRoutes);
// Retail module routes
app.use('/api/stock-transfers', stockTransferRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/stock-adjustments', stockAdjustmentRoutes);
// Services module routes
app.use('/api/attendants', attendantRoutes);
// Restaurant module routes
app.use('/api/tables', tableRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/kds', kdsRoutes);
app.use('/api/modifiers', modifierRoutes);
// Hospitality module routes
app.use('/api/rooms', roomRoutes);
app.use('/api/bookings', bookingRoutes);
app.use('/api/guests', guestRoutes);
app.use('/api/folios', folioRoutes);
app.use('/api/housekeeping', housekeepingRoutes);

// Health check
app.get('/api/health', async (req, res) => {
  const cache = require('./utils/cache');
  const cacheHealth = await cache.healthCheck();

  res.json({
    status: 'OK',
    message: 'POS System API is running',
    cache: cacheHealth,
    uptime: process.uptime()
  });
});

// Error handler (must be last)
app.use(errorHandler);

// Start the server (using http server for Socket.IO support)
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
  console.log(`WebSocket server ready`);
  // Tell PM2 the app is ready
  if (process.send) {
    process.send('ready');
  }
});

// Graceful shutdown handling
const gracefulShutdown = async (signal) => {
  console.log(`${signal} received. Shutting down gracefully...`);

  // Force close after 10 seconds
  const forceExit = setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 10000);

  try {
    // Close Socket.IO connections
    io.close();
    console.log('WebSocket connections closed.');

    // Close HTTP server (stop accepting new requests)
    await new Promise((resolve) => {
      server.close(resolve);
    });
    console.log('HTTP server closed.');

    // Disconnect Prisma
    await prisma.$disconnect();
    console.log('Database connections closed.');

    clearTimeout(forceExit);
    process.exit(0);
  } catch (error) {
    console.error('Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));
