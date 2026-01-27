const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireOwner, requireManager } = require('../middleware/auth');

// ============================================
// ROOM TYPES
// ============================================

// Get all room types
router.get('/types', authenticate, async (req, res) => {
  try {
    const { branchId, includeInactive } = req.query;

    const where = { tenantId: req.user.tenantId };
    if (branchId) where.branchId = branchId;
    if (!includeInactive) where.isActive = true;

    const roomTypes = await prisma.roomType.findMany({
      where,
      include: {
        _count: { select: { rooms: true } }
      },
      orderBy: { sortOrder: 'asc' }
    });

    res.json(roomTypes);
  } catch (error) {
    console.error('Error fetching room types:', error);
    res.status(500).json({ error: 'Failed to fetch room types' });
  }
});

// Get single room type
router.get('/types/:id', authenticate, async (req, res) => {
  try {
    const roomType = await prisma.roomType.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId
      },
      include: {
        rooms: true,
        ratePlans: { where: { isActive: true } }
      }
    });

    if (!roomType) {
      return res.status(404).json({ error: 'Room type not found' });
    }

    res.json(roomType);
  } catch (error) {
    console.error('Error fetching room type:', error);
    res.status(500).json({ error: 'Failed to fetch room type' });
  }
});

// Create room type
router.post('/types', authenticate, requireManager, async (req, res) => {
  try {
    const {
      name, code, description, basePrice, maxOccupancy,
      bedType, bedCount, size, amenities, branchId
    } = req.body;

    // Validate required fields
    if (!name || !code || !basePrice) {
      return res.status(400).json({ error: 'Name, code, and base price are required' });
    }

    // Check for duplicate code
    const existing = await prisma.roomType.findFirst({
      where: {
        tenantId: req.user.tenantId,
        branchId: branchId || req.user.branchId,
        code: code.toUpperCase()
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Room type code already exists' });
    }

    const roomType = await prisma.roomType.create({
      data: {
        tenantId: req.user.tenantId,
        branchId: branchId || req.user.branchId,
        name,
        code: code.toUpperCase(),
        description,
        basePrice: parseFloat(basePrice),
        maxOccupancy: parseInt(maxOccupancy) || 2,
        bedType,
        bedCount: parseInt(bedCount) || 1,
        size: size ? parseFloat(size) : null,
        amenities: amenities ? JSON.stringify(amenities) : null
      }
    });

    res.status(201).json(roomType);
  } catch (error) {
    console.error('Error creating room type:', error);
    res.status(500).json({ error: 'Failed to create room type' });
  }
});

// Update room type
router.put('/types/:id', authenticate, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name, code, description, basePrice, maxOccupancy,
      bedType, bedCount, size, amenities, isActive
    } = req.body;

    // Verify ownership
    const existing = await prisma.roomType.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Room type not found' });
    }

    const roomType = await prisma.roomType.update({
      where: { id },
      data: {
        name,
        code: code?.toUpperCase(),
        description,
        basePrice: basePrice ? parseFloat(basePrice) : undefined,
        maxOccupancy: maxOccupancy ? parseInt(maxOccupancy) : undefined,
        bedType,
        bedCount: bedCount ? parseInt(bedCount) : undefined,
        size: size ? parseFloat(size) : undefined,
        amenities: amenities ? JSON.stringify(amenities) : undefined,
        isActive
      }
    });

    res.json(roomType);
  } catch (error) {
    console.error('Error updating room type:', error);
    res.status(500).json({ error: 'Failed to update room type' });
  }
});

// Delete room type
router.delete('/types/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if rooms exist for this type
    const roomCount = await prisma.room.count({
      where: { roomTypeId: id, tenantId: req.user.tenantId }
    });

    if (roomCount > 0) {
      return res.status(400).json({
        error: 'Cannot delete room type with existing rooms. Deactivate it instead.'
      });
    }

    await prisma.roomType.delete({ where: { id } });
    res.json({ message: 'Room type deleted successfully' });
  } catch (error) {
    console.error('Error deleting room type:', error);
    res.status(500).json({ error: 'Failed to delete room type' });
  }
});

// ============================================
// ROOMS
// ============================================

// Get all rooms with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      branchId, roomTypeId, status, cleaningStatus,
      floor, includeInactive
    } = req.query;

    const where = { tenantId: req.user.tenantId };
    if (branchId) where.branchId = branchId;
    if (roomTypeId) where.roomTypeId = roomTypeId;
    if (status) where.status = status;
    if (cleaningStatus) where.cleaningStatus = cleaningStatus;
    if (floor) where.floor = floor;
    if (!includeInactive) where.isActive = true;

    const rooms = await prisma.room.findMany({
      where,
      include: {
        roomType: {
          select: { name: true, code: true, basePrice: true, maxOccupancy: true }
        }
      },
      orderBy: [{ floor: 'asc' }, { roomNumber: 'asc' }]
    });

    res.json(rooms);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get room availability summary
