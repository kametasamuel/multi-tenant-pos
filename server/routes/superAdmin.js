const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { authenticate, requireSuperAdmin, logAudit } = require('../middleware/auth');
const {
  validateApproval,
  validateRejection,
  validateSubscriptionUpdate,
  validateTenantStatus
} = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require super admin authentication
router.use(authenticate);
router.use(requireSuperAdmin);

// GET /api/super-admin/dashboard - Get dashboard stats
router.get('/dashboard', async (req, res) => {
  try {
    const [
      pendingApplications,
      totalApplications,
      activeTenants,
      inactiveTenants,
      expiringTenants
    ] = await Promise.all([
      prisma.tenantApplication.count({ where: { status: 'PENDING' } }),
      prisma.tenantApplication.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.tenant.count({ where: { isActive: false } }),
      prisma.tenant.count({
        where: {
          isActive: true,
          subscriptionEnd: {
            lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
          }
        }
      })
    ]);

    // Get recent applications
    const recentApplications = await prisma.tenantApplication.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        businessName: true,
        businessEmail: true,
        status: true,
        createdAt: true
      }
    });

    // Get tenants expiring soon
    const expiringSoon = await prisma.tenant.findMany({
      where: {
        isActive: true,
        subscriptionEnd: {
          lte: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
        }
      },
      take: 5,
      orderBy: { subscriptionEnd: 'asc' },
      select: {
        id: true,
        businessName: true,
        subscriptionEnd: true
      }
    });

    res.json({
      stats: {
        pendingApplications,
        totalApplications,
        activeTenants,
        inactiveTenants,
        expiringTenants
      },
      recentApplications,
      expiringSoon
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// GET /api/super-admin/applications - List all applications
router.get('/applications', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status: status.toUpperCase() } : {};

    const [applications, total] = await Promise.all([
      prisma.tenantApplication.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          businessName: true,
          businessEmail: true,
          businessPhone: true,
          businessLogo: true,
          ownerFullName: true,
          ownerEmail: true,
          status: true,
          rejectionReason: true,
          createdAt: true,
          reviewedAt: true
        }
      }),
      prisma.tenantApplication.count({ where })
    ]);

    res.json({
      applications,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List applications error:', error);
    res.status(500).json({ error: 'Failed to list applications' });
  }
});

// GET /api/super-admin/applications/:id - Get application details
router.get('/applications/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.tenantApplication.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        businessEmail: true,
        businessPhone: true,
        businessLogo: true,
        businessAddress: true,
        ownerFullName: true,
        ownerEmail: true,
        ownerPhone: true,
        status: true,
        rejectionReason: true,
        reviewedBy: true,
        reviewedAt: true,
        createdAt: true,
        updatedAt: true
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Get application error:', error);
    res.status(500).json({ error: 'Failed to get application' });
  }
});

// GET /api/super-admin/check-slug/:slug - Check if slug is available
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Validate slug format (lowercase alphanumeric with hyphens, 3-30 chars)
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
    if (!slugRegex.test(slug)) {
      return res.json({
        available: false,
        error: 'Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only (no hyphens at start/end)'
      });
    }

    // Reserved slugs that cannot be used
    const reservedSlugs = ['admin', 'super-admin', 'api', 'login', 'signup', 'dashboard', 'app', 'www'];
    if (reservedSlugs.includes(slug)) {
      return res.json({ available: false, error: 'This slug is reserved and cannot be used' });
    }

    // Check if slug exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { slug }
    });

    res.json({ available: !existingTenant });
  } catch (error) {
    console.error('Check slug error:', error);
    res.status(500).json({ error: 'Failed to check slug availability' });
  }
});

