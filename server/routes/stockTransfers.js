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

// Generate transfer number: TRF-YYYYMMDD-XXXX
async function generateTransferNumber(tenantId) {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `TRF-${dateStr}-`;

  const lastTransfer = await prisma.stockTransfer.findFirst({
    where: {
      tenantId,
      transferNumber: { startsWith: prefix }
    },
    orderBy: { transferNumber: 'desc' }
  });

  if (lastTransfer) {
    const lastNum = parseInt(lastTransfer.transferNumber.slice(-4));
    return `${prefix}${String(lastNum + 1).padStart(4, '0')}`;
  }
  return `${prefix}0001`;
}

// GET /api/stock-transfers - List transfers
router.get('/',
  requireManager,
  [
    query('status').optional().isIn(['PENDING', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED']),
    query('fromBranchId').optional().isUUID(),
    query('toBranchId').optional().isUUID(),
    query('startDate').optional().isISO8601(),
    query('endDate').optional().isISO8601(),
    query('page').optional().isInt({ min: 1 }),
    query('limit').optional().isInt({ min: 1, max: 100 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { status, fromBranchId, toBranchId, startDate, endDate, page = 1, limit = 50 } = req.query;
      const skip = (parseInt(page) - 1) * parseInt(limit);

      const where = { tenantId: req.user.tenantId };

      if (status) where.status = status;
      if (fromBranchId) where.fromBranchId = fromBranchId;
      if (toBranchId) where.toBranchId = toBranchId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      // Manager sees transfers involving their branch
      if (req.user.role === 'MANAGER' && req.user.branchId) {
        where.OR = [
          { fromBranchId: req.user.branchId },
          { toBranchId: req.user.branchId }
        ];
      }

      const [transfers, total] = await Promise.all([
        prisma.stockTransfer.findMany({
          where,
          skip,
          take: parseInt(limit),
          orderBy: { createdAt: 'desc' },
          include: {
            fromBranch: { select: { id: true, name: true } },
            toBranch: { select: { id: true, name: true } },
            initiatedBy: { select: { id: true, fullName: true } },
            receivedBy: { select: { id: true, fullName: true } },
            _count: { select: { items: true } }
          }
        }),
        prisma.stockTransfer.count({ where })
      ]);

      res.json({
        transfers,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      console.error('Error fetching stock transfers:', error);
      res.status(500).json({ error: 'Failed to fetch stock transfers' });
    }
  }
);

// GET /api/stock-transfers/:id - Get single transfer
router.get('/:id',
  requireManager,
  [param('id').isUUID()],
  handleValidation,
  async (req, res) => {
    try {
      const transfer = await prisma.stockTransfer.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: {
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          initiatedBy: { select: { id: true, fullName: true } },
          receivedBy: { select: { id: true, fullName: true } },
          items: {
            include: {
              product: {
                select: { id: true, name: true, sku: true, stockQuantity: true }
              }
            }
          }
        }
      });

      if (!transfer) {
        return res.status(404).json({ error: 'Stock transfer not found' });
      }

      res.json(transfer);
    } catch (error) {
      console.error('Error fetching stock transfer:', error);
      res.status(500).json({ error: 'Failed to fetch stock transfer' });
    }
  }
);

// POST /api/stock-transfers - Create new transfer
router.post('/',
  requireManager,
  [
    body('fromBranchId').isUUID().withMessage('Valid source branch required'),
    body('toBranchId').isUUID().withMessage('Valid destination branch required'),
    body('notes').optional().trim(),
    body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
    body('items.*.productId').isUUID(),
    body('items.*.quantity').isInt({ min: 1 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { fromBranchId, toBranchId, notes, items } = req.body;

      if (fromBranchId === toBranchId) {
        return res.status(400).json({ error: 'Source and destination branches must be different' });
      }

      // Verify branches belong to tenant
      const branches = await prisma.branch.findMany({
        where: {
          id: { in: [fromBranchId, toBranchId] },
          tenantId: req.user.tenantId,
          isActive: true
        }
      });
      if (branches.length !== 2) {
        return res.status(400).json({ error: 'Invalid branch selection' });
      }

      // Manager can only transfer from their branch
      if (req.user.role === 'MANAGER' && req.user.branchId !== fromBranchId) {
        return res.status(403).json({ error: 'You can only initiate transfers from your branch' });
      }

      // Verify products and stock availability
      const productIds = items.map(i => i.productId);
      const products = await prisma.product.findMany({
        where: {
          id: { in: productIds },
          tenantId: req.user.tenantId,
          branchId: fromBranchId
        }
      });

      const productMap = new Map(products.map(p => [p.id, p]));
      const errors = [];

      for (const item of items) {
        const product = productMap.get(item.productId);
        if (!product) {
          errors.push(`Product ${item.productId} not found in source branch`);
        } else if (product.stockQuantity < item.quantity) {
          errors.push(`Insufficient stock for ${product.name} (available: ${product.stockQuantity})`);
        }
      }

      if (errors.length > 0) {
        return res.status(400).json({ error: errors.join('; ') });
      }

      const transferNumber = await generateTransferNumber(req.user.tenantId);

      // Create transfer and items in transaction
      const transfer = await prisma.$transaction(async (tx) => {
        const newTransfer = await tx.stockTransfer.create({
          data: {
            transferNumber,
            fromBranchId,
            toBranchId,
            notes,
            initiatedById: req.user.id,
            tenantId: req.user.tenantId,
            items: {
              create: items.map(item => ({
                productId: item.productId,
                quantity: item.quantity
              }))
            }
          },
          include: {
            fromBranch: { select: { id: true, name: true } },
            toBranch: { select: { id: true, name: true } },
            items: {
              include: {
                product: { select: { id: true, name: true, sku: true } }
              }
            }
          }
        });

        return newTransfer;
      });

      await prisma.auditLog.create({
        data: {
          action: 'stock_transfer_created',
          description: `Created transfer ${transferNumber} from ${branches.find(b => b.id === fromBranchId).name} to ${branches.find(b => b.id === toBranchId).name}`,
          userId: req.user.id,
          tenantId: req.user.tenantId,
          branchId: fromBranchId
        }
      });

      res.status(201).json(transfer);
    } catch (error) {
      console.error('Error creating stock transfer:', error);
      res.status(500).json({ error: 'Failed to create stock transfer' });
    }
  }
);

// POST /api/stock-transfers/:id/ship - Ship transfer (PENDING -> IN_TRANSIT)
router.post('/:id/ship',
  requireManager,
  [param('id').isUUID()],
  handleValidation,
  async (req, res) => {
    try {
      const transfer = await prisma.stockTransfer.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: { items: true }
      });

      if (!transfer) {
        return res.status(404).json({ error: 'Stock transfer not found' });
      }

      if (transfer.status !== 'PENDING') {
        return res.status(400).json({ error: 'Transfer is not in PENDING status' });
      }

      // Manager can only ship from their branch
      if (req.user.role === 'MANAGER' && req.user.branchId !== transfer.fromBranchId) {
        return res.status(403).json({ error: 'You can only ship transfers from your branch' });
      }

      // Deduct stock from source branch
      await prisma.$transaction(async (tx) => {
        for (const item of transfer.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { stockQuantity: { decrement: item.quantity } }
          });
        }

        await tx.stockTransfer.update({
          where: { id: transfer.id },
          data: {
            status: 'IN_TRANSIT',
            shippedAt: new Date()
          }
        });
      });

      const updated = await prisma.stockTransfer.findFirst({
        where: { id: transfer.id },
        include: {
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } }
        }
      });

      await prisma.auditLog.create({
        data: {
          action: 'stock_transfer_shipped',
          description: `Shipped transfer ${transfer.transferNumber}`,
          userId: req.user.id,
          tenantId: req.user.tenantId,
          branchId: transfer.fromBranchId
        }
      });

      res.json(updated);
    } catch (error) {
      console.error('Error shipping stock transfer:', error);
      res.status(500).json({ error: 'Failed to ship stock transfer' });
    }
  }
);

