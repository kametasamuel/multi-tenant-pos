const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set!');
  process.exit(1);
}

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
    req.branchId = user.branchId; // User's assigned branch
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

// Check if user has admin/manager role (ADMIN, OWNER, or MANAGER)
const requireAdmin = (req, res, next) => {
  const isSuperAdmin = req.user.isSuperAdmin === true;
  const allowedRoles = ['ADMIN', 'OWNER', 'MANAGER'];
  if (!allowedRoles.includes(req.user.role) && !isSuperAdmin) {
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

// Check if user is owner (OWNER or ADMIN role)
const requireOwner = (req, res, next) => {
  const isSuperAdmin = req.user.isSuperAdmin === true;
  const ownerRoles = ['OWNER', 'ADMIN'];
  if (!ownerRoles.includes(req.user.role) && !isSuperAdmin) {
    return res.status(403).json({ error: 'Owner access required' });
  }
  next();
};

// Check if user is manager or higher
const requireManager = (req, res, next) => {
  const isSuperAdmin = req.user.isSuperAdmin === true;
  const managerRoles = ['MANAGER', 'OWNER', 'ADMIN'];
  if (!managerRoles.includes(req.user.role) && !isSuperAdmin) {
    return res.status(403).json({ error: 'Manager access required' });
  }
  next();
};

// Log audit trail
const logAudit = async (tenantId, userId, action, description = null, metadata = null, branchId = null) => {
  try {
    await prisma.auditLog.create({
      data: {
        action,
        description,
        metadata: metadata ? JSON.stringify(metadata) : null,
        userId,
        tenantId,
        branchId
      }
    });
  } catch (error) {
    console.error('Failed to log audit:', error);
  }
};

module.exports = {
  authenticate,
  requireAdmin,
  requireOwner,
  requireManager,
  requireSuperAdmin,
  logAudit,
  JWT_SECRET
};
