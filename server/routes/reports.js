const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get dashboard summary (Admin only)
router.get('/dashboard', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate);
    }

    // Total sales
    const totalSales = await prisma.sale.aggregate({
      where: {
        tenantId: req.tenantId,
        paymentStatus: 'completed',
        ...dateFilter
      },
      _sum: {
        finalAmount: true
      }
    });

    // Total expenses
    const totalExpenses = await prisma.expense.aggregate({
      where: {
        tenantId: req.tenantId,
        ...dateFilter
      },
      _sum: {
        amount: true
      }
    });

    // Net profit
    const salesTotal = totalSales._sum.finalAmount || 0;
    const expensesTotal = totalExpenses._sum.amount || 0;
    const netProfit = salesTotal - expensesTotal;

    // Transaction count
    const transactionCount = await prisma.sale.count({
      where: {
        tenantId: req.tenantId,
        paymentStatus: 'completed',
        ...dateFilter
      }
    });

    res.json({
      totalSales: salesTotal,
      totalExpenses: expensesTotal,
      netProfit,
      transactionCount
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get daily sales report (Cashier sees own, Admin sees all)
router.get('/daily-sales', authenticate, async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    const startOfDay = new Date(targetDate);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(targetDate);
    endOfDay.setHours(23, 59, 59, 999);

    const where = {
      tenantId: req.tenantId,
      paymentStatus: 'completed',
      createdAt: {
        gte: startOfDay,
        lte: endOfDay
      }
    };

    // Cashiers see only their own sales
    if (req.user.role === 'CASHIER') {
      where.cashierId = req.user.id;
    }

    const sales = await prisma.sale.findMany({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        cashier: {
          select: {
            fullName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    const totalAmount = sales.reduce((sum, sale) => sum + sale.finalAmount, 0);

    res.json({
      date: targetDate.toISOString().split('T')[0],
      sales,
      totalAmount,
      transactionCount: sales.length
    });
  } catch (error) {
    console.error('Daily sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get sales trends (Admin only)
router.get('/sales-trends', authenticate, requireAdmin, async (req, res) => {
  try {
    const { period = 'daily', days = 30 } = req.query;
    
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    // Group sales by period
    const sales = await prisma.sale.findMany({
      where: {
        tenantId: req.tenantId,
        paymentStatus: 'completed',
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      select: {
        finalAmount: true,
        createdAt: true
      },
      orderBy: { createdAt: 'asc' }
    });

    // Group by period
    const trends = {};
    sales.forEach(sale => {
      const date = new Date(sale.createdAt);
      let key;
      
      if (period === 'daily') {
        key = date.toISOString().split('T')[0];
      } else if (period === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else if (period === 'monthly') {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!trends[key]) {
        trends[key] = 0;
      }
      trends[key] += sale.finalAmount;
    });

    res.json({ trends });
  } catch (error) {
    console.error('Sales trends error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get staff performance (Admin only)
router.get('/staff-performance', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate);
    }

    const staffPerformance = await prisma.sale.groupBy({
      by: ['cashierId'],
      where: {
        tenantId: req.tenantId,
        paymentStatus: 'completed',
        ...dateFilter
      },
      _sum: {
        finalAmount: true
      },
      _count: {
        id: true
      }
    });

    // Get staff details
    const staffIds = staffPerformance.map(p => p.cashierId);
    const staff = await prisma.user.findMany({
      where: {
        id: { in: staffIds },
        tenantId: req.tenantId
      },
      select: {
        id: true,
        fullName: true,
        username: true,
        role: true
      }
    });

    const performance = staffPerformance.map(perf => {
      const staffMember = staff.find(s => s.id === perf.cashierId);
      return {
        staff: staffMember,
        totalSales: perf._sum.finalAmount || 0,
        transactionCount: perf._count.id
      };
    });

    res.json({ performance });
  } catch (error) {
    console.error('Staff performance error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
