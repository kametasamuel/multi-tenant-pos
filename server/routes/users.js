const express = require('express');
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { validateCreateUser } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for user profile image uploads
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'profiles');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  }
});

// Get all users (Admin only - Managers see only their branch)
router.get('/', authenticate, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 50, role, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const take = Math.min(parseInt(limit), 100); // Max 100 per page

    const where = {
      tenantId: req.tenantId
    };

    // Managers can only see users from their own branch
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    }

    // Filter by role if provided
    if (role) {
      where.role = role;
    }

    // Search by username or fullName
    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: {
          id: true,
          username: true,
          fullName: true,
          profileImage: true,
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
        orderBy: { createdAt: 'desc' },
        skip,
        take
      }),
      prisma.user.count({ where })
    ]);

    res.json({
      users,
      pagination: {
        page: parseInt(page),
        limit: take,
        total,
        totalPages: Math.ceil(total / take)
      }
    });
  } catch (error) {
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
        profileImage: true,
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
        profileImage: true,
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

// Upload profile image (Admin/Manager)
router.post('/:id/upload-image', authenticate, requireAdmin, upload.single('image'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify user exists and belongs to tenant
    const user = await prisma.user.findFirst({
      where: {
        id,
        tenantId: req.tenantId
      }
    });

    if (!user) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'User not found' });
    }

    // Managers can only upload for cashiers in their branch
    if (req.user.role === 'MANAGER') {
      if (user.role !== 'CASHIER' || user.branchId !== req.branchId) {
        if (req.file) {
          fs.unlinkSync(req.file.path);
        }
        return res.status(403).json({ error: 'You can only update images for cashiers in your branch' });
      }
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old profile image if exists
    if (user.profileImage) {
      const oldPath = path.join(__dirname, '..', '..', user.profileImage);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Failed to delete old profile image:', e);
        }
      }
    }

    // Update user with new image path
    const imagePath = '/uploads/profiles/' + req.file.filename;
    const updatedUser = await prisma.user.update({
      where: { id },
      data: { profileImage: imagePath },
      select: {
        id: true,
        username: true,
        fullName: true,
        profileImage: true,
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

    await logAudit(req.tenantId, req.user.id, 'user_image_uploaded', `Uploaded profile image for user: ${user.username}`, {
      userId: id
    });

    res.json({
      message: 'Profile image uploaded successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

// Delete profile image (Admin/Manager)
router.delete('/:id/image', authenticate, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        id,
        tenantId: req.tenantId
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Managers can only delete for cashiers in their branch
    if (req.user.role === 'MANAGER') {
      if (user.role !== 'CASHIER' || user.branchId !== req.branchId) {
        return res.status(403).json({ error: 'You can only update images for cashiers in your branch' });
      }
    }

    if (!user.profileImage) {
      return res.status(400).json({ error: 'User has no profile image' });
    }

    // Delete the file
    const imagePath = path.join(__dirname, '..', '..', user.profileImage);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    // Update user
    await prisma.user.update({
      where: { id },
      data: { profileImage: null }
    });

    await logAudit(req.tenantId, req.user.id, 'user_image_deleted', `Deleted profile image for user: ${user.username}`, {
      userId: id
    });

    res.json({ message: 'Profile image deleted successfully' });
  } catch (error) {
    console.error('Delete profile image error:', error);
    res.status(500).json({ error: 'Failed to delete profile image' });
  }
});

// ==========================================
// PROFILE ROUTES (Self-service)
// ==========================================

// Get current user's profile
router.get('/me/profile', authenticate, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        profileImage: true,
        role: true,
        isActive: true,
        createdAt: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true
          }
        },
        tenant: {
          select: {
            id: true,
            businessName: true,
            slug: true
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update current user's profile
router.put('/me/profile', authenticate, async (req, res) => {
  try {
    const { fullName, username, email, phone, currentPassword, newPassword } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get current user
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const updateData = {};
    const isSuperAdmin = user.isSuperAdmin;
    const canEditAllFields = userRole === 'OWNER' || userRole === 'ADMIN' || isSuperAdmin;

    // Update fullName if provided - Only OWNER/ADMIN/SuperAdmin can change fullName
    if (fullName && fullName.trim()) {
      if (canEditAllFields) {
        updateData.fullName = fullName.trim();
      }
      // Manager/Cashier cannot change fullName - silently ignore
    }

    // Update username if provided (check for uniqueness)
    if (username && username.trim() && username !== user.username) {
      // For SuperAdmin, check globally; for others, check within tenant
      const whereClause = isSuperAdmin
        ? { username: username.trim(), NOT: { id: userId } }
        : { tenantId: req.tenantId, username: username.trim(), NOT: { id: userId } };

      const existingUser = await prisma.user.findFirst({ where: whereClause });

      if (existingUser) {
        return res.status(400).json({ error: 'Username already taken' });
      }

      updateData.username = username.trim();
    }

    // Update email and phone - Only OWNER/ADMIN/SuperAdmin can change these
    if (canEditAllFields) {
      if (email !== undefined) {
        updateData.email = email ? email.trim() : null;
      }
      if (phone !== undefined) {
        updateData.phone = phone ? phone.trim() : null;
      }
    }

    // Handle password change
    if (newPassword) {
      // Require current password for password change
      if (!currentPassword) {
        return res.status(400).json({ error: 'Current password is required to change password' });
      }

      // Verify current password
      const isValidPassword = await bcrypt.compare(currentPassword, user.password);
      if (!isValidPassword) {
        return res.status(400).json({ error: 'Current password is incorrect' });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters' });
      }

      updateData.password = await bcrypt.hash(newPassword, 10);
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ error: 'No changes provided' });
    }

    // Update user
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: updateData,
      select: {
        id: true,
        username: true,
        fullName: true,
        email: true,
        phone: true,
        profileImage: true,
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

    await logAudit(req.tenantId, userId, 'profile_updated', `User updated their profile`, {
      changes: Object.keys(updateData).filter(k => k !== 'password')
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Upload own profile image
router.post('/me/upload-image', authenticate, upload.single('image'), async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'User not found' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old profile image if exists
    if (user.profileImage) {
      const oldPath = path.join(__dirname, '..', '..', user.profileImage);
      if (fs.existsSync(oldPath)) {
        try {
          fs.unlinkSync(oldPath);
        } catch (e) {
          console.error('Failed to delete old image:', e);
        }
      }
    }

    // Store relative path
    const profileImagePath = '/uploads/profiles/' + req.file.filename;

    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: { profileImage: profileImagePath },
      select: {
        id: true,
        username: true,
        fullName: true,
        profileImage: true,
        role: true,
        isActive: true
      }
    });

    await logAudit(req.tenantId, userId, 'profile_image_updated', `User updated their profile image`, {});

    res.json({
      message: 'Profile image uploaded successfully',
      user: updatedUser
    });
  } catch (error) {
    console.error('Profile image upload error:', error);
    if (req.file) {
      try {
        fs.unlinkSync(req.file.path);
      } catch (e) {}
    }
    res.status(500).json({ error: 'Failed to upload profile image' });
  }
});

// Delete own profile image
router.delete('/me/image', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (!user.profileImage) {
      return res.status(400).json({ error: 'No profile image to delete' });
    }

    // Delete the file
    const imagePath = path.join(__dirname, '..', '..', user.profileImage);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await prisma.user.update({
      where: { id: userId },
      data: { profileImage: null }
    });

    await logAudit(req.tenantId, userId, 'profile_image_deleted', `User deleted their profile image`, {});

    res.json({ message: 'Profile image deleted successfully' });
  } catch (error) {
    console.error('Delete profile image error:', error);
    res.status(500).json({ error: 'Failed to delete profile image' });
  }
});

module.exports = router;
