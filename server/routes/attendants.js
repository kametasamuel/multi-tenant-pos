const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { body, validationResult } = require('express-validator');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// GET /api/attendants - Get all attendants
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, branchId, isActive } = req.query;

    const where = { tenantId: req.tenantId };

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { specialty: { contains: search, mode: 'insensitive' } }
      ];
    }

    if (branchId) {
      where.branchId = branchId;
    }

    if (isActive !== undefined) {
      where.isActive = isActive === 'true';
    }

    const attendants = await prisma.attendant.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        phone: true,
        email: true,
        profileImage: true,
        specialty: true,
        commissionRate: true,
        isActive: true,
        branchId: true,
        createdAt: true,
        branch: {
          select: { id: true, name: true }
        },
        _count: {
          select: { saleItems: true }
        }
      },
      orderBy: [
        { isActive: 'desc' },
        { fullName: 'asc' }
      ]
    });

    res.json({ attendants });
  } catch (error) {
    console.error('Get attendants error:', error);
    res.status(500).json({ error: 'Failed to get attendants' });
  }
});

// GET /api/attendants/performance/summary - Get all attendants performance summary
// IMPORTANT: This must be before /:id route to avoid matching "performance" as an ID
router.get('/performance/summary', authenticate, requireAdmin, async (req, res) => {
  try {
    const { startDate, endDate, branchId } = req.query;

    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate);
    }

    // Get all sale items with attendants
    const saleItems = await prisma.saleItem.findMany({
      where: {
        attendantId: { not: null },
        sale: {
          tenantId: req.tenantId,
          paymentStatus: 'completed',
          ...(branchId && { branchId }),
          ...dateFilter
        }
      },
      include: {
        attendant: {
          select: {
            id: true,
            fullName: true,
            commissionRate: true,
            profileImage: true,
            specialty: true
          }
        },
        product: { select: { id: true, name: true, type: true } },
        sale: { select: { createdAt: true } }
      }
    });

    // Aggregate by attendant
    const attendantMap = {};
    saleItems.forEach(item => {
      const attendantId = item.attendantId;
      if (!attendantMap[attendantId]) {
        attendantMap[attendantId] = {
          attendant: item.attendant,
          totalSales: 0,
          serviceCount: 0,
          commission: 0,
          services: {}
        };
      }
      attendantMap[attendantId].totalSales += item.subtotal;
      attendantMap[attendantId].serviceCount += item.quantity;

      // Track services performed
      const serviceName = item.product.name;
      if (!attendantMap[attendantId].services[serviceName]) {
        attendantMap[attendantId].services[serviceName] = 0;
      }
      attendantMap[attendantId].services[serviceName] += item.quantity;

      // Calculate commission
      const commissionRate = item.attendant?.commissionRate || 0;
      attendantMap[attendantId].commission += (item.subtotal * commissionRate) / 100;
    });

    // Convert to array and format
    const performance = Object.values(attendantMap).map(a => ({
      ...a,
      topServices: Object.entries(a.services)
        .sort((x, y) => y[1] - x[1])
        .slice(0, 3)
        .map(([name, count]) => ({ name, count }))
    }));

    // Sort by total sales
    performance.sort((a, b) => b.totalSales - a.totalSales);

    // Calculate totals
    const totals = {
      totalSales: performance.reduce((sum, a) => sum + a.totalSales, 0),
      totalServices: performance.reduce((sum, a) => sum + a.serviceCount, 0),
      totalCommission: performance.reduce((sum, a) => sum + a.commission, 0)
    };

    res.json({ performance, totals });
  } catch (error) {
    console.error('Get performance summary error:', error);
    res.status(500).json({ error: 'Failed to get performance summary' });
  }
});

