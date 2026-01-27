const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireManager } = require('../middleware/auth');

// ============================================
// GUEST MANAGEMENT
// ============================================

// Search guests
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q } = req.query;

    if (!q || q.length < 2) {
      return res.json([]);
    }

    const guests = await prisma.guest.findMany({
      where: {
        tenantId: req.user.tenantId,
        OR: [
          { firstName: { contains: q, mode: 'insensitive' } },
          { lastName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } },
          { idNumber: { contains: q } }
        ]
      },
      take: 20,
      orderBy: { lastName: 'asc' }
    });

    res.json(guests);
  } catch (error) {
    console.error('Error searching guests:', error);
    res.status(500).json({ error: 'Failed to search guests' });
  }
});

// Get all guests with pagination
router.get('/', authenticate, async (req, res) => {
  try {
    const { vipStatus, page = 1, limit = 50 } = req.query;

    const where = { tenantId: req.user.tenantId };
    if (vipStatus) where.vipStatus = vipStatus;

    const [guests, total] = await Promise.all([
      prisma.guest.findMany({
        where,
        orderBy: { lastName: 'asc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.guest.count({ where })
    ]);

    res.json({
      guests,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching guests:', error);
    res.status(500).json({ error: 'Failed to fetch guests' });
  }
});

// Get VIP guests
router.get('/vip', authenticate, async (req, res) => {
  try {
    const guests = await prisma.guest.findMany({
      where: {
        tenantId: req.user.tenantId,
        vipStatus: { not: 'regular' }
      },
      orderBy: [
        { vipStatus: 'desc' },
        { totalStays: 'desc' }
      ]
    });

    res.json(guests);
  } catch (error) {
    console.error('Error fetching VIP guests:', error);
    res.status(500).json({ error: 'Failed to fetch VIP guests' });
  }
});

// Get frequent guests (top by stays)
router.get('/frequent', authenticate, async (req, res) => {
  try {
    const { limit = 20 } = req.query;

    const guests = await prisma.guest.findMany({
      where: {
        tenantId: req.user.tenantId,
        totalStays: { gte: 2 }
      },
      orderBy: { totalStays: 'desc' },
      take: parseInt(limit)
    });

    res.json(guests);
  } catch (error) {
    console.error('Error fetching frequent guests:', error);
    res.status(500).json({ error: 'Failed to fetch frequent guests' });
  }
});

// Get single guest with history
router.get('/:id', authenticate, async (req, res) => {
  try {
    const guest = await prisma.guest.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId
      },
      include: {
        bookings: {
          orderBy: { checkInDate: 'desc' },
          take: 10,
          include: {
            rooms: {
              include: {
                room: { select: { roomNumber: true, roomType: { select: { name: true } } } }
              }
            }
          }
        },
        customer: true
      }
    });

    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    res.json(guest);
  } catch (error) {
    console.error('Error fetching guest:', error);
    res.status(500).json({ error: 'Failed to fetch guest' });
  }
});

// Create guest
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      firstName, lastName, email, phone, idType, idNumber,
      nationality, dateOfBirth, address, city, country,
      company, vipStatus, preferences, notes
    } = req.body;

    if (!firstName || !lastName) {
      return res.status(400).json({ error: 'First name and last name are required' });
    }

    // Check for duplicate by ID number if provided
    if (idNumber) {
      const existing = await prisma.guest.findFirst({
        where: {
          tenantId: req.user.tenantId,
          idNumber
        }
      });

      if (existing) {
        return res.status(400).json({
          error: 'A guest with this ID number already exists',
          existingGuest: existing
        });
      }
    }

    // Optionally link to existing customer by phone/email
    let customerId = null;
    if (phone || email) {
      const existingCustomer = await prisma.customer.findFirst({
        where: {
          tenantId: req.user.tenantId,
          OR: [
            phone ? { phone } : {},
            email ? { email } : {}
          ].filter(o => Object.keys(o).length > 0)
        }
      });
      if (existingCustomer) {
        customerId = existingCustomer.id;
      }
    }

    const guest = await prisma.guest.create({
      data: {
        tenantId: req.user.tenantId,
        customerId,
        firstName,
        lastName,
        email,
        phone,
        idType,
        idNumber,
        nationality,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        address,
        city,
        country,
        company,
        vipStatus: vipStatus || 'regular',
        preferences: preferences ? JSON.stringify(preferences) : null,
        notes
      }
    });

    res.status(201).json(guest);
  } catch (error) {
    console.error('Error creating guest:', error);
    res.status(500).json({ error: 'Failed to create guest' });
  }
});

