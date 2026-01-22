const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { validateCreateUser } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Get all users (Admin only - Managers see only their branch)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const where = {
      tenantId: req.tenantId
    };

    // Managers can only see users from their own branch
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        createdAt: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({ users });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create user (Admin/Manager - Managers can only create CASHIER role)
router.post('/', authenticate, requireAdmin, validateCreateUser, async (req, res) => {
  try {
    const { username, password, fullName, role, branchId } = req.body;

    // Managers can only create CASHIER role
    if (req.user.role === 'MANAGER') {
      if (role !== 'CASHIER') {
        return res.status(403).json({ error: 'Managers can only create cashier accounts' });
      }
    }

    // Check if username already exists for this tenant
    const existingUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive'
        },
        tenantId: req.tenantId
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username already exists in this business' });
    }

    // Determine branch assignment
    let assignedBranchId;
    if (req.user.role === 'MANAGER') {
      // Managers: auto-assign to their own branch
      assignedBranchId = req.branchId;
    } else {
      // Owner/Admin: use provided branchId or their own branch
      assignedBranchId = branchId || req.branchId || null;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        username,
        password: hashedPassword,
        fullName,
        role,
        branchId: assignedBranchId,
        tenantId: req.tenantId
      },
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true
          }
        }
      }
    });

    await logAudit(req.tenantId, req.user.id, 'user_created', `Created user: ${username} (${role})`, {
      userId: user.id,
      role,
      branchId: assignedBranchId
    }, assignedBranchId);

    res.status(201).json({ user });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update user (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { fullName, role, isActive, password } = req.body;

    const user = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    if (fullName !== undefined) updateData.fullName = fullName;
    if (role !== undefined) updateData.role = role;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (password !== undefined) {
      updateData.password = await bcrypt.hash(password, 10);
    }

    const updatedUser = await prisma.user.update({
      where: { id: req.params.id },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        role: true,
        isActive: true
      }
    });

    await logAudit(req.tenantId, req.user.id, 'user_updated', `Updated user: ${user.username}`, {
      userId: user.id,
      changes: Object.keys(updateData)
    });

    res.json({ user: updatedUser });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Reset password (Admin only)
router.post('/:id/reset-password', authenticate, requireAdmin, async (req, res) => {
  try {
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const user = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    await prisma.user.update({
      where: { id: req.params.id },
      data: { password: hashedPassword }
    });

    await logAudit(req.tenantId, req.user.id, 'password_reset', `Reset password for user: ${user.username}`, {
      userId: user.id
    });

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
