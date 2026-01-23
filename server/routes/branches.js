const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireOwner, logAudit } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticate);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/branches - Get all branches for tenant
router.get('/', async (req, res) => {
  try {
    let branches = await prisma.branch.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: {
          select: {
            users: true,
            sales: true
          }
        }
      },
      orderBy: [
        { isMain: 'desc' },
        { name: 'asc' }
      ]
    });

    // Auto-create main branch if tenant has no branches (for legacy tenants)
    if (branches.length === 0) {
      // Get tenant info for branch name
      const tenant = await prisma.tenant.findUnique({
        where: { id: req.tenantId },
        select: { businessName: true }
      });

      // Create main branch with tenant's business name
      const mainBranch = await prisma.branch.create({
        data: {
          name: tenant?.businessName || 'Main Branch',
          isMain: true,
          isActive: true,
          tenantId: req.tenantId
        },
        include: {
          _count: {
            select: {
              users: true,
              sales: true
            }
          }
        }
      });

      // Assign all existing users to this branch
      await prisma.user.updateMany({
        where: { tenantId: req.tenantId, branchId: null },
        data: { branchId: mainBranch.id }
      });

      // Assign all existing sales to this branch
      await prisma.sale.updateMany({
        where: { tenantId: req.tenantId, branchId: null },
        data: { branchId: mainBranch.id }
      });

      branches = [mainBranch];
    }

    // Get revenue per branch (only completed sales, not voided)
    const branchesWithRevenue = await Promise.all(
      branches.map(async (branch) => {
        const salesAggregate = await prisma.sale.aggregate({
          where: {
            branchId: branch.id,
            paymentStatus: 'completed'
          },
          _sum: { finalAmount: true }
        });
        return {
          ...branch,
          totalRevenue: salesAggregate._sum.finalAmount || 0
        };
      })
    );

    res.json({ branches: branchesWithRevenue });
  } catch (error) {
    console.error('Get branches error:', error);
    res.status(500).json({ error: 'Failed to get branches' });
  }
});

// GET /api/branches/:id - Get branch details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: {
        id,
        tenantId: req.tenantId
      },
      include: {
        users: {
          select: {
            id: true,
            fullName: true,
            username: true,
            role: true,
            isActive: true
          }
        },
        _count: {
          select: {
            users: true,
            sales: true
          }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Get sales stats (only completed sales, not voided)
    const salesAggregate = await prisma.sale.aggregate({
      where: {
        branchId: id,
        paymentStatus: 'completed'
      },
      _sum: { finalAmount: true },
      _count: true
    });

    res.json({
      branch: {
        ...branch,
        totalRevenue: salesAggregate._sum.finalAmount || 0,
        totalTransactions: salesAggregate._count || 0
      }
    });
  } catch (error) {
    console.error('Get branch error:', error);
    res.status(500).json({ error: 'Failed to get branch details' });
  }
});

// POST /api/branches - Create a new branch (Owner only)
router.post('/', requireOwner, [
  body('name').trim().notEmpty().withMessage('Branch name is required'),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { name, address, phone } = req.body;

    // Check for duplicate branch name within tenant
    const existingBranch = await prisma.branch.findFirst({
      where: {
        tenantId: req.tenantId,
        name: { equals: name, mode: 'insensitive' }
      }
    });

    if (existingBranch) {
      return res.status(400).json({ error: 'A branch with this name already exists' });
    }

    // Check if this is the first branch (make it main)
    const branchCount = await prisma.branch.count({
      where: { tenantId: req.tenantId }
    });

    const branch = await prisma.branch.create({
      data: {
        name,
        address,
        phone,
        isMain: branchCount === 0,
        isActive: true,
        tenantId: req.tenantId
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'branch_created',
      `Created branch: ${name}`,
      { branchId: branch.id }
    );

    res.status(201).json({ branch });
  } catch (error) {
    console.error('Create branch error:', error);
    res.status(500).json({ error: 'Failed to create branch' });
  }
});

// PUT /api/branches/:id - Update a branch (Owner only)
router.put('/:id', requireOwner, [
  body('name').optional().trim().notEmpty().withMessage('Branch name cannot be empty'),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, address, phone, isActive } = req.body;

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // If updating name, check for duplicates
    if (name && name !== branch.name) {
      const existingBranch = await prisma.branch.findFirst({
        where: {
          tenantId: req.tenantId,
          name: { equals: name, mode: 'insensitive' },
          id: { not: id }
        }
      });

      if (existingBranch) {
        return res.status(400).json({ error: 'A branch with this name already exists' });
      }
    }

    // Prevent deactivating main branch
    if (isActive === false && branch.isMain) {
      return res.status(400).json({ error: 'Cannot deactivate the main branch' });
    }

    const updatedBranch = await prisma.branch.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(address !== undefined && { address }),
        ...(phone !== undefined && { phone }),
        ...(isActive !== undefined && { isActive })
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'branch_updated',
      `Updated branch: ${updatedBranch.name}`,
      { branchId: id, changes: req.body }
    );

    res.json({ branch: updatedBranch });
  } catch (error) {
    console.error('Update branch error:', error);
    res.status(500).json({ error: 'Failed to update branch' });
  }
});

