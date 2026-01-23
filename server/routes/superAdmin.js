const express = require('express');
const { PrismaClient, Prisma } = require('@prisma/client');
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
    // Exclude "System Admin" placeholder tenant from all counts
    const excludeSystemAdmin = { businessName: { not: 'System Admin' } };

    const [
      pendingApplications,
      totalApplications,
      activeTenants,
      inactiveTenants,
      expiringTenants
    ] = await Promise.all([
      prisma.tenantApplication.count({ where: { status: 'PENDING' } }),
      prisma.tenantApplication.count(),
      prisma.tenant.count({ where: { isActive: true, ...excludeSystemAdmin } }),
      prisma.tenant.count({ where: { isActive: false, ...excludeSystemAdmin } }),
      prisma.tenant.count({
        where: {
          isActive: true,
          ...excludeSystemAdmin,
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

    // Get tenants expiring soon (excluding System Admin)
    const expiringSoon = await prisma.tenant.findMany({
      where: {
        isActive: true,
        ...excludeSystemAdmin,
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

    // Always exclude the System Admin placeholder tenant
    const where = {
      businessName: { not: 'System Admin' }
    };
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (search) {
      where.AND = [
        { businessName: { not: 'System Admin' } },
        { businessName: { contains: search, mode: 'insensitive' } }
      ];
      delete where.businessName;
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
          businessType: true,
          businessLogo: true,
          country: true,
          currency: true,
          currencySymbol: true,
          taxRate: true,
          subscriptionStart: true,
          subscriptionEnd: true,
          gracePeriodEnd: true,
          isActive: true,
          isInGracePeriod: true,
          lastActivityAt: true,
          createdAt: true,
          _count: {
            select: {
              users: true,
              products: true,
              sales: true,
              branches: true
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
            expenses: true,
            branches: true
          }
        },
        users: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            isActive: true,
            createdAt: true,
            branch: { select: { name: true } }
          },
          orderBy: [
            { role: 'asc' },
            { createdAt: 'asc' }
          ]
        },
        branches: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
            isMain: true,
            _count: {
              select: { users: true, sales: true }
            }
          },
          orderBy: [
            { isMain: 'desc' },
            { name: 'asc' }
          ]
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

// PUT /api/super-admin/tenants/:id/slug - Update tenant slug
router.put('/tenants/:id/slug', async (req, res) => {
  try {
    const { id } = req.params;
    const { slug } = req.body;

    // Validate slug is provided
    if (!slug || typeof slug !== 'string') {
      return res.status(400).json({ error: 'URL slug is required' });
    }

    // Validate slug format (lowercase alphanumeric with hyphens, 3-30 chars)
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

    // Check if tenant exists
    const tenant = await prisma.tenant.findUnique({ where: { id } });
    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Check if slug is available (excluding current tenant)
    const existingSlug = await prisma.tenant.findFirst({
      where: {
        slug,
        id: { not: id }
      }
    });

    if (existingSlug) {
      return res.status(400).json({ error: 'This URL slug is already in use by another tenant' });
    }

    // Update the tenant's slug
    const updatedTenant = await prisma.tenant.update({
      where: { id },
      data: { slug }
    });

    // Log audit
    await logAudit(
      req.user.tenantId,
      req.user.id,
      'tenant_slug_updated',
      `Updated slug for ${tenant.businessName}: ${tenant.slug || 'none'} → ${slug}`,
      { tenantId: id, oldSlug: tenant.slug, newSlug: slug }
    );

    res.json({
      message: 'Tenant slug updated successfully',
      tenant: {
        id: updatedTenant.id,
        businessName: updatedTenant.businessName,
        slug: updatedTenant.slug,
        loginUrl: `/${updatedTenant.slug}/login`
      }
    });
  } catch (error) {
    console.error('Update tenant slug error:', error);
    res.status(500).json({ error: 'Failed to update tenant slug' });
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

// DELETE /api/super-admin/tenants/:id - Delete tenant and all related data
router.delete('/tenants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { confirmationName } = req.body;

    // Get tenant details first
    const tenant = await prisma.tenant.findUnique({
      where: { id },
      select: { businessName: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Require confirmation by typing the business name (case insensitive)
    if (confirmationName?.toLowerCase() !== tenant.businessName.toLowerCase()) {
      return res.status(400).json({
        error: 'Confirmation failed. Please type the business name to confirm deletion.',
        expectedName: tenant.businessName
      });
    }

    // Delete in transaction to ensure all related data is removed
    await prisma.$transaction(async (tx) => {
      // Delete all branch requests
      await tx.branchRequest.deleteMany({ where: { tenantId: id } });

      // Delete all security requests
      await tx.securityRequest.deleteMany({ where: { tenantId: id } });

      // Delete all audit logs
      await tx.auditLog.deleteMany({ where: { tenantId: id } });

      // Delete all sale items (through sales)
      const sales = await tx.sale.findMany({ where: { tenantId: id }, select: { id: true } });
      const saleIds = sales.map(s => s.id);
      if (saleIds.length > 0) {
        await tx.saleItem.deleteMany({ where: { saleId: { in: saleIds } } });
      }

      // Delete all sales
      await tx.sale.deleteMany({ where: { tenantId: id } });

      // Delete all expenses
      await tx.expense.deleteMany({ where: { tenantId: id } });

      // Delete all customers
      await tx.customer.deleteMany({ where: { tenantId: id } });

      // Delete all products
      await tx.product.deleteMany({ where: { tenantId: id } });

      // Delete all users
      await tx.user.deleteMany({ where: { tenantId: id } });

      // Delete all branches
      await tx.branch.deleteMany({ where: { tenantId: id } });

      // Finally delete the tenant
      await tx.tenant.delete({ where: { id } });
    });

    // Log the deletion (to super admin's audit log)
    await logAudit(
      req.user.tenantId,
      req.user.id,
      'tenant_deleted',
      `Deleted tenant: ${tenant.businessName}`,
      { deletedTenantId: id, businessName: tenant.businessName }
    );

    res.json({
      message: `Tenant "${tenant.businessName}" and all related data has been permanently deleted.`
    });
  } catch (error) {
    console.error('Delete tenant error:', error);
    res.status(500).json({ error: 'Failed to delete tenant. Please try again.' });
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
          cashier: { select: { fullName: true } }
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
        cashier: sale.cashier?.fullName || 'Unknown',
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

    // Get all tenants with their sales totals (excluding System Admin)
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        businessName: { not: 'System Admin' }
      },
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
    const excludeSysAdmin = { businessName: { not: 'System Admin' } };

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
          ...excludeSysAdmin,
          subscriptionEnd: { gt: thirtyDays }
        }
      }),
      prisma.tenant.count({ where: { isActive: false, ...excludeSysAdmin } }),
      prisma.tenant.count({
        where: {
          isActive: true,
          ...excludeSysAdmin,
          subscriptionEnd: { gt: now, lte: sevenDays }
        }
      }),
      prisma.tenant.count({
        where: {
          isActive: true,
          ...excludeSysAdmin,
          subscriptionEnd: { gt: sevenDays, lte: thirtyDays }
        }
      }),
      prisma.tenant.count({
        where: {
          isActive: true,
          ...excludeSysAdmin,
          subscriptionEnd: { lte: now }
        }
      })
    ]);

    // Get list of expiring tenants (excluding System Admin)
    const expiringTenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        ...excludeSysAdmin,
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
    // Get all tenants grouped by business type with their sales (excluding System Admin)
    const tenants = await prisma.tenant.findMany({
      where: {
        isActive: true,
        businessName: { not: 'System Admin' }
      },
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
        cashier: { select: { fullName: true } }
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
        cashier: sale.cashier?.fullName || 'Unknown',
        date: sale.createdAt
      });
    });

    // 3. Check for products with negative stock
    const negativeStock = await prisma.product.findMany({
      where: {
        stockQuantity: { lt: 0 },
        type: 'PRODUCT'
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
        cashier: { isActive: false }
      },
      include: {
        tenant: { select: { businessName: true } },
        cashier: { select: { fullName: true, isActive: true } }
      }
    });

    inactiveUserSales.forEach(sale => {
      anomalies.push({
        type: 'INACTIVE_USER_ACTIVITY',
        severity: 'HIGH',
        message: `Inactive user ${sale.cashier?.fullName || 'Unknown'} made a transaction at ${sale.tenant.businessName}`,
        tenantId: sale.tenantId,
        tenantName: sale.tenant.businessName,
        userName: sale.cashier?.fullName || 'Unknown',
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

// POST /api/super-admin/branches/:id/set-main - Set branch as main (Super Admin)
router.post('/branches/:id/set-main', async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        tenant: { select: { id: true, businessName: true } }
      }
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    if (branch.isMain) {
      return res.status(400).json({ error: 'This branch is already the main branch' });
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction([
      // Remove main status from all branches of this tenant
      prisma.branch.updateMany({
        where: { tenantId: branch.tenant.id },
        data: { isMain: false }
      }),
      // Set this branch as main
      prisma.branch.update({
        where: { id },
        data: { isMain: true }
      })
    ]);

    await logAudit(
      branch.tenant.id,
      req.user.id,
      'branch_set_main_by_admin',
      `Super Admin set ${branch.name} as main branch for ${branch.tenant.businessName}`,
      { branchId: id, tenantId: branch.tenant.id }
    );

    res.json({ message: `${branch.name} is now the main branch` });
  } catch (error) {
    console.error('Set main branch error:', error);
    res.status(500).json({ error: 'Failed to set main branch' });
  }
});

// DELETE /api/super-admin/branches/:id - Delete a branch (Super Admin)
router.delete('/branches/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { transferTo, confirmName } = req.body;

    const branch = await prisma.branch.findUnique({
      where: { id },
      include: {
        tenant: { select: { businessName: true, id: true } },
        _count: {
          select: { users: true, sales: true, products: true, expenses: true }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Check if this is the only branch for the tenant
    const branchCount = await prisma.branch.count({
      where: { tenantId: branch.tenant.id }
    });

    if (branchCount <= 1) {
      return res.status(400).json({ error: 'Cannot delete the only branch. Create another branch first.' });
    }

    // Require confirmation by typing branch name
    if (!confirmName || confirmName.toLowerCase() !== branch.name.toLowerCase()) {
      return res.status(400).json({
        error: 'Please type the branch name to confirm deletion',
        branchName: branch.name
      });
    }

    // Check if branch has data
    const hasData = branch._count.users > 0 || branch._count.sales > 0 ||
                    branch._count.products > 0 || branch._count.expenses > 0;

    // Determine transfer target
    let targetBranch = null;

    if (transferTo) {
      // User specified a target branch
      targetBranch = await prisma.branch.findFirst({
        where: { id: transferTo, tenantId: branch.tenant.id, id: { not: id } }
      });

      if (!targetBranch) {
        return res.status(400).json({ error: 'Target branch for data transfer not found' });
      }
    } else if (hasData || branch.isMain) {
      // Auto-select the next available branch for data transfer or main promotion
      targetBranch = await prisma.branch.findFirst({
        where: {
          tenantId: branch.tenant.id,
          id: { not: id },
          isActive: true
        },
        orderBy: [
          { isMain: 'desc' },
          { createdAt: 'asc' }
        ]
      });

      if (!targetBranch && hasData) {
        return res.status(400).json({
          error: 'Branch has associated data but no other active branch exists to transfer to.',
          counts: branch._count
        });
      }
    }

    const wasMain = branch.isMain;
    let newMainBranch = null;

    // Use transaction to delete/transfer
    await prisma.$transaction(async (tx) => {
      if (targetBranch) {
        // Transfer users to target branch
        await tx.user.updateMany({
          where: { branchId: id },
          data: { branchId: targetBranch.id }
        });

        // Transfer sales to target branch
        await tx.sale.updateMany({
          where: { branchId: id },
          data: { branchId: targetBranch.id }
        });

        // Transfer products to target branch
        await tx.product.updateMany({
          where: { branchId: id },
          data: { branchId: targetBranch.id }
        });

        // Transfer expenses to target branch
        await tx.expense.updateMany({
          where: { branchId: id },
          data: { branchId: targetBranch.id }
        });

        // Transfer audit logs to target branch
        await tx.auditLog.updateMany({
          where: { branchId: id },
          data: { branchId: targetBranch.id }
        });

        // Transfer security requests to target branch
        await tx.securityRequest.updateMany({
          where: { branchId: id },
          data: { branchId: targetBranch.id }
        });

        // If deleting main branch, promote the target branch to main
        if (wasMain) {
          await tx.branch.update({
            where: { id: targetBranch.id },
            data: { isMain: true }
          });
          newMainBranch = targetBranch;
        }
      }

      // Delete the branch
      await tx.branch.delete({ where: { id } });
    });

    await logAudit(
      branch.tenant.id,
      req.user.id,
      'branch_deleted_by_admin',
      `Super Admin deleted branch: ${branch.name} from ${branch.tenant.businessName}${targetBranch ? ` (data transferred to ${targetBranch.name})` : ''}${newMainBranch ? ` - ${newMainBranch.name} is now the main branch` : ''}`,
      { branchId: id, tenantId: branch.tenant.id, transferredTo: targetBranch?.id, newMainBranchId: newMainBranch?.id }
    );

    res.json({
      message: 'Branch deleted successfully',
      transferred: targetBranch ? {
        to: targetBranch.name,
        counts: branch._count
      } : null,
      newMainBranch: newMainBranch ? {
        id: newMainBranch.id,
        name: newMainBranch.name
      } : null
    });
  } catch (error) {
    console.error('Delete branch error:', error);
    res.status(500).json({ error: 'Failed to delete branch' });
  }
});

// ============================================
// OVERSIGHT ENDPOINTS - Full Transaction Access
// ============================================

// GET /api/super-admin/oversight/transactions - All transactions across all tenants
router.get('/oversight/transactions', async (req, res) => {
  try {
    const {
      page = 1,
      limit = 50,
      tenantId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      paymentMethod,
      isVoided
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {};

    if (tenantId) {
      where.tenantId = tenantId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        // Include the full end date by setting time to end of day
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateTime;
      }
    }

    if (minAmount || maxAmount) {
      where.finalAmount = {};
      if (minAmount) where.finalAmount.gte = parseFloat(minAmount);
      if (maxAmount) where.finalAmount.lte = parseFloat(maxAmount);
    }

    if (paymentMethod) {
      where.paymentMethod = paymentMethod;
    }

    if (isVoided !== undefined) {
      where.paymentStatus = isVoided === 'true' ? 'voided' : { not: 'voided' };
    }

    const [transactions, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { businessName: true, slug: true, currency: true, currencySymbol: true } },
          cashier: { select: { fullName: true, username: true } },
          voidedBy: { select: { fullName: true, username: true } },
          branch: { select: { name: true } },
          customer: { select: { name: true, phone: true } },
          items: {
            include: {
              product: { select: { name: true, barcode: true } }
            }
          }
        }
      }),
      prisma.sale.count({ where })
    ]);

    // Calculate totals
    const totals = await prisma.sale.aggregate({
      where,
      _sum: { finalAmount: true, discountAmount: true },
      _count: { id: true }
    });

    res.json({
      transactions,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      },
      summary: {
        totalRevenue: totals._sum.finalAmount || 0,
        totalDiscount: totals._sum.discountAmount || 0,
        transactionCount: totals._count.id || 0
      }
    });
  } catch (error) {
    console.error('Oversight transactions error:', error);
    res.status(500).json({ error: 'Failed to fetch transactions' });
  }
});

// GET /api/super-admin/oversight/voids - All voided sales across tenants
router.get('/oversight/voids', async (req, res) => {
  try {
    const { page = 1, limit = 50, tenantId, startDate, endDate } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { paymentStatus: 'voided' };

    if (tenantId) where.tenantId = tenantId;

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        where.createdAt.lte = endDateTime;
      }
    }

    const [voids, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { businessName: true, slug: true, currency: true, currencySymbol: true } },
          cashier: { select: { fullName: true, username: true } },
          voidedBy: { select: { fullName: true, username: true } },
          branch: { select: { name: true } },
          items: {
            include: {
              product: { select: { name: true, barcode: true } }
            }
          }
        }
      }),
      prisma.sale.count({ where })
    ]);

    // Calculate void stats
    const voidStats = await prisma.sale.aggregate({
      where,
      _sum: { finalAmount: true },
      _count: { id: true }
    });

    // Calculate void rate per tenant
    const tenantVoidRates = await prisma.$queryRaw`
      SELECT
        t.id as "tenantId",
        t."businessName",
        COUNT(CASE WHEN s."paymentStatus" = 'voided' THEN 1 END)::integer as "voidCount",
        COUNT(s.id)::integer as "totalSales",
        CASE WHEN COUNT(s.id) > 0
          THEN ROUND((COUNT(CASE WHEN s."paymentStatus" = 'voided' THEN 1 END)::numeric / COUNT(s.id)::numeric) * 100, 2)
          ELSE 0
        END as "voidRate"
      FROM tenants t
      LEFT JOIN sales s ON s."tenantId" = t.id
      WHERE t."isActive" = true
      GROUP BY t.id, t."businessName"
      HAVING COUNT(CASE WHEN s."paymentStatus" = 'voided' THEN 1 END) > 0
      ORDER BY "voidRate" DESC
      LIMIT 10
    `;

    res.json({
      voids,
      pagination: {
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total,
        limit: parseInt(limit)
      },
      summary: {
        totalVoidedAmount: voidStats._sum.finalAmount || 0,
        totalVoidCount: voidStats._count.id || 0
      },
      tenantVoidRates
    });
  } catch (error) {
    console.error('Oversight voids error:', error);
    res.status(500).json({ error: 'Failed to fetch voided sales' });
  }
});

