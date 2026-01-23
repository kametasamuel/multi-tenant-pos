const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireOwner, requireManager } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

router.use(authenticate);

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

const ADJUSTMENT_TYPES = ['damage', 'theft', 'count', 'expiry', 'received', 'other'];

// GET /api/stock-adjustments - List adjustments
router.get('/',
  requireManager,
  [
    query('productId').optional().isUUID(),
    query('branchId').optional().isUUID(),
    query('adjustmentType').optional().isIn(ADJUSTMENT_TYPES),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { productId, branchId, adjustmentType, startDate, endDate, page = 1, limit = 50 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = { tenantId: req.user.tenantId };

      if (productId) where.productId = productId;
      if (branchId) where.branchId = branchId;
      if (adjustmentType) where.adjustmentType = adjustmentType;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Manager can only see their branch
      if (req.user.role === 'MANAGER' && req.user.branchId) {
        where.branchId = req.user.branchId;
      }

      const [adjustments, total] = await Promise.all([
        prisma.stockAdjustment.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            branch: { select: { id: true, name: true } },
            adjustedBy: { select: { id: true, fullName: true } }
          }
        }),
        prisma.stockAdjustment.count({ where })
      ]);

      res.json({
        adjustments,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching stock adjustments:', error);
      res.status(500).json({ error: 'Failed to fetch stock adjustments' });
    }
  }
);

// GET /api/stock-adjustments/summary - Get adjustment summary stats
router.get('/summary',
  requireManager,
  [
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('branchId').optional().isUUID()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { startDate, endDate, branchId } = req.query;

      const where = { tenantId: req.user.tenantId };
      if (branchId) where.branchId = branchId;
      if (req.user.role === 'MANAGER' && req.user.branchId) {
        where.branchId = req.user.branchId;
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const adjustments = await prisma.stockAdjustment.findMany({
        where,
        include: {
          product: { select: { costPrice: true } }
        }
      });

      // Calculate summary by type
      const summary = {};
      let totalPositive = 0;
      let totalNegative = 0;
      let totalValueLost = 0;

      for (const adj of adjustments) {
        if (!summary[adj.adjustmentType]) {
          summary[adj.adjustmentType] = { count: 0, quantity: 0, value: 0 };
        }
        summary[adj.adjustmentType].count++;
        summary[adj.adjustmentType].quantity += adj.quantity;
        const value = Math.abs(adj.quantity) * (adj.product.costPrice || 0);
        summary[adj.adjustmentType].value += value;

        if (adj.quantity > 0) {
          totalPositive += adj.quantity;
        } else {
          totalNegative += Math.abs(adj.quantity);
          totalValueLost += value;
        }
      }

      res.json({
        byType: summary,
        totals: {
          adjustments: adjustments.length,
          increased: totalPositive,
          decreased: totalNegative,
          valueLost: totalValueLost
        }
      });
    } catch (error) {
      console.error('Error fetching adjustment summary:', error);
      res.status(500).json({ error: 'Failed to fetch summary' });
    }
  }
);

// GET /api/stock-adjustments/:id - Get single adjustment
router.get('/:id',
  requireManager,
  [param('id').isUUID()],
  handleValidation,
  async (req, res) => {
    try {
      const where = { id: req.params.id, tenantId: req.user.tenantId };
      if (req.user.role === 'MANAGER' && req.user.branchId) {
        where.branchId = req.user.branchId;
      }

      const adjustment = await prisma.stockAdjustment.findFirst({
        where,
        include: {
          product: {
            select: {
              id: true,
              name: true,
              sku: true,
              stockQuantity: true,
              costPrice: true
            }
          },
          branch: { select: { id: true, name: true } },
          adjustedBy: { select: { id: true, fullName: true } }
        }
      });

      if (!adjustment) {
        return res.status(404).json({ error: 'Stock adjustment not found' });
      }

      res.json(adjustment);
    } catch (error) {
      console.error('Error fetching stock adjustment:', error);
      res.status(500).json({ error: 'Failed to fetch stock adjustment' });
    }
  }
);