// POST /api/branches/:id/set-main - Set branch as main (Owner only)
router.post('/:id/set-main', requireOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Use transaction to ensure atomicity
    await prisma.$transaction([
      // Remove main status from all branches
      prisma.branch.updateMany({
        where: { tenantId: req.tenantId },
        data: { isMain: false }
      }),
      // Set this branch as main
      prisma.branch.update({
        where: { id },
        data: { isMain: true }
      })
    ]);

    await logAudit(
      req.tenantId,
      req.user.id,
      'branch_set_main',
      `Set ${branch.name} as main branch`,
      { branchId: id }
    );

    res.json({ message: 'Branch set as main successfully' });
  } catch (error) {
    console.error('Set main branch error:', error);
    res.status(500).json({ error: 'Failed to set main branch' });
  }
});

// DELETE /api/branches/:id - Delete a branch (Owner only)
router.delete('/:id', requireOwner, async (req, res) => {
  try {
    const { id } = req.params;
    const { transferTo, confirmName } = req.body;

    const branch = await prisma.branch.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        _count: {
          select: { users: true, sales: true, products: true, expenses: true }
        }
      }
    });

    if (!branch) {
      return res.status(404).json({ error: 'Branch not found' });
    }

    // Check if this is the only branch
    const branchCount = await prisma.branch.count({
      where: { tenantId: req.tenantId }
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
        where: { id: transferTo, tenantId: req.tenantId, id: { not: id } }
      });

      if (!targetBranch) {
        return res.status(400).json({ error: 'Target branch for data transfer not found' });
      }
    } else if (hasData || branch.isMain) {
      // Auto-select the next available branch for data transfer or main promotion
      targetBranch = await prisma.branch.findFirst({
        where: {
          tenantId: req.tenantId,
          id: { not: id },
          isActive: true
        },
        orderBy: [
          { isMain: 'desc' }, // Prefer current main if not being deleted
          { createdAt: 'asc' } // Then oldest branch
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
      req.tenantId,
      req.user.id,
      'branch_deleted',
      `Deleted branch: ${branch.name}${targetBranch ? ` (data transferred to ${targetBranch.name})` : ''}${newMainBranch ? ` - ${newMainBranch.name} is now the main branch` : ''}`,
      { branchId: id, transferredTo: targetBranch?.id, newMainBranchId: newMainBranch?.id }
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

// ============ BRANCH REQUESTS ============

// GET /api/branches/requests/list - Get branch requests for tenant (Owner)
router.get('/requests/list', requireOwner, async (req, res) => {
  try {
    const { status } = req.query;

    const where = { tenantId: req.tenantId };
    if (status) {
      where.status = status.toUpperCase();
    }

    const requests = await prisma.branchRequest.findMany({
      where,
      include: {
        requester: {
          select: { id: true, fullName: true, username: true }
        },
        reviewer: {
          select: { id: true, fullName: true, username: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ requests });
  } catch (error) {
    console.error('Get branch requests error:', error);
    res.status(500).json({ error: 'Failed to get branch requests' });
  }
});

// POST /api/branches/requests - Create branch request (Owner)
router.post('/requests', requireOwner, [
  body('branchName').trim().notEmpty().withMessage('Branch name is required'),
  body('reason').trim().notEmpty().withMessage('Reason is required'),
  body('address').optional().trim(),
  body('phone').optional().trim(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { branchName, address, phone, reason } = req.body;

    // Check for existing pending request with same name
    const existingRequest = await prisma.branchRequest.findFirst({
      where: {
        tenantId: req.tenantId,
        branchName: { equals: branchName, mode: 'insensitive' },
        status: 'PENDING'
      }
    });

    if (existingRequest) {
      return res.status(400).json({ error: 'A pending request for this branch name already exists' });
    }

    // Check if branch already exists
    const existingBranch = await prisma.branch.findFirst({
      where: {
        tenantId: req.tenantId,
        name: { equals: branchName, mode: 'insensitive' }
      }
    });

    if (existingBranch) {
      return res.status(400).json({ error: 'A branch with this name already exists' });
    }

    const request = await prisma.branchRequest.create({
      data: {
        branchName,
        address,
        phone,
        reason,
        requesterId: req.user.id,
        tenantId: req.tenantId
      },
      include: {
        requester: {
          select: { id: true, fullName: true }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'branch_request_created',
      `Requested new branch: ${branchName}`,
      { requestId: request.id }
    );

    res.status(201).json({ request });
  } catch (error) {
    console.error('Create branch request error:', error);
    res.status(500).json({ error: 'Failed to create branch request' });
  }
});

// DELETE /api/branches/requests/:id - Cancel pending request (Owner)
router.delete('/requests/:id', requireOwner, async (req, res) => {
  try {
    const { id } = req.params;

    const request = await prisma.branchRequest.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
        status: 'PENDING'
      }
    });

    if (!request) {
      return res.status(404).json({ error: 'Pending request not found' });
    }

    await prisma.branchRequest.delete({ where: { id } });

    await logAudit(
      req.tenantId,
      req.user.id,
      'branch_request_cancelled',
      `Cancelled branch request: ${request.branchName}`,
      { requestId: id }
    );

    res.json({ message: 'Branch request cancelled' });
  } catch (error) {
    console.error('Cancel branch request error:', error);
    res.status(500).json({ error: 'Failed to cancel branch request' });
  }
});

// GET /api/branches/stats - Get branch statistics
router.get('/stats/overview', requireOwner, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const dateFilter = {};
    if (startDate) dateFilter.gte = new Date(startDate);
    if (endDate) dateFilter.lte = new Date(endDate);
    const hasDateFilter = startDate || endDate;

    const branches = await prisma.branch.findMany({
      where: { tenantId: req.tenantId },
      include: {
        _count: {
          select: { users: true }
        }
      }
    });

    // Get stats for each branch
    const branchStats = await Promise.all(
      branches.map(async (branch) => {
        const salesWhere = {
          branchId: branch.id,
          ...(hasDateFilter && { createdAt: dateFilter })
        };

        const [salesAggregate, voidedCount] = await Promise.all([
          prisma.sale.aggregate({
            where: { ...salesWhere, paymentStatus: 'completed' },
            _sum: { finalAmount: true },
            _count: true
          }),
          prisma.sale.count({
            where: { ...salesWhere, paymentStatus: 'voided' }
          })
        ]);

        return {
          id: branch.id,
          name: branch.name,
          isMain: branch.isMain,
          isActive: branch.isActive,
          staffCount: branch._count.users,
          revenue: salesAggregate._sum.finalAmount || 0,
          transactions: salesAggregate._count || 0,
          voidedTransactions: voidedCount
        };
      })
    );

    // Calculate totals
    const totals = branchStats.reduce(
      (acc, branch) => ({
        totalRevenue: acc.totalRevenue + branch.revenue,
        totalTransactions: acc.totalTransactions + branch.transactions,
        totalStaff: acc.totalStaff + branch.staffCount
      }),
      { totalRevenue: 0, totalTransactions: 0, totalStaff: 0 }
    );

    res.json({
      branches: branchStats,
      totals,
      branchCount: branches.length
    });
  } catch (error) {
    console.error('Get branch stats error:', error);
    res.status(500).json({ error: 'Failed to get branch statistics' });
  }
});

module.exports = router;
