const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireSuperAdmin: authRequireSuperAdmin } = require('../middleware/auth');

// Use requireSuperAdmin from auth middleware (imported as authRequireSuperAdmin)
const requireSuperAdmin = authRequireSuperAdmin;

// ==========================================
// SUBSCRIPTION TIERS
// ==========================================

// GET /api/platform/tiers - Get all subscription tiers
router.get('/tiers', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const tiers = await prisma.subscriptionTier.findMany({
      include: {
        features: {
          include: {
            feature: true
          }
        },
        _count: {
          select: { tenants: true }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    res.json({ tiers });
  } catch (error) {
    console.error('Get tiers error:', error);
    res.status(500).json({ error: 'Failed to fetch subscription tiers' });
  }
});

// POST /api/platform/tiers - Create a new subscription tier
router.post('/tiers', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { name, description, monthlyPrice, annualPrice, maxUsers, maxBranches, maxProducts, sortOrder } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Tier name is required' });
    }

    const tier = await prisma.subscriptionTier.create({
      data: {
        name,
        description,
        monthlyPrice: parseFloat(monthlyPrice) || 0,
        annualPrice: parseFloat(annualPrice) || 0,
        maxUsers: parseInt(maxUsers) || 5,
        maxBranches: parseInt(maxBranches) || 1,
        maxProducts: parseInt(maxProducts) || 100,
        sortOrder: parseInt(sortOrder) || 0
      }
    });

    res.status(201).json({ tier, message: 'Subscription tier created' });
  } catch (error) {
    console.error('Create tier error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A tier with this name already exists' });
    }
    res.status(500).json({ error: 'Failed to create subscription tier' });
  }
});

// PUT /api/platform/tiers/:id - Update a subscription tier
router.put('/tiers/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, monthlyPrice, annualPrice, maxUsers, maxBranches, maxProducts, sortOrder, isActive } = req.body;

    const tier = await prisma.subscriptionTier.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(description !== undefined && { description }),
        ...(monthlyPrice !== undefined && { monthlyPrice: parseFloat(monthlyPrice) }),
        ...(annualPrice !== undefined && { annualPrice: parseFloat(annualPrice) }),
        ...(maxUsers !== undefined && { maxUsers: parseInt(maxUsers) }),
        ...(maxBranches !== undefined && { maxBranches: parseInt(maxBranches) }),
        ...(maxProducts !== undefined && { maxProducts: parseInt(maxProducts) }),
        ...(sortOrder !== undefined && { sortOrder: parseInt(sortOrder) }),
        ...(isActive !== undefined && { isActive })
      }
    });

    res.json({ tier, message: 'Subscription tier updated' });
  } catch (error) {
    console.error('Update tier error:', error);
    res.status(500).json({ error: 'Failed to update subscription tier' });
  }
});

// DELETE /api/platform/tiers/:id - Delete a subscription tier
router.delete('/tiers/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if any tenants use this tier
    const tenantsCount = await prisma.tenant.count({ where: { tierId: id } });
    if (tenantsCount > 0) {
      return res.status(400).json({
        error: `Cannot delete tier with ${tenantsCount} active tenants. Reassign them first.`
      });
    }

    await prisma.subscriptionTier.delete({ where: { id } });
    res.json({ message: 'Subscription tier deleted' });
  } catch (error) {
    console.error('Delete tier error:', error);
    res.status(500).json({ error: 'Failed to delete subscription tier' });
  }
});

// PUT /api/platform/tenants/:id/tier - Assign tier to tenant
router.put('/tenants/:id/tier', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { tierId } = req.body;

    const tenant = await prisma.tenant.update({
      where: { id },
      data: { tierId }
    });

    res.json({ tenant, message: 'Tenant tier updated' });
  } catch (error) {
    console.error('Update tenant tier error:', error);
    res.status(500).json({ error: 'Failed to update tenant tier' });
  }
});

// ==========================================
// FEATURES
// ==========================================

