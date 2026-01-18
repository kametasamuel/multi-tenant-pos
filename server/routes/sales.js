const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { validateCreateSale } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Create sale transaction
router.post('/', authenticate, validateCreateSale, async (req, res) => {
  try {
    const { items, paymentMethod, discountAmount = 0, notes } = req.body;
    const cashierId = req.user.id;

    // Validate all products exist and have sufficient stock
    const productIds = items.map(item => item.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: req.tenantId,
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'One or more products not found' });
    }

    // Calculate totals and validate stock
    let totalAmount = 0;
    const saleItemsData = [];

    for (const item of items) {
      const product = products.find(p => p.id === item.productId);
      if (!product) {
        return res.status(400).json({ error: `Product ${item.productId} not found` });
      }

      if (product.category === 'PRODUCT' && product.stockQuantity < item.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}` 
        });
      }

      const unitPrice = product.sellingPrice;
      const itemDiscount = item.discount || 0;
      const subtotal = (unitPrice * item.quantity) - itemDiscount;

      saleItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        subtotal
      });

      totalAmount += subtotal;
    }

    const finalAmount = totalAmount - discountAmount;

    if (finalAmount <= 0) {
      return res.status(400).json({ error: 'Final amount must be greater than zero' });
    }

    // Generate transaction number
    const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create sale with items (transaction)
    const sale = await prisma.$transaction(async (tx) => {
      // Create sale
      const newSale = await tx.sale.create({
        data: {
          transactionNumber,
          totalAmount,
          discountAmount,
          finalAmount,
          paymentMethod,
          paymentStatus: 'completed',
          cashierId,
          tenantId: req.tenantId,
          items: {
            create: saleItemsData
          }
        },
        include: {
          items: {
            include: {
              product: true
            }
          },
          cashier: {
            select: {
              fullName: true,
              username: true
            }
          }
        }
      });

      // Update product stock
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product.category === 'PRODUCT') {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                decrement: item.quantity
              }
            }
          });
        }
      }

      return newSale;
    });

    await logAudit(req.tenantId, cashierId, 'sale_created', `Sale created: ${transactionNumber}`, {
      saleId: sale.id,
      finalAmount,
      paymentMethod
    });

    res.status(201).json({ sale });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all sales (Admin sees all, Cashier sees own)
router.get('/', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, cashierId } = req.query;
    
    const where = {
      tenantId: req.tenantId
    };

    // Cashiers can only see their own sales
    if (req.user.role === 'CASHIER') {
      where.cashierId = req.user.id;
    } else if (cashierId) {
      // Admin can filter by cashier
      where.cashierId = cashierId;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
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
            fullName: true,
            username: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 100 // Limit to recent 100
    });

    res.json({ sales });
  } catch (error) {
    console.error('Get sales error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single sale
router.get('/:id', authenticate, async (req, res) => {
  try {
    const where = {
      id: req.params.id,
      tenantId: req.tenantId
    };

    // Cashiers can only see their own sales
    if (req.user.role === 'CASHIER') {
      where.cashierId = req.user.id;
    }

    const sale = await prisma.sale.findFirst({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        cashier: {
          select: {
            fullName: true,
            username: true
          }
        }
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json({ sale });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Void/Delete sale (Admin only)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const sale = await prisma.sale.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      },
      include: {
        items: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    // Restore stock and void sale
    await prisma.$transaction(async (tx) => {
      // Restore product stock
      for (const item of sale.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product && product.category === 'PRODUCT') {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: {
                increment: item.quantity
              }
            }
          });
        }
      }

      // Update sale status
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          paymentStatus: 'voided'
        }
      });
    });

    await logAudit(req.tenantId, req.user.id, 'sale_voided', `Voided sale: ${sale.transactionNumber}`, {
      saleId: sale.id,
      originalAmount: sale.finalAmount
    });

    res.json({ message: 'Sale voided successfully' });
  } catch (error) {
    console.error('Void sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