// Update guest
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      firstName, lastName, email, phone, idType, idNumber,
      nationality, dateOfBirth, address, city, country,
      company, vipStatus, preferences, notes
    } = req.body;

    const existing = await prisma.guest.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    const guest = await prisma.guest.update({
      where: { id },
      data: {
        firstName,
        lastName,
        email,
        phone,
        idType,
        idNumber,
        nationality,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
        address,
        city,
        country,
        company,
        vipStatus,
        preferences: preferences ? JSON.stringify(preferences) : undefined,
        notes
      }
    });

    res.json(guest);
  } catch (error) {
    console.error('Error updating guest:', error);
    res.status(500).json({ error: 'Failed to update guest' });
  }
});

// Update VIP status
router.put('/:id/vip', authenticate, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { vipStatus } = req.body;

    const validStatuses = ['regular', 'silver', 'gold', 'platinum'];
    if (!validStatuses.includes(vipStatus)) {
      return res.status(400).json({ error: 'Invalid VIP status' });
    }

    const guest = await prisma.guest.update({
      where: { id },
      data: { vipStatus }
    });

    res.json(guest);
  } catch (error) {
    console.error('Error updating VIP status:', error);
    res.status(500).json({ error: 'Failed to update VIP status' });
  }
});

// Delete guest (soft delete by unlinking, or hard delete if no bookings)
router.delete('/:id', authenticate, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const guest = await prisma.guest.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: { _count: { select: { bookings: true } } }
    });

    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    if (guest._count.bookings > 0) {
      return res.status(400).json({
        error: 'Cannot delete guest with booking history. Consider merging with another guest record.'
      });
    }

    await prisma.guest.delete({ where: { id } });
    res.json({ message: 'Guest deleted successfully' });
  } catch (error) {
    console.error('Error deleting guest:', error);
    res.status(500).json({ error: 'Failed to delete guest' });
  }
});

// Merge guests (combine duplicate records)
router.post('/merge', authenticate, requireManager, async (req, res) => {
  try {
    const { keepGuestId, mergeGuestId } = req.body;

    if (!keepGuestId || !mergeGuestId) {
      return res.status(400).json({ error: 'Both guest IDs are required' });
    }

    const [keepGuest, mergeGuest] = await Promise.all([
      prisma.guest.findFirst({ where: { id: keepGuestId, tenantId: req.user.tenantId } }),
      prisma.guest.findFirst({ where: { id: mergeGuestId, tenantId: req.user.tenantId } })
    ]);

    if (!keepGuest || !mergeGuest) {
      return res.status(404).json({ error: 'One or both guests not found' });
    }

    // Transfer bookings and update stats
    await prisma.$transaction(async (tx) => {
      // Update all bookings to point to kept guest
      await tx.booking.updateMany({
        where: { guestId: mergeGuestId },
        data: { guestId: keepGuestId }
      });

      // Update stats
      await tx.guest.update({
        where: { id: keepGuestId },
        data: {
          totalStays: keepGuest.totalStays + mergeGuest.totalStays,
          totalSpent: keepGuest.totalSpent + mergeGuest.totalSpent,
          lastStayAt: keepGuest.lastStayAt > mergeGuest.lastStayAt
            ? keepGuest.lastStayAt
            : mergeGuest.lastStayAt
        }
      });

      // Delete merged guest
      await tx.guest.delete({ where: { id: mergeGuestId } });
    });

    const updatedGuest = await prisma.guest.findUnique({
      where: { id: keepGuestId },
      include: { _count: { select: { bookings: true } } }
    });

    res.json({
      message: 'Guests merged successfully',
      guest: updatedGuest
    });
  } catch (error) {
    console.error('Error merging guests:', error);
    res.status(500).json({ error: 'Failed to merge guests' });
  }
});

module.exports = router;