// POST /api/stock-adjustments - Create stock adjustment
router.post('/',
  requireManager,
  [
    body('productId').isUUID().withMessage('Valid product ID required'),
    body('adjustmentType').isIn(ADJUSTMENT_TYPES).withMessage(`Type must be one of: ${ADJUSTMENT_TYPES.join(', ')}`),
    body('quantity').isInt().withMessage('Quantity must be an integer (positive to add, negative to subtract)'),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('branchId').optional().isUUID()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { productId, adjustmentType, quantity, reason, branchId } = req.body;

      // Determine branch
      const targetBranchId = branchId || req.user.branchId;

      // Manager can only adjust in their branch
      if (req.user.role === 'MANAGER' && targetBranchId !== req.user.branchId) {
        return res.status(403).json({ error: 'You can only adjust stock in your branch' });
      }

      // Find product
      const product = await prisma.product.findFirst({
        where: {
          id: productId,
          tenantId: req.user.tenantId,
          ...(targetBranchId && { branchId: targetBranchId })
        }
      });

      if (!product) {
        return res.status(404).json({ error: 'Product not found in specified branch' });
      }

      // Check if negative adjustment would result in negative stock
      const newQty = product.stockQuantity + quantity;
      if (newQty < 0) {
        return res.status(400).json({
          error: `Cannot reduce stock below zero. Current: ${product.stockQuantity}, Adjustment: ${quantity}`
        });
      }

      // Create adjustment and update stock in transaction
      const adjustment = await prisma.$transaction(async (tx) => {
        // Update product stock
        await tx.product.update({
          where: { id: product.id },
          data: { stockQuantity: newQty }
        });

        // Create adjustment record
        const adj = await tx.stockAdjustment.create({
          data: {
            productId,
            adjustmentType,
            quantity,
            previousQty: product.stockQuantity,
            newQty,
            reason,
            adjustedById: req.user.id,
            tenantId: req.user.tenantId,
            branchId: targetBranchId
          },
          include: {
            product: { select: { id: true, name: true, sku: true } },
            branch: { select: { id: true, name: true } },
            adjustedBy: { select: { id: true, fullName: true } }
          }
        });

        return adj;
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          action: 'stock_adjusted',
          description: `Adjusted ${product.name} stock by ${quantity > 0 ? '+' : ''}${quantity} (${adjustmentType})`,
          userId: req.user.id,
          tenantId: req.user.tenantId,
          branchId: targetBranchId,
          metadata: JSON.stringify({
            productId,
            adjustmentType,
            quantity,
            previousQty: product.stockQuantity,
            newQty
          })
        }
      });

      res.status(201).json(adjustment);
    } catch (error) {
      console.error('Error creating stock adjustment:', error);
      res.status(500).json({ error: 'Failed to create stock adjustment' });
    }
  }
);

// POST /api/stock-adjustments/bulk - Bulk stock count adjustment
router.post('/bulk',
  requireManager,
  [
    body('adjustments').isArray({ min: 1 }).withMessage('At least one adjustment required'),
    body('adjustments.*.productId').isUUID(),
    body('adjustments.*.newCount').isInt({ min: 0 }),
    body('reason').trim().notEmpty().withMessage('Reason is required'),
    body('branchId').optional().isUUID()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { adjustments, reason, branchId } = req.body;
      const targetBranchId = branchId || req.user.branchId;

      if (req.user.role === 'MANAGER' && targetBranchId !== req.user.branchId) {
        return res.status(403).json({ error: 'You can only adjust stock in your branch' });
      }

      const productIds = adjustments.map(a => a.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          tenantId: req.user.tenantId,
          ...(targetBranchId && { branchId: targetBranchId })
        }
      });

      if (products.length !== productIds.length) {
        return res.status(400).json({ error: 'One or more products not found in specified branch' });
      }

      const productMap = new Map(products.map(p => [p.id, p]));
      const results = [];

      await prisma.$transaction(async (tx) => {
        for (const adj of adjustments) {
          const product = productMap.get(adj.productId);
          const quantity = adj.newCount - product.stockQuantity;

          if (quantity === 0) continue;

          // Update stock
          await tx.product.update({
            where: { id: product.id },
            data: { stockQuantity: adj.newCount }
          });

          // Create adjustment record
          const adjustment = await tx.stockAdjustment.create({
            data: {
              productId: product.id,
              adjustmentType: 'count',
              quantity,
              previousQty: product.stockQuantity,
              newQty: adj.newCount,
              reason,
              adjustedById: req.user.id,
              tenantId: req.user.tenantId,
              branchId: targetBranchId
            }
          });

          results.push({
            productId: product.id,
            productName: product.name,
            previousQty: product.stockQuantity,
            newQty: adj.newCount,
            difference: quantity
          });
        }
      });

      // Log audit
      await prisma.auditLog.create({
        data: {
          action: 'bulk_stock_count',
          description: `Bulk stock count: ${results.length} products adjusted`,
          userId: req.user.id,
          tenantId: req.user.tenantId,
          branchId: targetBranchId,
          metadata: JSON.stringify({ count: results.length, reason })
        }
      });

      res.status(201).json({
        message: `${results.length} product(s) adjusted`,
        adjustments: results
      });
    } catch (error) {
      console.error('Error creating bulk stock adjustment:', error);
      res.status(500).json({ error: 'Failed to create bulk adjustment' });
    }
  }
);

// GET /api/stock-adjustments/product/:productId - Get adjustments for a product
router.get('/product/:productId',
  requireManager,
  [
    param('productId').isUUID(),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { limit = 20 } = req.query;

      const adjustments = await prisma.stockAdjustment.findMany({
        where: {
          productId: req.params.productId,
          tenantId: req.user.tenantId,
          ...(req.user.role === 'MANAGER' && req.user.branchId && { branchId: req.user.branchId })
        },
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          adjustedBy: { select: { id: true, fullName: true } },
          branch: { select: { id: true, name: true } }
        }
      });

      res.json(adjustments);
    } catch (error) {
      console.error('Error fetching product adjustments:', error);
      res.status(500).json({ error: 'Failed to fetch adjustments' });
    }
  }
);

module.exports = router;