router.get('/availability', authenticate, async (req, res) => {
  try {
    const { branchId, checkIn, checkOut } = req.query;

    const where = {
      tenantId: req.user.tenantId,
      isActive: true
    };
    if (branchId) where.branchId = branchId;

    // Get all rooms
    const rooms = await prisma.room.findMany({
      where,
      include: {
        roomType: true,
        bookingRooms: {
          where: {
            status: { in: ['reserved', 'checked_in'] },
            OR: [
              {
                checkInDate: { lte: new Date(checkOut || new Date()) },
                checkOutDate: { gte: new Date(checkIn || new Date()) }
              }
            ]
          }
        }
      }
    });

    // Calculate availability by room type
    const summary = {};
    rooms.forEach(room => {
      const typeId = room.roomTypeId;
      if (!summary[typeId]) {
        summary[typeId] = {
          roomType: room.roomType,
          total: 0,
          available: 0,
          occupied: 0,
          reserved: 0,
          maintenance: 0,
          cleaning: 0
        };
      }

      summary[typeId].total++;

      if (room.bookingRooms.length > 0) {
        const activeBooking = room.bookingRooms[0];
        if (activeBooking.status === 'checked_in') {
          summary[typeId].occupied++;
        } else {
          summary[typeId].reserved++;
        }
      } else if (room.status === 'maintenance' || room.status === 'out_of_order') {
        summary[typeId].maintenance++;
      } else if (room.cleaningStatus !== 'clean') {
        summary[typeId].cleaning++;
      } else {
        summary[typeId].available++;
      }
    });

    res.json({
      summary: Object.values(summary),
      totalRooms: rooms.length,
      availableRooms: rooms.filter(r =>
        r.status === 'available' &&
        r.cleaningStatus === 'clean' &&
        r.bookingRooms.length === 0
      ).length
    });
  } catch (error) {
    console.error('Error fetching availability:', error);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// Get single room
router.get('/:id', authenticate, async (req, res) => {
  try {
    const room = await prisma.room.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId
      },
      include: {
        roomType: true,
        bookingRooms: {
          where: {
            status: { in: ['reserved', 'checked_in'] }
          },
          include: {
            booking: {
              include: { guest: true }
            }
          },
          orderBy: { checkInDate: 'asc' },
          take: 5
        },
        housekeepingTasks: {
          where: { status: { in: ['pending', 'in_progress'] } },
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      }
    });

    if (!room) {
      return res.status(404).json({ error: 'Room not found' });
    }

    res.json(room);
  } catch (error) {
    console.error('Error fetching room:', error);
    res.status(500).json({ error: 'Failed to fetch room' });
  }
});

// Create room
router.post('/', authenticate, requireManager, async (req, res) => {
  try {
    const { roomTypeId, roomNumber, floor, building, branchId, notes } = req.body;

    if (!roomTypeId || !roomNumber) {
      return res.status(400).json({ error: 'Room type and room number are required' });
    }

    // Check for duplicate room number
    const existing = await prisma.room.findFirst({
      where: {
        tenantId: req.user.tenantId,
        branchId: branchId || req.user.branchId,
        roomNumber
      }
    });

    if (existing) {
      return res.status(400).json({ error: 'Room number already exists' });
    }

    const room = await prisma.room.create({
      data: {
        tenantId: req.user.tenantId,
        branchId: branchId || req.user.branchId,
        roomTypeId,
        roomNumber,
        floor,
        building,
        notes
      },
      include: { roomType: true }
    });

    res.status(201).json(room);
  } catch (error) {
    console.error('Error creating room:', error);
    res.status(500).json({ error: 'Failed to create room' });
  }
});

// Bulk create rooms
router.post('/bulk', authenticate, requireManager, async (req, res) => {
  try {
    const { roomTypeId, floor, building, branchId, startNumber, endNumber, prefix } = req.body;

    if (!roomTypeId || !startNumber || !endNumber) {
      return res.status(400).json({ error: 'Room type, start number, and end number are required' });
    }

    const start = parseInt(startNumber);
    const end = parseInt(endNumber);

    if (start > end || end - start > 100) {
      return res.status(400).json({ error: 'Invalid room number range (max 100 rooms at once)' });
    }

    const rooms = [];
    for (let i = start; i <= end; i++) {
      const roomNumber = prefix ? `${prefix}${i}` : `${i}`;
      rooms.push({
        tenantId: req.user.tenantId,
        branchId: branchId || req.user.branchId,
        roomTypeId,
        roomNumber,
        floor,
        building
      });
    }

    const created = await prisma.room.createMany({
      data: rooms,
      skipDuplicates: true
    });

    res.status(201).json({
      message: `${created.count} rooms created successfully`,
      count: created.count
    });
  } catch (error) {
    console.error('Error bulk creating rooms:', error);
    res.status(500).json({ error: 'Failed to create rooms' });
  }
});

// Update room
router.put('/:id', authenticate, requireManager, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomTypeId, roomNumber, floor, building, status, cleaningStatus, notes, isActive } = req.body;

    // Verify ownership
    const existing = await prisma.room.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const room = await prisma.room.update({
      where: { id },
      data: {
        roomTypeId,
        roomNumber,
        floor,
        building,
        status,
        cleaningStatus,
        notes,
        isActive,
        ...(cleaningStatus === 'clean' && { lastCleanedAt: new Date() }),
        ...(cleaningStatus === 'inspecting' && { lastInspectedAt: new Date() })
      },
      include: { roomType: true }
    });

    res.json(room);
  } catch (error) {
    console.error('Error updating room:', error);
    res.status(500).json({ error: 'Failed to update room' });
  }
});

