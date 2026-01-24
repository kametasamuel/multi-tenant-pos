const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { authenticate, requireOwner, logAudit } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require owner authentication
router.use(authenticate);
router.use(requireOwner);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============ DASHBOARD ============

// GET /api/owner/dashboard - Get owner dashboard data
router.get('/dashboard', async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    const dateFilter = {};
    if (startDate) {
      dateFilter.gte = new Date(startDate);
    }
    if (endDate) {
      dateFilter.lte = new Date(endDate);
    }
    const hasDateFilter = startDate || endDate;

    const salesWhere = {
      tenantId: req.tenantId,
      ...(hasDateFilter && { createdAt: dateFilter }),
      ...(branchId && { branchId })
    };

    // Get main stats
    const [
      totalSales,
      salesData,
      expensesData,
      staffCount,
      branchCount,
      pendingRequests,
      inventoryAlerts
    ] = await Promise.all([
      prisma.sale.aggregate({
        where: { ...salesWhere, paymentStatus: 'completed' },
        _sum: { finalAmount: true },
        _count: true
      }),
      prisma.sale.findMany({
        where: { ...salesWhere, paymentStatus: 'completed' },
        include: {
          items: {
            include: {
              product: { select: { costPrice: true } }
            }
          }
        }
      }),
      prisma.expense.aggregate({
        where: {
          tenantId: req.tenantId,
          ...(hasDateFilter && { createdAt: dateFilter }),
          ...(branchId && { branchId })
        },
        _sum: { amount: true }
      }),
      prisma.user.count({
        where: { tenantId: req.tenantId, isActive: true }
      }),
      prisma.branch.count({
        where: { tenantId: req.tenantId }
      }),
      prisma.securityRequest.count({
        where: { tenantId: req.tenantId, status: 'PENDING', ...(branchId && { branchId }) }
      }),
      // Inventory alerts - fetch products and calculate counts (filtered by branch if specified)
      prisma.product.findMany({
        where: {
          tenantId: req.tenantId,
          type: 'PRODUCT',
          isActive: true,
          ...(branchId && { branchId })
        },
        select: { stockQuantity: true, lowStockThreshold: true, expiryDate: true }
      }).then(products => {
        const now = new Date();
        const in30Days = new Date();
        in30Days.setDate(in30Days.getDate() + 30);
        const in90Days = new Date();
        in90Days.setDate(in90Days.getDate() + 90);

        return {
          lowStock: products.filter(p => p.stockQuantity > 0 && p.stockQuantity <= (p.lowStockThreshold || 10)).length,
          outOfStock: products.filter(p => p.stockQuantity === 0).length,
          expiringSoon: products.filter(p => p.expiryDate && new Date(p.expiryDate) > now && new Date(p.expiryDate) <= in90Days).length,
          expired: products.filter(p => p.expiryDate && new Date(p.expiryDate) < now).length
        };
      })
    ]);

    // Calculate COGS (Cost of Goods Sold)
    let cogs = 0;
    salesData.forEach(sale => {
      sale.items.forEach(item => {
        cogs += (item.product?.costPrice || 0) * item.quantity;
      });
    });

    const totalRevenue = totalSales._sum.finalAmount || 0;
    const totalExpenses = expensesData._sum.amount || 0;
    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - totalExpenses;

    // Get branch performance
    const branches = await prisma.branch.findMany({
      where: { tenantId: req.tenantId },
      select: { id: true, name: true, isMain: true }
    });

    const branchPerformance = await Promise.all(
      branches.map(async (branch) => {
        const branchSales = await prisma.sale.aggregate({
          where: {
            branchId: branch.id,
            paymentStatus: 'completed',
            ...(hasDateFilter && { createdAt: dateFilter })
          },
          _sum: { finalAmount: true },
          _count: true
        });
        return {
          id: branch.id,
          name: branch.name,
          isMain: branch.isMain,
          revenue: branchSales._sum.finalAmount || 0,
          transactions: branchSales._count || 0
        };
      })
    );

    // Get staff leaderboard (top 5)
    const staffSales = await prisma.sale.groupBy({
      by: ['cashierId'],
      where: { ...salesWhere, paymentStatus: 'completed' },
      _sum: { finalAmount: true },
      _count: true,
      orderBy: { _sum: { finalAmount: 'desc' } },
      take: 5
    });

    const staffIds = staffSales.map(s => s.cashierId);
    const staffDetails = await prisma.user.findMany({
      where: { id: { in: staffIds } },
      select: { id: true, fullName: true, role: true }
    });

    const staffLeaderboard = staffSales.map(s => {
      const staff = staffDetails.find(u => u.id === s.cashierId);
      return {
        id: s.cashierId,
        name: staff?.fullName || 'Unknown',
        role: staff?.role || 'CASHIER',
        totalSales: s._sum.finalAmount || 0,
        transactionCount: s._count
      };
    });

    // Get recent suspicious voids (high value, pending only)
    const suspiciousVoids = await prisma.securityRequest.findMany({
      where: {
        tenantId: req.tenantId,
        type: 'VOID',
        status: 'PENDING',
        amount: { gte: 100 },
        ...(hasDateFilter && { createdAt: dateFilter })
      },
      include: {
        requester: { select: { fullName: true } },
        reviewer: { select: { fullName: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 5
    });

    // Get hourly sales trend (today)
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const hourlySales = await prisma.sale.findMany({
      where: {
        tenantId: req.tenantId,
        paymentStatus: 'completed',
        createdAt: { gte: todayStart },
        ...(branchId && { branchId })
      },
      select: { createdAt: true, finalAmount: true }
    });

    // Group by hour
    const hourlyData = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = { hour: i, sales: 0, count: 0 };
    }
    hourlySales.forEach(sale => {
      const hour = sale.createdAt.getHours();
      hourlyData[hour].sales += sale.finalAmount;
      hourlyData[hour].count++;
    });

    res.json({
      stats: {
        totalRevenue,
        grossProfit,
        totalExpenses,
        netProfit,
        cogs,
        transactionCount: totalSales._count || 0,
        staffCount,
        branchCount
      },
      alerts: {
        pendingRequests,
        lowStockCount: inventoryAlerts.lowStock,
        outOfStockCount: inventoryAlerts.outOfStock,
        expiringSoonCount: inventoryAlerts.expiringSoon,
        expiredCount: inventoryAlerts.expired,
        suspiciousVoids
      },
      branchPerformance,
      staffLeaderboard,
      hourlyTrend: Object.values(hourlyData)
    });
  } catch (error) {
    console.error('Owner dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// ============ STAFF MANAGEMENT ============

// GET /api/owner/staff - Get all staff
router.get('/staff', async (req, res) => {
  try {
    const { role, branchId, status, search } = req.query;

    // Base where clause
    const baseWhere = {
      tenantId: req.tenantId,
      isSuperAdmin: false
    };

    // Build the staff query where clause
    // When filtering by branch, include OWNER/ADMIN roles regardless of their branch assignment
    // (Owners manage all branches so they should always be visible)
    let staffWhere;
    if (branchId) {
      staffWhere = {
        ...baseWhere,
        OR: [
          { branchId: branchId },
          { role: { in: ['OWNER', 'ADMIN'] } }
        ]
      };
    } else {
      staffWhere = { ...baseWhere };
    }

    // Handle role filter - treat OWNER and ADMIN as the same
    if (role) {
      if (role === 'OWNER' || role === 'OWNER,ADMIN') {
        staffWhere.role = { in: ['OWNER', 'ADMIN'] };
      } else {
        staffWhere.role = role;
      }
    }
    if (status === 'active') staffWhere.isActive = true;
    if (status === 'inactive') staffWhere.isActive = false;
    if (search) {
      staffWhere.AND = [
        {
          OR: [
            { fullName: { contains: search, mode: 'insensitive' } },
            { username: { contains: search, mode: 'insensitive' } }
          ]
        }
      ];
    }

    const staff = await prisma.user.findMany({
      where: staffWhere,
      select: {
        id: true,
        username: true,
        fullName: true,
        profileImage: true,
        role: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        phone: true,
        email: true,
        address: true,
        gender: true,
        dateOfBirth: true,
        specialty: true,
        commissionRate: true,
        branch: {
          select: { id: true, name: true }
        },
        _count: {
          select: { sales: true }
        }
      },
      orderBy: [
        { role: 'asc' },
        { fullName: 'asc' }
      ]
    });

    // Get stats - should match the same filter logic as staff list
    const statsWhere = branchId ? {
      ...baseWhere,
      OR: [
        { branchId: branchId },
        { role: { in: ['OWNER', 'ADMIN'] } }
      ]
    } : baseWhere;

    const roleStats = await prisma.user.groupBy({
      by: ['role'],
      where: statsWhere,
      _count: true
    });

    // Get stats by branch (always tenant-wide for context)
    const branchStats = await prisma.user.groupBy({
      by: ['branchId'],
      where: baseWhere,
      _count: true
    });

    res.json({
      staff,
      stats: {
        total: staff.length,
        byRole: roleStats.reduce((acc, r) => ({ ...acc, [r.role]: r._count }), {}),
        byBranch: branchStats
      }
    });
  } catch (error) {
    console.error('Get staff error:', error);
    res.status(500).json({ error: 'Failed to get staff' });
  }
});

// POST /api/owner/staff - Create staff member
router.post('/staff', [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('role').isIn(['CASHIER', 'MANAGER', 'OWNER']).withMessage('Invalid role. Allowed: CASHIER, MANAGER, OWNER'),
  body('branchId').optional(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { username, password, fullName, role, branchId } = req.body;

    // Check for existing username within this tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        username: { equals: username, mode: 'insensitive' },
        tenantId: req.tenantId
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists in this business' });
    }

    // Get all branches for this tenant
    const branches = await prisma.branch.findMany({
      where: { tenantId: req.tenantId }
    });

    // Determine branch assignment
    let assignedBranchId = branchId;

    if (branches.length === 1) {
      // Single branch: auto-assign to that branch
      assignedBranchId = branches[0].id;
    } else if (branches.length > 1) {
      // Multiple branches: branch selection is required
      if (!branchId) {
        return res.status(400).json({ error: 'Branch selection is required when you have multiple branches' });
      }
      // Validate the selected branch belongs to this tenant
      const validBranch = branches.find(b => b.id === branchId);
      if (!validBranch) {
        return res.status(400).json({ error: 'Invalid branch selected' });
      }
      assignedBranchId = branchId;
    } else {
      // No branches - shouldn't happen, but fallback to null
      assignedBranchId = null;
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        role,
        branchId: assignedBranchId,
        tenantId: req.tenantId
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        profileImage: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: { select: { id: true, name: true } }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'staff_created',
      `Created staff member: ${fullName} (${role})`,
      { staffId: newUser.id, role, branchId: assignedBranchId },
      assignedBranchId
    );

    res.status(201).json({ user: newUser });
  } catch (error) {
    console.error('Create staff error:', error);
    res.status(500).json({ error: 'Failed to create staff member' });
  }
});

// PUT /api/owner/staff/:id - Update staff member (Owner can transfer between branches)
router.put('/staff/:id', [
  body('fullName').optional().trim().notEmpty(),
  body('role').optional().isIn(['CASHIER', 'MANAGER', 'OWNER']).withMessage('Invalid role. Allowed: CASHIER, MANAGER, OWNER'),
  body('branchId').optional(),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, role, branchId, isActive } = req.body;

    const user = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId, isSuperAdmin: false }
    });

    if (!user) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    // Prevent deactivating self
    if (id === req.user.id && isActive === false) {
      return res.status(400).json({ error: 'Cannot deactivate your own account' });
    }

    // Validate branch if provided
    if (branchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: branchId, tenantId: req.tenantId }
      });
      if (!branch) {
        return res.status(400).json({ error: 'Invalid branch' });
      }
    }

    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        ...(fullName && { fullName }),
        ...(role && { role }),
        ...(branchId !== undefined && { branchId }),
        ...(isActive !== undefined && { isActive })
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        profileImage: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: { select: { id: true, name: true } }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'staff_updated',
      `Updated staff member: ${updatedUser.fullName}`,
      { staffId: id, changes: req.body },
      updatedUser.branchId
    );

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update staff error:', error);
    res.status(500).json({ error: 'Failed to update staff member' });
  }
});

