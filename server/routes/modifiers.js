const express = require('express');
const { PrismaClient } = require('@prisma/client');
const { authenticate, requireAdmin, logAudit } = require('../middleware/auth');
const { body, validationResult } = require('express-validator');

const router = express.Router();
const prisma = new PrismaClient();

// All routes require authentication
router.use(authenticate);

// Validation middleware
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Middleware to check if modifiers are enabled
const requireModifiersFeature = async (req, res, next) => {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: req.tenantId },
      select: { enableModifiers: true, businessType: true }
    });

    if (!tenant) {
      return res.status(404).json({ error: 'Tenant not found' });
    }

    if (!tenant.enableModifiers && tenant.businessType !== 'FOOD_AND_BEVERAGE') {
      return res.status(403).json({ error: 'Product modifiers are not enabled for this business' });
    }

    next();
  } catch (error) {
    console.error('Modifiers feature check error:', error);
    res.status(500).json({ error: 'Failed to check modifiers feature' });
  }
};

// GET /api/products/:productId/modifiers - Get modifiers for a product
router.get('/products/:productId/modifiers', requireModifiersFeature, async (req, res) => {
  try {
    const { productId } = req.params;

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    const modifiers = await prisma.productModifier.findMany({
      where: {
        productId,
        tenantId: req.tenantId,
        isActive: true
      },
      orderBy: { sortOrder: 'asc' }
    });

    // Parse options JSON for each modifier
    const modifiersWithOptions = modifiers.map(mod => ({
      ...mod,
      options: mod.options ? JSON.parse(mod.options) : []
    }));

    res.json({ modifiers: modifiersWithOptions });
  } catch (error) {
    console.error('Get product modifiers error:', error);
    res.status(500).json({ error: 'Failed to get modifiers' });
  }
});

// GET /api/modifiers - Get all modifiers for tenant (admin view)
router.get('/', requireModifiersFeature, requireAdmin, async (req, res) => {
  try {
    const { productId } = req.query;

    const where = {
      tenantId: req.tenantId,
      isActive: true
    };

    if (productId) {
      where.productId = productId;
    }

    const modifiers = await prisma.productModifier.findMany({
      where,
      include: {
        product: {
          select: { id: true, name: true, image: true }
        }
      },
      orderBy: [
        { productId: 'asc' },
        { sortOrder: 'asc' }
      ]
    });

    // Parse options JSON for each modifier
    const modifiersWithOptions = modifiers.map(mod => ({
      ...mod,
      options: mod.options ? JSON.parse(mod.options) : []
    }));

    res.json({ modifiers: modifiersWithOptions });
  } catch (error) {
    console.error('Get all modifiers error:', error);
    res.status(500).json({ error: 'Failed to get modifiers' });
  }
});

// POST /api/products/:productId/modifiers - Create modifier for a product
router.post('/products/:productId/modifiers', requireModifiersFeature, requireAdmin, [
  body('name').trim().notEmpty().withMessage('Modifier name is required'),
  body('type').isIn(['radio', 'checkbox', 'text']).withMessage('Invalid modifier type'),
  body('isRequired').optional().isBoolean(),
  body('options').optional().isArray(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { productId } = req.params;
    const { name, type, isRequired, options, sortOrder } = req.body;

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Get next sort order if not provided
    let actualSortOrder = sortOrder;
    if (actualSortOrder === undefined) {
      const lastModifier = await prisma.productModifier.findFirst({
        where: { productId, tenantId: req.tenantId },
        orderBy: { sortOrder: 'desc' }
      });
      actualSortOrder = (lastModifier?.sortOrder || 0) + 1;
    }

    // Validate options for non-text types
    if (type !== 'text' && (!options || options.length === 0)) {
      return res.status(400).json({ error: 'Options are required for radio and checkbox modifiers' });
    }

    const modifier = await prisma.productModifier.create({
      data: {
        name,
        type,
        isRequired: isRequired || false,
        sortOrder: actualSortOrder,
        options: options ? JSON.stringify(options) : '[]',
        productId,
        tenantId: req.tenantId
      }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'modifier_created',
      `Created modifier "${name}" for product "${product.name}"`,
      { modifierId: modifier.id, productId }
    );

    res.status(201).json({
      modifier: {
        ...modifier,
        options: options || []
      }
    });
  } catch (error) {
    console.error('Create modifier error:', error);
    res.status(500).json({ error: 'Failed to create modifier' });
  }
});

// PUT /api/modifiers/:id - Update a modifier
router.put('/:id', requireModifiersFeature, requireAdmin, [
  body('name').optional().trim().notEmpty().withMessage('Modifier name cannot be empty'),
  body('type').optional().isIn(['radio', 'checkbox', 'text']).withMessage('Invalid modifier type'),
  body('isRequired').optional().isBoolean(),
  body('options').optional().isArray(),
  body('sortOrder').optional().isInt({ min: 0 }),
  body('isActive').optional().isBoolean(),
  handleValidationErrors
], async (req, res) => {
  try {
    const { id } = req.params;
    const { name, type, isRequired, options, sortOrder, isActive } = req.body;

    // Verify modifier belongs to tenant
    const existingModifier = await prisma.productModifier.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        product: {
          select: { name: true }
        }
      }
    });

    if (!existingModifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (type !== undefined) updateData.type = type;
    if (isRequired !== undefined) updateData.isRequired = isRequired;
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder;
    if (isActive !== undefined) updateData.isActive = isActive;
    if (options !== undefined) updateData.options = JSON.stringify(options);

    const modifier = await prisma.productModifier.update({
      where: { id },
      data: updateData
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'modifier_updated',
      `Updated modifier "${existingModifier.name}" for product "${existingModifier.product.name}"`,
      { modifierId: id, changes: updateData }
    );

    res.json({
      modifier: {
        ...modifier,
        options: modifier.options ? JSON.parse(modifier.options) : []
      }
    });
  } catch (error) {
    console.error('Update modifier error:', error);
    res.status(500).json({ error: 'Failed to update modifier' });
  }
});

