const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, logAudit } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Search customers (autocomplete)
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;

    if (!q || q.length < 2) {
      return res.json({ customers: [] });
    }

    const customers = await prisma.customer.findMany({
      where: {
        tenantId: req.tenantId,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q } }
        ]
      },
      take: parseInt(limit),
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        totalSpent: true,
        visitCount: true,
        lastVisit: true
      }
    });

    res.json({ customers });
  } catch (error) {
    console.error('Search customers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all customers
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, page = 1, limit = 20 } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    const where = { tenantId: req.tenantId };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { email: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [customers, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        skip,
        take: parseInt(limit),
        orderBy: { name: 'asc' },
        include: {
          _count: { select: { sales: true } }
        }
      }),
      prisma.customer.count({ where })
    ]);

    res.json({
      customers,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single customer
router.get('/:id', authenticate, async (req, res) => {
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      },
      include: {
        sales: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            transactionNumber: true,
            finalAmount: true,
            createdAt: true,
            paymentMethod: true
          }
        }
      }
    });

    if (!customer) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    res.json({ customer });
  } catch (error) {
    console.error('Get customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create customer
router.post('/', authenticate, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;

    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Customer name is required' });
    }

    // Check for duplicate phone within tenant
    if (phone) {
      const existing = await prisma.customer.findFirst({
        where: {
          tenantId: req.tenantId,
          phone: phone
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'Customer with this phone number already exists' });
      }
    }

    const customer = await prisma.customer.create({
      data: {
        name: name.trim(),
        phone: phone?.trim() || null,
        email: email?.trim() || null,
        address: address?.trim() || null,
        notes: notes?.trim() || null,
        tenantId: req.tenantId
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'customer_created',
      `Created customer: ${name}`,
      { customerId: customer.id }
    );

    res.status(201).json({ customer });
  } catch (error) {
    console.error('Create customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update customer
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { name, phone, email, address, notes } = req.body;

    const existing = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    // Check for duplicate phone if changing
    if (phone && phone !== existing.phone) {
      const duplicate = await prisma.customer.findFirst({
        where: {
          tenantId: req.tenantId,
          phone: phone,
          id: { not: req.params.id }
        }
      });

      if (duplicate) {
        return res.status(400).json({ error: 'Customer with this phone number already exists' });
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name.trim();
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (address !== undefined) updateData.address = address?.trim() || null;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    const customer = await prisma.customer.update({
      where: { id: req.params.id },
      data: updateData
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'customer_updated',
      `Updated customer: ${existing.name}`,
      { customerId: customer.id, changes: updateData }
    );

    res.json({ customer });
  } catch (error) {
    console.error('Update customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Delete customer
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const existing = await prisma.customer.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!existing) {
      return res.status(404).json({ error: 'Customer not found' });
    }

    await prisma.customer.delete({
      where: { id: req.params.id }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'customer_deleted',
      `Deleted customer: ${existing.name}`,
      { customerId: existing.id }
    );

    res.json({ message: 'Customer deleted successfully' });
  } catch (error) {
    console.error('Delete customer error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
