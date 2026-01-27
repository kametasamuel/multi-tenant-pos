const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireManager } = require('../middleware/auth');

// ============================================
// FOLIOS (Guest Billing)
// ============================================

// Get all open folios
router.get('/open', authenticate, async (req, res) => {
  try {
    const { branchId } = req.query;

    const where = {
      tenantId: req.user.tenantId,
      status: 'open'
    };

    const folios = await prisma.folio.findMany({
      where,
      include: {
        booking: {
          include: {
            guest: { select: { firstName: true, lastName: true, vipStatus: true } },
            branch: { select: { name: true } }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Filter by branch if specified
    const filtered = branchId
      ? folios.filter(f => f.booking?.branchId === branchId)
      : folios;

    res.json(filtered);
  } catch (error) {
    console.error('Error fetching open folios:', error);
    res.status(500).json({ error: 'Failed to fetch open folios' });
  }
});

// Get single folio with details
router.get('/:id', authenticate, async (req, res) => {
  try {
    const folio = await prisma.folio.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId
      },
      include: {
        booking: {
          include: {
            guest: true,
            rooms: {
              include: {
                room: { include: { roomType: true } }
              }
            }
          }
        },
        charges: {
          where: { isVoided: false },
          orderBy: { chargeDate: 'desc' }
        },
        payments: {
          where: { isVoided: false },
          orderBy: { receivedAt: 'desc' }
        }
      }
    });

    if (!folio) {
      return res.status(404).json({ error: 'Folio not found' });
    }

    res.json(folio);
  } catch (error) {
    console.error('Error fetching folio:', error);
    res.status(500).json({ error: 'Failed to fetch folio' });
  }
});

// Get folio by booking
router.get('/booking/:bookingId', authenticate, async (req, res) => {
  try {
    const folio = await prisma.folio.findFirst({
      where: {
        bookingId: req.params.bookingId,
        tenantId: req.user.tenantId
      },
      include: {
        charges: {
          where: { isVoided: false },
          orderBy: { chargeDate: 'desc' }
        },
        payments: {
          where: { isVoided: false },
          orderBy: { receivedAt: 'desc' }
        }
      }
    });

    if (!folio) {
      return res.status(404).json({ error: 'Folio not found' });
    }

    res.json(folio);
  } catch (error) {
    console.error('Error fetching folio:', error);
    res.status(500).json({ error: 'Failed to fetch folio' });
  }
});

// ============================================
// FOLIO CHARGES
// ============================================

// Add charge to folio
router.post('/:id/charges', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { chargeType, description, quantity, unitPrice, roomNumber, reference } = req.body;

    if (!chargeType || !description || !unitPrice) {
      return res.status(400).json({ error: 'Charge type, description, and unit price are required' });
    }

    const folio = await prisma.folio.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!folio) {
      return res.status(404).json({ error: 'Folio not found' });
    }

    if (folio.status !== 'open') {
      return res.status(400).json({ error: 'Cannot add charges to a closed folio' });
    }

    const qty = parseInt(quantity) || 1;
    const price = parseFloat(unitPrice);
    const amount = qty * price;
    const taxRate = req.user.tenant?.taxRate || 0;
    const taxAmount = amount * taxRate;

    const charge = await prisma.folioCharge.create({
      data: {
        folioId: id,
        chargeType,
        description,
        quantity: qty,
        unitPrice: price,
        amount,
        taxAmount,
        roomNumber,
        reference,
        postedBy: req.user.id
      }
    });

    // Update folio totals
    await prisma.folio.update({
      where: { id },
      data: {
        subtotal: { increment: amount },
        taxAmount: { increment: taxAmount },
        totalAmount: { increment: amount + taxAmount },
        balance: { increment: amount + taxAmount }
      }
    });

    res.status(201).json(charge);
  } catch (error) {
    console.error('Error adding charge:', error);
    res.status(500).json({ error: 'Failed to add charge' });
  }
});

