const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const { validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// Login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password } = req.body;

    // Find all users by username (case-insensitive search across all tenants)
    // Multiple tenants can have users with the same username
    const users = await prisma.user.findMany({
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        }
      },
      include: {
        tenant: true
      },
      orderBy: {
        isSuperAdmin: 'desc' // Check super admin first
      }
    });

    if (users.length === 0) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Try to find a user with matching password
    let user = null;
    for (const u of users) {
      const isValidPassword = await bcrypt.compare(password, u.password);
      if (isValidPassword) {
        user = u;
        break;
      }
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ error: 'Account is inactive' });
    }

    // Super admin bypasses subscription checks
    // Handle case where isSuperAdmin field might not exist (before migration)
    const isSuperAdmin = user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      // Check subscription
      if (user.tenant && user.tenant.subscriptionEnd < new Date()) {
        return res.status(403).json({
          error: 'Subscription expired. Please renew to continue using the system.'
        });
      }
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user.id, 
        tenantId: user.tenantId,
        role: user.role,
        username: user.username,
        isSuperAdmin: isSuperAdmin
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'user_login',
        description: `User ${user.username} logged in`,
        userId: user.id,
        tenantId: user.tenantId
      }
    });

    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        fullName: user.fullName,
        role: user.role,
        tenantId: user.tenantId,
        tenantName: user.tenant?.businessName || 'Super Admin',
        isSuperAdmin: isSuperAdmin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    res.status(500).json({ 
      error: 'Internal server error',
      message: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        tenantId: true,
        tenant: {
          select: {
            businessName: true,
            businessLogo: true,
            subscriptionEnd: true,
            currencySymbol: true
          }
        },
        isSuperAdmin: true
      }
    });

    res.json({ user: {
      ...user,
      tenantName: user.tenant?.businessName || 'Super Admin',
      currencySymbol: user.tenant?.currencySymbol || '$'
    } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
