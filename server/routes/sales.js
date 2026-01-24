const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { validateCreateSale } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Create sale transaction
router.post('/', authenticate, validateCreateSale, async (req, res) => {
  try {
    const { items, paymentMethod, discountAmount = 0, notes, customerId } = req.body;
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

      if (product.type === 'PRODUCT' && product.stockQuantity < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}`
        });
      }

      // Validate attendantId if provided (for SERVICES business type)
      if (item.attendantId) {
        const attendant = await prisma.attendant.findFirst({
          where: { id: item.attendantId, tenantId: req.tenantId, isActive: true }
        });
        if (!attendant) {
          return res.status(400).json({ error: 'Invalid attendant selected' });
        }
      }

      const unitPrice = product.sellingPrice;
      const itemDiscount = item.discount || 0;
      const subtotal = (unitPrice * item.quantity) - itemDiscount;

      saleItemsData.push({
        productId: item.productId,
        quantity: item.quantity,
        unitPrice,
        discount: itemDiscount,
        subtotal,
        attendantId: item.attendantId || null
      });

      totalAmount += subtotal;
    }

    const finalAmount = totalAmount - discountAmount;

    if (finalAmount <= 0) {
      return res.status(400).json({ error: 'Final amount must be greater than zero' });
    }

    // Generate transaction number
    const transactionNumber = `TXN-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Validate customer if provided
    if (customerId) {
      const customer = await prisma.customer.findFirst({
        where: { id: customerId, tenantId: req.tenantId }
      });
      if (!customer) {
        return res.status(400).json({ error: 'Customer not found' });
      }
    }

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
          customerId: customerId || null,
          tenantId: req.tenantId,
          branchId: req.branchId || null, // Tag sale with user's branch
          items: {
            create: saleItemsData
          }
        },
        include: {
          items: {
            include: {
              product: true,
              attendant: {
                select: {
                  id: true,
                  fullName: true,
                  commissionRate: true
                }
              }
            }
          },
          cashier: {
            select: {
              fullName: true,
              username: true
            }
          },
          customer: {
            select: {
              id: true,
              name: true,
              phone: true
            }
          }
        }
      });

      // Update product stock
      for (const item of items) {
        const product = products.find(p => p.id === item.productId);
        if (product.type === 'PRODUCT') {
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

      // Update customer stats if customer was specified
      if (customerId) {
        await tx.customer.update({
          where: { id: customerId },
          data: {
            totalSpent: { increment: finalAmount },
            visitCount: { increment: 1 }
          }
        });
      }

      return newSale;
    });

    await logAudit(req.tenantId, cashierId, 'sale_created', `Sale created: ${transactionNumber}`, {
      saleId: sale.id,
      finalAmount,
      paymentMethod,
      branchId: req.branchId
    }, req.branchId);

    res.status(201).json({ sale });
  } catch (error) {
    console.error('Create sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all sales (filtered by role and parameters)
router.get('/', authenticate, async (req, res) => {
  try {
    const { startDate, endDate, cashierId, ownSalesOnly, branchId, page = 1, limit = 100 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = {
      tenantId: req.tenantId
    };

    // Cashiers always see only their own sales
    // Managers see only their branch's sales (unless viewing POS with ownSalesOnly)
    // Owners/Admins see all tenant sales (can filter by branchId)
    if (req.user.role === 'CASHIER') {
      where.cashierId = req.user.id;
    } else if (ownSalesOnly === 'true') {
      // When using POS terminal, see only their own sales
      where.cashierId = req.user.id;
    } else if (req.user.role === 'MANAGER' && req.branchId) {
      // Managers see only their branch's sales
      where.branchId = req.branchId;
      if (cashierId) {
        where.cashierId = cashierId;
      }
    } else if (branchId) {
      // Owner/Admin filtering by specific branch
      where.branchId = branchId;
      if (cashierId) {
        where.cashierId = cashierId;
      }
    } else if (cashierId) {
      // Admin can filter by specific cashier
      where.cashierId = cashierId;
    }
    // If none of above, admin/owner sees all tenant sales (for reports/oversight)

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const [sales, total] = await Promise.all([
      prisma.sale.findMany({
        where,
        include: {
          items: {
            include: {
              product: true,
              attendant: {
                select: {
                  id: true,
                  fullName: true,
                  commissionRate: true
                }
              }
            }
          },
          cashier: {
            select: {
              fullName: true,
              username: true,
              branchId: true
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
        take: parseInt(limit)
      }),
      prisma.sale.count({ where })
    ]);

    res.json({
      sales,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
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
    } else if (req.user.role === 'MANAGER' && req.branchId) {
      // Managers can only see their branch's sales
      where.branchId = req.branchId;
    }

    const sale = await prisma.sale.findFirst({
      where,
      include: {
        items: {
          include: {
            product: true,
            attendant: {
              select: {
                id: true,
                fullName: true,
                commissionRate: true
              }
            }
          }
        },
        cashier: {
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

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found' });
    }

    res.json({ sale });
  } catch (error) {
    console.error('Get sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Void/Delete sale (Admin/Manager - managers can only void their branch's sales)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    // Build where clause with branch filtering for managers
    const where = {
      id: req.params.id,
      tenantId: req.tenantId
    };

    // Managers can only void sales from their own branch
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    }

    const sale = await prisma.sale.findFirst({
      where,
      include: {
        items: true
      }
    });

    if (!sale) {
      return res.status(404).json({ error: 'Sale not found or not in your branch' });
    }

    // Restore stock and void sale
    await prisma.$transaction(async (tx) => {
      // Restore product stock
      for (const item of sale.items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product && product.type === 'PRODUCT') {
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

      // Update sale status with void tracking info
      await tx.sale.update({
        where: { id: sale.id },
        data: {
          paymentStatus: 'voided',
          voidedById: req.user.id,
          voidedAt: new Date(),
          voidReason: req.body.reason || null
        }
      });
    });

    await logAudit(req.tenantId, req.user.id, 'sale_voided', `Voided sale: ${sale.transactionNumber}`, {
      saleId: sale.id,
      originalAmount: sale.finalAmount,
      branchId: sale.branchId,
      reason: req.body.reason || null
    }, sale.branchId);

    res.json({ message: 'Sale voided successfully' });
  } catch (error) {
    console.error('Void sale error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
