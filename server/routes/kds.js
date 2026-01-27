const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, logAudit } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');
const { emitOrderUpdated, emitOrderItemUpdated } = require('../utils/socketEvents');

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

// Middleware to check if KDS features are enabled
const requireKDSFeatures = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { enableKDS: true, businessType: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!tenant.enableKDS && tenant.businessType !== 'FOOD_AND_BEVERAGE') {
      return res.status(403).json({ error: 'Kitchen Display System is not enabled for this business' });
    }

    next();
  } catch (error) {
    console.error('KDS features check error:', error);
    res.status(500).json({ error: 'Failed to check KDS features' });
  }
};

// GET /api/kds/orders - Get pending orders for kitchen
router.get('/orders', requireKDSFeatures, async (req, res) => {
  try {
    const { branchId, status } = req.query;

    const where = {
      tenantId: req.tenantId,
      status: { in: ['pending', 'confirmed', 'preparing'] }
    };

    // Filter by specific status if provided
    if (status) {
      where.status = status;
    }

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
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                kitchenCategory: true,
                prepTime: true,
                recipe: true,
                description: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        createdBy: {
          select: { id: true, fullName: true }
        },
        customer: {
          select: { id: true, name: true, phone: true }
        }
      },
      orderBy: [
        { priority: 'desc' }, // VIP/Rush first (vip > rush > normal alphabetically but we handle in frontend)
        { createdAt: 'asc' } // Then oldest first (FIFO)
      ]
    });

    // Calculate wait time and group by status
    const now = new Date();
    const ordersWithMeta = orders.map(order => {
      const waitTimeMs = now - new Date(order.createdAt);
      const waitMinutes = Math.floor(waitTimeMs / 60000);

      // Calculate estimated completion based on prep times
      const maxPrepTime = order.items.reduce((max, item) =>
        Math.max(max, item.product.prepTime || 15), 0
      );

      // Group items by kitchen category
      const itemsByCategory = order.items.reduce((acc, item) => {
        const category = item.product.kitchenCategory || 'General';
        if (!acc[category]) acc[category] = [];
        acc[category].push(item);
        return acc;
      }, {});

      // Check if order is running late (wait time > max prep time)
      const isLate = waitMinutes > maxPrepTime;

      return {
        ...order,
        waitMinutes,
        maxPrepTime,
        isLate,
        itemsByCategory,
        itemCount: order.items.length,
        pendingItemCount: order.items.filter(i => i.status === 'pending').length,
        preparingItemCount: order.items.filter(i => i.status === 'preparing').length,
        readyItemCount: order.items.filter(i => i.status === 'ready').length
      };
    });

    // Group orders by status
    const groupedOrders = {
      pending: ordersWithMeta.filter(o => o.status === 'pending'),
      confirmed: ordersWithMeta.filter(o => o.status === 'confirmed'),
      preparing: ordersWithMeta.filter(o => o.status === 'preparing')
    };

    res.json({
      orders: ordersWithMeta,
      groupedOrders,
      summary: {
        total: orders.length,
        pending: groupedOrders.pending.length,
        confirmed: groupedOrders.confirmed.length,
        preparing: groupedOrders.preparing.length,
        lateOrders: ordersWithMeta.filter(o => o.isLate).length
      }
    });
  } catch (error) {
    console.error('Get KDS orders error:', error);
    res.status(500).json({ error: 'Failed to get kitchen orders' });
  }
});

// GET /api/kds/orders/ready - Get ready orders waiting to be served
router.get('/orders/ready', requireKDSFeatures, async (req, res) => {
  try {
    const { branchId } = req.query;

    const where = {
      tenantId: req.tenantId,
      status: 'ready'
    };

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
        items: {
          include: {
            product: {
              select: { id: true, name: true }
            }
          }
        }
      },
      orderBy: { readyAt: 'asc' }
    });

    // Calculate time since ready
    const now = new Date();
    const ordersWithMeta = orders.map(order => ({
      ...order,
      readySinceMinutes: order.readyAt ? Math.floor((now - new Date(order.readyAt)) / 60000) : 0
    }));

    res.json({ orders: ordersWithMeta });
  } catch (error) {
    console.error('Get ready orders error:', error);
    res.status(500).json({ error: 'Failed to get ready orders' });
  }
});