// GET /api/platform/features - Get all features
router.get('/features', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const features = await prisma.feature.findMany({
      orderBy: [{ category: 'asc' }, { name: 'asc' }]
    });

    res.json({ features });
  } catch (error) {
    console.error('Get features error:', error);
    res.status(500).json({ error: 'Failed to fetch features' });
  }
});

// POST /api/platform/features - Create a feature
router.post('/features', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { code, name, description, category } = req.body;

    if (!code || !name) {
      return res.status(400).json({ error: 'Feature code and name are required' });
    }

    const feature = await prisma.feature.create({
      data: {
        code: code.toLowerCase().replace(/[^a-z0-9_]/g, '_'),
        name,
        description,
        category: category || 'general'
      }
    });

    res.status(201).json({ feature, message: 'Feature created' });
  } catch (error) {
    console.error('Create feature error:', error);
    if (error.code === 'P2002') {
      return res.status(400).json({ error: 'A feature with this code already exists' });
    }
    res.status(500).json({ error: 'Failed to create feature' });
  }
});

// PUT /api/platform/tiers/:tierId/features - Update features for a tier
router.put('/tiers/:tierId/features', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { tierId } = req.params;
    const { featureIds } = req.body; // Array of feature IDs to enable

    // Remove all existing tier features
    await prisma.tierFeature.deleteMany({ where: { tierId } });

    // Add new tier features
    if (featureIds && featureIds.length > 0) {
      await prisma.tierFeature.createMany({
        data: featureIds.map(featureId => ({
          tierId,
          featureId,
          isEnabled: true
        }))
      });
    }

    // Fetch updated tier with features
    const tier = await prisma.subscriptionTier.findUnique({
      where: { id: tierId },
      include: {
        features: {
          include: { feature: true }
        }
      }
    });

    res.json({ tier, message: 'Tier features updated' });
  } catch (error) {
    console.error('Update tier features error:', error);
    res.status(500).json({ error: 'Failed to update tier features' });
  }
});

// ==========================================
// GRACE PERIOD MANAGEMENT
// ==========================================

// GET /api/platform/grace-period/tenants - Get tenants in grace period or expired
router.get('/grace-period/tenants', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();

    const tenants = await prisma.tenant.findMany({
      where: {
        OR: [
          { isInGracePeriod: true },
          { subscriptionEnd: { lt: now } }
        ]
      },
      include: {
        tier: true,
        _count: { select: { users: true, products: true, sales: true } }
      },
      orderBy: { subscriptionEnd: 'asc' }
    });

    res.json({ tenants });
  } catch (error) {
    console.error('Get grace period tenants error:', error);
    res.status(500).json({ error: 'Failed to fetch tenants' });
  }
});

// PUT /api/platform/tenants/:id/grace-period - Set grace period for a tenant
router.put('/tenants/:id/grace-period', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { graceDays } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const gracePeriodEnd = new Date();
    gracePeriodEnd.setDate(gracePeriodEnd.getDate() + (parseInt(graceDays) || 7));

    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: {
        gracePeriodEnd,
        isInGracePeriod: true
      }
    });

    res.json({ tenant: updatedTenant, message: `Grace period set for ${graceDays} days` });
  } catch (error) {
    console.error('Set grace period error:', error);
    res.status(500).json({ error: 'Failed to set grace period' });
  }
});

// POST /api/platform/grace-period/enforce - Enforce lockout for expired tenants
router.post('/grace-period/enforce', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const now = new Date();

    // Find tenants past their grace period
    const expiredTenants = await prisma.tenant.findMany({
      where: {
        OR: [
          // Subscription expired and no grace period set
          {
            subscriptionEnd: { lt: now },
            gracePeriodEnd: null
          },
          // Grace period also expired
          {
            gracePeriodEnd: { lt: now }
          }
        ],
        isActive: true
      }
    });

    // Deactivate them
    const result = await prisma.tenant.updateMany({
      where: {
        id: { in: expiredTenants.map(t => t.id) }
      },
      data: {
        isActive: false,
        isInGracePeriod: false
      }
    });

    res.json({
      message: `Enforced lockout on ${result.count} tenants`,
      affectedTenants: expiredTenants.map(t => ({
        id: t.id,
        businessName: t.businessName,
        subscriptionEnd: t.subscriptionEnd,
        gracePeriodEnd: t.gracePeriodEnd
      }))
    });
  } catch (error) {
    console.error('Enforce lockout error:', error);
    res.status(500).json({ error: 'Failed to enforce lockout' });
  }
});