// POST /api/super-admin/applications/:id/approve - Approve and create tenant
router.post('/applications/:id/approve', validateApproval, async (req, res) => {
  try {
    const { id } = req.params;
    const { subscriptionMonths, slug } = req.body;

    // Validate slug is required
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'URL slug is required' });
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9][a-z0-9-]{1,28}[a-z0-9]$/;
    if (!slugRegex.test(slug)) {
      return res.status(400).json({
        error: 'Slug must be 3-30 characters, lowercase letters, numbers, and hyphens only (no hyphens at start/end)'
      });
    }

    // Check reserved slugs
    const reservedSlugs = ['admin', 'super-admin', 'api', 'login', 'signup', 'dashboard', 'app', 'www'];
    if (reservedSlugs.includes(slug)) {
      return res.status(400).json({ error: 'This slug is reserved and cannot be used' });
    }

    // Check if slug is available
    const existingSlug = await prisma.tenant.findUnique({
      where: { slug }
    });

    if (existingSlug) {
      return res.status(400).json({ error: 'This URL slug is already in use' });
    }

    // Get application
    const application = await prisma.tenantApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'PENDING') {
      return res.status(400).json({ error: 'Application has already been processed' });
    }

    // Check if business name is still available
    const existingTenant = await prisma.tenant.findUnique({
      where: { businessName: application.businessName }
    });

    if (existingTenant) {
      return res.status(400).json({ error: 'A business with this name already exists' });
    }

    // Generate a username from business name
    const baseUsername = application.businessName
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .substring(0, 15) + '_admin';

    // Calculate subscription end date
    const subscriptionEnd = new Date();
    subscriptionEnd.setMonth(subscriptionEnd.getMonth() + parseInt(subscriptionMonths));

    // Use transaction to create tenant, admin user, main branch, and update application
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant with slug
      const tenant = await tx.tenant.create({
        data: {
          businessName: application.businessName,
          slug: slug,
          businessLogo: application.businessLogo,
          subscriptionStart: new Date(),
          subscriptionEnd,
          isActive: true
        }
      });

      // Create main branch for the tenant using business details from signup
      const mainBranch = await tx.branch.create({
        data: {
          name: application.businessName,
          address: application.businessAddress,
          phone: application.businessPhone,
          isMain: true,
          isActive: true,
          tenantId: tenant.id
        }
      });

      // Create admin user assigned to main branch
      const adminUser = await tx.user.create({
        data: {
          username: baseUsername,
          password: application.password, // Already hashed
          fullName: application.ownerFullName,
          role: 'OWNER',
          isActive: true,
          isSuperAdmin: false,
          tenantId: tenant.id,
          branchId: mainBranch.id
        }
      });

      // Update application status
      await tx.tenantApplication.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedBy: req.user.id,
          reviewedAt: new Date()
        }
      });

      return { tenant, adminUser, mainBranch };
    });

    // Log audit
    await logAudit(
      req.user.tenantId,
      req.user.id,
      'application_approved',
      `Approved application for ${application.businessName}`,
      { applicationId: id, tenantId: result.tenant.id }
    );

    res.json({
      message: 'Application approved successfully',
      tenant: {
        id: result.tenant.id,
        businessName: result.tenant.businessName,
        slug: result.tenant.slug,
        subscriptionEnd: result.tenant.subscriptionEnd,
        loginUrl: `/${result.tenant.slug}/login`
      },
      credentials: {
        username: result.adminUser.username,
        // Password is the one they set during signup - display message
        note: 'The admin should use the password they set during signup'
      }
    });
  } catch (error) {
    console.error('Approval error:', error);
    res.status(500).json({ error: 'Failed to approve application' });
  }
});

// POST /api/super-admin/applications/:id/reject - Reject application
router.post('/applications/:id/reject', validateRejection, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const application = await prisma.tenantApplication.findUnique({
      where: { id }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'PENDING') {
      return res.status(400).json({ error: 'Application has already been processed' });
    }

    await prisma.tenantApplication.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        reviewedBy: req.user.id,
        reviewedAt: new Date()
      }
    });

    // Log audit
    await logAudit(
      req.user.tenantId,
      req.user.id,
      'application_rejected',
      `Rejected application for ${application.businessName}`,
      { applicationId: id, reason }
    );

    res.json({ message: 'Application rejected successfully' });
  } catch (error) {
    console.error('Rejection error:', error);
    res.status(500).json({ error: 'Failed to reject application' });
  }
});

