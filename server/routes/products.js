const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { validateCreateProduct } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Get all products (for current tenant, filtered by branch for managers)
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, category, lowStock, branchId } = req.query;

    const where = {
      tenantId: req.tenantId,
      isActive: true
    };

    // Branch filtering: Managers see only their branch, Owners can filter or see all
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    } else if (req.user.role === 'CASHIER' && req.branchId) {
      // Cashiers also see only their branch's products
      where.branchId = req.branchId;
    } else if (branchId) {
      // Owner/Admin filtering by specific branch
      where.branchId = branchId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { barcode: { equals: search } }
      ];
    }

    if (category) {
      where.category = category;
    }

    if (lowStock === 'true') {
      where.stockQuantity = { lte: prisma.raw('"lowStockThreshold"') };
    }

    const products = await prisma.product.findMany({
      where,
      include: {
        branch: {
          select: { id: true, name: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    res.json({ products });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get single product
router.get('/:id', authenticate, async (req, res) => {
  try {
    const where = {
      id: req.params.id,
      tenantId: req.tenantId
    };

    // Managers and Cashiers can only see their branch's products
    if ((req.user.role === 'MANAGER' || req.user.role === 'CASHIER') && req.branchId) {
      where.branchId = req.branchId;
    }

    const product = await prisma.product.findFirst({
      where,
      include: {
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ product });
  } catch (error) {
    console.error('Get product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Create product (Admin only)
router.post('/', authenticate, requireAdmin, validateCreateProduct, async (req, res) => {
  try {
    const { name, description, category, barcode, costPrice, sellingPrice, stockQuantity, lowStockThreshold, customCategory, expiryDate, branchId } = req.body;

    // Use provided branchId or fall back to user's branch
    const productBranchId = branchId || req.branchId || null;

    // Validate branch if provided
    if (productBranchId) {
      const branch = await prisma.branch.findFirst({
        where: { id: productBranchId, tenantId: req.tenantId }
      });
      if (!branch) {
        return res.status(400).json({ error: 'Invalid branch' });
      }
    }

    // For services, costPrice defaults to 0
    const productCategory = category || 'PRODUCT';
    const actualCostPrice = productCategory === 'SERVICE' ? (costPrice || 0) : (costPrice || 0);

    const product = await prisma.product.create({
      data: {
        name,
        description,
        category: productCategory,
        barcode,
        costPrice: actualCostPrice,
        sellingPrice,
        stockQuantity: stockQuantity || 0,
        lowStockThreshold: lowStockThreshold || 10,
        customCategory: customCategory || null,
        expiryDate: expiryDate ? new Date(expiryDate) : null,
        tenantId: req.tenantId,
        branchId: productBranchId
      },
      include: {
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    await logAudit(req.tenantId, req.user.id, 'product_created', `Created product: ${name}`, {
      productId: product.id,
      costPrice: actualCostPrice,
      sellingPrice,
      branchId: productBranchId
    }, productBranchId);

    res.status(201).json({ product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, costPrice, sellingPrice, stockQuantity, lowStockThreshold, isActive, customCategory, expiryDate, branchId } = req.body;

    const where = { id: req.params.id, tenantId: req.tenantId };

    // Managers can only update their branch's products
    if (req.user.role === 'MANAGER' && req.branchId) {
      where.branchId = req.branchId;
    }

    const existingProduct = await prisma.product.findFirst({ where });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Validate new branch if changing
    if (branchId !== undefined && branchId !== existingProduct.branchId) {
      // Only Owner/Admin can reassign products to different branches
      if (req.user.role === 'MANAGER') {
        return res.status(403).json({ error: 'Managers cannot reassign products to different branches' });
      }
      if (branchId) {
        const branch = await prisma.branch.findFirst({
          where: { id: branchId, tenantId: req.tenantId }
        });
        if (!branch) {
          return res.status(400).json({ error: 'Invalid branch' });
        }
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (costPrice !== undefined) updateData.costPrice = costPrice;
    if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice;
    if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (customCategory !== undefined) updateData.customCategory = customCategory || null;
    if (expiryDate !== undefined) updateData.expiryDate = expiryDate ? new Date(expiryDate) : null;
    if (branchId !== undefined && req.user.role !== 'MANAGER') updateData.branchId = branchId || null;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData,
      include: {
        branch: {
          select: { id: true, name: true }
        }
      }
    });

    await logAudit(req.tenantId, req.user.id, 'product_updated', `Updated product: ${existingProduct.name}`, {
      productId: product.id,
      changes: updateData,
      branchId: product.branchId
    }, product.branchId);

    res.json({ product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get low stock products (Admin only)
router.get('/inventory/low-stock', authenticate, requireAdmin, async (req, res) => {
  try {
    const { branchId } = req.query;

    // Determine branch filter
    const branchIdToUse = req.user.role === 'MANAGER' ? req.branchId : branchId;

    // Fetch all products and filter in JS (to compare stockQuantity with lowStockThreshold)
    const products = await prisma.product.findMany({
      where: {
        tenantId: req.tenantId,
        isActive: true,
        category: 'PRODUCT',
        ...(branchIdToUse && { branchId: branchIdToUse })
      },
      include: {
        branch: {
          select: { id: true, name: true }
        }
      },
      orderBy: { stockQuantity: 'asc' }
    });

    // Filter to only low stock items
    const lowStockProducts = products.filter(p => p.stockQuantity <= (p.lowStockThreshold || 10));

    res.json({ products: lowStockProducts });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