// Quick charge presets
router.post('/:id/charges/quick', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { type, roomNumber } = req.body; // type: "minibar", "laundry", "room_service", etc.

    const folio = await prisma.folio.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!folio || folio.status !== 'open') {
      return res.status(400).json({ error: 'Folio not found or closed' });
    }

    // Quick charge templates (these could be configurable per tenant)
    const templates = {
      minibar: { description: 'Minibar consumption', unitPrice: 50, chargeType: 'minibar' },
      laundry: { description: 'Laundry service', unitPrice: 30, chargeType: 'laundry' },
      parking: { description: 'Parking fee', unitPrice: 20, chargeType: 'parking' },
      breakfast: { description: 'Breakfast', unitPrice: 25, chargeType: 'restaurant' },
      late_checkout: { description: 'Late checkout fee', unitPrice: 50, chargeType: 'room' },
      extra_bed: { description: 'Extra bed', unitPrice: 40, chargeType: 'room' }
    };

    const template = templates[type];
    if (!template) {
      return res.status(400).json({ error: 'Invalid charge type', validTypes: Object.keys(templates) });
    }

    const taxRate = req.user.tenant?.taxRate || 0;
    const taxAmount = template.unitPrice * taxRate;

    const charge = await prisma.folioCharge.create({
      data: {
        folioId: id,
        chargeType: template.chargeType,
        description: template.description,
        quantity: 1,
        unitPrice: template.unitPrice,
        amount: template.unitPrice,
        taxAmount,
        roomNumber,
        postedBy: req.user.id
      }
    });

    await prisma.folio.update({
      where: { id },
      data: {
        subtotal: { increment: template.unitPrice },
        taxAmount: { increment: taxAmount },
        totalAmount: { increment: template.unitPrice + taxAmount },
        balance: { increment: template.unitPrice + taxAmount }
      }
    });

    res.status(201).json(charge);
  } catch (error) {
    console.error('Error adding quick charge:', error);
    res.status(500).json({ error: 'Failed to add charge' });
  }
});

// Void charge
router.post('/charges/:chargeId/void', authenticate, requireManager, async (req, res) => {
  try {
    const { chargeId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Void reason is required' });
    }

    const charge = await prisma.folioCharge.findUnique({
      where: { id: chargeId },
      include: { folio: true }
    });

    if (!charge) {
      return res.status(404).json({ error: 'Charge not found' });
    }

    if (charge.folio.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (charge.isVoided) {
      return res.status(400).json({ error: 'Charge is already voided' });
    }

    if (charge.folio.status !== 'open') {
      return res.status(400).json({ error: 'Cannot void charges on a closed folio' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.folioCharge.update({
        where: { id: chargeId },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidedBy: req.user.id,
          voidReason: reason
        }
      });

      await tx.folio.update({
        where: { id: charge.folioId },
        data: {
          subtotal: { decrement: charge.amount },
          taxAmount: { decrement: charge.taxAmount },
          totalAmount: { decrement: charge.amount + charge.taxAmount },
          balance: { decrement: charge.amount + charge.taxAmount }
        }
      });
    });

    res.json({ message: 'Charge voided successfully' });
  } catch (error) {
    console.error('Error voiding charge:', error);
    res.status(500).json({ error: 'Failed to void charge' });
  }
});

// ============================================
// FOLIO PAYMENTS
// ============================================

// Add payment to folio
router.post('/:id/payments', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, paymentMethod, reference, notes } = req.body;

    if (!amount || !paymentMethod) {
      return res.status(400).json({ error: 'Amount and payment method are required' });
    }

    const folio = await prisma.folio.findFirst({
      where: { id, tenantId: req.user.tenantId }
    });

    if (!folio) {
      return res.status(404).json({ error: 'Folio not found' });
    }

    if (folio.status !== 'open') {
      return res.status(400).json({ error: 'Cannot add payments to a closed folio' });
    }

    const paymentAmount = parseFloat(amount);

    const payment = await prisma.folioPayment.create({
      data: {
        folioId: id,
        amount: paymentAmount,
        paymentMethod,
        reference,
        notes,
        receivedBy: req.user.id
      }
    });

    // Update folio
    const newPaidAmount = folio.paidAmount + paymentAmount;
    const newBalance = folio.totalAmount - newPaidAmount;

    await prisma.folio.update({
      where: { id },
      data: {
        paidAmount: newPaidAmount,
        balance: newBalance
      }
    });

    // Also update booking paid amount
    if (folio.bookingId) {
      await prisma.booking.update({
        where: { id: folio.bookingId },
        data: { paidAmount: { increment: paymentAmount } }
      });
    }

    res.status(201).json({
      payment,
      folioBalance: newBalance
    });
  } catch (error) {
    console.error('Error adding payment:', error);
    res.status(500).json({ error: 'Failed to add payment' });
  }
});