// GET /api/super-admin/tenants - List all tenants
router.get('/tenants', async (req, res) => {
  try {
    const { search, status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.businessName = { contains: search, mode: 'insensitive' };
    }

    const [tenants, total] = await Promise.all([
      prisma.tenant.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          businessName: true,
          slug: true,
          businessLogo: true,
          subscriptionStart: true,
          subscriptionEnd: true,
          isActive: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              products: true,
              sales: true
            }
          }
        }
      }),
      prisma.tenant.count({ where })
    ]);

    res.json({
      tenants,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('List tenants error:', error);
    res.status(500).json({ error: 'Failed to list tenants' });
  }
});

// GET /api/super-admin/tenants/:id - Get tenant details with stats
router.get('/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            users: true,
            products: true,
            sales: true,
            expenses: true
          }
        },
        users: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            isActive: true,
            createdAt: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Get sales total for this tenant
    const salesAggregate = await prisma.sale.aggregate({
      where: { tenantId: id },
      _sum: { finalAmount: true }
    });

    res.json({
      tenant: {
        ...tenant,
        totalSales: salesAggregate._sum.finalAmount || 0
      }
    });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Failed to get tenant details' });
  }
});

// PUT /api/super-admin/tenants/:id/status - Activate/deactivate tenant
router.put('/tenants/:id/status', validateTenantStatus, async (req, res) => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    await prisma.tenant.update({
      where: { id },
      data: { isActive }
    });

    // Log audit
    await logAudit(
      req.user.tenantId,
      req.user.id,
      isActive ? 'tenant_activated' : 'tenant_deactivated',
      `${isActive ? 'Activated' : 'Deactivated'} tenant: ${tenant.businessName}`,
      { tenantId: id }
    );

    res.json({
      message: `Tenant ${isActive ? 'activated' : 'deactivated'} successfully`
    });
  } catch (error) {
    console.error('Update tenant status error:', error);
    res.status(500).json({ error: 'Failed to update tenant status' });
  }
});

// PUT /api/super-admin/tenants/:id/subscription - Extend subscription
router.put('/tenants/:id/subscription', validateSubscriptionUpdate, async (req, res) => {
  try {
    const { id } = req.params;
    const { months, days } = req.body;

    const tenant = await prisma.tenant.findUnique({ where: { id } });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Calculate new end date
    let newEndDate = new Date(tenant.subscriptionEnd);
    if (newEndDate < new Date()) {
      newEndDate = new Date(); // Start from today if already expired
    }

    if (months) {
      newEndDate.setMonth(newEndDate.getMonth() + parseInt(months));
    }
    if (days) {
      newEndDate.setDate(newEndDate.getDate() + parseInt(days));
    }

    await prisma.tenant.update({
      where: { id },
      data: { subscriptionEnd: newEndDate }
    });

    // Log audit
    await logAudit(
      req.user.tenantId,
      req.user.id,
      'subscription_extended',
      `Extended subscription for ${tenant.businessName}`,
      { tenantId: id, months, days, newEndDate }
    );

    res.json({
      message: 'Subscription extended successfully',
      subscriptionEnd: newEndDate
    });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Failed to extend subscription' });
  }
});

// ============ GLOBAL ANALYTICS ROUTES ============