// GET /api/super-admin/oversight/suspicious - Suspicious activity detection
router.get('/oversight/suspicious', async (req, res) => {
  try {
    const { startDate, endDate, tenantId } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        dateFilter.createdAt.lte = endDateTime;
      }
    }

    // Add tenant filter if provided
    const tenantFilter = tenantId ? { tenantId } : {};

    // High-value voids (sales > $500 that were voided)
    const highValueVoids = await prisma.sale.findMany({
      where: {
        paymentStatus: 'voided',
        finalAmount: { gte: 500 },
        ...dateFilter,
        ...tenantFilter
      },
      take: 20,
      orderBy: { finalAmount: 'desc' },
      include: {
        tenant: { select: { businessName: true, slug: true, currency: true, currencySymbol: true } },
        cashier: { select: { fullName: true, username: true } },
        voidedBy: { select: { fullName: true, username: true } }
      }
    });

    // Users with high void counts in last 7 days (cashiers who processed voided sales)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Build tenant condition for raw queries
    const tenantCondition = tenantId ? `AND s."tenantId" = '${tenantId}'` : '';
    const tenantConditionUsers = tenantId ? `AND u."tenantId" = '${tenantId}'` : '';

    const suspiciousUsers = await prisma.$queryRaw`
      SELECT
        u.id as "userId",
        u."fullName",
        u.username,
        t."businessName" as "tenantName",
        COUNT(s.id)::integer as "voidCount",
        COALESCE(SUM(s."finalAmount"), 0)::numeric as "totalVoidedAmount"
      FROM users u
      JOIN tenants t ON u."tenantId" = t.id
      JOIN sales s ON s."cashierId" = u.id
      WHERE s."paymentStatus" = 'voided' AND s."createdAt" >= ${sevenDaysAgo}
        ${tenantId ? Prisma.sql`AND s."tenantId" = ${tenantId}` : Prisma.empty}
      GROUP BY u.id, u."fullName", u.username, t."businessName"
      HAVING COUNT(s.id) >= 5
      ORDER BY "voidCount" DESC
      LIMIT 10
    `;

    // Unusual hours transactions (late night: 11pm-5am)
    const unusualHoursSales = await prisma.$queryRaw`
      SELECT
        s.id,
        s."finalAmount" as total,
        s."createdAt",
        t."businessName" as "tenantName",
        u."fullName" as "staffName",
        EXTRACT(HOUR FROM s."createdAt") as "hour"
      FROM sales s
      JOIN tenants t ON s."tenantId" = t.id
      JOIN users u ON s."cashierId" = u.id
      WHERE s."paymentStatus" != 'voided'
        AND (EXTRACT(HOUR FROM s."createdAt") >= 23 OR EXTRACT(HOUR FROM s."createdAt") < 5)
        AND s."createdAt" >= ${sevenDaysAgo}
        ${tenantId ? Prisma.sql`AND s."tenantId" = ${tenantId}` : Prisma.empty}
      ORDER BY s."createdAt" DESC
      LIMIT 20
    `;

    // Large discounts (> 30%)
    const largeDiscounts = await prisma.sale.findMany({
      where: {
        paymentStatus: { not: 'voided' },
        discountAmount: { gt: 0 },
        ...dateFilter,
        ...tenantFilter
      },
      take: 20,
      orderBy: { discountAmount: 'desc' },
      include: {
        tenant: { select: { businessName: true, currency: true, currencySymbol: true } },
        cashier: { select: { fullName: true } }
      }
    });

    // Filter for significant discounts (> 30% of subtotal)
    const significantDiscounts = largeDiscounts.filter(sale => {
      const subtotal = sale.totalAmount || (sale.finalAmount + sale.discountAmount);
      const discountPercent = (sale.discountAmount / subtotal) * 100;
      return discountPercent > 30;
    }).map(sale => ({
      ...sale,
      discountPercent: ((sale.discountAmount / (sale.totalAmount || (sale.finalAmount + sale.discountAmount))) * 100).toFixed(1)
    }));

    res.json({
      highValueVoids,
      suspiciousUsers,
      unusualHoursSales,
      significantDiscounts,
      summary: {
        highValueVoidCount: highValueVoids.length,
        suspiciousUserCount: suspiciousUsers.length,
        unusualHoursCount: unusualHoursSales.length,
        largeDiscountCount: significantDiscounts.length
      }
    });
  } catch (error) {
    console.error('Suspicious activity error:', error);
    res.status(500).json({ error: 'Failed to detect suspicious activity' });
  }
});