// DELETE /api/modifiers/:id - Delete a modifier (soft delete)
router.delete('/:id', requireModifiersFeature, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;

    // Verify modifier belongs to tenant
    const modifier = await prisma.productModifier.findFirst({
      where: { id, tenantId: req.tenantId },
      include: {
        product: {
          select: { name: true }
        }
      }
    });

    if (!modifier) {
      return res.status(404).json({ error: 'Modifier not found' });
    }

    // Soft delete
    await prisma.productModifier.update({
      where: { id },
      data: { isActive: false }
    });

    await logAudit(
      req.tenantId,
      req.user.id,
      'modifier_deleted',
      `Deleted modifier "${modifier.name}" from product "${modifier.product.name}"`,
      { modifierId: id }
    );

    res.json({ message: 'Modifier deleted successfully' });
  } catch (error) {
    console.error('Delete modifier error:', error);
    res.status(500).json({ error: 'Failed to delete modifier' });
  }
});

// POST /api/modifiers/reorder - Reorder modifiers for a product
router.post('/reorder', requireModifiersFeature, requireAdmin, [
  body('productId').notEmpty().withMessage('Product ID is required'),
  body('modifierIds').isArray({ min: 1 }).withMessage('Modifier IDs array is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { productId, modifierIds } = req.body;

    // Verify product belongs to tenant
    const product = await prisma.product.findFirst({
      where: { id: productId, tenantId: req.tenantId }
    });

    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Update sort orders
    await Promise.all(
      modifierIds.map((id, index) =>
        prisma.productModifier.updateMany({
          where: { id, productId, tenantId: req.tenantId },
          data: { sortOrder: index }
        })
      )
    );

    res.json({ message: 'Modifiers reordered successfully' });
  } catch (error) {
    console.error('Reorder modifiers error:', error);
    res.status(500).json({ error: 'Failed to reorder modifiers' });
  }
});

// POST /api/modifiers/copy - Copy modifiers from one product to another
router.post('/copy', requireModifiersFeature, requireAdmin, [
  body('sourceProductId').notEmpty().withMessage('Source product ID is required'),
  body('targetProductId').notEmpty().withMessage('Target product ID is required'),
  handleValidationErrors
], async (req, res) => {
  try {
    const { sourceProductId, targetProductId } = req.body;

    // Verify both products belong to tenant
    const [sourceProduct, targetProduct] = await Promise.all([
      prisma.product.findFirst({ where: { id: sourceProductId, tenantId: req.tenantId } }),
      prisma.product.findFirst({ where: { id: targetProductId, tenantId: req.tenantId } })
    ]);

    if (!sourceProduct) {
      return res.status(404).json({ error: 'Source product not found' });
    }

    if (!targetProduct) {
      return res.status(404).json({ error: 'Target product not found' });
    }

    // Get source modifiers
    const sourceModifiers = await prisma.productModifier.findMany({
      where: { productId: sourceProductId, tenantId: req.tenantId, isActive: true }
    });

    if (sourceModifiers.length === 0) {
      return res.status(400).json({ error: 'Source product has no modifiers to copy' });
    }

    // Create copies for target product
    const createdModifiers = await Promise.all(
      sourceModifiers.map(mod =>
        prisma.productModifier.create({
          data: {
            name: mod.name,
            type: mod.type,
            isRequired: mod.isRequired,
            sortOrder: mod.sortOrder,
            options: mod.options,
            productId: targetProductId,
            tenantId: req.tenantId
          }
        })
      )
    );

    await logAudit(
      req.tenantId,
      req.user.id,
      'modifiers_copied',
      `Copied ${createdModifiers.length} modifiers from "${sourceProduct.name}" to "${targetProduct.name}"`,
      { sourceProductId, targetProductId, count: createdModifiers.length }
    );

    res.status(201).json({
      message: `Copied ${createdModifiers.length} modifiers`,
      modifiers: createdModifiers.map(mod => ({
        ...mod,
        options: mod.options ? JSON.parse(mod.options) : []
      }))
    });
  } catch (error) {
    console.error('Copy modifiers error:', error);
    res.status(500).json({ error: 'Failed to copy modifiers' });
  }
});

module.exports = router;