// GET /api/super-admin/analytics - Get global analytics overview
router.get('/analytics', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    // Build date filter
    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const salesWhere = hasDateFilter ? { createdAt: dateFilter } : {};

    // Get aggregate stats across all tenants
    const [
      totalRevenue,
      totalTransactions,
      activeTenants,
      totalProducts,
      totalUsers,
      recentSales
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: salesWhere,
        _sum: { finalAmount: true }
      }),
      prisma.sale.count({ where: salesWhere }),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.product.count(),
      prisma.user.count({ where: { isActive: true, isSuperAdmin: false } }),
      prisma.sale.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { businessName: true } },
          user: { select: { fullName: true } }
        }
      })
    ]);

    // Get sales by day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailySales = await prisma.sale.groupBy({
      by: ['createdAt'],
      where: {
        createdAt: { gte: thirtyDaysAgo }
      },
      _sum: { finalAmount: true },
      _count: true
    });

    res.json({
      stats: {
        totalRevenue: totalRevenue._sum.finalAmount || 0,
        totalTransactions,
        activeTenants,
        totalProducts,
        totalUsers
      },
      recentSales: recentSales.map(sale => ({
        id: sale.id,
        amount: sale.finalAmount,
        tenant: sale.tenant.businessName,
        cashier: sale.user.fullName,
        date: sale.createdAt
      })),
      dailySales
    });
  } catch (error) {
    console.error('Analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

// GET /api/super-admin/analytics/revenue-by-tenant - Revenue breakdown by tenant
router.get('/analytics/revenue-by-tenant', async (req, res) => {
  try {
    const { startDate, endDate, limit = 10 } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    // Get all tenants with their sales totals
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        currency: true,
        currencySymbol: true,
        sales: {
          where: hasDateFilter ? { createdAt: dateFilter } : {},
          select: { finalAmount: true }
        }
      }
    });

    // Calculate revenue for each tenant
    const revenueByTenant = tenants.map(tenant => ({
      id: tenant.id,
      businessName: tenant.businessName,
      businessType: tenant.businessType,
      currency: tenant.currency,
      currencySymbol: tenant.currencySymbol,
      totalRevenue: tenant.sales.reduce((sum, sale) => sum + sale.finalAmount, 0),
      transactionCount: tenant.sales.length
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue)
    .slice(0, parseInt(limit));

    res.json({ revenueByTenant });
  } catch (error) {
    console.error('Revenue by tenant error:', error);
    res.status(500).json({ error: 'Failed to load revenue by tenant' });
  }
});

// GET /api/super-admin/analytics/subscription-health - Subscription health overview
router.get('/analytics/subscription-health', async (req, res) => {
  try {
    const now = new Date();
    const sevenDays = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDays = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const [
      active,
      inactive,
      expiringSoon,
      expiringThisMonth,
      expired
    ] = await Promise.all([
      prisma.tenant.count({
        where: {
          isActive: true,
          subscriptionEnd: { gt: thirtyDays }
        }
      }),
      prisma.tenant.count({ where: { isActive: false } }),
      prisma.tenant.count({
        where: {
          isActive: true,
          subscriptionEnd: { gt: now, lte: sevenDays }
        }
      }),
      prisma.tenant.count({
        where: {
          isActive: true,
          subscriptionEnd: { gt: sevenDays, lte: thirtyDays }
        }
      }),
      prisma.tenant.count({
        where: {
          isActive: true,
          subscriptionEnd: { lte: now }
        }
      })
    ]);

    // Get list of expiring tenants
    const expiringTenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        subscriptionEnd: { lte: thirtyDays }
      },
      orderBy: { subscriptionEnd: 'asc' },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        subscriptionEnd: true
      }
    });

    res.json({
      summary: {
        healthy: active,
        inactive,
        expiringSoon,
        expiringThisMonth,
        expired
      },
      expiringTenants
    });
  } catch (error) {
    console.error('Subscription health error:', error);
    res.status(500).json({ error: 'Failed to load subscription health' });
  }
});

// GET /api/super-admin/analytics/staff-productivity - Staff performance across all tenants
router.get('/analytics/staff-productivity', async (req, res) => {
  try {
    const { startDate, endDate, limit = 20 } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    // Get users with their sales data
    const users = await prisma.user.findMany({
      where: {
        isActive: true,
        isSuperAdmin: false,
        role: { in: ['CASHIER', 'MANAGER', 'OWNER', 'ADMIN'] }
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        tenant: {
          select: {
            businessName: true,
            currencySymbol: true
          }
        },
        sales: {
          where: hasDateFilter ? { createdAt: dateFilter } : {},
          select: {
            finalAmount: true,
            createdAt: true
          }
        }
      }
    });

    // Calculate productivity metrics
    const staffProductivity = users
      .map(user => ({
        id: user.id,
        name: user.fullName,
        role: user.role,
        tenant: user.tenant.businessName,
        currencySymbol: user.tenant.currencySymbol,
        totalSales: user.sales.reduce((sum, sale) => sum + sale.finalAmount, 0),
        transactionCount: user.sales.length,
        avgTransactionValue: user.sales.length > 0
          ? user.sales.reduce((sum, sale) => sum + sale.finalAmount, 0) / user.sales.length
          : 0
      }))
      .filter(staff => staff.transactionCount > 0)
      .sort((a, b) => b.totalSales - a.totalSales)
      .slice(0, parseInt(limit));

    res.json({ staffProductivity });
  } catch (error) {
    console.error('Staff productivity error:', error);
    res.status(500).json({ error: 'Failed to load staff productivity' });
  }
});