// ============================================
// TENANT DEEP ACCESS - Full Data Access
// ============================================

// GET /api/super-admin/tenants/:id/full-data - Complete tenant data access
router.get('/tenants/:id/full-data', async (req, res) => {
  try {
    const { id } = req.params;
    const { includeTransactions, includeLogs, startDate, endDate } = req.query;

    const tenant = await prisma.tenant.findUnique({
      where: { id },
      include: {
        users: {
          select: {
            id: true,
            username: true,
            fullName: true,
            role: true,
            isActive: true,
            createdAt: true,
            branch: { select: { name: true } }
          },
          orderBy: [
            { role: 'asc' },
            { createdAt: 'asc' }
          ]
        },
        branches: {
          select: {
            id: true,
            name: true,
            address: true,
            phone: true,
            isActive: true,
            isMain: true,
            _count: { select: { users: true, sales: true } }
          },
          orderBy: [
            { isMain: 'desc' },
            { name: 'asc' }
          ]
        },
        products: {
          select: {
            id: true,
            name: true,
            barcode: true,
            costPrice: true,
            sellingPrice: true,
            stockQuantity: true,
            lowStockThreshold: true,
            isActive: true
          }
        }
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate);
    }

    // Get financial summary
    const financialSummary = await prisma.sale.aggregate({
      where: { tenantId: id, paymentStatus: { not: 'voided' }, ...dateFilter },
      _sum: { finalAmount: true, discountAmount: true },
      _count: { id: true },
      _avg: { finalAmount: true }
    });

    const voidSummary = await prisma.sale.aggregate({
      where: { tenantId: id, paymentStatus: 'voided', ...dateFilter },
      _sum: { finalAmount: true },
      _count: { id: true }
    });

    const expenseSummary = await prisma.expense.aggregate({
      where: { tenantId: id, ...dateFilter },
      _sum: { amount: true },
      _count: { id: true }
    });

    // Product stats
    const productStats = await prisma.product.aggregate({
      where: { tenantId: id },
      _count: { id: true },
      _sum: { stockQuantity: true }
    });

    // Use raw query for column-to-column comparison
    const lowStockResult = await prisma.$queryRaw`
      SELECT COUNT(*)::integer as count
      FROM products
      WHERE "tenantId" = ${id}
        AND "isActive" = true
        AND "stockQuantity" <= "lowStockThreshold"
    `;
    const lowStockCount = lowStockResult[0]?.count || 0;

    // Include transactions if requested
    let recentTransactions = [];
    if (includeTransactions === 'true') {
      recentTransactions = await prisma.sale.findMany({
        where: { tenantId: id, ...dateFilter },
        take: 100,
        orderBy: { createdAt: 'desc' },
        include: {
          cashier: { select: { fullName: true } },
          branch: { select: { name: true } },
          items: { include: { product: { select: { name: true } } } }
        }
      });
    }

    // Include audit logs if requested
    let auditLogs = [];
    if (includeLogs === 'true') {
      auditLogs = await prisma.auditLog.findMany({
        where: { tenantId: id, ...dateFilter },
        take: 200,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, username: true } }
        }
      });
    }

    // Daily sales trend (last 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dailySales = await prisma.$queryRaw`
      SELECT
        DATE(s."createdAt") as date,
        COUNT(s.id)::integer as "transactionCount",
        SUM(s."finalAmount")::numeric as revenue
      FROM sales s
      WHERE s."tenantId" = ${id}
        AND s."paymentStatus" != 'voided'
        AND s."createdAt" >= ${thirtyDaysAgo}
      GROUP BY DATE(s."createdAt")
      ORDER BY date DESC
    `;

    // Top products
    const topProducts = await prisma.$queryRaw`
      SELECT
        p.id,
        p.name,
        SUM(si.quantity)::integer as "unitsSold",
        SUM(si.quantity * si."unitPrice")::numeric as revenue
      FROM sale_items si
      JOIN products p ON si."productId" = p.id
      JOIN sales s ON si."saleId" = s.id
      WHERE s."tenantId" = ${id}
        AND s."paymentStatus" != 'voided'
        AND s."createdAt" >= ${thirtyDaysAgo}
      GROUP BY p.id, p.name
      ORDER BY "unitsSold" DESC
      LIMIT 10
    `;

    // Staff performance
    const staffPerformance = await prisma.$queryRaw`
      SELECT
        u.id,
        u."fullName",
        u.username,
        COUNT(s.id)::integer as "salesCount",
        COALESCE(SUM(s."finalAmount"), 0)::numeric as revenue,
        COUNT(CASE WHEN s."paymentStatus" = 'voided' THEN 1 END)::integer as "voidCount"
      FROM users u
      LEFT JOIN sales s ON s."cashierId" = u.id AND s."createdAt" >= ${thirtyDaysAgo}
      WHERE u."tenantId" = ${id}
        AND u.role IN ('CASHIER', 'MANAGER')
      GROUP BY u.id, u."fullName", u.username
      ORDER BY revenue DESC NULLS LAST
    `;

    res.json({
      tenant,
      financials: {
        revenue: financialSummary._sum.finalAmount || 0,
        discounts: financialSummary._sum.discountAmount || 0,
        transactionCount: financialSummary._count.id || 0,
        averageTransaction: financialSummary._avg.finalAmount || 0,
        voidedAmount: voidSummary._sum.finalAmount || 0,
        voidCount: voidSummary._count.id || 0,
        voidRate: financialSummary._count.id > 0
          ? ((voidSummary._count.id / (financialSummary._count.id + voidSummary._count.id)) * 100).toFixed(2)
          : 0,
        expenses: expenseSummary._sum.amount || 0,
        expenseCount: expenseSummary._count.id || 0,
        netProfit: (financialSummary._sum.finalAmount || 0) - (expenseSummary._sum.amount || 0)
      },
      inventory: {
        totalProducts: productStats._count.id || 0,
        totalUnits: productStats._sum.stockQuantity || 0,
        lowStockCount
      },
      dailySales,
      topProducts,
      staffPerformance,
      recentTransactions,
      auditLogs
    });
  } catch (error) {
    console.error('Tenant full data error:', error);
    res.status(500).json({ error: 'Failed to fetch tenant data' });
  }
});

module.exports = router;