// POST /api/stock-transfers/:id/receive - Receive transfer
router.post('/:id/receive',
  requireManager,
  [
    param('id').isUUID(),
    body('items').optional().isArray(),
    body('items.*.itemId').optional().isUUID(),
    body('items.*.receivedQty').optional().isInt({ min: 0 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const transfer = await prisma.stockTransfer.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: {
          items: true,
          toBranch: true
        }
      });

      if (!transfer) {
        return res.status(404).json({ error: 'Stock transfer not found' });
      }

      if (transfer.status !== 'IN_TRANSIT') {
        return res.status(400).json({ error: 'Transfer is not in transit' });
      }

      // Manager can only receive at their branch
      if (req.user.role === 'MANAGER' && req.user.branchId !== transfer.toBranchId) {
        return res.status(403).json({ error: 'You can only receive transfers at your branch' });
      }

      const { items } = req.body;

      await prisma.$transaction(async (tx) => {
        for (const transferItem of transfer.items) {
          // Find received qty (default to full quantity if not specified)
          const receiveData = items?.find(i => i.itemId === transferItem.id);
          const receivedQty = receiveData ? receiveData.receivedQty : transferItem.quantity;

          // Update transfer item
          await tx.stockTransferItem.update({
            where: { id: transferItem.id },
            data: { receivedQty }
          });

          // Find or create product at destination branch
          // First check if product exists at destination
          const destProduct = await tx.product.findFirst({
            where: {
              tenantId: req.user.tenantId,
              branchId: transfer.toBranchId,
              name: { equals: (await tx.product.findUnique({ where: { id: transferItem.productId } })).name }
            }
          });

          if (destProduct) {
            // Update existing product stock
            await tx.product.update({
              where: { id: destProduct.id },
              data: { stockQuantity: { increment: receivedQty } }
            });
          } else {
            // Copy product to destination branch
            const sourceProduct = await tx.product.findUnique({
              where: { id: transferItem.productId }
            });

            await tx.product.create({
              data: {
                name: sourceProduct.name,
                description: sourceProduct.description,
                type: sourceProduct.type,
                sku: sourceProduct.sku,
                barcode: sourceProduct.barcode,
                costPrice: sourceProduct.costPrice,
                sellingPrice: sourceProduct.sellingPrice,
                stockQuantity: receivedQty,
                lowStockThreshold: sourceProduct.lowStockThreshold,
                tenantId: req.user.tenantId,
                branchId: transfer.toBranchId
              }
            });
          }
        }

        await tx.stockTransfer.update({
          where: { id: transfer.id },
          data: {
            status: 'RECEIVED',
            receivedAt: new Date(),
            receivedById: req.user.id
          }
        });
      });

      const updated = await prisma.stockTransfer.findFirst({
        where: { id: transfer.id },
        include: {
          fromBranch: { select: { name: true } },
          toBranch: { select: { name: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } }
            }
          }
        }
      });

      await prisma.auditLog.create({
        data: {
          action: 'stock_transfer_received',
          description: `Received transfer ${transfer.transferNumber}`,
          userId: req.user.id,
          tenantId: req.user.tenantId,
          branchId: transfer.toBranchId
        }
      });

      res.json(updated);
    } catch (error) {
      console.error('Error receiving stock transfer:', error);
      res.status(500).json({ error: 'Failed to receive stock transfer' });
    }
  }
);