// GET /api/attendants/:id - Get single attendant with performance data
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { startDate, endDate } = req.query;

    const attendant = await prisma.attendant.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    if (!attendant) {
      return res.status(404).json({ error: 'Attendant not found' });
    }

    // Build date filter for performance data
    const dateFilter = {};
    if (startDate || endDate) {
      dateFilter.createdAt = {};
      if (startDate) dateFilter.createdAt.gte = new Date(startDate);
      if (endDate) dateFilter.createdAt.lte = new Date(endDate);
    }

    // Get performance data
    const saleItems = await prisma.saleItem.findMany({
      where: {
        attendantId: id,
        sale: {
          tenantId: req.tenantId,
          paymentStatus: 'completed',
          ...dateFilter
        }
      },
      include: {
        product: { select: { id: true, name: true } },
        sale: { select: { id: true, transactionNumber: true, createdAt: true } }
      },
      orderBy: { sale: { createdAt: 'desc' } },
      take: 50
    });

    const totalSales = saleItems.reduce((sum, item) => sum + item.subtotal, 0);
    const serviceCount = saleItems.reduce((sum, item) => sum + item.quantity, 0);
    const commission = (totalSales * attendant.commissionRate) / 100;

    res.json({
      attendant,
      performance: {
        totalSales,
        serviceCount,
        commission,
        commissionRate: attendant.commissionRate
      },
      recentServices: saleItems.slice(0, 20)
    });
  } catch (error) {
    console.error('Get attendant error:', error);
    res.status(500).json({ error: 'Failed to get attendant' });
  }
});

// POST /api/attendants - Create attendant
router.post('/', authenticate, requireAdmin, [
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }).withMessage('Commission rate must be between 0 and 100'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { fullName, phone, email, specialty, commissionRate, branchId } = req.body;

    const attendant = await prisma.attendant.create({
      data: {
        fullName,
        phone: phone || null,
        email: email || null,
        specialty: specialty || null,
        commissionRate: commissionRate || 0,
        branchId: branchId || null,
        tenantId: req.tenantId
      },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    res.status(201).json({ attendant });
  } catch (error) {
    console.error('Create attendant error:', error);
    res.status(500).json({ error: 'Failed to create attendant' });
  }
});

// PUT /api/attendants/:id - Update attendant
router.put('/:id', authenticate, requireAdmin, [
  body('fullName').optional().trim().notEmpty(),
  body('commissionRate').optional().isFloat({ min: 0, max: 100 }),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, phone, email, specialty, commissionRate, branchId, isActive } = req.body;

    const existing = await prisma.attendant.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Attendant not found' });
    }

    const attendant = await prisma.attendant.update({
      where: { id },
      data: {
        ...(fullName !== undefined && { fullName }),
        ...(phone !== undefined && { phone }),
        ...(email !== undefined && { email }),
        ...(specialty !== undefined && { specialty }),
        ...(commissionRate !== undefined && { commissionRate }),
        ...(branchId !== undefined && { branchId }),
        ...(isActive !== undefined && { isActive })
      },
      include: {
        branch: { select: { id: true, name: true } }
      }
    });

    res.json({ attendant });
  } catch (error) {
    console.error('Update attendant error:', error);
    res.status(500).json({ error: 'Failed to update attendant' });
  }
});

// DELETE /api/attendants/:id - Delete attendant (soft delete by setting isActive = false)
router.delete('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.attendant.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Attendant not found' });
    }

    // Soft delete
    await prisma.attendant.update({
      where: { id },
      data: { isActive: false }
    });

    res.json({ message: 'Attendant deactivated' });
  } catch (error) {
    console.error('Delete attendant error:', error);
    res.status(500).json({ error: 'Failed to delete attendant' });
  }
});

// POST /api/attendants/:id/upload-image - Upload profile image
router.post('/:id/upload-image', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const existing = await prisma.attendant.findFirst({
      where: { id, tenantId: req.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Attendant not found' });
    }

    // Handle file upload (similar to user image upload)
    if (!req.files || !req.files.image) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const file = req.files.image;
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    if (!allowedTypes.includes(file.mimetype)) {
      return res.status(400).json({ error: 'Invalid file type' });
    }

    if (file.size > 5 * 1024 * 1024) {
      return res.status(400).json({ error: 'File too large. Max 5MB' });
    }

    const fileName = `attendant-${id}-${Date.now()}.${file.mimetype.split('/')[1]}`;
    const uploadPath = `uploads/${fileName}`;

    await file.mv(uploadPath);

    await prisma.attendant.update({
      where: { id },
      data: { profileImage: `/${uploadPath}` }
    });

    res.json({ profileImage: `/${uploadPath}` });
  } catch (error) {
    console.error('Upload image error:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

module.exports = router;
