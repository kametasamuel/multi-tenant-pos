const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const { authenticate, requireOwner, requireManager } = require('../middleware/auth');
const { body, param, query, validationResult } = require('express-validator');

router.use(authenticate);

const handleValidation = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ error: errors.array()[0].msg });
  }
  next();
};

// GET /api/categories - List all categories (with hierarchy)
router.get('/',
    [
    query('flat').optional().isIn(['true', 'false']),
    query('isActive').optional().isIn(['true', 'false'])
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { flat, isActive } = req.query;

      const where = { tenantId: req.user.tenantId };
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const categories = await prisma.productCategory.findMany({
        where,
        orderBy: [
          { sortOrder: 'asc' },
          { name: 'asc' }
        ],
        include: {
          _count: {
            select: { products: true, children: true }
          }
        }
      });

      // Return flat list if requested
      if (flat === 'true') {
        return res.json(categories);
      }

      // Build hierarchical tree
      const categoryMap = new Map(categories.map(c => [c.id, { ...c, children: [] }]));
      const tree = [];

      for (const category of categories) {
        const node = categoryMap.get(category.id);
        if (category.parentId && categoryMap.has(category.parentId)) {
          categoryMap.get(category.parentId).children.push(node);
        } else {
          tree.push(node);
        }
      }

      res.json(tree);
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({ error: 'Failed to fetch categories' });
    }
  }
);