// PUT /api/kds/orders/:id/status - Update order status from KDS
router.put('/orders/:id/status', requireKDSFeatures, [
  body('status').isIn(['confirmed', 'preparing', 'ready', 'served']).withMessage('Invalid status'),
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
        // Update all pending items to preparing
        await prisma.restaurantOrderItem.updateMany({
          where: { orderId: id, status: 'pending' },
          data: { status: 'preparing' }
        });
        break;
      case 'ready':
        updateData.readyAt = now;
        // Update all items to ready
        await prisma.restaurantOrderItem.updateMany({
          where: { orderId: id, status: { not: 'ready' } },
          data: { status: 'ready' }
        });
        break;
      case 'served':
        updateData.servedAt = now;
        // Update all items to served
        await prisma.restaurantOrderItem.updateMany({
          where: { orderId: id },
          data: { status: 'served' }
        });
        break;
    }

    const updatedOrder = await prisma.restaurantOrder.update({
      where: { id },
      data: updateData,
      include: {
        table: {
          select: { id: true, tableNumber: true }
        },
        items: {
          include: {
            product: {
              select: { id: true, name: true }
            }
          }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'kds_order_status_updated',
      `Order ${order.orderNumber} marked as ${status}`,
      { orderId: id, previousStatus: order.status, newStatus: status },
      order.branchId
    );

    // Emit WebSocket event for real-time POS updates
    const io = req.app.get('io');
    if (io) {
      emitOrderUpdated(io, req.tenantId, order.branchId, updatedOrder);
    }

    res.json({ order: updatedOrder });
  } catch (error) {
    console.error('Update KDS order status error:', error);
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

// PUT /api/kds/items/:id - Update single item status
router.put('/items/:id', requireKDSFeatures, [
  body('status').isIn(['pending', 'preparing', 'ready', 'served']).withMessage('Invalid status'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    // Find the item and verify access
    const item = await prisma.restaurantOrderItem.findFirst({
      where: { id },
      include: {
        order: {
          select: { id: true, orderNumber: true, tenantId: true, branchId: true }
        },
        product: {
          select: { id: true, name: true }
        }
      }
    });

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    if (item.order.tenantId !== req.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Update item status
    const updatedItem = await prisma.restaurantOrderItem.update({
      where: { id },
      data: { status },
      include: {
        product: {
          select: { id: true, name: true }
        }
      }
    });

    // Check if all items in the order have the same status and update order accordingly
    const orderItems = await prisma.restaurantOrderItem.findMany({
      where: { orderId: item.order.id }
    });

    const allReady = orderItems.every(i => i.status === 'ready' || i.status === 'served');
    const allServed = orderItems.every(i => i.status === 'served');
    const anyPreparing = orderItems.some(i => i.status === 'preparing');

    // Auto-update order status based on item statuses
    if (allServed) {
      // Check if order was already paid (has saleId)
      const order = await prisma.restaurantOrder.findUnique({
        where: { id: item.order.id },
        select: { saleId: true, tableId: true, isTabOpen: true }
      });

      if (order.saleId && !order.isTabOpen) {
        // Order was pre-paid, now complete it
        await prisma.restaurantOrder.update({
          where: { id: item.order.id },
          data: { status: 'completed', servedAt: new Date(), completedAt: new Date() }
        });

        // Free the table if this was the last open order
        if (order.tableId) {
          const otherOpenOrders = await prisma.restaurantOrder.count({
            where: {
              tableId: order.tableId,
              id: { not: item.order.id },
              status: { notIn: ['completed', 'cancelled'] }
            }
          });

          if (otherOpenOrders === 0) {
            await prisma.restaurantTable.update({
              where: { id: order.tableId },
              data: { status: 'available', assignedCashierId: null }
            });
          }
        }
      } else {
        // Not paid yet, just mark as served
        await prisma.restaurantOrder.update({
          where: { id: item.order.id },
          data: { status: 'served', servedAt: new Date() }
        });
      }
    } else if (allReady) {
      await prisma.restaurantOrder.update({
        where: { id: item.order.id },
        data: { status: 'ready', readyAt: new Date() }
      });
    } else if (anyPreparing) {
      const order = await prisma.restaurantOrder.findUnique({
        where: { id: item.order.id }
      });
      if (order.status === 'pending' || order.status === 'confirmed') {
        await prisma.restaurantOrder.update({
          where: { id: item.order.id },
          data: { status: 'preparing', preparingAt: new Date() }
        });
      }
    }

    await logAudit(
      req.tenantId,
      req.user.id,
      'kds_item_status_updated',
      `Item ${item.product.name} in order ${item.order.orderNumber} marked as ${status}`,
      { itemId: id, orderId: item.order.id, status },
      item.order.branchId
    );

    // Emit WebSocket event for real-time updates
    const io = req.app.get('io');
    if (io) {
      emitOrderItemUpdated(io, req.tenantId, item.order.branchId, item.order.id, updatedItem);
    }

    res.json({ item: updatedItem });
  } catch (error) {
    console.error('Update KDS item status error:', error);
    res.status(500).json({ error: 'Failed to update item status' });
  }
});

// POST /api/kds/orders/:id/bump - Bump order (mark as ready and alert servers)
router.post('/orders/:id/bump', requireKDSFeatures, async (req, res) => {
  try {
    const { id } = req.params;

    const where = { id, tenantId: req.tenantId };
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const order = await prisma.restaurantOrder.findFirst({ where });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    const now = new Date();

    // Update order and all items to ready
    await prisma.$transaction([
      prisma.restaurantOrder.update({
        where: { id },
        data: { status: 'ready', readyAt: now }
      }),
      prisma.restaurantOrderItem.updateMany({
        where: { orderId: id },
        data: { status: 'ready' }
      })
    ]);

    await logAudit(
      req.tenantId,
      req.user.id,
      'kds_order_bumped',
      `Order ${order.orderNumber} bumped (ready for service)`,
      { orderId: id },
      order.branchId
    );

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      emitOrderUpdated(io, req.tenantId, order.branchId, { ...order, status: 'ready' });
    }

    res.json({ message: 'Order bumped successfully', orderId: id });
  } catch (error) {
    console.error('Bump order error:', error);
    res.status(500).json({ error: 'Failed to bump order' });
  }
});

// POST /api/kds/orders/:id/recall - Recall order back to kitchen
router.post('/orders/:id/recall', requireKDSFeatures, async (req, res) => {
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

    if (order.status === 'completed' || order.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot recall completed or cancelled orders' });
    }

    // Reset order back to preparing
    await prisma.$transaction([
      prisma.restaurantOrder.update({
        where: { id },
        data: { status: 'preparing', readyAt: null }
      }),
      prisma.restaurantOrderItem.updateMany({
        where: { orderId: id },
        data: { status: 'preparing' }
      })
    ]);

    await logAudit(
      req.tenantId,
      req.user.id,
      'kds_order_recalled',
      `Order ${order.orderNumber} recalled to kitchen${reason ? `: ${reason}` : ''}`,
      { orderId: id, reason },
      order.branchId
    );

    // Emit WebSocket event
    const io = req.app.get('io');
    if (io) {
      emitOrderUpdated(io, req.tenantId, order.branchId, { ...order, status: 'preparing' });
    }

    res.json({ message: 'Order recalled to kitchen', orderId: id });
  } catch (error) {
    console.error('Recall order error:', error);
    res.status(500).json({ error: 'Failed to recall order' });
  }
});

// GET /api/kds/orders/:id - Get single order details with recipes
router.get('/orders/:id', requireKDSFeatures, async (req, res) => {
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
          select: { id: true, tableNumber: true, section: true, capacity: true }
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                image: true,
                description: true,
                kitchenCategory: true,
                prepTime: true,
                recipe: true
              }
            }
          },
          orderBy: { createdAt: 'asc' }
        },
        createdBy: {
          select: { id: true, fullName: true }
        },
        customer: {
          select: { id: true, name: true, phone: true }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Calculate wait time
    const now = new Date();
    const waitTimeMs = now - new Date(order.createdAt);
    const waitMinutes = Math.floor(waitTimeMs / 60000);

    // Group items by kitchen category
    const itemsByCategory = order.items.reduce((acc, item) => {
      const category = item.product.kitchenCategory || 'General';
      if (!acc[category]) acc[category] = [];
      acc[category].push(item);
      return acc;
    }, {});

    res.json({
      order: {
        ...order,
        waitMinutes,
        itemsByCategory,
        itemCount: order.items.length,
        pendingItemCount: order.items.filter(i => i.status === 'pending').length,
        preparingItemCount: order.items.filter(i => i.status === 'preparing').length,
        readyItemCount: order.items.filter(i => i.status === 'ready').length
      }
    });
  } catch (error) {
    console.error('Get order details error:', error);
    res.status(500).json({ error: 'Failed to get order details' });
  }
});

