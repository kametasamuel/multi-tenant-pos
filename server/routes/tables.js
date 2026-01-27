const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
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

// Middleware to check if restaurant features are enabled
const requireRestaurantFeatures = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { enableTables: true, businessType: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    // Allow if tables are enabled OR if business type is FOOD_AND_BEVERAGE
    if (!tenant.enableTables && tenant.businessType !== 'FOOD_AND_BEVERAGE') {
      return res.status(403).json({ error: 'Table management is not enabled for this business' });
    }

    next();
  } catch (error) {
    console.error('Restaurant features check error:', error);
    res.status(500).json({ error: 'Failed to check restaurant features' });
  }
};

// GET /api/tables - Get all tables with status and open orders
router.get('/', requireRestaurantFeatures, async (req, res) => {
  try {
    const { status, section, branchId, forCashier } = req.query;

    const where = {
      tenantId: req.tenantId,
      isActive: true
    };

    // Branch filtering
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    } else if (branchId) {
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    if (section) {
      where.section = section;
    }

    // For cashier view: only show available tables or tables assigned to this cashier
    if (forCashier === 'true' && req.user.role === 'CASHIER') {
      where.OR = [
        { assignedCashierId: null },  // Available tables
        { assignedCashierId: req.user.id }  // Tables assigned to this cashier
      ];
    }

    const tables = await prisma.restaurantTable.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true }
        },
        assignedCashier: {
          select: { id: true, fullName: true }
        },
        orders: {
          where: {
            isTabOpen: true,
            status: { notIn: ['completed', 'cancelled'] }
          },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, image: true }
                }
              }
            },
            createdBy: {
              select: { id: true, fullName: true }
            }
          },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: [
        { section: 'asc' },
        { tableNumber: 'asc' }
      ]
    });

    // Get unique sections for filtering
    const sections = await prisma.restaurantTable.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true,
        section: { not: null }
      },
      select: { section: true },
      distinct: ['section']
    });

    res.json({
      tables,
      sections: sections.map(s => s.section).filter(Boolean)
    });
  } catch (error) {
    console.error('Get tables error:', error);
    res.status(500).json({ error: 'Failed to get tables' });
  }
});