// Update room status (quick action)
router.put('/:id/status', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, cleaningStatus } = req.body;

    const existing = await prisma.room.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Room not found' });
    }

    const updateData = {};
    if (status) updateData.status = status;
    if (cleaningStatus) {
      updateData.cleaningStatus = cleaningStatus;
      if (cleaningStatus === 'clean') updateData.lastCleanedAt = new Date();
    }

    const room = await prisma.room.update({
      where: { id },
      data: updateData,
      include: { roomType: true }
    });

    res.json(room);
  } catch (error) {
    console.error('Error updating room status:', error);
    res.status(500).json({ error: 'Failed to update room status' });
  }
});

// Delete room
router.delete('/:id', authenticate, requireOwner, async (req, res) => {
  try {
    const { id } = req.params;

    // Check for active bookings
    const activeBookings = await prisma.bookingRoom.count({
      where: {
        roomId: id,
        status: { in: ['reserved', 'checked_in'] }
      }
    });

    if (activeBookings > 0) {
      return res.status(400).json({
        error: 'Cannot delete room with active bookings. Deactivate it instead.'
      });
    }

    await prisma.room.delete({ where: { id } });
    res.json({ message: 'Room deleted successfully' });
  } catch (error) {
    console.error('Error deleting room:', error);
    res.status(500).json({ error: 'Failed to delete room' });
  }
});

// ============================================
// RATE PLANS
// ============================================

// Get rate plans for a room type
router.get('/types/:roomTypeId/rates', authenticate, async (req, res) => {
  try {
    const ratePlans = await prisma.ratePlan.findMany({
      where: {
        roomTypeId: req.params.roomTypeId,
        tenantId: req.user.tenantId,
        isActive: true
      },
      orderBy: { isDefault: 'desc' }
    });

    res.json(ratePlans);
  } catch (error) {
    console.error('Error fetching rate plans:', error);
    res.status(500).json({ error: 'Failed to fetch rate plans' });
  }
});

// Create rate plan
router.post('/types/:roomTypeId/rates', authenticate, requireManager, async (req, res) => {
  try {
    const { roomTypeId } = req.params;
    const { name, code, price, isDefault, startDate, endDate, daysOfWeek, minNights, maxNights } = req.body;

    if (!name || !code || !price) {
      return res.status(400).json({ error: 'Name, code, and price are required' });
    }

    // If setting as default, unset other defaults
    if (isDefault) {
      await prisma.ratePlan.updateMany({
        where: { roomTypeId, tenantId: req.user.tenantId },
        data: { isDefault: false }
      });
    }

    const ratePlan = await prisma.ratePlan.create({
      data: {
        tenantId: req.user.tenantId,
        roomTypeId,
        name,
        code: code.toUpperCase(),
        price: parseFloat(price),
        isDefault: isDefault || false,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        daysOfWeek: daysOfWeek ? JSON.stringify(daysOfWeek) : null,
        minNights: minNights ? parseInt(minNights) : 1,
        maxNights: maxNights ? parseInt(maxNights) : null
      }
    });

    res.status(201).json(ratePlan);
  } catch (error) {
    console.error('Error creating rate plan:', error);
    res.status(500).json({ error: 'Failed to create rate plan' });
  }
});

module.exports = router;
