const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { emitOrderCreated, emitOrderUpdated, emitOrderCompleted, emitOrderCancelled } = require('../utils/socketEvents');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticate);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    console.log('Order validation errors:', errors.array());
    console.log('Request body:', JSON.stringify(req.body, null, 2));
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware to check if restaurant features are enabled
const requireRestaurantFeatures = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { enableRunningTabs: true, businessType: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Allow if running tabs enabled OR if business type is FOOD_AND_BEVERAGE
    if (!tenant.enableRunningTabs && tenant.businessType !== 'FOOD_AND_BEVERAGE') {
      return res.status(403).json({ error: 'Restaurant orders are not enabled for this business' });
    }

    next();
  } catch (error) {
    console.error('Restaurant features check error:', error);
    res.status(500).json({ error: 'Failed to check restaurant features' });
  }
};

// Helper: Generate order number (ORD-001 format, resets daily)
async function generateOrderNumber(tenantId, branchId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const count = await prisma.restaurantOrder.count({
    where: {
      tenantId,
      branchId,
      createdAt: { gte: today }
    }
  });

  const num = (count + 1).toString().padStart(3, '0');
  return `ORD-${num}`;
}

// Helper: Calculate order total
function calculateOrderTotal(items) {
  return items.reduce((sum, item) => {
    const modifiers = item.modifiers ? JSON.parse(item.modifiers) : [];
    const modifierTotal = modifiers.reduce((mSum, mod) => mSum + (mod.price || 0), 0);
    return sum + (item.unitPrice + modifierTotal) * item.quantity;
  }, 0);
}