// GET /api/kds/stats - Kitchen performance stats
router.get('/stats', requireKDSFeatures, async (req, res) => {
  try {
    const { branchId, period = 'today' } = req.query;

    // Calculate date range
    let startDate = new Date();
    startDate.setHours(0, 0, 0, 0);

    if (period === 'week') {
      startDate.setDate(startDate.getDate() - 7);
    } else if (period === 'month') {
      startDate.setMonth(startDate.getMonth() - 1);
    }

    const where = {
      tenantId: req.tenantId,
      createdAt: { gte: startDate }
    };

    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    // Get all completed orders in period
    const completedOrders = await prisma.restaurantOrder.findMany({
      where: {
        ...where,
        status: { in: ['completed', 'served'] },
        readyAt: { not: null }
      },
      select: {
        id: true,
        createdAt: true,
        confirmedAt: true,
        preparingAt: true,
        readyAt: true,
        servedAt: true,
        items: {
          select: {
            product: {
              select: { kitchenCategory: true }
            }
          }
        }
      }
    });

    // Calculate average prep time (from created to ready)
    const prepTimes = completedOrders
      .filter(o => o.readyAt && o.createdAt)
      .map(o => (new Date(o.readyAt) - new Date(o.createdAt)) / 60000);

    const avgPrepTime = prepTimes.length > 0
      ? Math.round(prepTimes.reduce((a, b) => a + b, 0) / prepTimes.length)
      : 0;

    // Get current queue
    const queueCount = await prisma.restaurantOrder.count({
      where: {
        ...where,
        status: { in: ['pending', 'confirmed', 'preparing'] }
      }
    });

    // Count by category
    const categoryStats = {};
    completedOrders.forEach(order => {
      order.items.forEach(item => {
        const cat = item.product.kitchenCategory || 'General';
        if (!categoryStats[cat]) categoryStats[cat] = 0;
        categoryStats[cat]++;
      });
    });

    // Orders per hour (for today)
    const hourlyStats = Array(24).fill(0);
    if (period === 'today') {
      completedOrders.forEach(order => {
        const hour = new Date(order.createdAt).getHours();
        hourlyStats[hour]++;
      });
    }

    res.json({
      stats: {
        totalCompleted: completedOrders.length,
        avgPrepTimeMinutes: avgPrepTime,
        currentQueueSize: queueCount,
        categoryStats,
        hourlyStats: period === 'today' ? hourlyStats : null
      },
      period
    });
  } catch (error) {
    console.error('Get KDS stats error:', error);
    res.status(500).json({ error: 'Failed to get kitchen stats' });
  }
});

module.exports = router;
