const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { validateCreateProduct } = require('../middleware/validation');

const router = express.Router();
const prisma = new PrismaClient();

// Get all products (for current tenant)
router.get('/', authenticate, async (req, res) => {
  try {
    const { search, category, lowStock } = req.query;
    
    const where = {
      tenantId: req.tenantId,
      isActive: true
    };

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
    const product = await prisma.product.findFirst({
      where: {
        id: req.params.id,
        tenantId: req.tenantId
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
    const { name, description, category, barcode, costPrice, sellingPrice, stockQuantity, lowStockThreshold } = req.body;

    const product = await prisma.product.create({
      data: {
        name,
        description,
        category: category || 'PRODUCT',
        barcode,
        costPrice,
        sellingPrice,
        stockQuantity: stockQuantity || 0,
        lowStockThreshold: lowStockThreshold || 10,
        tenantId: req.tenantId
      }
    });

    await logAudit(req.tenantId, req.user.id, 'product_created', `Created product: ${name}`, {
      productId: product.id,
      costPrice,
      sellingPrice
    });

    res.status(201).json({ product });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update product (Admin only)
router.put('/:id', authenticate, requireAdmin, async (req, res) => {
  try {
    const { name, description, costPrice, sellingPrice, stockQuantity, lowStockThreshold, isActive } = req.body;

    const existingProduct = await prisma.product.findFirst({
      where: { id: req.params.id, tenantId: req.tenantId }
    });

    if (!existingProduct) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (costPrice !== undefined) updateData.costPrice = costPrice;
    if (sellingPrice !== undefined) updateData.sellingPrice = sellingPrice;
    if (stockQuantity !== undefined) updateData.stockQuantity = stockQuantity;
    if (lowStockThreshold !== undefined) updateData.lowStockThreshold = lowStockThreshold;
    if (isActive !== undefined) updateData.isActive = isActive;

    const product = await prisma.product.update({
      where: { id: req.params.id },
      data: updateData
    });

    await logAudit(req.tenantId, req.user.id, 'product_updated', `Updated product: ${existingProduct.name}`, {
      productId: product.id,
      changes: updateData
    });

    res.json({ product });
  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get low stock products (Admin only)
router.get('/inventory/low-stock', authenticate, requireAdmin, async (req, res) => {
  try {
    const products = await prisma.$queryRaw`
      SELECT * FROM products 
      WHERE "tenantId" = ${req.tenantId} 
      AND "isActive" = true 
      AND "stockQuantity" <= "lowStockThreshold"
      ORDER BY "stockQuantity" ASC
    `;

    res.json({ products });
  } catch (error) {
    console.error('Get low stock error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