// ==========================================
// TAX CONFIGURATION
// ==========================================

// GET /api/platform/tax-configs - Get all tax configurations
router.get('/tax-configs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { country } = req.query;

    const taxConfigs = await prisma.taxConfig.findMany({
      where: country ? { country } : undefined,
      orderBy: [{ country: 'asc' }, { name: 'asc' }]
    });

    res.json({ taxConfigs });
  } catch (error) {
    console.error('Get tax configs error:', error);
    res.status(500).json({ error: 'Failed to fetch tax configurations' });
  }
});

// POST /api/platform/tax-configs - Create a tax configuration
router.post('/tax-configs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { country, name, rate, isCompound, effectiveFrom } = req.body;

    if (!country || !name || rate === undefined) {
      return res.status(400).json({ error: 'Country, name, and rate are required' });
    }

    const taxConfig = await prisma.taxConfig.create({
      data: {
        country: country.toUpperCase(),
        name,
        rate: parseFloat(rate),
        isCompound: isCompound || false,
        effectiveFrom: effectiveFrom ? new Date(effectiveFrom) : new Date()
      }
    });

    res.status(201).json({ taxConfig, message: 'Tax configuration created' });
  } catch (error) {
    console.error('Create tax config error:', error);
    res.status(500).json({ error: 'Failed to create tax configuration' });
  }
});

// PUT /api/platform/tax-configs/:id - Update a tax configuration
router.put('/tax-configs/:id', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, rate, isCompound, isActive, effectiveFrom, effectiveTo } = req.body;

    const taxConfig = await prisma.taxConfig.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(rate !== undefined && { rate: parseFloat(rate) }),
        ...(isCompound !== undefined && { isCompound }),
        ...(isActive !== undefined && { isActive }),
        ...(effectiveFrom && { effectiveFrom: new Date(effectiveFrom) }),
        ...(effectiveTo !== undefined && { effectiveTo: effectiveTo ? new Date(effectiveTo) : null })
      }
    });

    res.json({ taxConfig, message: 'Tax configuration updated' });
  } catch (error) {
    console.error('Update tax config error:', error);
    res.status(500).json({ error: 'Failed to update tax configuration' });
  }
});

// POST /api/platform/tax-configs/push - Push tax rates to tenants in a country
router.post('/tax-configs/push', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { country, taxRate } = req.body;

    if (!country || taxRate === undefined) {
      return res.status(400).json({ error: 'Country and tax rate are required' });
    }

    const result = await prisma.tenant.updateMany({
      where: { country: country.toUpperCase() },
      data: { taxRate: parseFloat(taxRate) }
    });

    res.json({
      message: `Tax rate ${taxRate}% pushed to ${result.count} tenants in ${country}`,
      affectedCount: result.count
    });
  } catch (error) {
    console.error('Push tax rates error:', error);
    res.status(500).json({ error: 'Failed to push tax rates' });
  }
});

// ==========================================
// ADMIN IMPERSONATION
// ==========================================

// POST /api/platform/impersonate - Start impersonation session
router.post('/impersonate', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId, reason } = req.body;

    if (!tenantId || !reason) {
      return res.status(400).json({ error: 'Tenant ID and reason are required' });
    }

    // Verify tenant exists
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        users: {
          where: { role: { in: ['OWNER', 'ADMIN'] } },
          take: 1
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Create impersonation log
    const log = await prisma.impersonationLog.create({
      data: {
        adminId: req.user.id,
        tenantId,
        reason,
        ipAddress: req.ip,
        userAgent: req.headers['user-agent']
      }
    });

    // Create impersonation token
    const jwt = require('jsonwebtoken');
    const impersonationToken = jwt.sign(
      {
        id: tenant.users[0]?.id || req.user.id,
        tenantId: tenant.id,
        role: 'OWNER',
        isImpersonating: true,
        impersonationLogId: log.id,
        realAdminId: req.user.id
      },
      process.env.JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({
      message: 'Impersonation session started',
      impersonationToken,
      tenant: {
        id: tenant.id,
        businessName: tenant.businessName,
        slug: tenant.slug
      },
      logId: log.id,
      expiresIn: '2 hours'
    });
  } catch (error) {
    console.error('Start impersonation error:', error);
    res.status(500).json({ error: 'Failed to start impersonation session' });
  }
});

