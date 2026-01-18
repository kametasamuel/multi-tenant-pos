const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Verify JWT token and attach user to request
const authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1]; // Bearer TOKEN
    
    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Fetch user from database to ensure they still exist and are active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      include: { tenant: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Super admin bypasses tenant checks
    // Handle case where isSuperAdmin field might not exist (before migration)
    const isSuperAdmin = user.isSuperAdmin === true;
    if (!isSuperAdmin) {
      // Check if tenant subscription is valid
      if (user.tenant && user.tenant.subscriptionEnd < new Date()) {
        return res.status(403).json({ 
          error: 'Subscription expired. Please renew to continue using the system.' 
        });
      }

      if (user.tenant && !user.tenant.isActive) {
        return res.status(403).json({ error: 'Tenant account is inactive' });
      }
    }

    req.user = user;
    req.tenantId = user.tenantId;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Check if user has admin role
const requireAdmin = (req, res, next) => {
  const isSuperAdmin = req.user.isSuperAdmin === true;
  if (req.user.role !== 'ADMIN' && !isSuperAdmin) {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
};

// Check if user is super admin
const requireSuperAdmin = (req, res, next) => {
  if (req.user.isSuperAdmin !== true) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  next();
};

// Log audit trail
const logAudit = async (tenantId, userId, action, description = null, metadata = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        userId,
        tenantId
      }
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requireSuperAdmin,
  logAudit,
  JWT_SECRET
};
