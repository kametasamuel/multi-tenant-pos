const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Get current tenant info
router.get('/current', authenticate, async (req, res) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: {
        id: true,
        businessName: true,
        businessLogo: true,
        subscriptionStart: true,
        subscriptionEnd: true,
        isActive: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    res.json({ tenant });
  } catch (error) {
    console.error('Get tenant error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update subscription (Admin only - typically done by super admin)
router.put('/subscription', authenticate, requireAdmin, async (req, res) => {
  try {
    const { subscriptionEnd } = req.body;

    if (!subscriptionEnd) {
      return res.status(400).json({ error: 'Subscription end date is required' });
    }

    const tenant = await prisma.tenant.update({
      where: { id: req.tenantId },
      data: {
        subscriptionEnd: new Date(subscriptionEnd)
      }
    });

    res.json({ tenant });
  } catch (error) {
    console.error('Update subscription error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