// POST /api/owner/staff/:id/reset-password - Reset staff password
router.post('/staff/:id/reset-password', [
  body('newPassword').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;

    const user = await prisma.user.findFirst({
      where: { id, tenantId: req.tenantId, isSuperAdmin: false }
    });

    if (!user) {
      return res.status(404).json({ error: 'Staff member not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id },
      data: { password: hashedPassword }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'password_reset',
      `Reset password for: ${user.fullName}`,
      { staffId: id },
      user.branchId
    );

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// ============ ACTIVITY LOGS ============

// GET /api/owner/activity - Get activity logs
router.get('/activity', async (req, res) => {
  try {
    const { startDate, endDate, userId, action, branchId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { tenantId: req.tenantId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    // Filter by branchId directly on the log
    if (branchId) {
      where.branchId = branchId;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: { id: true, fullName: true, username: true, role: true, branch: { select: { id: true, name: true } } }
          },
          branch: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit)
      }),
      prisma.auditLog.count({ where })
    ]);

    // Get action type counts using same where filter as logs
    const actionCounts = await prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10
    });

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      },
      actionCounts: actionCounts.map(a => ({ action: a.action, count: a._count }))
    });
  } catch (error) {
    console.error('Get activity logs error:', error);
    res.status(500).json({ error: 'Failed to get activity logs' });
  }
});