// Void payment
router.post('/payments/:paymentId/void', authenticate, requireManager, async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { reason } = req.body;

    if (!reason) {
      return res.status(400).json({ error: 'Void reason is required' });
    }

    const payment = await prisma.folioPayment.findUnique({
      where: { id: paymentId },
      include: { folio: true }
    });

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    if (payment.folio.tenantId !== req.user.tenantId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (payment.isVoided) {
      return res.status(400).json({ error: 'Payment is already voided' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.folioPayment.update({
        where: { id: paymentId },
        data: {
          isVoided: true,
          voidedAt: new Date(),
          voidedBy: req.user.id,
          voidReason: reason
        }
      });

      await tx.folio.update({
        where: { id: payment.folioId },
        data: {
          paidAmount: { decrement: payment.amount },
          balance: { increment: payment.amount }
        }
      });

      // Also update booking
      if (payment.folio.bookingId) {
        await tx.booking.update({
          where: { id: payment.folio.bookingId },
          data: { paidAmount: { decrement: payment.amount } }
        });
      }
    });

    res.json({ message: 'Payment voided successfully' });
  } catch (error) {
    console.error('Error voiding payment:', error);
    res.status(500).json({ error: 'Failed to void payment' });
  }
});

// ============================================
// FOLIO OPERATIONS
// ============================================

// Transfer charges between folios
router.post('/transfer', authenticate, requireManager, async (req, res) => {
  try {
    const { sourceChargeIds, targetFolioId } = req.body;

    if (!sourceChargeIds || !sourceChargeIds.length || !targetFolioId) {
      return res.status(400).json({ error: 'Source charge IDs and target folio ID are required' });
    }

    const targetFolio = await prisma.folio.findFirst({
      where: { id: targetFolioId, tenantId: req.user.tenantId, status: 'open' }
    });

    if (!targetFolio) {
      return res.status(404).json({ error: 'Target folio not found or closed' });
    }

    const charges = await prisma.folioCharge.findMany({
      where: {
        id: { in: sourceChargeIds },
        isVoided: false
      },
      include: { folio: true }
    });

    if (charges.length === 0) {
      return res.status(404).json({ error: 'No valid charges found' });
    }

    // Verify all charges belong to same tenant
    if (charges.some(c => c.folio.tenantId !== req.user.tenantId)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    await prisma.$transaction(async (tx) => {
      let totalAmount = 0;
      let totalTax = 0;

      for (const charge of charges) {
        // Update source folio
        await tx.folio.update({
          where: { id: charge.folioId },
          data: {
            subtotal: { decrement: charge.amount },
            taxAmount: { decrement: charge.taxAmount },
            totalAmount: { decrement: charge.amount + charge.taxAmount },
            balance: { decrement: charge.amount + charge.taxAmount }
          }
        });

        // Move charge to target folio
        await tx.folioCharge.update({
          where: { id: charge.id },
          data: { folioId: targetFolioId }
        });

        totalAmount += charge.amount;
        totalTax += charge.taxAmount;
      }

      // Update target folio
      await tx.folio.update({
        where: { id: targetFolioId },
        data: {
          subtotal: { increment: totalAmount },
          taxAmount: { increment: totalTax },
          totalAmount: { increment: totalAmount + totalTax },
          balance: { increment: totalAmount + totalTax }
        }
      });
    });

    res.json({ message: `${charges.length} charges transferred successfully` });
  } catch (error) {
    console.error('Error transferring charges:', error);
    res.status(500).json({ error: 'Failed to transfer charges' });
  }
});

// Print/export folio
router.get('/:id/print', authenticate, async (req, res) => {
  try {
    const folio = await prisma.folio.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.user.tenantId
      },
      include: {
        booking: {
          include: {
            guest: true,
            rooms: {
              include: {
                room: { include: { roomType: true } }
              }
            },
            branch: true
          }
        },
        charges: {
          where: { isVoided: false },
          orderBy: { chargeDate: 'asc' }
        },
        payments: {
          where: { isVoided: false },
          orderBy: { receivedAt: 'asc' }
        }
      }
    });

    if (!folio) {
      return res.status(404).json({ error: 'Folio not found' });
    }

    // Format for printing
    const printData = {
      folioNumber: folio.folioNumber,
      guestName: folio.guestName,
      roomNumber: folio.roomNumber,
      checkIn: folio.booking?.checkInDate,
      checkOut: folio.booking?.checkOutDate,
      charges: folio.charges.map(c => ({
        date: c.chargeDate,
        description: c.description,
        quantity: c.quantity,
        unitPrice: c.unitPrice,
        amount: c.amount,
        tax: c.taxAmount
      })),
      payments: folio.payments.map(p => ({
        date: p.receivedAt,
        method: p.paymentMethod,
        amount: p.amount,
        reference: p.reference
      })),
      subtotal: folio.subtotal,
      tax: folio.taxAmount,
      total: folio.totalAmount,
      paid: folio.paidAmount,
      balance: folio.balance,
      status: folio.status
    };

    res.json(printData);
  } catch (error) {
    console.error('Error fetching folio for print:', error);
    res.status(500).json({ error: 'Failed to fetch folio' });
  }
});

module.exports = router;