// POST /api/stock-transfers/:id/cancel - Cancel transfer
router.post('/:id/cancel',
  requireOwner,
  [param('id').isUUID()],
  handleValidation,
  async (req, res) => {
    try {
      const transfer = await prisma.stockTransfer.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: { items: true }
      });

      if (!transfer) {
        return res.status(404).json({ error: 'Stock transfer not found' });
      }

      if (transfer.status === 'RECEIVED') {
        return res.status(400).json({ error: 'Cannot cancel a completed transfer' });
      }

      // If in transit, return stock to source
      if (transfer.status === 'IN_TRANSIT') {
        await prisma.$transaction(async (tx) => {
          for (const item of transfer.items) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stockQuantity: { increment: item.quantity } }
            });
          }

          await tx.stockTransfer.update({
            where: { id: transfer.id },
            data: { status: 'CANCELLED' }
          });
        });
      } else {
        await prisma.stockTransfer.update({
          where: { id: transfer.id },
          data: { status: 'CANCELLED' }
        });
      }

      await prisma.auditLog.create({
        data: {
          action: 'stock_transfer_cancelled',
          description: `Cancelled transfer ${transfer.transferNumber}`,
          userId: req.user.id,
          tenantId: req.user.tenantId
        }
      });

      res.json({ message: 'Transfer cancelled successfully' });
    } catch (error) {
      console.error('Error cancelling stock transfer:', error);
      res.status(500).json({ error: 'Failed to cancel stock transfer' });
    }
  }
);

module.exports = router;
