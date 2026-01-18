const express = require('express');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { validateSignup } = require('../middleware/validation');
const { signupLimiter } = require('../middleware/security');

const router = express.Router();
const prisma = new PrismaClient();

// Configure multer for logo uploads
const uploadsDir = path.join(__dirname, '..', '..', 'uploads', 'logos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'logo-' + uniqueSuffix + path.extname(file.originalname));
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

// POST /api/applications/signup - Submit new tenant application
router.post('/signup', signupLimiter, validateSignup, async (req, res) => {
  try {
    const {
      businessName,
      businessEmail,
      businessPhone,
      businessAddress,
      ownerFullName,
      ownerEmail,
      ownerPhone,
      password
    } = req.body;

    // Check if application with this email already exists
    const existingApplication = await prisma.tenantApplication.findUnique({
      where: { businessEmail }
    });

    if (existingApplication) {
      return res.status(400).json({
        error: 'An application with this business email already exists',
        applicationId: existingApplication.id,
        status: existingApplication.status
      });
    }

    // Check if a tenant with this business name already exists
    const existingTenant = await prisma.tenant.findUnique({
      where: { businessName }
    });

    if (existingTenant) {
      return res.status(400).json({
        error: 'A business with this name already exists'
      });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the application
    const application = await prisma.tenantApplication.create({
      data: {
        businessName,
        businessEmail,
        businessPhone,
        businessAddress,
        ownerFullName,
        ownerEmail,
        ownerPhone,
        password: hashedPassword
      }
    });

    res.status(201).json({
      message: 'Application submitted successfully',
      applicationId: application.id,
      status: application.status
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({ error: 'Failed to submit application' });
  }
});

// POST /api/applications/:id/upload-logo - Upload business logo
router.post('/:id/upload-logo', upload.single('logo'), async (req, res) => {
  try {
    const { id } = req.params;

    // Verify application exists and is pending
    const application = await prisma.tenantApplication.findUnique({
      where: { id }
    });

    if (!application) {
      // Delete uploaded file if application not found
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(404).json({ error: 'Application not found' });
    }

    if (application.status !== 'PENDING') {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(400).json({ error: 'Cannot upload logo for processed applications' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    // Delete old logo if exists
    if (application.businessLogo) {
      const oldPath = path.join(__dirname, '..', '..', application.businessLogo);
      if (fs.existsSync(oldPath)) {
        fs.unlinkSync(oldPath);
      }
    }

    // Update application with logo path
    const logoPath = '/uploads/logos/' + req.file.filename;
    await prisma.tenantApplication.update({
      where: { id },
      data: { businessLogo: logoPath }
    });

    res.json({
      message: 'Logo uploaded successfully',
      logoPath
    });
  } catch (error) {
    console.error('Logo upload error:', error);
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ error: 'Failed to upload logo' });
  }
});

// GET /api/applications/:id/status - Check application status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;

    const application = await prisma.tenantApplication.findUnique({
      where: { id },
      select: {
        id: true,
        businessName: true,
        businessEmail: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        reviewedAt: true
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'Application not found' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({ error: 'Failed to check application status' });
  }
});

// GET /api/applications/status-by-email - Check status by email
router.get('/status-by-email', async (req, res) => {
  try {
    const { email } = req.query;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    const application = await prisma.tenantApplication.findUnique({
      where: { businessEmail: email },
      select: {
        id: true,
        businessName: true,
        businessEmail: true,
        status: true,
        rejectionReason: true,
        createdAt: true,
        reviewedAt: true
      }
    });

    if (!application) {
      return res.status(404).json({ error: 'No application found with this email' });
    }

    res.json({ application });
  } catch (error) {
    console.error('Status check by email error:', error);
    res.status(500).json({ error: 'Failed to check application status' });
  }
});

module.exports = router;
