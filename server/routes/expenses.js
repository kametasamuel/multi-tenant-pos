const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireManager } = require('../middleware/auth');
const { validateCreateExpense } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Create expense - Only managers and owners can create expenses
router.post('/', authenticate, requireManager, validateCreateExpense, async (req, res) => {
  try {
    const { description, amount, category, branchId } = req.body;

    // Managers can only create expenses for their own branch
    // Owners can specify any branch or default to their branch
    let expenseBranchId;
    if (req.user.role === 'MANAGER') {
      // Force manager to use their own branch
      expenseBranchId = req.branchId;
    } else {
      // Owner/Admin can specify branchId or use their own
      expenseBranchId = branchId || req.branchId || null;
    }

    const expense = await prisma.expense.create({
      data: {
        description,
        amount,
        category,
        recordedBy: req.user.id,
        tenantId: req.tenantId,
        branchId: expenseBranchId
      },
      include: {
        recorder: {
          select: {
            fullName: true,
            username: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    // Log expense creation
    await prisma.auditLog.create({
      data: {
        action: 'expense_created',
        description: `Expense logged: ${description} - ${category} (${amount})`,
        userId: req.user.id,
        tenantId: req.tenantId,
        branchId: expenseBranchId,
        metadata: JSON.stringify({
          expenseId: expense.id,
          amount,
          category,
          description,
          branchId: expenseBranchId
        })
      }
    });

    res.status(201).json({ expense });
  } catch (error) {
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all expenses
router.get('/', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, category, branchId } = req.query;

    const where = {
      tenantId: req.tenantId
    };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    if (category) {
      where.category = category;
    }

    // Branch filtering: Managers see only their branch, Owners can filter or see all
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        recorder: {
          select: {
            fullName: true,
            username: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single expense
router.get('/:id', authenticate, async (req, res) => {
  try {
    const where = {
      id: req.params.id,
      tenantId: req.tenantId
    };

    // Managers can only see their branch's expenses
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    }

    const expense = await prisma.expense.findFirst({
      where,
      include: {
        recorder: {
          select: {
            fullName: true,
            username: true
          }
        },
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    if (!expense) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    res.json({ expense });
  } catch (error) {
    console.error('Get expense error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