// GET /api/super-admin/analytics/industry-performance - Performance by business type
router.get('/analytics/industry-performance', async (req, res) => {
  try {
    // Get all tenants grouped by business type with their sales
    const tenants = await prisma.tenant.findMany({
      where: { isActive: true },
      select: {
        businessType: true,
        sales: {
          select: { finalAmount: true }
        },
        products: {
          select: { id: true }
        }
      }
    });

    // Group by business type
    const industryMap = {};
    tenants.forEach(tenant => {
      const type = tenant.businessType || 'OTHER';
      if (!industryMap[type]) {
        industryMap[type] = {
          businessType: type,
          tenantCount: 0,
          totalRevenue: 0,
          totalTransactions: 0,
          totalProducts: 0
        };
      }
      industryMap[type].tenantCount++;
      industryMap[type].totalRevenue += tenant.sales.reduce((sum, sale) => sum + sale.finalAmount, 0);
      industryMap[type].totalTransactions += tenant.sales.length;
      industryMap[type].totalProducts += tenant.products.length;
    });

    const industryPerformance = Object.values(industryMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    res.json({ industryPerformance });
  } catch (error) {
    console.error('Industry performance error:', error);
    res.status(500).json({ error: 'Failed to load industry performance' });
  }
});

// GET /api/super-admin/analytics/anomalies - Detect unusual patterns
router.get('/analytics/anomalies', async (req, res) => {
  try {
    const anomalies = [];
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // 1. Check for tenants with expired subscriptions but still active
    const expiredButActive = await prisma.tenant.findMany({
      where: {
        isActive: true,
        subscriptionEnd: { lt: now }
      },
      select: {
        id: true,
        businessName: true,
        subscriptionEnd: true
      }
    });

    expiredButActive.forEach(tenant => {
      anomalies.push({
        type: 'EXPIRED_SUBSCRIPTION',
        severity: 'HIGH',
        message: `${tenant.businessName} has an expired subscription but is still active`,
        tenantId: tenant.id,
        tenantName: tenant.businessName,
        date: tenant.subscriptionEnd
      });
    });

    // 2. Check for unusually high transaction amounts in last 24 hours
    const recentHighValueSales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: yesterday },
        finalAmount: { gte: 1000000 } // 1 million in base currency
      },
      include: {
        tenant: { select: { businessName: true } },
        user: { select: { fullName: true } }
      }
    });

    recentHighValueSales.forEach(sale => {
      anomalies.push({
        type: 'HIGH_VALUE_TRANSACTION',
        severity: 'MEDIUM',
        message: `Unusually high transaction of ${sale.finalAmount} at ${sale.tenant.businessName}`,
        tenantId: sale.tenantId,
        tenantName: sale.tenant.businessName,
        amount: sale.finalAmount,
        cashier: sale.user.fullName,
        date: sale.createdAt
      });
    });

    // 3. Check for products with negative stock
    const negativeStock = await prisma.product.findMany({
      where: {
        stockQuantity: { lt: 0 },
        category: 'PRODUCT'
      },
      include: {
        tenant: { select: { businessName: true } }
      }
    });

    negativeStock.forEach(product => {
      anomalies.push({
        type: 'NEGATIVE_STOCK',
        severity: 'HIGH',
        message: `${product.name} at ${product.tenant.businessName} has negative stock (${product.stockQuantity})`,
        tenantId: product.tenantId,
        tenantName: product.tenant.businessName,
        productName: product.name,
        stockQuantity: product.stockQuantity
      });
    });

    // 4. Check for inactive users with recent transactions
    const inactiveUserSales = await prisma.sale.findMany({
      where: {
        createdAt: { gte: yesterday },
        user: { isActive: false }
      },
      include: {
        tenant: { select: { businessName: true } },
        user: { select: { fullName: true, isActive: true } }
      }
    });

    inactiveUserSales.forEach(sale => {
      anomalies.push({
        type: 'INACTIVE_USER_ACTIVITY',
        severity: 'HIGH',
        message: `Inactive user ${sale.user.fullName} made a transaction at ${sale.tenant.businessName}`,
        tenantId: sale.tenantId,
        tenantName: sale.tenant.businessName,
        userName: sale.user.fullName,
        date: sale.createdAt
      });
    });

    // Sort by severity (HIGH first)
    const severityOrder = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    anomalies.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    res.json({
      anomalies,
      summary: {
        total: anomalies.length,
        high: anomalies.filter(a => a.severity === 'HIGH').length,
        medium: anomalies.filter(a => a.severity === 'MEDIUM').length,
        low: anomalies.filter(a => a.severity === 'LOW').length
      }
    });
  } catch (error) {
    console.error('Anomalies detection error:', error);
    res.status(500).json({ error: 'Failed to detect anomalies' });
  }
});

