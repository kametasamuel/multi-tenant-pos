const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { validateCreateExpense } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Create expense
router.post('/', authenticate, validateCreateExpense, async (req, res) => {
  try {
    const { description, amount, category } = req.body;

    const expense = await prisma.expense.create({
      data: {
        description,
        amount,
        category,
        recordedBy: req.user.id,
        tenantId: req.tenantId
      },
      include: {
        recorder: {
          select: {
            fullName: true,
            username: true
          }
        }
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
    const { startDate, endDate, category } = req.query;

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

    const expenses = await prisma.expense.findMany({
      where,
      include: {
        recorder: {
          select: {
            fullName: true,
            username: true
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
    const expense = await prisma.expense.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      },
      include: {
        recorder: {
          select: {
            fullName: true,
            username: true
          }
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
