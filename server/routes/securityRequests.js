const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Create a security request (Cashier or Manager)
router.post('/', authenticate, async (req, res) => {
  try {
    const { type, reason, saleId, itemName, amount } = req.body;

    if (!type || !reason || !itemName) {
      return res.status(400).json({ error: 'Type, reason, and item name are required' });
    }

    if (!['VOID', 'REVIEW'].includes(type)) {
      return res.status(400).json({ error: 'Invalid request type' });
    }

    // If it's a void request with a saleId, validate the sale exists
    if (saleId) {
      const sale = await prisma.sale.findFirst({
        where: { id: saleId, tenantId: req.tenantId }
      });
      if (!sale) {
        return res.status(404).json({ error: 'Sale not found' });
      }
    }

    const securityRequest = await prisma.securityRequest.create({
      data: {
        type,
        reason,
        saleId: saleId || null,
        itemName,
        amount: amount || 0,
        requesterId: req.user.id,
        tenantId: req.tenantId,
        branchId: req.branchId || null // Tag with user's branch
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });

    await logAudit(req.tenantId, req.user.id, 'security_request_created', `Created ${type} request for: ${itemName}`, {
      requestId: securityRequest.id,
      type,
      amount,
      branchId: req.branchId
    }, req.branchId);

    res.status(201).json({ securityRequest });
  } catch (error) {
    console.error('Create security request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all security requests for tenant (Managers see branch, Owners see all, Cashiers see own)
router.get('/', authenticate, async (req, res) => {
  try {
    const { status, type, branchId, startDate, endDate } = req.query;

    const where = {
      tenantId: req.tenantId
    };

    // Cashiers can only see their own requests
    // Managers see only their branch's requests
    // Owners/Admins see all or can filter by branch
    if (req.user.role === 'CASHIER') {
      where.requesterId = req.user.id;
    } else if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    } else if (branchId) {
      // Owner/Admin filtering by specific branch
      where.branchId = branchId;
    }

    if (status) {
      where.status = status;
    }

    if (type) {
      where.type = type;
    }

    // Date filtering
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        // Set end of day for endDate
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        where.createdAt.lte = end;
      }
    }

    const securityRequests = await prisma.securityRequest.findMany({
      where,
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            username: true,
            branchId: true
          }
        },
        reviewer: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        sale: {
          select: {
            id: true,
            transactionNumber: true,
            finalAmount: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ securityRequests });
  } catch (error) {
    console.error('Get security requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single security request
router.get('/:id', authenticate, async (req, res) => {
  try {
    const where = {
      id: req.params.id,
      tenantId: req.tenantId
    };

    // Cashiers can only see their own requests
    if (req.user.role === 'CASHIER') {
      where.requesterId = req.user.id;
    } else if (req.user.role === 'MANAGER' && req.branchId) {
      // Managers can only see their branch's requests
      where.branchId = req.branchId;
    }

    const securityRequest = await prisma.securityRequest.findFirst({
      where,
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        reviewer: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        sale: {
          include: {
            items: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!securityRequest) {
      return res.status(404).json({ error: 'Security request not found' });
    }

    res.json({ securityRequest });
  } catch (error) {
    console.error('Get security request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Approve security request (Manager/Admin only)
router.post('/:id/approve', authenticate, requireAdmin, async (req, res) => {
  try {
    const requestWhere = {
      id: req.params.id,
      tenantId: req.tenantId,
      status: 'PENDING'
    };

    // Managers can only approve their branch's requests
    if (req.user.role === 'MANAGER' && req.branchId) {
      requestWhere.branchId = req.branchId;
    }

    const securityRequest = await prisma.securityRequest.findFirst({
      where: requestWhere,
      include: {
        sale: {
          include: {
            items: true
          }
        }
      }
    });

    if (!securityRequest) {
      return res.status(404).json({ error: 'Pending security request not found' });
    }

    // If it's a void request with a sale, void the sale and restore stock
    if (securityRequest.type === 'VOID' && securityRequest.sale) {
      await prisma.$transaction(async (tx) => {
        // Restore product stock
        for (const item of securityRequest.sale.items) {
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

        // Update sale status to voided with tracking info
        await tx.sale.update({
          where: { id: securityRequest.sale.id },
          data: {
            paymentStatus: 'voided',
            voidedById: req.user.id,
            voidedAt: new Date(),
            voidReason: securityRequest.reason
          }
        });

        // Update the security request
        await tx.securityRequest.update({
          where: { id: securityRequest.id },
          data: {
            status: 'APPROVED',
            reviewerId: req.user.id,
            reviewedAt: new Date()
          }
        });
      });
    } else {
      // Just approve the request (for review requests)
      await prisma.securityRequest.update({
        where: { id: securityRequest.id },
        data: {
          status: 'APPROVED',
          reviewerId: req.user.id,
          reviewedAt: new Date()
        }
      });
    }

    await logAudit(req.tenantId, req.user.id, 'security_request_approved', `Approved ${securityRequest.type} request for: ${securityRequest.itemName}`, {
      requestId: securityRequest.id,
      type: securityRequest.type,
      saleId: securityRequest.saleId,
      branchId: securityRequest.branchId
    }, securityRequest.branchId);

    const updatedRequest = await prisma.securityRequest.findFirst({
      where: { id: req.params.id },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        reviewer: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });

    res.json({ securityRequest: updatedRequest, message: 'Request approved successfully' });
  } catch (error) {
    console.error('Approve security request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reject security request (Manager/Admin only)
router.post('/:id/reject', authenticate, requireAdmin, async (req, res) => {
  try {
    const requestWhere = {
      id: req.params.id,
      tenantId: req.tenantId,
      status: 'PENDING'
    };

    // Managers can only reject their branch's requests
    if (req.user.role === 'MANAGER' && req.branchId) {
      requestWhere.branchId = req.branchId;
    }

    const securityRequest = await prisma.securityRequest.findFirst({
      where: requestWhere
    });

    if (!securityRequest) {
      return res.status(404).json({ error: 'Pending security request not found' });
    }

    const updatedRequest = await prisma.securityRequest.update({
      where: { id: securityRequest.id },
      data: {
        status: 'REJECTED',
        reviewerId: req.user.id,
        reviewedAt: new Date()
      },
      include: {
        requester: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        },
        reviewer: {
          select: {
            id: true,
            fullName: true,
            username: true
          }
        }
      }
    });

    await logAudit(req.tenantId, req.user.id, 'security_request_rejected', `Rejected ${securityRequest.type} request for: ${securityRequest.itemName}`, {
      requestId: securityRequest.id,
      type: securityRequest.type,
      branchId: securityRequest.branchId
    }, securityRequest.branchId);

    res.json({ securityRequest: updatedRequest, message: 'Request rejected successfully' });
  } catch (error) {
    console.error('Reject security request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
