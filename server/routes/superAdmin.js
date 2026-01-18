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

// POST /api/super-admin/applications/:id/approve - Approve and create tenant
router.post('/applications/:id/approve', validateApproval, async (req, res) => {
  try {
    const { id } = req.params;
    const { subscriptionMonths } = req.body;

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

    // Use transaction to create tenant, admin user, and update application
    const result = await prisma.$transaction(async (tx) => {
      // Create tenant
      const tenant = await tx.tenant.create({
        data: {
          businessName: application.businessName,
          businessLogo: application.businessLogo,
          subscriptionStart: new Date(),
          subscriptionEnd,
          isActive: true
        }
      });

      // Create admin user
      const adminUser = await tx.user.create({
        data: {
          username: baseUsername,
          password: application.password, // Already hashed
          fullName: application.ownerFullName,
          role: 'ADMIN',
          isActive: true,
          isSuperAdmin: false,
          tenantId: tenant.id
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

      return { tenant, adminUser };
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
        subscriptionEnd: result.tenant.subscriptionEnd
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

module.exports = router;
