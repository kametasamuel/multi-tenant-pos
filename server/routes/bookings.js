const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireManager } = require('../middleware/auth');

// Helper: Generate booking number
const generateBookingNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  const count = await prisma.booking.count({
    where: {
      tenantId,
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`)
      }
    }
  });
  return `BK-${year}-${String(count + 1).padStart(4, '0')}`;
};

// Helper: Generate folio number
const generateFolioNumber = async (tenantId) => {
  const year = new Date().getFullYear();
  const count = await prisma.folio.count({
    where: {
      tenantId,
      createdAt: {
        gte: new Date(`${year}-01-01`),
        lt: new Date(`${year + 1}-01-01`)
      }
    }
  });
  return `F-${year}-${String(count + 1).padStart(4, '0')}`;
};

// ============================================
// BOOKINGS / RESERVATIONS
// ============================================

// Get all bookings with filters
router.get('/', authenticate, async (req, res) => {
  try {
    const {
      branchId, status, guestId, startDate, endDate,
      source, page = 1, limit = 50
    } = req.query;

    const where = { tenantId: req.user.tenantId };
    if (branchId) where.branchId = branchId;
    if (status) where.status = status;
    if (guestId) where.guestId = guestId;
    if (source) where.source = source;
    if (startDate || endDate) {
      where.checkInDate = {};
      if (startDate) where.checkInDate.gte = new Date(startDate);
      if (endDate) where.checkInDate.lte = new Date(endDate);
    }

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        include: {
          guest: {
            select: { firstName: true, lastName: true, phone: true, vipStatus: true }
          },
          rooms: {
            include: {
              room: {
                select: { roomNumber: true, roomType: { select: { name: true } } }
              }
            }
          },
          _count: { select: { rooms: true } }
        },
        orderBy: { checkInDate: 'desc' },
        skip: (parseInt(page) - 1) * parseInt(limit),
        take: parseInt(limit)
      }),
      prisma.booking.count({ where })
    ]);

    res.json({
      bookings,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

// Get today's arrivals
router.get('/arrivals', authenticate, async (req, res) => {
  try {
    const { branchId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = {
      tenantId: req.user.tenantId,
      checkInDate: { gte: today, lt: tomorrow },
      status: { in: ['confirmed', 'pending'] }
    };
    if (branchId) where.branchId = branchId;

    const arrivals = await prisma.booking.findMany({
      where,
      include: {
        guest: true,
        rooms: {
          include: {
            room: { include: { roomType: true } }
          }
        }
      },
      orderBy: { expectedArrival: 'asc' }
    });

    res.json(arrivals);
  } catch (error) {
    console.error('Error fetching arrivals:', error);
    res.status(500).json({ error: 'Failed to fetch arrivals' });
  }
});

// Get today's departures
router.get('/departures', authenticate, async (req, res) => {
  try {
    const { branchId } = req.query;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const where = {
      tenantId: req.user.tenantId,
      checkOutDate: { gte: today, lt: tomorrow },
      status: 'checked_in'
    };
    if (branchId) where.branchId = branchId;

    const departures = await prisma.booking.findMany({
      where,
      include: {
        guest: true,
        rooms: {
          include: {
            room: { include: { roomType: true } }
          }
        },
        folio: {
          select: { balance: true, totalAmount: true }
        }
      },
      orderBy: { checkOutDate: 'asc' }
    });

    res.json(departures);
  } catch (error) {
    console.error('Error fetching departures:', error);
    res.status(500).json({ error: 'Failed to fetch departures' });
  }
});

// Get in-house guests (currently checked in)
router.get('/in-house', authenticate, async (req, res) => {
  try {
    const { branchId } = req.query;

    const where = {
      tenantId: req.user.tenantId,
      status: 'checked_in'
    };
    if (branchId) where.branchId = branchId;

    const inHouse = await prisma.booking.findMany({
      where,
      include: {
        guest: true,
        rooms: {
          include: {
            room: { include: { roomType: true } }
          }
        },
        folio: {
          select: { balance: true, totalAmount: true, paidAmount: true }
        }
      },
      orderBy: { checkOutDate: 'asc' }
    });

    res.json(inHouse);
  } catch (error) {
    console.error('Error fetching in-house guests:', error);
    res.status(500).json({ error: 'Failed to fetch in-house guests' });
  }
});

// Get single booking
router.get('/:id', authenticate, async (req, res) => {
  try {
    const booking = await prisma.booking.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId
      },
      include: {
        guest: true,
        rooms: {
          include: {
            room: { include: { roomType: true } }
          }
        },
        folio: {
          include: {
            charges: { orderBy: { chargeDate: 'desc' } },
            payments: { orderBy: { receivedAt: 'desc' } }
          }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    res.json(booking);
  } catch (error) {
    console.error('Error fetching booking:', error);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Create booking
router.post('/', authenticate, async (req, res) => {
  try {
    const {
      guestId, checkInDate, checkOutDate, rooms, // rooms: [{roomId, ratePerNight}]
      adultsCount, childrenCount, source, expectedArrival,
      specialRequests, internalNotes, depositAmount, branchId
    } = req.body;

    // Validate required fields
    if (!guestId || !checkInDate || !checkOutDate || !rooms || rooms.length === 0) {
      return res.status(400).json({
        error: 'Guest, check-in date, check-out date, and at least one room are required'
      });
    }

    // Verify guest exists
    const guest = await prisma.guest.findFirst({
      where: { id: guestId, tenantId: req.user.tenantId }
    });
    if (!guest) {
      return res.status(404).json({ error: 'Guest not found' });
    }

    // Check room availability
    for (const roomData of rooms) {
      const conflicts = await prisma.bookingRoom.findFirst({
        where: {
          roomId: roomData.roomId,
          status: { in: ['reserved', 'checked_in'] },
          OR: [
            {
              checkInDate: { lt: new Date(checkOutDate) },
              checkOutDate: { gt: new Date(checkInDate) }
            }
          ]
        }
      });

      if (conflicts) {
        const room = await prisma.room.findUnique({ where: { id: roomData.roomId } });
        return res.status(400).json({
          error: `Room ${room?.roomNumber || roomData.roomId} is not available for selected dates`
        });
      }
    }

    // Calculate total
    const nights = Math.ceil(
      (new Date(checkOutDate) - new Date(checkInDate)) / (1000 * 60 * 60 * 24)
    );
    const totalAmount = rooms.reduce((sum, r) => sum + (r.ratePerNight * nights), 0);

    // Create booking with rooms
    const bookingNumber = await generateBookingNumber(req.user.tenantId);

    const booking = await prisma.booking.create({
      data: {
        tenantId: req.user.tenantId,
        branchId: branchId || req.user.branchId,
        bookingNumber,
        guestId,
        checkInDate: new Date(checkInDate),
        checkOutDate: new Date(checkOutDate),
        adultsCount: adultsCount || 1,
        childrenCount: childrenCount || 0,
        source: source || 'direct',
        expectedArrival,
        specialRequests,
        internalNotes,
        totalAmount,
        depositAmount: depositAmount || 0,
        depositPaidAt: depositAmount ? new Date() : null,
        paidAmount: depositAmount || 0,
        createdBy: req.user.id,
        rooms: {
          create: rooms.map(r => ({
            roomId: r.roomId,
            ratePerNight: r.ratePerNight,
            ratePlanCode: r.ratePlanCode,
            checkInDate: new Date(checkInDate),
            checkOutDate: new Date(checkOutDate),
            adultsCount: r.adultsCount || adultsCount || 1,
            childrenCount: r.childrenCount || childrenCount || 0
          }))
        }
      },
      include: {
        guest: true,
        rooms: {
          include: {
            room: { include: { roomType: true } }
          }
        }
      }
    });

    // Update room status to reserved
    await prisma.room.updateMany({
      where: { id: { in: rooms.map(r => r.roomId) } },
      data: { status: 'reserved' }
    });

    res.status(201).json(booking);
  } catch (error) {
    console.error('Error creating booking:', error);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Check-in
router.post('/:id/check-in', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { roomAssignments } = req.body; // Optional: reassign rooms at check-in

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        guest: true,
        rooms: { include: { room: true } }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'checked_in') {
      return res.status(400).json({ error: 'Booking is already checked in' });
    }

    if (booking.status === 'cancelled' || booking.status === 'no_show') {
      return res.status(400).json({ error: 'Cannot check in a cancelled booking' });
    }

    // Create folio for the stay
    const folioNumber = await generateFolioNumber(req.user.tenantId);
    const primaryRoom = booking.rooms[0];

    // Start transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create folio
      const folio = await tx.folio.create({
        data: {
          tenantId: req.user.tenantId,
          bookingId: id,
          folioNumber,
          guestName: `${booking.guest.firstName} ${booking.guest.lastName}`,
          roomNumber: primaryRoom.room.roomNumber,
          paidAmount: booking.paidAmount
        }
      });

      // Add room charges to folio
      const nights = Math.ceil(
        (booking.checkOutDate - booking.checkInDate) / (1000 * 60 * 60 * 24)
      );

      for (const br of booking.rooms) {
        await tx.folioCharge.create({
          data: {
            folioId: folio.id,
            chargeType: 'room',
            description: `Room ${br.room.roomNumber} - ${nights} night(s)`,
            quantity: nights,
            unitPrice: br.ratePerNight,
            amount: br.ratePerNight * nights,
            roomNumber: br.room.roomNumber,
            postedBy: req.user.id
          }
        });
      }

      // Calculate folio totals
      const totalCharges = booking.rooms.reduce(
        (sum, br) => sum + (br.ratePerNight * nights), 0
      );
      const taxAmount = totalCharges * (req.user.tenant?.taxRate || 0);

      await tx.folio.update({
        where: { id: folio.id },
        data: {
          subtotal: totalCharges,
          taxAmount,
          totalAmount: totalCharges + taxAmount,
          balance: totalCharges + taxAmount - booking.paidAmount
        }
      });

      // Update booking status
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 'checked_in',
          checkedInAt: new Date(),
          checkedInBy: req.user.id
        },
        include: {
          guest: true,
          rooms: { include: { room: { include: { roomType: true } } } },
          folio: true
        }
      });

      // Update room statuses
      await tx.room.updateMany({
        where: { id: { in: booking.rooms.map(br => br.roomId) } },
        data: { status: 'occupied' }
      });

      // Update booking room statuses
      await tx.bookingRoom.updateMany({
        where: { bookingId: id },
        data: { status: 'checked_in' }
      });

      return updatedBooking;
    });

    res.json(result);
  } catch (error) {
    console.error('Error checking in:', error);
    res.status(500).json({ error: 'Failed to check in' });
  }
});

// Check-out
router.post('/:id/check-out', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { paymentMethod, paymentAmount, paymentReference } = req.body;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: {
        guest: true,
        rooms: { include: { room: true } },
        folio: {
          include: { charges: true, payments: true }
        }
      }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'checked_in') {
      return res.status(400).json({ error: 'Booking is not checked in' });
    }

    if (!booking.folio) {
      return res.status(400).json({ error: 'No folio found for this booking' });
    }

    // Check folio balance
    const balance = booking.folio.balance;

    if (balance > 0 && !paymentAmount) {
      return res.status(400).json({
        error: `Outstanding balance of ${balance}. Please collect payment.`,
        balance
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Record final payment if any
      if (paymentAmount && paymentAmount > 0) {
        await tx.folioPayment.create({
          data: {
            folioId: booking.folio.id,
            amount: parseFloat(paymentAmount),
            paymentMethod: paymentMethod || 'cash',
            reference: paymentReference,
            receivedBy: req.user.id
          }
        });

        await tx.folio.update({
          where: { id: booking.folio.id },
          data: {
            paidAmount: { increment: parseFloat(paymentAmount) },
            balance: { decrement: parseFloat(paymentAmount) }
          }
        });
      }

      // Close folio
      await tx.folio.update({
        where: { id: booking.folio.id },
        data: {
          status: 'closed',
          closedAt: new Date()
        }
      });

      // Update booking
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 'checked_out',
          checkedOutAt: new Date(),
          checkedOutBy: req.user.id,
          paidAmount: booking.paidAmount + (parseFloat(paymentAmount) || 0)
        },
        include: {
          guest: true,
          rooms: { include: { room: true } },
          folio: true
        }
      });

      // Update room statuses and create housekeeping tasks
      for (const br of booking.rooms) {
        await tx.room.update({
          where: { id: br.roomId },
          data: {
            status: 'available',
            cleaningStatus: 'dirty'
          }
        });

        await tx.bookingRoom.update({
          where: { id: br.id },
          data: { status: 'checked_out' }
        });

        // Create housekeeping task
        await tx.housekeepingTask.create({
          data: {
            tenantId: req.user.tenantId,
            branchId: booking.branchId,
            roomId: br.roomId,
            taskType: 'checkout_clean',
            priority: 'high',
            createdBy: req.user.id
          }
        });
      }

      // Update guest stats
      await tx.guest.update({
        where: { id: booking.guestId },
        data: {
          totalStays: { increment: 1 },
          totalSpent: { increment: booking.folio.totalAmount },
          lastStayAt: new Date()
        }
      });

      return updatedBooking;
    });

    res.json(result);
  } catch (error) {
    console.error('Error checking out:', error);
    res.status(500).json({ error: 'Failed to check out' });
  }
});

// Cancel booking
router.post('/:id/cancel', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: { rooms: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'checked_in') {
      return res.status(400).json({ error: 'Cannot cancel a checked-in booking. Use check-out instead.' });
    }

    if (booking.status === 'checked_out' || booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Booking is already completed or cancelled' });
    }

    const result = await prisma.$transaction(async (tx) => {
      // Update booking
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: {
          status: 'cancelled',
          cancelledAt: new Date(),
          cancelReason: reason
        }
      });

      // Free up rooms
      await tx.room.updateMany({
        where: { id: { in: booking.rooms.map(br => br.roomId) } },
        data: { status: 'available' }
      });

      return updatedBooking;
    });

    res.json(result);
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({ error: 'Failed to cancel booking' });
  }
});

// Mark as no-show
router.post('/:id/no-show', authenticate, requireManager, async (req, res) => {
  try {
    const { id } = req.params;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: req.user.tenantId },
      include: { rooms: true }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status !== 'confirmed' && booking.status !== 'pending') {
      return res.status(400).json({ error: 'Can only mark pending/confirmed bookings as no-show' });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id },
        data: { status: 'no_show' }
      });

      await tx.room.updateMany({
        where: { id: { in: booking.rooms.map(br => br.roomId) } },
        data: { status: 'available' }
      });

      return updatedBooking;
    });

    res.json(result);
  } catch (error) {
    console.error('Error marking no-show:', error);
    res.status(500).json({ error: 'Failed to mark as no-show' });
  }
});

// Update booking
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const {
      checkInDate, checkOutDate, adultsCount, childrenCount,
      expectedArrival, specialRequests, internalNotes
    } = req.body;

    const booking = await prisma.booking.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!booking) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    if (booking.status === 'checked_out' || booking.status === 'cancelled') {
      return res.status(400).json({ error: 'Cannot modify a completed or cancelled booking' });
    }

    const updatedBooking = await prisma.booking.update({
      where: { id },
      data: {
        checkInDate: checkInDate ? new Date(checkInDate) : undefined,
        checkOutDate: checkOutDate ? new Date(checkOutDate) : undefined,
        adultsCount,
        childrenCount,
        expectedArrival,
        specialRequests,
        internalNotes
      },
      include: {
        guest: true,
        rooms: { include: { room: { include: { roomType: true } } } }
      }
    });

    res.json(updatedBooking);
  } catch (error) {
    console.error('Error updating booking:', error);
    res.status(500).json({ error: 'Failed to update booking' });
  }
});

module.exports = router;