// GET /api/owner/activity/export - Export activity logs as CSV
router.get('/activity/export', async (req, res) => {
  try {
    const { startDate, endDate, userId, action } = req.query;

    const where = { tenantId: req.tenantId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (userId) where.userId = userId;
    if (action) where.action = { contains: action, mode: 'insensitive' };

    const logs = await prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { fullName: true, username: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 10000 // Limit export
    });

    // Generate CSV
    const csvHeader = 'Date,Time,User,Action,Description,Metadata\n';
    const csvRows = logs.map(log => {
      const date = log.createdAt.toISOString().split('T')[0];
      const time = log.createdAt.toISOString().split('T')[1].split('.')[0];
      return `"${date}","${time}","${log.user.fullName}","${log.action}","${log.description || ''}","${log.metadata || ''}"`;
    }).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=activity-logs-${new Date().toISOString().split('T')[0]}.csv`);
    res.send(csvHeader + csvRows);
  } catch (error) {
    console.error('Export activity logs error:', error);
    res.status(500).json({ error: 'Failed to export activity logs' });
  }
});

// ============ REPORTS ============

// GET /api/owner/reports/pl - Get Profit & Loss report
router.get('/reports/pl', async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const salesWhere = {
      tenantId: req.tenantId,
      paymentStatus: 'completed',
      ...(hasDateFilter && { createdAt: dateFilter }),
      ...(branchId && { branchId })
    };

    // Get all sales with items for COGS calculation
    const sales = await prisma.sale.findMany({
      where: salesWhere,
      include: {
        items: {
          include: {
            product: { select: { costPrice: true, name: true } }
          }
        }
      }
    });

    // Calculate revenue and COGS
    let totalRevenue = 0;
    let cogs = 0;
    sales.forEach(sale => {
      totalRevenue += sale.finalAmount;
      sale.items.forEach(item => {
        cogs += (item.product?.costPrice || 0) * item.quantity;
      });
    });

    // Get expenses (filter by branch if specified, same as sales)
    const expenseWhere = {
      tenantId: req.tenantId,
      ...(hasDateFilter && { createdAt: dateFilter }),
      ...(branchId && { branchId })
    };

    const expensesAggregate = await prisma.expense.aggregate({
      where: expenseWhere,
      _sum: { amount: true }
    });

    // Get expenses by category
    const expensesByCategory = await prisma.expense.groupBy({
      by: ['category'],
      where: expenseWhere,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } }
    });

    const totalExpenses = expensesAggregate._sum.amount || 0;
    const grossProfit = totalRevenue - cogs;
    const netProfit = grossProfit - totalExpenses;
    const grossMargin = totalRevenue > 0 ? (grossProfit / totalRevenue) * 100 : 0;
    const netMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    res.json({
      summary: {
        totalRevenue,
        cogs,
        grossProfit,
        grossMargin,
        totalExpenses,
        netProfit,
        netMargin,
        transactionCount: sales.length
      },
      expensesByCategory: expensesByCategory.map(e => ({
        category: e.category,
        amount: e._sum.amount || 0
      }))
    });
  } catch (error) {
    console.error('Get P&L report error:', error);
    res.status(500).json({ error: 'Failed to get P&L report' });
  }
});

// GET /api/owner/reports/branch-comparison - Compare branches
router.get('/reports/branch-comparison', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const branches = await prisma.branch.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: { select: { users: true } }
      }
    });

    const branchComparison = await Promise.all(
      branches.map(async (branch) => {
        const salesWhere = {
          branchId: branch.id,
          paymentStatus: 'completed',
          ...(hasDateFilter && { createdAt: dateFilter })
        };

        const sales = await prisma.sale.findMany({
          where: salesWhere,
          include: {
            items: {
              include: {
                product: { select: { costPrice: true } }
              }
            }
          }
        });

        let revenue = 0;
        let cogs = 0;
        sales.forEach(sale => {
          revenue += sale.finalAmount;
          sale.items.forEach(item => {
            cogs += (item.product?.costPrice || 0) * item.quantity;
          });
        });

        const grossProfit = revenue - cogs;

        return {
          id: branch.id,
          name: branch.name,
          isMain: branch.isMain,
          isActive: branch.isActive,
          staffCount: branch._count.users,
          revenue,
          cogs,
          grossProfit,
          grossMargin: revenue > 0 ? (grossProfit / revenue) * 100 : 0,
          transactionCount: sales.length,
          avgTransactionValue: sales.length > 0 ? revenue / sales.length : 0
        };
      })
    );

    res.json({ branches: branchComparison });
  } catch (error) {
    console.error('Get branch comparison error:', error);
    res.status(500).json({ error: 'Failed to get branch comparison' });
  }
});

// GET /api/owner/reports/product-profitability - Product profitability analysis
router.get('/reports/product-profitability', async (req, res) => {
  try {
    const { startDate, endDate, branchId, limit = 20 } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const salesWhere = {
      tenantId: req.tenantId,
      paymentStatus: 'completed',
      ...(hasDateFilter && { createdAt: dateFilter }),
      ...(branchId && { branchId })
    };

    // Get all sale items grouped by product
    const saleItems = await prisma.saleItem.findMany({
      where: {
        sale: salesWhere
      },
      include: {
        product: {
          select: { id: true, name: true, costPrice: true, sellingPrice: true, type: true, customCategory: true }
        }
      }
    });

    // Aggregate by product
    const productMap = {};
    saleItems.forEach(item => {
      const productId = item.productId;
      if (!productMap[productId]) {
        productMap[productId] = {
          id: productId,
          name: item.product.name,
          type: item.product.type,
          category: item.product.customCategory || 'General',
          costPrice: item.product.costPrice,
          sellingPrice: item.product.sellingPrice,
          totalQuantity: 0,
          totalRevenue: 0,
          totalCost: 0
        };
      }
      productMap[productId].totalQuantity += item.quantity;
      productMap[productId].totalRevenue += item.subtotal;
      productMap[productId].totalCost += (item.product.costPrice || 0) * item.quantity;
    });

    // Calculate profit and margin for each product
    const products = Object.values(productMap).map(p => ({
      ...p,
      grossProfit: p.totalRevenue - p.totalCost,
      grossMargin: p.totalRevenue > 0 ? ((p.totalRevenue - p.totalCost) / p.totalRevenue) * 100 : 0
    }));

    // Sort by gross profit
    products.sort((a, b) => b.grossProfit - a.grossProfit);

    res.json({
      products: products.slice(0, parseInt(limit)),
      totals: {
        totalRevenue: products.reduce((sum, p) => sum + p.totalRevenue, 0),
        totalCost: products.reduce((sum, p) => sum + p.totalCost, 0),
        totalProfit: products.reduce((sum, p) => sum + p.grossProfit, 0)
      }
    });
  } catch (error) {
    console.error('Get product profitability error:', error);
    res.status(500).json({ error: 'Failed to get product profitability' });
  }
});

// GET /api/owner/reports/stylist-performance - Attendant performance report (for SERVICES business type)
// Legacy endpoint name kept for backwards compatibility
router.get('/reports/stylist-performance', async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    // Get all sale items with attendant assigned
    const saleItemsWhere = {
      attendantId: { not: null },
      sale: {
        tenantId: req.tenantId,
        paymentStatus: 'completed',
        ...(hasDateFilter && { createdAt: dateFilter }),
        ...(branchId && { branchId })
      }
    };

    const attendantSales = await prisma.saleItem.findMany({
      where: saleItemsWhere,
      include: {
        attendant: {
          select: {
            id: true,
            fullName: true,
            profileImage: true,
            commissionRate: true
          }
        },
        product: {
          select: {
            id: true,
            name: true,
            type: true
          }
        },
        sale: {
          select: {
            createdAt: true,
            transactionNumber: true
          }
        }
      }
    });

    // Aggregate by attendant
    const attendantMap = {};
    attendantSales.forEach(item => {
      const attendantId = item.attendantId;
      if (!attendantMap[attendantId]) {
        attendantMap[attendantId] = {
          stylist: item.attendant, // Keep 'stylist' key for frontend compatibility
          totalSales: 0,
          serviceCount: 0,
          commission: 0,
          services: {}
        };
      }
      attendantMap[attendantId].totalSales += item.subtotal;
      attendantMap[attendantId].serviceCount += item.quantity;

      // Calculate commission
      const commissionRate = item.attendant?.commissionRate || 0;
      attendantMap[attendantId].commission += (item.subtotal * commissionRate) / 100;

      // Track services performed
      const serviceName = item.product.name;
      if (!attendantMap[attendantId].services[serviceName]) {
        attendantMap[attendantId].services[serviceName] = 0;
      }
      attendantMap[attendantId].services[serviceName] += item.quantity;
    });

    // Convert to array and format
    const performance = Object.values(attendantMap).map(s => ({
      ...s,
      topServices: Object.entries(s.services)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }))
    }));

    // Sort by total sales
    performance.sort((a, b) => b.totalSales - a.totalSales);

    // Calculate totals
    const totals = {
      totalSales: performance.reduce((sum, s) => sum + s.totalSales, 0),
      totalServices: performance.reduce((sum, s) => sum + s.serviceCount, 0),
      totalCommission: performance.reduce((sum, s) => sum + s.commission, 0)
    };

    res.json({ performance, totals });
  } catch (error) {
    console.error('Get attendant performance error:', error);
    res.status(500).json({ error: 'Failed to get attendant performance' });
  }
});

// GET /api/owner/reports/staff-performance - Staff performance report
router.get('/reports/staff-performance', async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const userWhere = {
      tenantId: req.tenantId,
      isSuperAdmin: false,
      ...(branchId && { branchId })
    };

    const staff = await prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true,
        branchId: true,
        branch: { select: { name: true } }
      }
    });

    const staffPerformance = await Promise.all(
      staff.map(async (user) => {
        const salesWhere = {
          cashierId: user.id,
          paymentStatus: 'completed',
          ...(hasDateFilter && { createdAt: dateFilter })
        };

        const [salesAggregate, voidCount] = await Promise.all([
          prisma.sale.aggregate({
            where: salesWhere,
            _sum: { finalAmount: true },
            _count: true
          }),
          prisma.securityRequest.count({
            where: {
              requesterId: user.id,
              type: 'VOID',
              ...(hasDateFilter && { createdAt: dateFilter })
            }
          })
        ]);

        return {
          id: user.id,
          name: user.fullName,
          username: user.username,
          role: user.role,
          branch: user.branch?.name || 'Unassigned',
          totalSales: salesAggregate._sum.finalAmount || 0,
          transactionCount: salesAggregate._count || 0,
          avgTransactionValue: salesAggregate._count > 0
            ? (salesAggregate._sum.finalAmount || 0) / salesAggregate._count
            : 0,
          voidRequests: voidCount
        };
      })
    );

    // Sort by total sales
    staffPerformance.sort((a, b) => b.totalSales - a.totalSales);

    res.json({ staff: staffPerformance });
  } catch (error) {
    console.error('Get staff performance error:', error);
    res.status(500).json({ error: 'Failed to get staff performance' });
  }
});

// ============ SETTINGS ============

// GET /api/owner/settings - Get tenant settings
router.get('/settings', async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        businessLogo: true,
        currency: true,
        currencySymbol: true,
        taxRate: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        isActive: true
      }
    });

    res.json({ settings: tenant });
  } catch (error) {
    console.error('Get settings error:', error);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// PUT /api/owner/settings - Update tenant settings
router.put('/settings', [
  body('businessName').optional().trim().notEmpty(),
  body('businessType').optional().isIn(['RETAIL', 'FOOD_AND_BEVERAGE', 'HOSPITALITY', 'SERVICES', 'RESTAURANT', 'SALON', 'PHARMACY', 'GROCERY', 'ELECTRONICS', 'CLOTHING', 'OTHER']),
  body('currency').optional().trim().notEmpty(),
  body('currencySymbol').optional().trim().notEmpty(),
  body('taxRate').optional().isFloat({ min: 0, max: 1 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { businessName, businessType, currency, currencySymbol, taxRate } = req.body;

    // If changing business name, check uniqueness
    if (businessName) {
      const existing = await prisma.tenant.findFirst({
        where: {
          businessName: { equals: businessName, mode: 'insensitive' },
          id: { not: req.tenantId }
        }
      });
      if (existing) {
        return res.status(400).json({ error: 'Business name already exists' });
      }
    }

    const updatedTenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        ...(businessName && { businessName }),
        ...(businessType && { businessType }),
        ...(currency && { currency }),
        ...(currencySymbol && { currencySymbol }),
        ...(taxRate !== undefined && { taxRate })
      },
      select: {
        id: true,
        businessName: true,
        businessType: true,
        businessLogo: true,
        currency: true,
        currencySymbol: true,
        taxRate: true
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'settings_updated',
      'Updated business settings',
      { changes: req.body },
      req.branchId
    );

    res.json({ settings: updatedTenant });
  } catch (error) {
    console.error('Update settings error:', error);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

module.exports = router;
