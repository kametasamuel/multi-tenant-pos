const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { PrismaClient } = require('@prisma/client');
const { validateLogin } = require('../middleware/validation');
const { authenticate } = require('../middleware/auth');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();
const prisma = new PrismaClient();

// In-memory store for password reset tokens (in production, use Redis or database)
const passwordResetTokens = new Map();

// Get tenant by slug (public - for displaying tenant info on login page)
router.get('/tenant/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // Check for admin route
    if (slug === 'admin') {
      return res.json({
        tenant: {
          id: 'super-admin',
          slug: 'admin',
          businessName: 'Smart POS Admin',
          businessLogo: null,
          isSuperAdmin: true
        }
      });
    }

    const tenant = await prisma.tenant.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        businessName: true,
        businessLogo: true,
        isActive: true,
        subscriptionEnd: true
      }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Business not found' });
    }

    if (!tenant.isActive) {
      return res.status(403).json({ error: 'This business account has been deactivated' });
    }

    if (tenant.subscriptionEnd < new Date()) {
      return res.status(403).json({ error: 'This business subscription has expired' });
    }

    res.json({
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        businessName: tenant.businessName,
        businessLogo: tenant.businessLogo
      }
    });
  } catch (error) {
    console.error('Get tenant by slug error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Login
router.post('/login', validateLogin, async (req, res) => {
  try {
    const { username, password, tenantSlug } = req.body;

    // Build the user query
    const userQuery = {
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        }
      },
      include: {
        tenant: true,
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: {
        isSuperAdmin: 'desc' // Check super admin first
      }
    };

    // If tenantSlug is provided, restrict to that tenant (unless it's 'admin' for super admin)
    if (tenantSlug && tenantSlug !== 'admin') {
      // Find the tenant by slug
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });

      if (!tenant) {
        return res.status(401).json({ error: 'Invalid business or credentials' });
      }

      // Add tenant filter to query
      userQuery.where.tenantId = tenant.id;
    } else if (tenantSlug === 'admin') {
      // Only look for super admins
      userQuery.where.isSuperAdmin = true;
    }

    // Find users by username
    const users = await prisma.user.findMany(userQuery);

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
        tenantId: user.tenantId,
        branchId: user.branchId
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
        tenantSlug: user.tenant?.slug || (isSuperAdmin ? 'admin' : null),
        isSuperAdmin: isSuperAdmin,
        currency: user.tenant?.currency || 'USD',
        currencySymbol: user.tenant?.currencySymbol || '$',
        taxRate: user.tenant?.taxRate || 0,
        branchId: user.branchId,
        branchName: user.branch?.name || null
      }
    });
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
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
        branchId: true,
        tenant: {
          select: {
            businessName: true,
            businessLogo: true,
            slug: true,
            subscriptionEnd: true,
            currency: true,
            currencySymbol: true,
            taxRate: true
          }
        },
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        isSuperAdmin: true
      }
    });

    res.json({ user: {
      ...user,
      tenantName: user.tenant?.businessName || 'Super Admin',
      tenantSlug: user.tenant?.slug || (user.isSuperAdmin ? 'admin' : null),
      currency: user.tenant?.currency || 'USD',
      currencySymbol: user.tenant?.currencySymbol || '$',
      taxRate: user.tenant?.taxRate || 0,
      branchId: user.branchId,
      branchName: user.branch?.name || null
    } });
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Request password reset (for Owner/SuperAdmin only)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email, tenantSlug } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email
    let user = null;

    if (tenantSlug) {
      // For tenant users - find Owner/Admin with this email
      const tenant = await prisma.tenant.findUnique({
        where: { slug: tenantSlug }
      });

      if (tenant) {
        user = await prisma.user.findFirst({
          where: {
            email: email.toLowerCase(),
            tenantId: tenant.id,
            role: { in: ['OWNER', 'ADMIN'] },
            isActive: true
          },
          include: {
            tenant: {
              select: {
                businessName: true,
                slug: true
              }
            }
          }
        });
      }
    } else {
      // For super admin
      user = await prisma.user.findFirst({
        where: {
          email: email.toLowerCase(),
          isSuperAdmin: true,
          isActive: true
        }
      });
    }

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenExpiry = Date.now() + 3600000; // 1 hour

    // Store token
    passwordResetTokens.set(resetToken, {
      userId: user.id,
      email: user.email,
      expiry: tokenExpiry
    });

    // Clean up expired tokens periodically
    for (const [token, data] of passwordResetTokens.entries()) {
      if (data.expiry < Date.now()) {
        passwordResetTokens.delete(token);
      }
    }

    // Generate reset URL for email
    const resetUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    // TODO: Send actual email when email service is configured
    // await sendPasswordResetEmail(user.email, user.fullName, resetUrl);
    // For development only - remove in production
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] Password reset URL: ${resetUrl}`);
    }

    res.json({
      message: 'If an account exists with this email, a password reset link has been sent.'
    });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password with token
router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body;

    if (!token || !newPassword) {
      return res.status(400).json({ error: 'Token and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Verify token
    const tokenData = passwordResetTokens.get(token);
    if (!tokenData) {
      return res.status(400).json({ error: 'Invalid or expired reset token' });
    }

    if (tokenData.expiry < Date.now()) {
      passwordResetTokens.delete(token);
      return res.status(400).json({ error: 'Reset token has expired' });
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update user password
    await prisma.user.update({
      where: { id: tokenData.userId },
      data: { password: hashedPassword }
    });

    // Invalidate the token
    passwordResetTokens.delete(token);

    // Log the password reset
    const user = await prisma.user.findUnique({
      where: { id: tokenData.userId }
    });

    if (user && user.tenantId) {
      await prisma.auditLog.create({
        data: {
          action: 'password_reset',
          description: `Password reset via email for user: ${user.username}`,
          userId: user.id,
          tenantId: user.tenantId
        }
      });
    }

    res.json({ message: 'Password has been reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
