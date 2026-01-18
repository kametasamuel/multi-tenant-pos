const { body, validationResult } = require('express-validator');

const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Validation rules
const validateLogin = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  handleValidationErrors
];

const validateCreateProduct = [
  body('name').trim().notEmpty().withMessage('Product name is required'),
  body('costPrice').isFloat({ min: 0 }).withMessage('Cost price must be a positive number'),
  body('sellingPrice').isFloat({ min: 0 }).withMessage('Selling price must be a positive number'),
  body('stockQuantity').optional().isInt({ min: 0 }).withMessage('Stock quantity must be a non-negative integer'),
  handleValidationErrors
];

const validateCreateSale = [
  body('items').isArray({ min: 1 }).withMessage('At least one item is required'),
  body('items.*.productId').notEmpty().withMessage('Product ID is required'),
  body('items.*.quantity').isInt({ min: 1 }).withMessage('Quantity must be at least 1'),
  body('paymentMethod').isIn(['CASH', 'MOBILE_MONEY', 'SPLIT_CASH_MOMO']).withMessage('Invalid payment method'),
  handleValidationErrors
];

const validateCreateExpense = [
  body('description').trim().notEmpty().withMessage('Description is required'),
  body('amount').isFloat({ min: 0 }).withMessage('Amount must be a positive number'),
  body('category').trim().notEmpty().withMessage('Category is required'),
  handleValidationErrors
];

const validateCreateUser = [
  body('username').trim().notEmpty().withMessage('Username is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters'),
  body('fullName').trim().notEmpty().withMessage('Full name is required'),
  body('role').isIn(['CASHIER', 'ADMIN']).withMessage('Invalid role'),
  handleValidationErrors
];

// Validation for tenant application signup
const validateSignup = [
  body('businessName').trim().notEmpty().withMessage('Business name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Business name must be 2-100 characters'),
  body('businessEmail').trim().isEmail().withMessage('Valid business email is required')
    .normalizeEmail(),
  body('businessPhone').optional().trim()
    .matches(/^[\d\s\-+()]+$/).withMessage('Invalid phone number format'),
  body('businessAddress').optional().trim()
    .isLength({ max: 500 }).withMessage('Address must be less than 500 characters'),
  body('ownerFullName').trim().notEmpty().withMessage('Owner full name is required')
    .isLength({ min: 2, max: 100 }).withMessage('Owner name must be 2-100 characters'),
  body('ownerEmail').trim().isEmail().withMessage('Valid owner email is required')
    .normalizeEmail(),
  body('ownerPhone').optional().trim()
    .matches(/^[\d\s\-+()]+$/).withMessage('Invalid phone number format'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/).withMessage('Password must contain at least one uppercase letter, one lowercase letter, and one number'),
  handleValidationErrors
];

// Validation for application approval
const validateApproval = [
  body('subscriptionMonths').isInt({ min: 1, max: 60 }).withMessage('Subscription months must be between 1 and 60'),
  handleValidationErrors
];

// Validation for application rejection
const validateRejection = [
  body('reason').trim().notEmpty().withMessage('Rejection reason is required')
    .isLength({ min: 10, max: 500 }).withMessage('Reason must be 10-500 characters'),
  handleValidationErrors
];

// Validation for subscription update
const validateSubscriptionUpdate = [
  body('months').optional().isInt({ min: 1, max: 60 }).withMessage('Months must be between 1 and 60'),
  body('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365'),
  handleValidationErrors
];

// Validation for tenant status update
const validateTenantStatus = [
  body('isActive').isBoolean().withMessage('isActive must be a boolean'),
  handleValidationErrors
];

module.exports = {
  validateLogin,
  validateCreateProduct,
  validateCreateSale,
  validateCreateExpense,
  validateCreateUser,
  validateSignup,
  validateApproval,
  validateRejection,
  validateSubscriptionUpdate,
  validateTenantStatus,
  handleValidationErrors
};
