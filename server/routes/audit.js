const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get audit logs (Admin only - Managers see only their branch's logs)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, action, userId, branchId, page = 1 } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 50, 200); // Max 200 per page
    const skip = (parseInt(page) - 1) * limit;

    const where = {
      tenantId: req.tenantId
    };

    // Managers can only see audit logs from their own branch
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    } else if (branchId) {
      // Owner/Admin can filter by specific branch
      where.branchId = branchId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (action) {
      where.action = action;
    }

    if (userId) {
      where.userId = userId;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: {
            select: {
              username: true,
              fullName: true,
              role: true
            }
          },
          branch: {
            select: {
              id: true,
              name: true
            }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit
      }),
      prisma.auditLog.count({ where })
    ]);

    res.json({
      logs,
      pagination: {
        page: parseInt(page),
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