// POST /api/platform/impersonate/:logId/end - End impersonation session
router.post('/impersonate/:logId/end', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { logId } = req.params;
    const { actionsPerformed } = req.body;

    const log = await prisma.impersonationLog.update({
      where: { id: logId },
      data: {
        endedAt: new Date(),
        actionsPerformed: actionsPerformed ? JSON.stringify(actionsPerformed) : null
      }
    });

    res.json({ message: 'Impersonation session ended', log });
  } catch (error) {
    console.error('End impersonation error:', error);
    res.status(500).json({ error: 'Failed to end impersonation session' });
  }
});

// GET /api/platform/impersonation-logs - Get impersonation audit logs
router.get('/impersonation-logs', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const { tenantId, adminId, page = 1, limit = 20 } = req.query;

    const where = {};
    if (tenantId) where.tenantId = tenantId;
    if (adminId) where.adminId = adminId;

    const [logs, total] = await Promise.all([
      prisma.impersonationLog.findMany({
        where,
        orderBy: { startedAt: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.impersonationLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get impersonation logs error:', error);
    res.status(500).json({ error: 'Failed to fetch impersonation logs' });
  }
});

// ==========================================
// TENANT HEALTH & CHURN PREDICTION
// ==========================================

// GET /api/platform/tenant-health - Get tenant health metrics
router.get('/tenant-health', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Get all active tenants with their activity metrics
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      include: {
        tier: true,
        _count: { select: { users: true, products: true, branches: true } }
      }
    });

    // Get transaction data for each tenant
    const tenantHealth = await Promise.all(tenants.map(async (tenant) => {
      // Last 30 days transactions
      const recentSales = await prisma.sale.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: thirtyDaysAgo },
          paymentStatus: { not: 'voided' }
        }
      });

      // Previous 30 days transactions (for comparison)
      const previousSales = await prisma.sale.count({
        where: {
          tenantId: tenant.id,
          createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo },
          paymentStatus: { not: 'voided' }
        }
      });

      // Last login (approximate via audit log)
      const lastActivity = await prisma.auditLog.findFirst({
        where: { tenantId: tenant.id },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      });

      // Calculate change
      const changePercent = previousSales > 0
        ? Math.round(((recentSales - previousSales) / previousSales) * 100)
        : recentSales > 0 ? 100 : 0;

      // Calculate health score (0-100)
      let healthScore = 50; // Base score

      // Activity bonus
      if (recentSales > 0) healthScore += 20;
      if (recentSales > 50) healthScore += 10;
      if (recentSales > 200) healthScore += 10;

      // Growth bonus/penalty
      if (changePercent > 0) healthScore += Math.min(changePercent / 10, 10);
      if (changePercent < -50) healthScore -= 20;

      // Days since last activity penalty
      const daysSinceActivity = lastActivity
        ? Math.floor((new Date() - lastActivity.createdAt) / (1000 * 60 * 60 * 24))
        : 999;
      if (daysSinceActivity > 7) healthScore -= 10;
      if (daysSinceActivity > 14) healthScore -= 10;
      if (daysSinceActivity > 30) healthScore -= 20;

      // Subscription health
      const daysUntilExpiry = Math.ceil((new Date(tenant.subscriptionEnd) - new Date()) / (1000 * 60 * 60 * 24));
      if (daysUntilExpiry < 7) healthScore -= 10;

      healthScore = Math.max(0, Math.min(100, healthScore));

      // Risk level
      let riskLevel = 'low';
      if (healthScore < 40) riskLevel = 'critical';
      else if (healthScore < 60) riskLevel = 'high';
      else if (healthScore < 75) riskLevel = 'medium';

      return {
        id: tenant.id,
        businessName: tenant.businessName,
        slug: tenant.slug,
        tier: tenant.tier?.name || 'None',
        subscriptionEnd: tenant.subscriptionEnd,
        daysUntilExpiry,
        recentTransactions: recentSales,
        previousTransactions: previousSales,
        changePercent,
        daysSinceActivity,
        lastActivityAt: lastActivity?.createdAt || null,
        healthScore,
        riskLevel,
        userCount: tenant._count.users,
        productCount: tenant._count.products
      };
    }));

    // Sort by health score (lowest first = highest risk)
    tenantHealth.sort((a, b) => a.healthScore - b.healthScore);

    // Summary stats
    const summary = {
      totalTenants: tenantHealth.length,
      criticalRisk: tenantHealth.filter(t => t.riskLevel === 'critical').length,
      highRisk: tenantHealth.filter(t => t.riskLevel === 'high').length,
      mediumRisk: tenantHealth.filter(t => t.riskLevel === 'medium').length,
      lowRisk: tenantHealth.filter(t => t.riskLevel === 'low').length,
      averageHealthScore: Math.round(tenantHealth.reduce((sum, t) => sum + t.healthScore, 0) / tenantHealth.length) || 0
    };

    res.json({ tenants: tenantHealth, summary });
  } catch (error) {
    console.error('Get tenant health error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant health metrics' });
  }
});