// GET /api/categories/:id - Get single category with products
router.get('/:id',
    [param('id').isUUID()],
  handleValidation,
  async (req, res) => {
    try {
      const category = await prisma.productCategory.findFirst({
        where: {
          id: req.params.id,
          tenantId: req.user.tenantId
        },
        include: {
          parent: { select: { id: true, name: true } },
          children: {
            select: { id: true, name: true, isActive: true },
            orderBy: { sortOrder: 'asc' }
          },
          products: {
            take: 20,
            orderBy: { name: 'asc' },
            select: {
              id: true,
              name: true,
              sku: true,
              sellingPrice: true,
              stockQuantity: true,
              isActive: true
            }
          },
          _count: { select: { products: true } }
        }
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      res.json(category);
    } catch (error) {
      console.error('Error fetching category:', error);
      res.status(500).json({ error: 'Failed to fetch category' });
    }
  }
);

// POST /api/categories - Create new category
router.post('/',
  requireManager,
  [
    body('name').trim().notEmpty().withMessage('Category name is required'),
    body('description').optional().trim(),
    body('parentId').optional().isUUID(),
    body('sortOrder').optional().isInt({ min: 0 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { name, description, parentId, sortOrder } = req.body;

      // Check for duplicate name at same level
      const existing = await prisma.productCategory.findFirst({
        where: {
          tenantId: req.user.tenantId,
          name: { equals: name, mode: 'insensitive' },
          parentId: parentId || null
        }
      });

      if (existing) {
        return res.status(400).json({ error: 'A category with this name already exists at this level' });
      }

      // Verify parent exists if specified
      if (parentId) {
        const parent = await prisma.productCategory.findFirst({
          where: { id: parentId, tenantId: req.user.tenantId }
        });
        if (!parent) {
          return res.status(400).json({ error: 'Parent category not found' });
        }
      }

      const category = await prisma.productCategory.create({
        data: {
          name,
          description,
          parentId,
          sortOrder: sortOrder || 0,
          tenantId: req.user.tenantId
        },
        include: {
          parent: { select: { id: true, name: true } }
        }
      });

      await prisma.auditLog.create({
        data: {
          action: 'category_created',
          description: `Created category: ${name}`,
          userId: req.user.id,
          tenantId: req.user.tenantId,
          branchId: req.user.branchId
        }
      });

      res.status(201).json(category);
    } catch (error) {
      console.error('Error creating category:', error);
      res.status(500).json({ error: 'Failed to create category' });
    }
  }
);

// PUT /api/categories/:id - Update category
router.put('/:id',
  requireManager,
  [
    param('id').isUUID(),
    body('name').optional().trim().notEmpty(),
    body('description').optional().trim(),
    body('parentId').optional(),
    body('sortOrder').optional().isInt({ min: 0 }),
    body('isActive').optional().isBoolean()
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { name, description, parentId, sortOrder, isActive } = req.body;

      const category = await prisma.productCategory.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId }
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      // Can't set self as parent
      if (parentId === category.id) {
        return res.status(400).json({ error: 'Category cannot be its own parent' });
      }

      // Check for duplicate name if changing
      if (name && name !== category.name) {
        const checkParentId = parentId !== undefined ? parentId : category.parentId;
        const existing = await prisma.productCategory.findFirst({
          where: {
            tenantId: req.user.tenantId,
            name: { equals: name, mode: 'insensitive' },
            parentId: checkParentId,
            id: { not: category.id }
          }
        });

        if (existing) {
          return res.status(400).json({ error: 'A category with this name already exists at this level' });
        }
      }

      // Verify new parent if changing
      if (parentId !== undefined && parentId !== category.parentId && parentId !== null) {
        const parent = await prisma.productCategory.findFirst({
          where: { id: parentId, tenantId: req.user.tenantId }
        });
        if (!parent) {
          return res.status(400).json({ error: 'Parent category not found' });
        }

        // Prevent circular reference
        let checkId = parentId;
        while (checkId) {
          if (checkId === category.id) {
            return res.status(400).json({ error: 'Cannot create circular category hierarchy' });
          }
          const checkCat = await prisma.productCategory.findUnique({ where: { id: checkId } });
          checkId = checkCat?.parentId;
        }
      }

      const updated = await prisma.productCategory.update({
        where: { id: category.id },
        data: {
          ...(name !== undefined && { name }),
          ...(description !== undefined && { description }),
          ...(parentId !== undefined && { parentId }),
          ...(sortOrder !== undefined && { sortOrder }),
          ...(isActive !== undefined && { isActive })
        },
        include: {
          parent: { select: { id: true, name: true } },
          _count: { select: { products: true, children: true } }
        }
      });

      res.json(updated);
    } catch (error) {
      console.error('Error updating category:', error);
      res.status(500).json({ error: 'Failed to update category' });
    }
  }
);

// DELETE /api/categories/:id - Delete category
router.delete('/:id',
  requireOwner,
  [param('id').isUUID()],
  handleValidation,
  async (req, res) => {
    try {
      const category = await prisma.productCategory.findFirst({
        where: { id: req.params.id, tenantId: req.user.tenantId },
        include: {
          _count: { select: { products: true, children: true } }
        }
      });

      if (!category) {
        return res.status(404).json({ error: 'Category not found' });
      }

      if (category._count.products > 0) {
        return res.status(400).json({
          error: `Cannot delete category with ${category._count.products} product(s). Move or delete products first.`
        });
      }

      if (category._count.children > 0) {
        return res.status(400).json({
          error: `Cannot delete category with ${category._count.children} subcategory(ies). Delete subcategories first.`
        });
      }

      await prisma.productCategory.delete({
        where: { id: category.id }
      });

      await prisma.auditLog.create({
        data: {
          action: 'category_deleted',
          description: `Deleted category: ${category.name}`,
          userId: req.user.id,
          tenantId: req.user.tenantId,
          branchId: req.user.branchId
        }
      });

      res.json({ message: 'Category deleted successfully' });
    } catch (error) {
      console.error('Error deleting category:', error);
      res.status(500).json({ error: 'Failed to delete category' });
    }
  }
);

// PUT /api/categories/reorder - Reorder categories
router.put('/reorder',
  requireManager,
  [
    body('categories').isArray({ min: 1 }),
    body('categories.*.id').isUUID(),
    body('categories.*.sortOrder').isInt({ min: 0 })
  ],
  handleValidation,
  async (req, res) => {
    try {
      const { categories } = req.body;

      // Verify all categories belong to tenant
      const categoryIds = categories.map(c => c.id);
      const existing = await prisma.productCategory.findMany({
        where: {
          id: { in: categoryIds },
          tenantId: req.user.tenantId
        }
      });

      if (existing.length !== categoryIds.length) {
        return res.status(400).json({ error: 'One or more categories not found' });
      }

      // Update sort orders
      await prisma.$transaction(
        categories.map(cat =>
          prisma.productCategory.update({
            where: { id: cat.id },
            data: { sortOrder: cat.sortOrder }
          })
        )
      );

      res.json({ message: 'Categories reordered successfully' });
    } catch (error) {
      console.error('Error reordering categories:', error);
      res.status(500).json({ error: 'Failed to reorder categories' });
    }
  }
);

module.exports = router;