// ============ BRANCH REQUEST MANAGEMENT ============

// GET /api/super-admin/branch-requests - Get all branch requests
router.get('/branch-requests', async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = status ? { status: status.toUpperCase() } : {};

    const [requests, total] = await Promise.all([
      prisma.branchRequest.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          requester: {
            select: { id: true, fullName: true, username: true }
          },
          reviewer: {
            select: { id: true, fullName: true, username: true }
          },
          tenant: {
            select: { id: true, businessName: true }
          }
        }
      }),
      prisma.branchRequest.count({ where })
    ]);

    res.json({
      requests,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get branch requests error:', error);
    res.status(500).json({ error: 'Failed to get branch requests' });
  }
});

// POST /api/super-admin/branch-requests/:id/approve - Approve branch request
router.post('/branch-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.branchRequest.findUnique({
      where: { id },
      include: { tenant: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Branch request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    // Check if branch name already exists for this tenant
    const existingBranch = await prisma.branch.findFirst({
      where: {
        tenantId: request.tenantId,
        name: { equals: request.branchName, mode: 'insensitive' }
      }
    });

    if (existingBranch) {
      return res.status(400).json({ error: 'A branch with this name already exists for this tenant' });
    }

    // Use transaction to create branch and update request
    const result = await prisma.$transaction(async (tx) => {
      // Create the branch
      const branch = await tx.branch.create({
        data: {
          name: request.branchName,
          address: request.address,
          phone: request.phone,
          isMain: false,
          isActive: true,
          tenantId: request.tenantId
        }
      });

      // Update request status
      await tx.branchRequest.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewerId: req.user.id,
          reviewedAt: new Date()
        }
      });

      return { branch };
    });

    // Log audit
    await logAudit(
      req.user.tenantId,
      req.user.id,
      'branch_request_approved',
      `Approved branch request: ${request.branchName} for ${request.tenant.businessName}`,
      { requestId: id, branchId: result.branch.id, tenantId: request.tenantId }
    );

    res.json({
      message: 'Branch request approved successfully',
      branch: result.branch
    });
  } catch (error) {
    console.error('Approve branch request error:', error);
    res.status(500).json({ error: 'Failed to approve branch request' });
  }
});

// POST /api/super-admin/branch-requests/:id/reject - Reject branch request
router.post('/branch-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 10) {
      return res.status(400).json({ error: 'Rejection reason must be at least 10 characters' });
    }

    const request = await prisma.branchRequest.findUnique({
      where: { id },
      include: { tenant: true }
    });

    if (!request) {
      return res.status(404).json({ error: 'Branch request not found' });
    }

    if (request.status !== 'PENDING') {
      return res.status(400).json({ error: 'Request has already been processed' });
    }

    await prisma.branchRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason,
        reviewerId: req.user.id,
        reviewedAt: new Date()
      }
    });

    // Log audit
    await logAudit(
      req.user.tenantId,
      req.user.id,
      'branch_request_rejected',
      `Rejected branch request: ${request.branchName} for ${request.tenant.businessName}`,
      { requestId: id, tenantId: request.tenantId, reason }
    );

    res.json({ message: 'Branch request rejected successfully' });
  } catch (error) {
    console.error('Reject branch request error:', error);
    res.status(500).json({ error: 'Failed to reject branch request' });
  }
});

module.exports = router;
