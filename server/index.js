const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
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

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

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

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'OK', message: 'POS System API is running' });
});

// Error handler (must be last)
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