// GET /api/tables/:id - Get single table with open orders
router.get('/:id', requireRestaurantFeatures, async (req, res) => {
  try {
    const { id } = req.params;

    const where = {
      id,
      tenantId: req.tenantId
    };

    // Branch filtering for managers/cashiers
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const table = await prisma.restaurantTable.findFirst({
      where,
      include: {
        branch: {
          select: { id: true, name: true }
        },
        assignedCashier: {
          select: { id: true, fullName: true }
        },
        orders: {
          where: {
            isTabOpen: true,
            status: { notIn: ['completed', 'cancelled'] }
          },
          include: {
            items: {
              include: {
                product: {
                  select: { id: true, name: true, sellingPrice: true, image: true }
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
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check if user can access this table (for cashiers)
    if (req.user.role === 'CASHIER' && table.assignedCashierId && table.assignedCashierId !== req.user.id) {
      return res.status(403).json({ error: 'This table is being served by another cashier' });
    }

    // Calculate order totals
    const ordersWithTotals = table.orders.map(order => {
      const itemsTotal = order.items.reduce((sum, item) => {
        const modifiers = item.modifiers ? JSON.parse(item.modifiers) : [];
        const modifierTotal = modifiers.reduce((mSum, mod) => mSum + (mod.price || 0), 0);
        return sum + (item.unitPrice + modifierTotal) * item.quantity;
      }, 0);

      return {
        ...order,
        total: itemsTotal
      };
    });

    const tabTotal = ordersWithTotals.reduce((sum, order) => sum + order.total, 0);

    res.json({
      table: {
        ...table,
        orders: ordersWithTotals,
        tabTotal
      }
    });
  } catch (error) {
    console.error('Get table error:', error);
    res.status(500).json({ error: 'Failed to get table details' });
  }
});

// POST /api/tables - Create table (Admin/Manager)
router.post('/', requireRestaurantFeatures, requireAdmin, [
  body('tableNumber').trim().notEmpty().withMessage('Table number is required'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('section').optional().trim(),
  body('positionX').optional().isInt(),
  body('positionY').optional().isInt(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { tableNumber, capacity, section, positionX, positionY, branchId } = req.body;

    // Determine branch
    let tableBranchId;
    if (req.user.role === 'MANAGER') {
      tableBranchId = req.branchId;
    } else {
      tableBranchId = branchId || req.branchId;
    }

    // Check for duplicate table number in same branch
    const existingTable = await prisma.restaurantTable.findFirst({
      where: {
        tenantId: req.tenantId,
        branchId: tableBranchId,
        tableNumber: { equals: tableNumber, mode: 'insensitive' },
        isActive: true
      }
    });

    if (existingTable) {
      return res.status(400).json({ error: 'A table with this number already exists in this branch' });
    }

    const table = await prisma.restaurantTable.create({
      data: {
        tableNumber,
        capacity: capacity || 4,
        section: section || null,
        positionX: positionX || null,
        positionY: positionY || null,
        status: 'available',
        tenantId: req.tenantId,
        branchId: tableBranchId
      },
      include: {
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'table_created',
      `Created table: ${tableNumber}`,
      { tableId: table.id, section },
      tableBranchId
    );

    res.status(201).json({ table });
  } catch (error) {
    console.error('Create table error:', error);
    res.status(500).json({ error: 'Failed to create table' });
  }
});

// PUT /api/tables/:id - Update table (Admin/Manager)
router.put('/:id', requireRestaurantFeatures, requireAdmin, [
  body('tableNumber').optional().trim().notEmpty().withMessage('Table number cannot be empty'),
  body('capacity').optional().isInt({ min: 1 }).withMessage('Capacity must be at least 1'),
  body('section').optional().trim(),
  body('positionX').optional().isInt(),
  body('positionY').optional().isInt(),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { tableNumber, capacity, section, positionX, positionY, isActive } = req.body;

    const where = { id, tenantId: req.tenantId };

    // Managers can only update their branch's tables
    if (req.user.role === 'MANAGER') {
      where.branchId = req.branchId;
    }

    const table = await prisma.restaurantTable.findFirst({ where });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // If updating table number, check for duplicates
    if (tableNumber && tableNumber !== table.tableNumber) {
      const existingTable = await prisma.restaurantTable.findFirst({
        where: {
          tenantId: req.tenantId,
          branchId: table.branchId,
          tableNumber: { equals: tableNumber, mode: 'insensitive' },
          id: { not: id },
          isActive: true
        }
      });

      if (existingTable) {
        return res.status(400).json({ error: 'A table with this number already exists' });
      }
    }

    const updatedTable = await prisma.restaurantTable.update({
      where: { id },
      data: {
        ...(tableNumber && { tableNumber }),
        ...(capacity !== undefined && { capacity }),
        ...(section !== undefined && { section: section || null }),
        ...(positionX !== undefined && { positionX }),
        ...(positionY !== undefined && { positionY }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'table_updated',
      `Updated table: ${updatedTable.tableNumber}`,
      { tableId: id, changes: req.body },
      table.branchId
    );

    res.json({ table: updatedTable });
  } catch (error) {
    console.error('Update table error:', error);
    res.status(500).json({ error: 'Failed to update table' });
  }
});

// PUT /api/tables/:id/status - Update table status
router.put('/:id/status', requireRestaurantFeatures, [
  body('status').isIn(['available', 'occupied', 'reserved']).withMessage('Invalid status'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    const where = { id, tenantId: req.tenantId };

    // Branch filtering
    if (req.user.role === 'MANAGER' || req.user.role === 'CASHIER') {
      where.branchId = req.branchId;
    }

    const table = await prisma.restaurantTable.findFirst({ where });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check table ownership for cashiers
    const isOwnerOrManager = req.user.role === 'OWNER' || req.user.role === 'MANAGER' || req.user.role === 'ADMIN';
    if (!isOwnerOrManager && table.assignedCashierId && table.assignedCashierId !== req.user.id) {
      return res.status(403).json({ error: 'This table is being served by another cashier' });
    }

    // Check if table has open orders when trying to set to available
    if (status === 'available') {
      const openOrders = await prisma.restaurantOrder.count({
        where: {
          tableId: id,
          isTabOpen: true,
          status: { notIn: ['completed', 'cancelled'] }
        }
      });

      if (openOrders > 0) {
        return res.status(400).json({
          error: 'Cannot set table to available while there are open orders. Close all tabs first.'
        });
      }
    }

    // Build update data
    const updateData = { status };

    // Clear cashier assignment when setting to available
    if (status === 'available') {
      updateData.assignedCashierId = null;
    }

    // Assign current cashier when setting to occupied (if not already assigned)
    if (status === 'occupied' && !table.assignedCashierId) {
      updateData.assignedCashierId = req.user.id;
    }

    const updatedTable = await prisma.restaurantTable.update({
      where: { id },
      data: updateData,
      include: {
        assignedCashier: {
          select: { id: true, fullName: true }
        }
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'table_status_changed',
      `Table ${table.tableNumber} status changed to ${status}`,
      { tableId: id, previousStatus: table.status, newStatus: status },
      table.branchId
    );

    res.json({ table: updatedTable });
  } catch (error) {
    console.error('Update table status error:', error);
    res.status(500).json({ error: 'Failed to update table status' });
  }
});

// DELETE /api/tables/:id - Delete table (soft delete)
router.delete('/:id', requireRestaurantFeatures, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const where = { id, tenantId: req.tenantId };

    // Managers can only delete their branch's tables
    if (req.user.role === 'MANAGER') {
      where.branchId = req.branchId;
    }

    const table = await prisma.restaurantTable.findFirst({ where });

    if (!table) {
      return res.status(404).json({ error: 'Table not found' });
    }

    // Check for open orders
    const openOrders = await prisma.restaurantOrder.count({
      where: {
        tableId: id,
        isTabOpen: true,
        status: { notIn: ['completed', 'cancelled'] }
      }
    });

    if (openOrders > 0) {
      return res.status(400).json({
        error: 'Cannot delete table with open orders. Close all tabs first.'
      });
    }

    // Soft delete
    await prisma.restaurantTable.update({
      where: { id },
      data: { isActive: false }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'table_deleted',
      `Deleted table: ${table.tableNumber}`,
      { tableId: id },
      table.branchId
    );

    res.json({ message: 'Table deleted successfully' });
  } catch (error) {
    console.error('Delete table error:', error);
    res.status(500).json({ error: 'Failed to delete table' });
  }
});

// POST /api/tables/bulk - Create multiple tables at once
router.post('/bulk', requireRestaurantFeatures, requireAdmin, [
  body('startNumber').isInt({ min: 1 }).withMessage('Start number must be at least 1'),
  body('count').isInt({ min: 1, max: 50 }).withMessage('Count must be between 1 and 50'),
  body('capacity').optional().isInt({ min: 1 }),
  body('section').optional().trim(),
  body('prefix').optional().trim(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { startNumber, count, capacity, section, prefix, branchId } = req.body;

    // Determine branch
    let tableBranchId;
    if (req.user.role === 'MANAGER') {
      tableBranchId = req.branchId;
    } else {
      tableBranchId = branchId || req.branchId;
    }

    const createdTables = [];
    const skippedNumbers = [];

    for (let i = 0; i < count; i++) {
      const tableNumber = prefix
        ? `${prefix}${startNumber + i}`
        : `${startNumber + i}`;

      // Check for existing table
      const exists = await prisma.restaurantTable.findFirst({
        where: {
          tenantId: req.tenantId,
          branchId: tableBranchId,
          tableNumber: { equals: tableNumber, mode: 'insensitive' },
          isActive: true
        }
      });

      if (exists) {
        skippedNumbers.push(tableNumber);
        continue;
      }

      const table = await prisma.restaurantTable.create({
        data: {
          tableNumber,
          capacity: capacity || 4,
          section: section || null,
          status: 'available',
          tenantId: req.tenantId,
          branchId: tableBranchId
        }
      });

      createdTables.push(table);
    }

    if (createdTables.length > 0) {
      await logAudit(
        req.tenantId,
        req.user.id,
        'tables_bulk_created',
        `Created ${createdTables.length} tables`,
        { tableIds: createdTables.map(t => t.id), section },
        tableBranchId
      );
    }

    res.status(201).json({
      tables: createdTables,
      created: createdTables.length,
      skipped: skippedNumbers
    });
  } catch (error) {
    console.error('Bulk create tables error:', error);
    res.status(500).json({ error: 'Failed to create tables' });
  }
});

// PUT /api/tables/positions - Update table positions (for drag-drop layout)
router.put('/positions/update', requireRestaurantFeatures, requireAdmin, [
  body('positions').isArray().withMessage('Positions must be an array'),
  body('positions.*.id').notEmpty().withMessage('Table ID is required'),
  body('positions.*.positionX').isInt().withMessage('Position X must be an integer'),
  body('positions.*.positionY').isInt().withMessage('Position Y must be an integer'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { positions } = req.body;

    // Verify all tables belong to tenant
    const tableIds = positions.map(p => p.id);
    const tables = await prisma.restaurantTable.findMany({
      where: {
        id: { in: tableIds },
        tenantId: req.tenantId
      }
    });

    if (tables.length !== tableIds.length) {
      return res.status(400).json({ error: 'Some tables not found' });
    }

    // Update positions
    await Promise.all(
      positions.map(({ id, positionX, positionY }) =>
        prisma.restaurantTable.update({
          where: { id },
          data: { positionX, positionY }
        })
      )
    );

    await logAudit(
      req.tenantId,
      req.user.id,
      'tables_positions_updated',
      `Updated positions for ${positions.length} tables`,
      { tableIds }
    );

    res.json({ message: 'Positions updated successfully' });
  } catch (error) {
    console.error('Update positions error:', error);
    res.status(500).json({ error: 'Failed to update positions' });
  }
});

module.exports = router;