// ==========================================
// FEATURE FLAG CHECK (For tenant middleware)
// ==========================================

// GET /api/platform/check-feature/:code - Check if tenant has access to a feature
router.get('/check-feature/:code', authenticate, async (req, res) => {
  try {
    const { code } = req.params;
    const tenantId = req.user.tenantId;

    // Super admins have access to everything
    if (req.user.isSuperAdmin) {
      return res.json({ hasAccess: true, reason: 'super_admin' });
    }

    // Get tenant with tier
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      include: {
        tier: {
          include: {
            features: {
              include: { feature: true }
            }
          }
        }
      }
    });

    if (!tenant) {
      return res.json({ hasAccess: false, reason: 'tenant_not_found' });
    }

    // Check if subscription is active
    if (new Date() > new Date(tenant.subscriptionEnd) && !tenant.isInGracePeriod) {
      return res.json({ hasAccess: false, reason: 'subscription_expired' });
    }

    // Check if feature is enabled for tenant's tier
    if (!tenant.tier) {
      // No tier = basic access only
      return res.json({ hasAccess: false, reason: 'no_tier_assigned' });
    }

    const hasFeature = tenant.tier.features.some(
      tf => tf.feature.code === code && tf.isEnabled
    );

    res.json({
      hasAccess: hasFeature,
      reason: hasFeature ? 'tier_enabled' : 'tier_disabled',
      tier: tenant.tier.name
    });
  } catch (error) {
    console.error('Check feature error:', error);
    res.status(500).json({ error: 'Failed to check feature access' });
  }
});

// ==========================================
// SEED DEFAULT TIERS AND FEATURES
// ==========================================