// GET /api/orders - List orders (with filters)
router.get('/', requireRestaurantFeatures, async (req, res) => {
  try {
    const { status, tableId, isTabOpen, date, branchId, page = 1, limit = 50 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100);

    const where = { tenantId: req.tenantId };

    // Branch filtering
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    if (tableId) {
      where.tableId = tableId;
    }

    if (isTabOpen !== undefined) {
      where.isTabOpen = isTabOpen === 'true';
    }

    if (date) {
      const startDate = new Date(date);
      startDate.setHours(0, 0, 0, 0);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      where.createdAt = { gte: startDate, lte: endDate };
    }

    const [orders, total] = await Promise.all([
      prisma.restaurantOrder.findMany({
        where,
        include: {
          table: {
            select: { id: true, tableNumber: true, section: true }
          },
          customer: {
            select: { id: true, name: true, phone: true }
          },
          createdBy: {
            select: { id: true, fullName: true }
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, image: true }
              }
            }
          },
          branch: {
            select: { id: true, name: true }
          }
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.restaurantOrder.count({ where })
    ]);

    // Calculate totals for each order
    const ordersWithTotals = orders.map(order => ({
      ...order,
      total: calculateOrderTotal(order.items)
    }));

    res.json({
      orders: ordersWithTotals,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Failed to get orders' });
  }
});

// GET /api/orders/open-tabs - Get all open tabs
router.get('/open-tabs', requireRestaurantFeatures, async (req, res) => {
  try {
    const { branchId } = req.query;

    const where = {
      tenantId: req.tenantId,
      isTabOpen: true,
      status: { notIn: ['completed', 'cancelled'] }
    };

    // Branch filtering
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    const orders = await prisma.restaurantOrder.findMany({
      where,
      include: {
        table: {
          select: { id: true, tableNumber: true, section: true }
        },
        customer: {
          select: { id: true, name: true }
        },
        createdBy: {
          select: { id: true, fullName: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    const ordersWithTotals = orders.map(order => ({
      ...order,
      total: calculateOrderTotal(order.items)
    }));

    res.json({ orders: ordersWithTotals });
  } catch (error) {
    console.error('Get open tabs error:', error);
    res.status(500).json({ error: 'Failed to get open tabs' });
  }
});

// GET /api/orders/:id - Get single order
router.get('/:id', requireRestaurantFeatures, async (req, res) => {
  try {
    const { id } = req.params;

    const where = { id, tenantId: req.tenantId };

    // Branch filtering for managers/cashiers
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({
      where,
      include: {
        table: {
          select: { id: true, tableNumber: true, section: true, capacity: true }
        },
        customer: {
          select: { id: true, name: true, phone: true, email: true }
        },
        createdBy: {
          select: { id: true, fullName: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, sellingPrice: true, image: true, kitchenCategory: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        branch: {
          select: { id: true, name: true }
        },
        sale: {
          select: { id: true, transactionNumber: true, finalAmount: true, paymentMethod: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      order: {
        ...order,
        total: calculateOrderTotal(order.items)
      }
    });
  } catch (error) {
    console.error('Get order error:', error);
    res.status(500).json({ error: 'Failed to get order' });
  }
});

// POST /api/orders - Create new order
router.post('/', requireRestaurantFeatures, [
  body('orderType').isIn(['dine-in', 'takeout', 'delivery', 'walk-in']).withMessage('Invalid order type'),
  body('tableId').optional().isString(),
  body('customerId').optional().isString(),
  body('notes').optional().isString(),
  body('priority').optional().isIn(['normal', 'rush', 'vip']).withMessage('Invalid priority'),
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { orderType, tableId, customerId, notes, items, priority } = req.body;

    // Verify table exists and check ownership if dine-in
    if (orderType === 'dine-in' && tableId) {
      const table = await prisma.restaurantTable.findFirst({
        where: { id: tableId, tenantId: req.tenantId, isActive: true }
      });

      if (!table) {
        return res.status(400).json({ error: 'Table not found' });
      }

      // Check table ownership - only allow if:
      // 1. Table has no assigned cashier (available)
      // 2. Table is assigned to this cashier
      // 3. User is owner/manager (can override)
      const isOwnerOrManager = req.user.role === 'OWNER' || req.user.role === 'MANAGER' || req.user.role === 'ADMIN';
      if (table.assignedCashierId && table.assignedCashierId !== req.user.id && !isOwnerOrManager) {
        return res.status(403).json({ error: 'This table is being served by another cashier' });
      }
    }

    // Verify products and get prices
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: req.tenantId,
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'Some products not found' });
    }

    const productMap = new Map(products.map(p => [p.id, p]));

    // Generate order number
    const orderNumber = await generateOrderNumber(req.tenantId, req.branchId);

    // Create order with items
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.restaurantOrder.create({
        data: {
          orderNumber,
          orderType,
          status: 'pending',
          priority: priority || 'normal',
          tableId: orderType === 'dine-in' ? tableId : null,
          customerId: customerId || null,
          notes: notes || null,
          isTabOpen: true,
          tenantId: req.tenantId,
          branchId: req.branchId,
          createdById: req.user.id
        }
      });

      // Create order items
      await Promise.all(items.map(item => {
        const product = productMap.get(item.productId);
        return tx.restaurantOrderItem.create({
          data: {
            orderId: newOrder.id,
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: product.sellingPrice,
            modifiers: item.modifiers ? JSON.stringify(item.modifiers) : null,
            specialRequest: item.specialRequest || null,
            status: 'pending'
          }
        });
      }));

      // Update table status and assign cashier if dine-in
      if (orderType === 'dine-in' && tableId) {
        await tx.restaurantTable.update({
          where: { id: tableId },
          data: {
            status: 'occupied',
            assignedCashierId: req.user.id  // Assign this cashier to the table
          }
        });
      }

      return newOrder;
    });

    // Fetch complete order with items
    const completeOrder = await prisma.restaurantOrder.findUnique({
      where: { id: order.id },
      include: {
        table: {
          select: { id: true, tableNumber: true }
        },
        customer: {
          select: { id: true, name: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, image: true }
            }
          }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'order_created',
      `Created order ${orderNumber} (${orderType})`,
      { orderId: order.id, tableId, itemCount: items.length },
      req.branchId
    );

    // Emit WebSocket event for real-time kitchen updates
    const io = req.app.get('io');
    if (io) {
      emitOrderCreated(io, req.tenantId, req.branchId, {
        ...completeOrder,
        total: calculateOrderTotal(completeOrder.items)
      });
    }

    res.status(201).json({
      order: {
        ...completeOrder,
        total: calculateOrderTotal(completeOrder.items)
      }
    });
  } catch (error) {
    console.error('Create order error:', error);
    res.status(500).json({ error: 'Failed to create order' });
  }
});

// POST /api/orders/:id/items - Add items to existing order (running tab)
router.post('/:id/items', requireRestaurantFeatures, [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { items } = req.body;

    // Find order with table info
    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({
      where,
      include: {
        table: { select: { id: true, assignedCashierId: true } }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check ownership - only creator, assigned cashier, or owner/manager can add items
    const isOwnerOrManager = req.user.role === 'OWNER' || req.user.role === 'MANAGER' || req.user.role === 'ADMIN';
    const isAssignedCashier = order.table?.assignedCashierId === req.user.id;
    const isCreator = order.createdById === req.user.id;

    if (!isOwnerOrManager && !isAssignedCashier && !isCreator) {
      return res.status(403).json({ error: 'You do not have permission to modify this order' });
    }

    if (!order.isTabOpen) {
      return res.status(400).json({ error: 'Cannot add items to a closed tab' });
    }

    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot add items to a completed or cancelled order' });
    }

    // Verify products and get prices
    const productIds = items.map(i => i.productId);
    const products = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        tenantId: req.tenantId,
        isActive: true
      }
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({ error: 'Some products not found' });
    }

    const productMap = new Map(products.map(p => [p.id, p]));

    // Add items
    await Promise.all(items.map(item => {
      const product = productMap.get(item.productId);
      return prisma.restaurantOrderItem.create({
        data: {
          orderId: id,
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: product.sellingPrice,
          modifiers: item.modifiers ? JSON.stringify(item.modifiers) : null,
          specialRequest: item.specialRequest || null,
          status: 'pending'
        }
      });
    }));

    // Update order status if needed
    if (order.status === 'served') {
      await prisma.restaurantOrder.update({
        where: { id },
        data: { status: 'confirmed' }
      });
    }

    // Fetch updated order
    const updatedOrder = await prisma.restaurantOrder.findUnique({
      where: { id },
      include: {
        table: {
          select: { id: true, tableNumber: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, image: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'order_items_added',
      `Added ${items.length} items to order ${order.orderNumber}`,
      { orderId: id, newItems: items },
      req.branchId
    );

    // Emit WebSocket event for real-time kitchen updates
    const io = req.app.get('io');
    if (io) {
      emitOrderUpdated(io, req.tenantId, req.branchId, {
        ...updatedOrder,
        total: calculateOrderTotal(updatedOrder.items)
      });
    }

    res.json({
      order: {
        ...updatedOrder,
        total: calculateOrderTotal(updatedOrder.items)
      }
    });
  } catch (error) {
    console.error('Add items error:', error);
    res.status(500).json({ error: 'Failed to add items' });
  }
});

// PUT /api/orders/:id/priority - Update order priority (rush/VIP)
router.put('/:id/priority', requireRestaurantFeatures, [
  body('priority').isIn(['normal', 'rush', 'vip']).withMessage('Invalid priority'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { priority } = req.body;

    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({ where });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const updatedOrder = await prisma.restaurantOrder.update({
      where: { id },
      data: { priority },
      include: {
        table: { select: { id: true, tableNumber: true } },
        items: {
          include: { product: { select: { id: true, name: true } } }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'order_priority_updated',
      `Order ${order.orderNumber} priority changed to ${priority.toUpperCase()}`,
      { orderId: id, oldPriority: order.priority, newPriority: priority },
      req.branchId
    );

    res.json({
      order: updatedOrder,
      message: `Order marked as ${priority.toUpperCase()}`
    });
  } catch (error) {
    console.error('Update order priority error:', error);
    res.status(500).json({ error: 'Failed to update order priority' });
  }
});

// PUT /api/orders/:id/status - Update order status
router.put('/:id/status', requireRestaurantFeatures, [
  body('status').isIn(['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed', 'cancelled']).withMessage('Invalid status'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({ where });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Build update data with timestamps
    const updateData = { status };
    const now = new Date();

    switch (status) {
      case 'confirmed':
        updateData.confirmedAt = now;
        break;
      case 'preparing':
        updateData.preparingAt = now;
        break;
      case 'ready':
        updateData.readyAt = now;
        break;
      case 'served':
        updateData.servedAt = now;
        break;
      case 'completed':
        updateData.completedAt = now;
        updateData.isTabOpen = false;
        break;
      case 'cancelled':
        updateData.isTabOpen = false;
        break;
    }

    const updatedOrder = await prisma.restaurantOrder.update({
      where: { id },
      data: updateData,
      include: {
        table: {
          select: { id: true, tableNumber: true }
        }
      }
    });

    // Free up table and clear cashier if order completed/cancelled
    if ((status === 'completed' || status === 'cancelled') && order.tableId) {
      // Check if there are other open orders for this table
      const otherOpenOrders = await prisma.restaurantOrder.count({
        where: {
          tableId: order.tableId,
          id: { not: id },
          isTabOpen: true,
          status: { notIn: ['completed', 'cancelled'] }
        }
      });

      if (otherOpenOrders === 0) {
        await prisma.restaurantTable.update({
          where: { id: order.tableId },
          data: {
            status: 'available',
            assignedCashierId: null  // Clear cashier assignment
          }
        });
      }
    }

    await logAudit(
      req.tenantId,
      req.user.id,
      'order_status_updated',
      `Order ${order.orderNumber} status changed to ${status}`,
      { orderId: id, previousStatus: order.status, newStatus: status },
      req.branchId
    );

    // Emit WebSocket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      if (status === 'completed') {
        emitOrderCompleted(io, req.tenantId, order.branchId, id);
      } else if (status === 'cancelled') {
        emitOrderCancelled(io, req.tenantId, order.branchId, id);
      } else {
        emitOrderUpdated(io, req.tenantId, order.branchId, updatedOrder);
      }
    }

    res.json({ order: updatedOrder });
  } catch (error) {
    console.error('Update order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// PUT /api/orders/:id/close - Close tab and create sale
router.put('/:id/close', requireRestaurantFeatures, [
  body('paymentMethod').isIn(['cash', 'card', 'mobile_money', 'bank_transfer']).withMessage('Invalid payment method'),
  body('discount').optional().isFloat({ min: 0 }),
  body('discountType').optional().isIn(['percentage', 'fixed']),
  body('tax').optional().isFloat({ min: 0 }),
  body('amountPaid').optional().isFloat({ min: 0 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, discount = 0, discountType = 'fixed', tax = 0, amountPaid, notes } = req.body;

    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({
      where,
      include: {
        items: {
          include: {
            product: true
          }
        },
        table: true,
        customer: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.isTabOpen) {
      return res.status(400).json({ error: 'Tab is already closed' });
    }

    if (order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot close a cancelled order' });
    }

    // Calculate totals
    const subtotal = calculateOrderTotal(order.items);
    let discountAmount = 0;
    if (discount > 0) {
      discountAmount = discountType === 'percentage'
        ? subtotal * (discount / 100)
        : discount;
    }
    const taxAmount = (subtotal - discountAmount) * (tax / 100);
    const finalAmount = subtotal - discountAmount + taxAmount;
    const change = (amountPaid || finalAmount) - finalAmount;

    // Map payment method to enum value
    const paymentMethodMap = {
      'cash': 'CASH',
      'card': 'CARD',
      'momo': 'MOMO',
      'mobile_money': 'MOMO',
      'bank_transfer': 'BANK_TRANSFER',
      'transfer': 'BANK_TRANSFER',
      'split': 'SPLIT'
    };
    const dbPaymentMethod = paymentMethodMap[paymentMethod.toLowerCase()] || 'CASH';

    // Generate transaction number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const saleCount = await prisma.sale.count({
      where: {
        tenantId: req.tenantId,
        branchId: req.branchId,
        createdAt: { gte: today }
      }
    });
    const transactionNumber = `RCP-${Date.now()}-${(saleCount + 1).toString().padStart(4, '0')}`;

    // Create sale and update order in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create sale with SaleItem records
      const sale = await tx.sale.create({
        data: {
          transactionNumber,
          totalAmount: subtotal,
          discountAmount,
          finalAmount,
          paymentMethod: dbPaymentMethod,
          paymentStatus: 'completed',
          tenantId: req.tenantId,
          branchId: req.branchId,
          cashierId: req.user.id,
          customerId: order.customerId,
          items: {
            create: order.items.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: 0,
              subtotal: item.unitPrice * item.quantity + (item.modifiers ? JSON.parse(item.modifiers).reduce((s, m) => s + (m.price || 0), 0) * item.quantity : 0)
            }))
          }
        },
        include: {
          items: true
        }
      });

      // Update stock for products
      for (const item of order.items) {
        if (item.product.type === 'PRODUCT') {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { decrement: item.quantity }
            }
          });
        }
      }

      // Check if all items are served before marking order as completed
      const allItemsServed = order.items.every(item => item.status === 'served');

      // Update order - only set to 'completed' if all items are served
      // Otherwise, keep current status so kitchen can continue working
      const updatedOrder = await tx.restaurantOrder.update({
        where: { id },
        data: {
          status: allItemsServed ? 'completed' : order.status,
          completedAt: allItemsServed ? new Date() : null,
          isTabOpen: false,
          saleId: sale.id
        }
      });

      // Free table and clear assigned cashier if no other open orders
      if (order.tableId) {
        const otherOpenOrders = await tx.restaurantOrder.count({
          where: {
            tableId: order.tableId,
            id: { not: id },
            isTabOpen: true,
            status: { notIn: ['completed', 'cancelled'] }
          }
        });

        if (otherOpenOrders === 0) {
          await tx.restaurantTable.update({
            where: { id: order.tableId },
            data: {
              status: 'available',
              assignedCashierId: null  // Clear cashier assignment
            }
          });
        }
      }

      // Update customer stats if customer was specified
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            totalSpent: { increment: finalAmount },
            visitCount: { increment: 1 },
            lastVisit: new Date()
          }
        });
      }

      return { sale, order: updatedOrder };
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'order_closed',
      `Closed order ${order.orderNumber} - Sale ${transactionNumber} created`,
      { orderId: id, saleId: result.sale.id, total: finalAmount },
      req.branchId
    );

    res.json({
      order: result.order,
      sale: {
        id: result.sale.id,
        transactionNumber: result.sale.transactionNumber,
        finalAmount: result.sale.finalAmount,
        change: change
      }
    });
  } catch (error) {
    console.error('Close order error:', error);
    res.status(500).json({ error: 'Failed to close order' });
  }
});

// DELETE /api/orders/:id - Cancel order
router.delete('/:id', requireRestaurantFeatures, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({ where });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (order.status === 'completed') {
      return res.status(400).json({ error: 'Cannot cancel a completed order' });
    }

    if (order.saleId) {
      return res.status(400).json({ error: 'Cannot cancel order with associated sale' });
    }

    // Update order to cancelled
    await prisma.restaurantOrder.update({
      where: { id },
      data: {
        status: 'cancelled',
        isTabOpen: false
      }
    });

    // Free table and clear cashier if needed
    if (order.tableId) {
      const otherOpenOrders = await prisma.restaurantOrder.count({
        where: {
          tableId: order.tableId,
          id: { not: id },
          isTabOpen: true,
          status: { notIn: ['completed', 'cancelled'] }
        }
      });

      if (otherOpenOrders === 0) {
        await prisma.restaurantTable.update({
          where: { id: order.tableId },
          data: {
            status: 'available',
            assignedCashierId: null  // Clear cashier assignment
          }
        });
      }
    }

    await logAudit(
      req.tenantId,
      req.user.id,
      'order_cancelled',
      `Cancelled order ${order.orderNumber}${reason ? `: ${reason}` : ''}`,
      { orderId: id, reason },
      req.branchId
    );

    res.json({ message: 'Order cancelled successfully' });
  } catch (error) {
    console.error('Cancel order error:', error);
    res.status(500).json({ error: 'Failed to cancel order' });
  }
});

// PUT /api/orders/:id/items/:itemId - Update single item
router.put('/:id/items/:itemId', requireRestaurantFeatures, [
  body('quantity').optional().isInt({ min: 1 }),
  body('modifiers').optional().isArray(),
  body('specialRequest').optional().isString(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const { quantity, modifiers, specialRequest } = req.body;

    // Verify order
    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({ where });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.isTabOpen) {
      return res.status(400).json({ error: 'Cannot modify items in a closed tab' });
    }

    const item = await prisma.restaurantOrderItem.findFirst({
      where: { id: itemId, orderId: id }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Only allow modifications if item is pending
    if (item.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot modify items that are already being prepared' });
    }

    const updateData = {};
    if (quantity !== undefined) updateData.quantity = quantity;
    if (modifiers !== undefined) updateData.modifiers = JSON.stringify(modifiers);
    if (specialRequest !== undefined) updateData.specialRequest = specialRequest;

    const updatedItem = await prisma.restaurantOrderItem.update({
      where: { id: itemId },
      data: updateData,
      include: {
        product: {
          select: { id: true, name: true }
        }
      }
    });

    res.json({ item: updatedItem });
  } catch (error) {
    console.error('Update item error:', error);
    res.status(500).json({ error: 'Failed to update item' });
  }
});

// DELETE /api/orders/:id/items/:itemId - Remove item from order
router.delete('/:id/items/:itemId', requireRestaurantFeatures, async (req, res) => {
  try {
    const { id, itemId } = req.params;

    // Verify order
    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({
      where,
      include: { items: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    if (!order.isTabOpen) {
      return res.status(400).json({ error: 'Cannot remove items from a closed tab' });
    }

    const item = order.items.find(i => i.id === itemId);

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.status !== 'pending') {
      return res.status(400).json({ error: 'Cannot remove items that are already being prepared' });
    }

    // Delete item
    await prisma.restaurantOrderItem.delete({
      where: { id: itemId }
    });

    // If no items left, cancel the order
    if (order.items.length === 1) {
      await prisma.restaurantOrder.update({
        where: { id },
        data: { status: 'cancelled', isTabOpen: false }
      });

      // Free table and clear cashier
      if (order.tableId) {
        const otherOpenOrders = await prisma.restaurantOrder.count({
          where: {
            tableId: order.tableId,
            id: { not: id },
            isTabOpen: true,
            status: { notIn: ['completed', 'cancelled'] }
          }
        });

        if (otherOpenOrders === 0) {
          await prisma.restaurantTable.update({
            where: { id: order.tableId },
            data: {
              status: 'available',
              assignedCashierId: null  // Clear cashier assignment
            }
          });
        }
      }

      return res.json({ message: 'Item removed, order cancelled (no items left)' });
    }

    res.json({ message: 'Item removed successfully' });
  } catch (error) {
    console.error('Remove item error:', error);
    res.status(500).json({ error: 'Failed to remove item' });
  }
});

// GET /api/orders/table/:tableId/summary - Get all orders for a table (for close tab summary)
router.get('/table/:tableId/summary', requireRestaurantFeatures, async (req, res) => {
  try {
    const { tableId } = req.params;

    // Verify table exists and belongs to tenant
    const table = await prisma.restaurantTable.findFirst({
      where: {
        id: tableId,
        tenantId: req.tenantId
      }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check ownership
    const isOwnerOrManager = req.user.role === 'OWNER' || req.user.role === 'MANAGER' || req.user.role === 'ADMIN';
    if (!isOwnerOrManager && table.assignedCashierId && table.assignedCashierId !== req.user.id) {
      return res.status(403).json({ error: 'This table is being served by another cashier' });
    }

    // Get all open orders for this table
    const orders = await prisma.restaurantOrder.findMany({
      where: {
        tableId,
        tenantId: req.tenantId,
        isTabOpen: true,
        status: { notIn: ['completed', 'cancelled'] }
      },
      include: {
        items: {
          include: {
            product: {
              select: { id: true, name: true, image: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        customer: {
          select: { id: true, name: true, phone: true }
        },
        createdBy: {
          select: { id: true, fullName: true }
        }
      },
      orderBy: { createdAt: 'asc' }
    });

    // Aggregate all items across orders with formatted data for the frontend
    const allItems = orders.flatMap(order =>
      order.items.map(item => {
        const modifiers = item.modifiers ? JSON.parse(item.modifiers) : [];
        const modifierTotal = modifiers.reduce((mSum, mod) => mSum + (mod.price || 0), 0);
        const itemTotal = (item.unitPrice + modifierTotal) * item.quantity;

        return {
          id: item.id,
          productId: item.productId,
          name: item.product?.name || 'Item',
          image: item.product?.image,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          modifiers,
          specialRequest: item.specialRequest,
          status: item.status,
          total: itemTotal,
          orderNumber: order.orderNumber,
          orderId: order.id,
          createdAt: item.createdAt
        };
      })
    );

    // Calculate totals
    const subtotal = allItems.reduce((sum, item) => sum + item.total, 0);

    // Get tenant tax rate
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { taxRate: true }
    });
    const taxRate = tenant?.taxRate || 0;
    const tax = subtotal * taxRate;
    const total = subtotal + tax;

    res.json({
      table: {
        id: table.id,
        tableNumber: table.tableNumber,
        section: table.section,
        capacity: table.capacity
      },
      orders,
      allItems,
      summary: {
        orderCount: orders.length,
        itemCount: allItems.reduce((sum, item) => sum + item.quantity, 0),
        subtotal,
        tax,
        taxRate,
        total,
        customer: orders[0]?.customer || null
      }
    });
  } catch (error) {
    console.error('Get table summary error:', error);
    res.status(500).json({ error: 'Failed to get table summary' });
  }
});

// PUT /api/orders/table/:tableId/close - Close all orders for a table
router.put('/table/:tableId/close', requireRestaurantFeatures, [
  body('paymentMethod').isIn(['cash', 'card', 'mobile_money', 'momo', 'bank_transfer', 'transfer', 'split']).withMessage('Invalid payment method'),
  body('discount').optional().isFloat({ min: 0 }),
  body('discountType').optional().isIn(['percentage', 'fixed']),
  body('tax').optional().isFloat({ min: 0 }),
  body('amountReceived').optional().isFloat({ min: 0 }),
  body('splitPayments').optional(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { tableId } = req.params;
    const { paymentMethod, discount = 0, discountType = 'fixed', tax = 0, amountReceived, splitPayments, notes } = req.body;

    // Verify table
    const table = await prisma.restaurantTable.findFirst({
      where: {
        id: tableId,
        tenantId: req.tenantId
      }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check ownership
    const isOwnerOrManager = req.user.role === 'OWNER' || req.user.role === 'MANAGER' || req.user.role === 'ADMIN';
    if (!isOwnerOrManager && table.assignedCashierId && table.assignedCashierId !== req.user.id) {
      return res.status(403).json({ error: 'This table is being served by another cashier' });
    }

    // Get all open orders for this table
    const orders = await prisma.restaurantOrder.findMany({
      where: {
        tableId,
        tenantId: req.tenantId,
        isTabOpen: true,
        status: { notIn: ['completed', 'cancelled'] }
      },
      include: {
        items: {
          include: {
            product: true
          }
        },
        customer: true
      }
    });

    if (orders.length === 0) {
      return res.status(400).json({ error: 'No open orders for this table' });
    }

    // Aggregate all items
    const allItems = orders.flatMap(order => order.items);

    // Calculate totals
    const subtotal = allItems.reduce((sum, item) => {
      const modifiers = item.modifiers ? JSON.parse(item.modifiers) : [];
      const modifierTotal = modifiers.reduce((mSum, mod) => mSum + (mod.price || 0), 0);
      return sum + (item.unitPrice + modifierTotal) * item.quantity;
    }, 0);

    let discountAmount = 0;
    if (discount > 0) {
      discountAmount = discountType === 'percentage'
        ? subtotal * (discount / 100)
        : discount;
    }
    const taxAmount = (subtotal - discountAmount) * (tax / 100);
    const finalAmount = subtotal - discountAmount + taxAmount;
    const change = (amountReceived || finalAmount) - finalAmount;

    // Generate receipt number
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const saleCount = await prisma.sale.count({
      where: {
        tenantId: req.tenantId,
        branchId: req.branchId,
        createdAt: { gte: today }
      }
    });
    const receiptNumber = `RCP-${Date.now()}-${(saleCount + 1).toString().padStart(4, '0')}`;

    // Map payment method to enum value
    const paymentMethodMap = {
      'cash': 'CASH',
      'card': 'CARD',
      'momo': 'MOMO',
      'mobile_money': 'MOMO',
      'bank_transfer': 'BANK_TRANSFER',
      'transfer': 'BANK_TRANSFER',
      'split': 'SPLIT'
    };
    const dbPaymentMethod = paymentMethodMap[paymentMethod.toLowerCase()] || 'CASH';

    // Create sale and close all orders in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create single sale for all orders with SaleItem records
      const sale = await tx.sale.create({
        data: {
          transactionNumber: receiptNumber,
          totalAmount: subtotal,
          discountAmount: discountAmount,
          finalAmount,
          paymentMethod: dbPaymentMethod,
          paymentStatus: 'completed',
          splitPayments: splitPayments ? JSON.stringify(splitPayments) : null,
          tenantId: req.tenantId,
          branchId: req.branchId,
          cashierId: req.user.id,
          customerId: orders[0].customerId,
          items: {
            create: allItems.map(item => ({
              productId: item.productId,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              discount: 0,
              subtotal: item.unitPrice * item.quantity + (item.modifiers ? JSON.parse(item.modifiers).reduce((s, m) => s + (m.price || 0), 0) * item.quantity : 0)
            }))
          }
        },
        include: {
          items: true
        }
      });

      // Update stock for products
      for (const item of allItems) {
        if (item.product.type === 'PRODUCT') {
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stockQuantity: { decrement: item.quantity }
            }
          });
        }
      }

      // Close all orders - only mark as 'completed' if all items are served
      for (const order of orders) {
        const allItemsServed = order.items.every(item => item.status === 'served');
        await tx.restaurantOrder.update({
          where: { id: order.id },
          data: {
            status: allItemsServed ? 'completed' : order.status,
            completedAt: allItemsServed ? new Date() : null,
            isTabOpen: false,
            saleId: sale.id
          }
        });
      }

      // Check if all items across all orders are served
      const allOrdersServed = orders.every(order =>
        order.items.every(item => item.status === 'served')
      );

      // Only free table if all items are served
      // If kitchen is still working, keep table occupied
      if (allOrdersServed) {
        await tx.restaurantTable.update({
          where: { id: tableId },
          data: {
            status: 'available',
            assignedCashierId: null
          }
        });
      }

      // Update customer stats if customer was specified
      if (orders[0].customerId) {
        await tx.customer.update({
          where: { id: orders[0].customerId },
          data: {
            totalSpent: { increment: finalAmount },
            visitCount: { increment: 1 },
            lastVisit: new Date()
          }
        });
      }

      return { sale, orderCount: orders.length };
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'table_closed',
      `Closed Table ${table.tableNumber} - ${result.orderCount} orders - Sale ${receiptNumber}`,
      { tableId, orderIds: orders.map(o => o.id), saleId: result.sale.id, total: finalAmount },
      req.branchId
    );

    res.json({
      sale: {
        id: result.sale.id,
        transactionNumber: result.sale.transactionNumber,
        finalAmount: result.sale.finalAmount,
        totalAmount: result.sale.totalAmount,
        discountAmount: result.sale.discountAmount,
        paymentMethod: result.sale.paymentMethod,
        items: result.sale.items
      },
      table: {
        id: table.id,
        tableNumber: table.tableNumber
      },
      ordersClosed: result.orderCount,
      change
    });
  } catch (error) {
    console.error('Close table error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to close table', details: error.message, stack: error.stack });
  }
});

// GET /api/orders/:id/refresh - Get updated order status (for polling)
router.get('/:id/refresh', requireRestaurantFeatures, async (req, res) => {
  try {
    const { id } = req.params;

    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({
      where,
      include: {
        table: {
          select: { id: true, tableNumber: true, section: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true, image: true }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        customer: {
          select: { id: true, name: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    res.json({
      order: {
        ...order,
        total: calculateOrderTotal(order.items)
      }
    });
  } catch (error) {
    console.error('Refresh order error:', error);
    res.status(500).json({ error: 'Failed to refresh order' });
  }
});

// PUT /api/orders/:id/switch-table - Switch order to a different table
router.put('/:id/switch-table', requireRestaurantFeatures, [
  body('newTableId').notEmpty().withMessage('New table ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { newTableId } = req.body;

    // Find the order
    const order = await prisma.restaurantOrder.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
        isTabOpen: true
      },
      include: { table: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found or already closed' });
    }

    // Check if new table exists and is available
    const newTable = await prisma.restaurantTable.findFirst({
      where: {
        id: newTableId,
        tenantId: req.tenantId,
        isActive: true
      }
    });

    if (!newTable) {
      return res.status(404).json({ error: 'New table not found' });
    }

    // Check if new table has existing open orders (different from current order)
    const existingOrder = await prisma.restaurantOrder.findFirst({
      where: {
        tableId: newTableId,
        tenantId: req.tenantId,
        isTabOpen: true,
        id: { not: id }
      }
    });

    if (existingOrder) {
      return res.status(400).json({ error: 'New table already has an active order' });
    }

    const oldTableId = order.tableId;
    const oldTableNumber = order.table?.tableNumber;

    // Update order with new table
    const updatedOrder = await prisma.$transaction(async (tx) => {
      // Update order's table
      const updated = await tx.restaurantOrder.update({
        where: { id },
        data: { tableId: newTableId },
        include: {
          table: true,
          items: {
            include: { product: { select: { id: true, name: true } } }
          }
        }
      });

      // Free the old table
      if (oldTableId) {
        await tx.restaurantTable.update({
          where: { id: oldTableId },
          data: {
            status: 'available',
            assignedCashierId: null
          }
        });
      }

      // Mark new table as occupied
      await tx.restaurantTable.update({
        where: { id: newTableId },
        data: {
          status: 'occupied',
          assignedCashierId: req.user.id
        }
      });

      // Log the action
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          tenantId: req.tenantId,
          branchId: req.branchId,
          action: 'ORDER_TABLE_SWITCH',
          description: `Order ${order.orderNumber} moved from Table ${oldTableNumber} to Table ${newTable.tableNumber}`,
          metadata: JSON.stringify({
            orderId: id,
            orderNumber: order.orderNumber,
            fromTable: oldTableNumber,
            fromTableId: oldTableId,
            toTable: newTable.tableNumber,
            toTableId: newTableId,
            switchedBy: req.user.fullName
          })
        }
      });

      return updated;
    });

    res.json({
      message: 'Order moved to new table',
      order: updatedOrder
    });
  } catch (error) {
    console.error('Switch table error:', error);
    res.status(500).json({ error: 'Failed to switch table' });
  }
});

// POST /api/orders/:id/request-cancel - Request order cancellation (for kitchen approval)
router.post('/:id/request-cancel', requireRestaurantFeatures, [
  body('reason').notEmpty().withMessage('Cancellation reason is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    // Find the order
    const order = await prisma.restaurantOrder.findFirst({
      where: {
        id,
        tenantId: req.tenantId,
        isTabOpen: true
      },
      include: {
        table: true,
        items: {
          include: { product: { select: { name: true, sellingPrice: true } } }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found or already closed' });
    }

    // Check if order has items in preparation
    const hasPreparingItems = order.items.some(item =>
      item.status === 'preparing' || item.status === 'ready'
    );

    // Calculate order total
    const total = order.items.reduce((sum, item) => sum + (item.unitPrice * item.quantity), 0);

    // Create a security request for cancellation
    const cancelRequest = await prisma.$transaction(async (tx) => {
      const request = await tx.securityRequest.create({
        data: {
          type: 'ORDER_CANCEL',
          reason,
          status: 'PENDING',
          requesterId: req.user.id,
          tenantId: req.tenantId,
          branchId: req.branchId,
          itemName: `Order ${order.orderNumber} (Table ${order.table?.tableNumber || 'N/A'})`,
          amount: total,
          metadata: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            tableId: order.tableId,
            tableNumber: order.table?.tableNumber,
            itemCount: order.items.length,
            hasPreparingItems,
            items: order.items.map(i => ({
              name: i.product?.name,
              quantity: i.quantity,
              status: i.status
            }))
          })
        }
      });

      // Log the request
      await tx.auditLog.create({
        data: {
          userId: req.user.id,
          tenantId: req.tenantId,
          branchId: req.branchId,
          action: 'ORDER_CANCEL_REQUESTED',
          description: `Cancellation requested for Order ${order.orderNumber} (Table ${order.table?.tableNumber || 'N/A'}) - Reason: ${reason}`,
          metadata: JSON.stringify({
            orderId: order.id,
            orderNumber: order.orderNumber,
            tableNumber: order.table?.tableNumber,
            reason,
            requestedBy: req.user.fullName,
            hasPreparingItems,
            total,
            requestId: request.id
          })
        }
      });

      return request;
    });

    res.json({
      message: 'Cancellation request submitted',
      request: cancelRequest,
      requiresKitchenApproval: hasPreparingItems
    });
  } catch (error) {
    console.error('Request cancel error:', error);
    res.status(500).json({ error: 'Failed to submit cancellation request' });
  }
});

module.exports = router;