// POST /api/platform/seed-defaults - Seed default tiers and features
router.post('/seed-defaults', authenticate, requireSuperAdmin, async (req, res) => {
  try {
    // Default features
    const defaultFeatures = [
      { code: 'basic_pos', name: 'Basic POS', category: 'core', description: 'Core point of sale functionality' },
      { code: 'inventory_management', name: 'Inventory Management', category: 'inventory', description: 'Stock tracking and alerts' },
      { code: 'multi_branch', name: 'Multi-Branch Support', category: 'operations', description: 'Manage multiple locations' },
      { code: 'analytics_basic', name: 'Basic Analytics', category: 'analytics', description: 'Sales reports and charts' },
      { code: 'analytics_advanced', name: 'Advanced Analytics', category: 'analytics', description: 'Predictive insights and trends' },
      { code: 'smart_fifo', name: 'Smart FIFO', category: 'inventory', description: 'First-in-first-out inventory tracking' },
      { code: 'customer_management', name: 'Customer Management', category: 'crm', description: 'Customer database and loyalty' },
      { code: 'expense_tracking', name: 'Expense Tracking', category: 'finance', description: 'Record and categorize expenses' },
      { code: 'staff_management', name: 'Staff Management', category: 'hr', description: 'Employee roles and permissions' },
      { code: 'api_access', name: 'API Access', category: 'integrations', description: 'REST API for integrations' },
      { code: 'export_data', name: 'Data Export', category: 'data', description: 'Export reports to CSV/PDF' },
      { code: 'audit_logs', name: 'Audit Logs', category: 'security', description: 'Detailed activity tracking' },
      { code: 'void_management', name: 'Void Management', category: 'security', description: 'Transaction void requests' },
      { code: 'product_expiry', name: 'Product Expiry Tracking', category: 'inventory', description: 'Track product expiration dates' },
      { code: 'barcode_scanning', name: 'Barcode Scanning', category: 'core', description: 'Scan products by barcode' }
    ];

    // Upsert features
    for (const feature of defaultFeatures) {
      await prisma.feature.upsert({
        where: { code: feature.code },
        update: feature,
        create: feature
      });
    }

    // Default tiers
    const basicTier = await prisma.subscriptionTier.upsert({
      where: { name: 'Basic' },
      update: {},
      create: {
        name: 'Basic',
        description: 'Essential POS features for small businesses',
        monthlyPrice: 29.99,
        annualPrice: 299.99,
        maxUsers: 3,
        maxBranches: 1,
        maxProducts: 100,
        sortOrder: 1
      }
    });

    const professionalTier = await prisma.subscriptionTier.upsert({
      where: { name: 'Professional' },
      update: {},
      create: {
        name: 'Professional',
        description: 'Advanced features for growing businesses',
        monthlyPrice: 79.99,
        annualPrice: 799.99,
        maxUsers: 10,
        maxBranches: 3,
        maxProducts: 500,
        sortOrder: 2
      }
    });

    const enterpriseTier = await prisma.subscriptionTier.upsert({
      where: { name: 'Enterprise' },
      update: {},
      create: {
        name: 'Enterprise',
        description: 'Full platform access for large organizations',
        monthlyPrice: 199.99,
        annualPrice: 1999.99,
        maxUsers: 50,
        maxBranches: 20,
        maxProducts: 5000,
        sortOrder: 3
      }
    });

    // Get all features
    const allFeatures = await prisma.feature.findMany();
    const featureMap = Object.fromEntries(allFeatures.map(f => [f.code, f.id]));

    // Assign features to tiers
    const basicFeatures = ['basic_pos', 'inventory_management', 'customer_management', 'expense_tracking', 'barcode_scanning'];
    const proFeatures = [...basicFeatures, 'analytics_basic', 'staff_management', 'export_data', 'audit_logs', 'void_management', 'product_expiry'];
    const enterpriseFeatures = [...proFeatures, 'multi_branch', 'analytics_advanced', 'smart_fifo', 'api_access'];

    // Clear and reassign tier features
    await prisma.tierFeature.deleteMany({ where: { tierId: { in: [basicTier.id, professionalTier.id, enterpriseTier.id] } } });

    const tierFeatureData = [
      ...basicFeatures.map(code => ({ tierId: basicTier.id, featureId: featureMap[code] })),
      ...proFeatures.map(code => ({ tierId: professionalTier.id, featureId: featureMap[code] })),
      ...enterpriseFeatures.map(code => ({ tierId: enterpriseTier.id, featureId: featureMap[code] }))
    ].filter(tf => tf.featureId); // Filter out any undefined

    await prisma.tierFeature.createMany({ data: tierFeatureData });

    res.json({
      message: 'Default tiers and features seeded successfully',
      tiers: [basicTier, professionalTier, enterpriseTier],
      featuresCount: allFeatures.length
    });
  } catch (error) {
    console.error('Seed defaults error:', error);
    res.status(500).json({ error: 'Failed to seed defaults' });
  }
});

module.exports = router;
